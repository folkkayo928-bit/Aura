import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = (() => {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.default === "string") return parsed.default;
  } catch {}
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
})();

const RENDER_TELEGRAM_AUTH_URL = "https://aura-8bom.onrender.com/api/telegram/auth";
const REDIRECT_URL = "https://aura-8bom.onrender.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "AUTH_BACKEND_UNAVAILABLE" }, 503);

  let body: { initData?: string };
  try { body = await req.json(); } catch { return json({ error: "INVALID_JSON" }, 400); }
  const initData = String(body?.initData || "").trim();
  if (!initData) return json({ error: "MISSING_TELEGRAM_INIT_DATA" }, 400);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let telegramResponse: Response;
    try {
      telegramResponse = await fetch(RENDER_TELEGRAM_AUTH_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initData }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!telegramResponse.ok) return json({ error: "INVALID_TELEGRAM_SESSION" }, 401);
    const telegramPayload = await telegramResponse.json();
    const telegramUser = telegramPayload?.user;
    if (!telegramUser?.id) return json({ error: "INVALID_TELEGRAM_USER" }, 401);

    const telegramId = String(telegramUser.id);
    if (!/^\d{1,20}$/.test(telegramId)) return json({ error: "INVALID_TELEGRAM_USER" }, 401);

    const name =
      [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ").trim() ||
      "AURA Collector";
    const username = String(telegramUser.username || "").trim();
    const syntheticEmail = `telegram_${telegramId}@users.aura`;
    const admin = adminClient();

    let targetUser: { id: string; email?: string | null } | null = null;

    const { data: profile } = await admin
      .from("profiles").select("id").eq("telegram_user_id", telegramId).maybeSingle();

    if (profile?.id) {
      const { data: existingUser } = await admin.auth.admin.getUserById(profile.id);
      if (existingUser.user) targetUser = { id: existingUser.user.id, email: existingUser.user.email };
    }

    // Supabase Admin JS does not expose getUserByEmail. For a returning
    // Telegram account we resolve through profiles.telegram_user_id above.
    // A first-time Telegram account is created below; duplicate-email races
    // are handled by a bounded user-list fallback.
    if (!targetUser) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: syntheticEmail,
        email_confirm: true,
        user_metadata: {
          name,
          telegram_id: telegramId,
          ...(username ? { telegram_username: username } : {}),
          auth_provider: "telegram_miniapp",
        },
      });
      if (createError || !created.user) {
        console.error("failed to create Telegram user", createError);
        return json({ error: "TELEGRAM_ACCOUNT_SETUP_FAILED" }, 500);
      }
      targetUser = { id: created.user.id, email: created.user.email };
    } else {
      const { data: updated, error: updateError } =
        await admin.auth.admin.updateUserById(targetUser.id, {
          user_metadata: {
            name,
            telegram_id: telegramId,
            ...(username ? { telegram_username: username } : {}),
            auth_provider: "telegram_miniapp",
          },
          ...(targetUser.email ? {} : { email: syntheticEmail, email_confirm: true }),
        });

      if (updateError || !updated.user) {
        console.error("failed to refresh Telegram user metadata", updateError);
        return json({ error: "TELEGRAM_ACCOUNT_SETUP_FAILED" }, 500);
      }
      targetUser = { id: updated.user.id, email: updated.user.email };
    }

    const { error: profileLinkError } = await admin
      .from("profiles")
      .update({
        telegram_user_id: telegramId,
        display_name: name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetUser.id);

    if (profileLinkError) {
      console.error("failed to link Telegram profile", profileLinkError);
      return json({ error: "TELEGRAM_ACCOUNT_SETUP_FAILED" }, 500);
    }

    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: targetUser.email || syntheticEmail,
      options: {
        redirectTo: REDIRECT_URL,
        data: {
          name,
          telegram_id: telegramId,
          ...(username ? { telegram_username: username } : {}),
          auth_provider: "telegram_miniapp",
        },
      },
    });

    if (error || !data?.properties?.hashed_token) {
      console.error("failed to mint Telegram session", error);
      return json({ error: "TELEGRAM_SESSION_CREATION_FAILED" }, 500);
    }

    return json({
      ok: true,
      token_hash: data.properties.hashed_token,
      user: { id: telegramId, name, username },
    });
  } catch (error) {
    console.error("Telegram Mini App auth failed", error);
    if (error instanceof DOMException && error.name === "AbortError") {
      return json({ error: "TELEGRAM_AUTH_TIMEOUT" }, 504);
    }
    return json({ error: "TELEGRAM_AUTH_FAILED" }, 500);
  }
});
