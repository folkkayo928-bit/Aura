import { createClient } from "npm:@supabase/supabase-js@2";

function secretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  try { return JSON.parse(raw).default as string; }
  catch { return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""; }
}
function db() {
  return createClient(Deno.env.get("SUPABASE_URL")!, secretKey());
}
async function authorized(client: ReturnType<typeof db>, req: Request) {
  const provided = req.headers.get("x-aura-worker-secret") || "";
  const { data, error } = await client.rpc("get_aura_worker_secret");
  return !error && !!data && provided.length > 0 && provided === data;
}
function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  const client = db();
  if (!(await authorized(client, req))) return json({ error: "UNAUTHORIZED" }, 401);

  const { data: notifications, error } = await client.rpc("claim_aura_telegram_notifications", { p_limit: 50 });
  if (error) {
    console.error("Unable to claim Telegram notifications", error);
    return json({ error: "QUEUE_READ_FAILED" }, 500);
  }

  const items = Array.isArray(notifications) ? notifications : [];
  let sent = 0, failed = 0, skipped = 0;
  const { data: notifySecret, error: notifySecretError } = await client.rpc("get_aura_telegram_notify_secret");
  if (notifySecretError || !notifySecret) {
    for (const item of items) {
      await client.rpc("complete_aura_telegram_notification", {
        p_id: item.id, p_success: false, p_error: "TELEGRAM_NOTIFY_TRANSPORT_NOT_CONFIGURED",
      });
    }
    return json({ ok: true, ready: false, sent: 0, failed: items.length, reason: "TELEGRAM_NOTIFY_TRANSPORT_NOT_CONFIGURED" });
  }

  for (const item of items) {
    const chatId = String(item.telegram_user_id || "").trim();
    if (!/^\d{1,20}$/.test(chatId)) {
      await client.rpc("complete_aura_telegram_notification", {
        p_id: item.id, p_success: false, p_error: "TELEGRAM_ID_NOT_LINKED",
      });
      skipped++;
      continue;
    }

    try {
      const response = await fetch("https://aura-8bom.onrender.com/api/internal/telegram/withdrawal-notify", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-aura-telegram-notify-secret": String(notifySecret),
        },
        body: JSON.stringify({
          telegram_user_id: chatId,
          title: String(item.title || "AURA update"),
          message: String(item.message || "Your AURA activity has changed."),
        }),
        signal: AbortSignal.timeout(8000),
      });
      const result = await response.json().catch(() => ({}));
      const delivered = response.ok && result?.ok === true && result?.sent === true;
      await client.rpc("complete_aura_telegram_notification", {
        p_id: item.id,
        p_success: delivered,
        p_error: delivered ? null : String(result?.error || `TELEGRAM_HTTP_${response.status}`),
      });
      if (delivered) sent++; else failed++;
    } catch (error) {
      await client.rpc("complete_aura_telegram_notification", {
        p_id: item.id,
        p_success: false,
        p_error: String(error instanceof Error ? error.message : error).slice(0, 500),
      });
      failed++;
    }
  }

  return json({ ok: true, claimed: items.length, sent, failed, skipped });
});
