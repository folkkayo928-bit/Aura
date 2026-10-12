import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

import { validateAddress } from "../_shared/multichain-address-validation.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "METHOD_NOT_ALLOWED" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = req.headers.get("Authorization");
  if (!supabaseUrl || !anonKey) return json({ success: false, error: "SERVICE_UNAVAILABLE" }, 503);
  if (!authorization?.startsWith("Bearer ")) return json({ success: false, error: "AUTH_REQUIRED" }, 401);

  try {
    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return json({ success: false, error: "AUTH_REQUIRED" }, 401);

    let body: unknown;
    try { body = await req.json(); } catch { return json({ success: false, error: "INVALID_JSON" }, 400); }
    if (!body || typeof body !== "object") return json({ success: false, error: "INVALID_REQUEST" }, 400);

    const request = body as Record<string, unknown>;
    if (typeof request.network !== "string" || typeof request.address !== "string") {
      return json({ success: false, error: "NETWORK_AND_ADDRESS_REQUIRED" }, 400);
    }
    const network = request.network.trim().toLowerCase();
    const address = request.address.trim();
    if (address.length < 8 || address.length > 160) {
      return json({ success: false, error: "INVALID_ADDRESS_LENGTH" }, 400);
    }

    try {
      const normalizedAddress = validateAddress(network, address);
      return json({
        success: true,
        network,
        normalizedAddress,
        validation: "format_only",
        message: "Address format is valid. This does not prove wallet ownership, confirm token support, or verify that a transfer can be sent.",
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "INVALID_ADDRESS";
      const status = code === "UNSUPPORTED_NETWORK" ? 400 : 422;
      return json({ success: false, error: code }, status);
    }
  } catch {
    return json({ success: false, error: "VALIDATION_FAILED" }, 400);
  }
});
