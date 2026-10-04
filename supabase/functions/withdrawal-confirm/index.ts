import { createClient } from "npm:@supabase/supabase-js@2";

function publicKey() {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "";
  try { return JSON.parse(raw).default as string; } catch { return Deno.env.get("SUPABASE_ANON_KEY") || ""; }
}

Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const appUrl = Deno.env.get("AURA_APP_URL") || "https://aura-3idc.netlify.app";
  const token = req.method === "GET"
    ? new URL(req.url).searchParams.get("token")
    : String((await req.json().catch(() => ({}))).token || "");

  if (!token) return Response.redirect(`${appUrl}/?withdrawal=error&reason=missing_token`, 303);

  const client = createClient(url, publicKey());
  const { data, error } = await client.rpc("confirm_wallet_withdrawal", { p_token: token });
  if (error || !data?.withdrawal_id) {
    return Response.redirect(`${appUrl}/?withdrawal=error&reason=invalid_or_expired`, 303);
  }

  return Response.redirect(
    `${appUrl}/?withdrawal=confirmed&id=${encodeURIComponent(data.withdrawal_id)}`,
    303,
  );
});