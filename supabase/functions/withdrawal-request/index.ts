import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function publicKey() {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "";
  try { return JSON.parse(raw).default as string; } catch { return Deno.env.get("SUPABASE_ANON_KEY") || ""; }
}
function secretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  try { return JSON.parse(raw).default as string; } catch { return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""; }
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

    const { data: authUser, error: adminUserError } = await adminClient.auth.admin.getUserById(userData.user.id);
    const email = authUser?.user?.email;
    if (adminUserError || !email) {
      await userClient.rpc("cancel_wallet_withdrawal", { p_withdrawal_id: withdrawal.id });
      return json({ error: "ACCOUNT_EMAIL_UNAVAILABLE" }, 409);
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("RESEND_FROM_EMAIL");
    const appUrl = Deno.env.get("AURA_APP_URL") || "https://aura-3idc.netlify.app";
    if (!resendKey || !from) {
      await userClient.rpc("cancel_wallet_withdrawal", { p_withdrawal_id: withdrawal.id });
      return json({ error: "EMAIL_PROVIDER_NOT_CONFIGURED" }, 503);
    }

    const confirmUrl = `${url}/functions/v1/withdrawal-confirm?token=${encodeURIComponent(String(confirmation.token))}`;
    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#0b0b10;color:#f5f5f4;padding:32px">
      <div style="max-width:560px;margin:auto;background:#15151c;border:1px solid #292933;border-radius:20px;padding:28px">
        <h2 style="margin-top:0">Confirm your AURA withdrawal</h2>
        <p>A withdrawal request was created for <strong>${amount.toFixed(6)} USDT</strong> on <strong>${chain.toUpperCase()}</strong>.</p>
        <p>Destination: <code>${destinationAddress}</code></p>
        <p>Your funds are already reserved, but nothing will be broadcast to the blockchain until you confirm this email.</p>
        <p><a href="${confirmUrl}" style="display:inline-block;padding:13px 18px;background:#fbbf24;color:#111;border-radius:12px;text-decoration:none;font-weight:700">Confirm withdrawal</a></p>
        <p style="font-size:12px;color:#a8a29e">This confirmation expires in 30 minutes. If you did not request this withdrawal, ignore this email and cancel the reservation from AURA.</p>
      </div>
    </body></html>`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Confirm your AURA withdrawal",
        html,
        headers: { "X-Entity-Ref-ID": `aura-withdrawal-${withdrawal.id}` },
      }),
    });

    if (!emailResponse.ok) {
      const detail = await emailResponse.text();
      await userClient.rpc("cancel_wallet_withdrawal", { p_withdrawal_id: withdrawal.id });
      console.error("Resend rejected withdrawal email", detail.slice(0, 1000));
      return json({ error: "EMAIL_DELIVERY_FAILED" }, 502);
    }

    return json({
      success: true,
      withdrawal: {
        id: withdrawal.id,
        status: withdrawal.status,
        emailConfirmationExpiresAt: confirmation.expires_at,
      },
    });
  } catch (error) {
    console.error("withdrawal-request failed", error);
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});