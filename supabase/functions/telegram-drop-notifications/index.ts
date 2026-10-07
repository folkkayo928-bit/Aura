import { createClient } from "npm:@supabase/supabase-js@2";

const RENDER_NOTIFY_URL = "https://aura-8bom.onrender.com/api/internal/telegram/drop-notify";

function secretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  try { return JSON.parse(raw).default as string; }
  catch { return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""; }
}
function db() {
  return createClient(Deno.env.get("SUPABASE_URL")!, secretKey());
}
async function workerAuthorized(client: ReturnType<typeof db>, req: Request) {
  const provided = req.headers.get("x-aura-worker-secret") || "";
  const { data, error } = await client.rpc("get_aura_worker_secret");
  return !error && !!data && provided.length > 0 && provided === data;
}
function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const client = db();
  if (!(await workerAuthorized(client, req))) return json({ error: "UNAUTHORIZED" }, 401);

  const { data: notifySecret, error: secretError } = await client.rpc("get_aura_telegram_notify_secret");
  if (secretError || !notifySecret) {
    return json({ ok: true, ready: false, skipped: true, reason: "TELEGRAM_NOTIFY_TRANSPORT_NOT_CONFIGURED" });
  }

  try {
    const { data: reminders, error } = await client
      .from("aura_drop_reminders")
      .select("drop_id,user_id,telegram_prealert_sent_at,telegram_live_sent_at,profiles:user_id(telegram_user_id,telegram_bot_alerts),aura_drops:drop_id(id,title,description,status,scheduled_at)")
      .or("telegram_prealert_sent_at.is.null,telegram_live_sent_at.is.null")
      .limit(200);

    if (error) throw error;

    const now = Date.now();
    const prealert: any[] = [];
    const live: any[] = [];

    for (const reminder of reminders || []) {
      const profile = Array.isArray(reminder.profiles) ? reminder.profiles[0] : reminder.profiles;
      const drop = Array.isArray(reminder.aura_drops) ? reminder.aura_drops[0] : reminder.aura_drops;
      const telegramUserId = String(profile?.telegram_user_id || "").trim();
      if (!profile?.telegram_bot_alerts || !/^\\d{1,20}$/.test(telegramUserId) || !drop) continue;

      if (drop.status === "live" && !reminder.telegram_live_sent_at) {
        live.push({
          id: `${reminder.drop_id}:${reminder.user_id}:live`,
          user_id: reminder.user_id,
          drop_id: reminder.drop_id,
          telegram_user_id: telegramUserId,
          title: drop.title,
          message: drop.description || "The drop you saved is now live in AURA.",
        });
        continue;
      }

      if (drop.status === "scheduled" && !reminder.telegram_prealert_sent_at && drop.scheduled_at) {
        const scheduled = new Date(drop.scheduled_at).getTime();
        if (Number.isFinite(scheduled) && scheduled > now && scheduled <= now + 15 * 60 * 1000) {
          prealert.push({
            id: `${reminder.drop_id}:${reminder.user_id}:pre`,
            user_id: reminder.user_id,
            drop_id: reminder.drop_id,
            telegram_user_id: telegramUserId,
            title: drop.title,
            message: "Your saved drop starts within 15 minutes.",
          });
        }
      }
    }

    const deliver = async (items: any[]) => {
      if (!items.length) return { sent: 0, failed: 0 };
      const response = await fetch(RENDER_NOTIFY_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-aura-telegram-notify-secret": String(notifySecret),
        },
        body: JSON.stringify({
          items: items.map((item) => ({
            id: item.id,
            telegram_user_id: item.telegram_user_id,
            title: item.title,
            message: item.message,
          })),
        }),
      });
      if (!response.ok) throw new Error("TELEGRAM_TRANSPORT_HTTP_" + response.status);
      return await response.json() as { sent?: number; failed?: number; sent_ids?: string[] };
    };

    const preResult = await deliver(prealert);
    const liveResult = await deliver(live);
    const successfulPre = preResult.sent || 0;
    const successfulLive = liveResult.sent || 0;
    const preSentIds = new Set(preResult.sent_ids || []);
    const liveSentIds = new Set(liveResult.sent_ids || []);

    for (const item of prealert.filter((item) => preSentIds.has(item.id))) {
      await client.from("aura_drop_reminders")
        .update({ telegram_prealert_sent_at: new Date().toISOString() })
        .eq("drop_id", item.drop_id).eq("user_id", item.user_id).is("telegram_prealert_sent_at", null);
    }
    for (const item of live.filter((item) => liveSentIds.has(item.id))) {
      await client.from("aura_drop_reminders")
        .update({ telegram_live_sent_at: new Date().toISOString() })
        .eq("drop_id", item.drop_id).eq("user_id", item.user_id).is("telegram_live_sent_at", null);
    }

    return json({
      ok: true,
      ready: true,
      queued_prealerts: prealert.length,
      queued_live: live.length,
      sent_prealerts: successfulPre,
      sent_live: successfulLive,
      failed: Number(preResult.failed || 0) + Number(liveResult.failed || 0),
    });
  } catch (error) {
    console.error("telegram-drop-notifications failed", error);
    return json({ ok: false, error: "TELEGRAM_DROP_NOTIFICATION_ERROR" }, 500);
  }
});
