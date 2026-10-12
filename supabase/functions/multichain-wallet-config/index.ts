import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ success: false, error: "METHOD_NOT_ALLOWED" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return json({ success: false, error: "WALLET_CONFIG_UNAVAILABLE" }, 503);
  }

  try {
    // This endpoint deliberately uses only the public/anon key. RLS exposes
    // enabled registry rows only; no secrets or user data are returned.
    const client = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [networkResult, assetResult] = await Promise.all([
      client
        .from("wallet_network_registry")
        .select("network_key,family,display_name,chain_id,native_symbol,min_confirmations,enabled_for_receive,enabled_for_send")
        .or("enabled_for_receive.eq.true,enabled_for_send.eq.true")
        .order("network_key"),
      client
        .from("wallet_asset_registry")
        .select("asset_key,network_key,symbol,display_name,token_standard,token_address,decimals,enabled")
        .eq("enabled", true)
        .order("network_key"),
    ]);

    if (networkResult.error || assetResult.error) {
      // Avoid leaking database schema details to public callers.
      return json({ success: false, error: "WALLET_CONFIG_UNAVAILABLE" }, 503);
    }

    const networks = networkResult.data ?? [];
    const assets = assetResult.data ?? [];
    const required = ["ethereum", "bsc", "solana", "ton"];
    const enabledUsdtNetworks = new Set(
      assets.filter((asset) => asset.symbol === "USDT").map((asset) => asset.network_key),
    );
    const ready = required.every((key) =>
      networks.some((network) =>
        network.network_key === key &&
        network.enabled_for_receive &&
        network.enabled_for_send &&
        enabledUsdtNetworks.has(key)
      )
    );

    return json({
      success: true,
      ready,
      targetNetworks: required,
      enabledNetworkCount: networks.length,
      networks,
      assets,
      message: ready
        ? "All four target networks are enabled in the registry. This reports configuration only; it does not certify live RPC or transaction health."
        : "Multichain USDT is not fully enabled. A network is listed only after the backend registry enables it.",
    });
  } catch {
    return json({ success: false, error: "WALLET_CONFIG_UNAVAILABLE" }, 503);
  }
});
