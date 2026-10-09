import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function publicKey() {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "";
  try { return JSON.parse(raw).default as string; } catch { return Deno.env.get("SUPABASE_ANON_KEY") || ""; }
}

function secretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  try { return JSON.parse(raw).default as string; } catch { return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""; }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  }[char] || char));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "AUTH_REQUIRED" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, publicKey(), { global: { headers: { Authorization: auth } } });
  const adminClient = createClient(url, secretKey());

  try {
    const body = await req.json();
    const chain = String(body.chain || "").trim().toLowerCase();
    const destinationAddress = String(body.destinationAddress || "").trim();
    const amount = Number(body.amount);
    const networkFee = Number(body.networkFee || 0);

    if (!chain || !destinationAddress || !Number.isFinite(amount) || amount <= 0) {
      return json({ error: "INVALID_WITHDRAWAL_REQUEST" }, 400);
    }
    if (!["ethereum", "polygon", "arbitrum"].includes(chain)) {
      return json({ error: "CHAIN_NOT_YET_SUPPORTED_FOR_REAL_WITHDRAWAL" }, 400);
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(destinationAddress)) {
      return json({ error: "INVALID_EVM_DESTINATION_ADDRESS" }, 400);
    }

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "AUTH_REQUIRED" }, 401);

    const { data: withdrawal, error: withdrawalError } = await userClient.rpc("request_wallet_withdrawal", {
      p_chain: chain,
      p_token_symbol: "USDT",
      p_destination_address: destinationAddress,
      p_amount: amount,
      p_network_fee: Number.isFinite(networkFee) && networkFee >= 0 ? networkFee : 0,
      p_idempotency_key: crypto.randomUUID(),
    });
    if (withdrawalError || !withdrawal) {
      return json({ error: withdrawalError?.message || "WITHDRAWAL_REQUEST_FAILED" }, 400);
    }

    const { data: confirmation, error: confirmationError } = await userClient.rpc("issue_wallet_withdrawal_email_confirmation", {
      p_withdrawal_id: withdrawal.id,
    });
    if (confirmationError || !confirmation?.token) {
      await userClient.rpc("cancel_wallet_withdrawal", { p_withdrawal_id: withdrawal.id });
      return json({ error: confirmationError?.message || "CONFIRMATION_TOKEN_FAILED" }, 500);
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles").select("telegram_user_id").eq("id", userData.user.id).maybeSingle();
    if (profileError) {
      await userClient.rpc("cancel_wallet_withdrawal", { p_withdrawal_id: withdrawal.id });
      return json({ error: "ACCOUNT_NOTIFICATION_SETTINGS_UNAVAILABLE" }, 503);
    }

    const telegramUserId = String(profile?.telegram_user_id || "").trim();
    const confirmUrl = `${url}/functions/v1/withdrawal-confirm?token=${encodeURIComponent(String(confirmation.token))}`;
    let telegramSent = false;
    let telegramError = "";

    // Telegram is the primary confirmation channel for Mini App users.
    // The numeric ID comes from the server-side linked profile, never the request body.
    if (/^\\d{1,20}$/.test(telegramUserId)) {
      const { data: notifySecret, error: notifySecretError } = await adminClient.rpc("get_aura_telegram_notify_secret");
      if (!notifySecretError && notifySecret) {
        try {
          const response = await fetch("https://aura-8bom.onrender.com/api/internal/telegram/withdrawal-notify", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-aura-telegram-notify-secret": String(notifySecret),
            },
            body: JSON.stringify({
              telegram_user_id: telegramUserId,
              title: "Confirm your USDT withdrawal",
              message: `You requested ${amount.toFixed(6)} USDT on ${chain.toUpperCase()}.\\nDestination: ${destinationAddress}\\nYour funds are reserved. Nothing will be sent until you confirm. This link expires in 30 minutes.`,
              confirm_url: confirmUrl,
            }),
            signal: AbortSignal.timeout(10000),
          });
          const result = await response.json().catch(() => ({}));
          telegramSent = response.ok && result?.ok === true && result?.sent === true;
          if (!telegramSent) telegramError = String(result?.error || `TELEGRAM_HTTP_${response.status}`);
        } catch (error) {
          telegramError = String(error instanceof Error ? error.message : error).slice(0, 300);
        }
      } else {
        telegramError = "TELEGRAM_NOTIFY_TRANSPORT_NOT_CONFIGURED";
      }
    }

    // Email is an optional fallback, not a prerequisite for Telegram-linked accounts.
    if (!telegramSent) {
      const { data: authUser, error: adminUserError } = await adminClient.auth.admin.getUserById(userData.user.id);
      const email = authUser?.user?.email;
      const isSyntheticTelegramEmail = String(email || "").toLowerCase().endsWith("@users.aura");
      if (adminUserError || !email || isSyntheticTelegramEmail) {
        await userClient.rpc("cancel_wallet_withdrawal", { p_withdrawal_id: withdrawal.id });
        return json({
          error: telegramError || "NO_CONFIRMATION_CHANNEL",
          message: "Telegram confirmation could not be delivered. Start the AURA bot in Telegram and retry, or add a real email address.",
        }, 409);
      }

      const smtpHost = Deno.env.get("BREVO_SMTP_HOST") || "smtp-relay.brevo.com";
      const smtpPort = Number(Deno.env.get("BREVO_SMTP_PORT") || "587");
      const smtpUser = Deno.env.get("BREVO_SMTP_USER");
      const smtpPassword = Deno.env.get("BREVO_SMTP_PASSWORD");
      const from = Deno.env.get("BREVO_FROM_EMAIL") || "Aura@brevosend.com";
      const fromName = Deno.env.get("BREVO_FROM_NAME") || "AURA";

      if (!smtpUser || !smtpPassword || !from) {
        await userClient.rpc("cancel_wallet_withdrawal", { p_withdrawal_id: withdrawal.id });
        return json({ error: "EMAIL_PROVIDER_NOT_CONFIGURED" }, 503);
      }

      const safeChain = escapeHtml(chain.toUpperCase());
      const safeDestination = escapeHtml(destinationAddress);
      const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#0b0b10;color:#f5f5f4;padding:32px">
        <div style="max-width:560px;margin:auto;background:#15151c;border:1px solid #292933;border-radius:20px;padding:28px">
          <h2 style="margin-top:0">Confirm your AURA withdrawal</h2>
          <p>A withdrawal request was created for <strong>${amount.toFixed(6)} USDT</strong> on <strong>${safeChain}</strong>.</p>
          <p>Destination: <code>${safeDestination}</code></p>
          <p>Your funds are reserved, but nothing will be broadcast until you confirm.</p>
          <p><a href="${confirmUrl}" style="display:inline-block;padding:13px 18px;background:#fbbf24;color:#111;border-radius:12px;text-decoration:none;font-weight:700">Confirm withdrawal</a></p>
          <p style="font-size:12px;color:#a8a29e">This confirmation expires in 30 minutes. If you did not request this withdrawal, do not confirm it.</p>
        </div>
      </body></html>`;

      const transporter = nodemailer.createTransport({
        host: smtpHost, port: smtpPort, secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPassword },
        connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
      });
      try {
        await transporter.sendMail({
          from: `"${fromName}" <${from}>`,
          to: email,
          subject: "Confirm your AURA withdrawal",
          html,
          headers: { "X-Entity-Ref-ID": `aura-withdrawal-${withdrawal.id}` },
        });
      } catch (mailError) {
        await userClient.rpc("cancel_wallet_withdrawal", { p_withdrawal_id: withdrawal.id });
        console.error("Withdrawal email fallback failed", String(mailError).slice(0, 1000));
        return json({ error: "CONFIRMATION_DELIVERY_FAILED" }, 502);
      } finally {
        try { transporter.close(); } catch { /* best effort */ }
      }
    }

    return json({
      success: true,
      confirmationChannel: telegramSent ? "telegram" : "email",
      telegramFallbackReason: telegramSent ? undefined : telegramError || undefined,
      withdrawal: {
        id: withdrawal.id,
        status: withdrawal.status,
        confirmationExpiresAt: confirmation.expires_at,
      },
    });
  } catch (error) {
    console.error("withdrawal-request failed", error);
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});
