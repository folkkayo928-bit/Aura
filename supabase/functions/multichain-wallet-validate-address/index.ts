import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getAddress } from "npm:ethers@6.15.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

function decodeBase58(value: string): Uint8Array {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = 0n;
  for (const char of value) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) throw new Error("INVALID_SOLANA_ADDRESS");
    n = n * 58n + BigInt(digit);
  }
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.push(Number(n & 255n));
    n >>= 8n;
  }
  bytes.reverse();
  let leadingZeroes = 0;
  while (leadingZeroes < value.length && value[leadingZeroes] === "1") leadingZeroes++;
  const decoded = new Uint8Array([...new Array(leadingZeroes).fill(0), ...bytes]);
  if (decoded.length !== 32) throw new Error("INVALID_SOLANA_ADDRESS");
  return decoded;
}

function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]{48}$/.test(value)) throw new Error("INVALID_TON_ADDRESS");
  const standard = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(standard);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function crc16Xmodem(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function validateTonAddress(value: string): string {
  const raw = /^(-?\d+):([a-fA-F0-9]{64})$/.exec(value);
  if (raw) {
    const workchain = Number(raw[1]);
    if (!Number.isInteger(workchain) || workchain < -128 || workchain > 127) {
      throw new Error("INVALID_TON_ADDRESS");
    }
    return `${workchain}:${raw[2].toLowerCase()}`;
  }

  const bytes = decodeBase64Url(value);
  if (bytes.length !== 36) throw new Error("INVALID_TON_ADDRESS");
  const expected = crc16Xmodem(bytes.slice(0, 34));
  const actual = (bytes[34] << 8) | bytes[35];
  if (expected !== actual) throw new Error("INVALID_TON_ADDRESS");
  const workchain = bytes[1] > 127 ? bytes[1] - 256 : bytes[1];
  const account = Array.from(bytes.slice(2, 34), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${workchain}:${account}`;
}

function validateAddress(network: string, address: string) {
  switch (network) {
    case "ethereum":
    case "bsc":
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error("INVALID_EVM_ADDRESS");
      return getAddress(address);
    case "solana":
      decodeBase58(address);
      return address;
    case "ton":
      return validateTonAddress(address);
    default:
      throw new Error("UNSUPPORTED_NETWORK");
  }
}

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
