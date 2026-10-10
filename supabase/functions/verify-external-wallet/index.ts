import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { ethers } from "npm:ethers@6.15.0";
import { ed25519 } from "npm:@noble/curves@1.9.7/ed25519";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS")!;
const admin = createClient(supabaseUrl, serviceKey);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

function randomNonce() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

function isEvmNetwork(network: string) {
  return network === "ethereum" || network === "polygon" || network === "arbitrum" || network === "bsc";
}

function normalizeAddress(provider: string, address: string) {
  return provider === "MetaMask" ? ethers.getAddress(address) : address.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ success: false, error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ success: false, error: "AUTH_REQUIRED" }, 401);

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ success: false, error: "AUTH_REQUIRED" }, 401);

    const body = await req.json();
    const action = body?.action;
    const provider = body?.provider;
    const network = body?.network;
    const address = body?.address;

    if (!["MetaMask", "Phantom"].includes(provider) || !["ethereum", "polygon", "arbitrum", "bsc", "solana"].includes(network) || typeof address !== "string" || !address.trim()) {
      return json({ success: false, error: "INVALID_WALLET_REQUEST" }, 400);
    }
    if (provider === "MetaMask" && !isEvmNetwork(network)) return json({ success: false, error: "METAMASK_REQUIRES_EVM" }, 400);
    if (provider === "Phantom" && network !== "solana") return json({ success: false, error: "PHANTOM_REQUIRES_SOLANA" }, 400);

    const normalized = normalizeAddress(provider, address);

    if (action === "challenge") {
      const nonce = randomNonce();
      const expires = new Date(Date.now() + 10 * 60 * 1000);
      const message = [
        "AURA external wallet ownership verification",
        `Account: ${user.id}`,
        `Wallet: ${normalized}`,
        `Network: ${network}`,
        `Nonce: ${nonce}`,
        `Expires: ${expires.toISOString()}`,
        "",
        "Sign this message to prove you control this wallet. No blockchain transaction will be sent.",
      ].join("\n");

      const { error } = await admin.from("external_wallet_challenges").insert({
        user_id: user.id, provider, network, address: normalized, nonce, message, expires_at: expires.toISOString(),
      });
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true, message, expiresAt: expires.toISOString() });
    }

    if (action !== "verify" || typeof body.signature !== "string") {
      return json({ success: false, error: "INVALID_ACTION" }, 400);
    }

    const { data: challenge, error: challengeError } = await admin
      .from("external_wallet_challenges")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .eq("network", network)
      .eq("address", normalized)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (challengeError || !challenge) return json({ success: false, error: "CHALLENGE_EXPIRED" }, 400);

    let valid = false;
    if (provider === "MetaMask") {
      const recovered = ethers.verifyMessage(challenge.message, body.signature);
      valid = recovered.toLowerCase() === normalized.toLowerCase();
    } else {
      const messageBytes = new TextEncoder().encode(challenge.message);
      const signatureBytes = ethers.getBytes(body.signature);
      const publicKeyBytes = bs58Decode(normalized);
      valid = ed25519.verify(signatureBytes, messageBytes, publicKeyBytes);
    }

    if (!valid) return json({ success: false, error: "SIGNATURE_INVALID" }, 400);

    const now = new Date().toISOString();
    const { data: wallet, error: walletError } = await admin.from("external_wallets")
      .upsert({ user_id: user.id, provider, network, address: normalized, verified_at: now, connected_at: now }, { onConflict: "user_id,provider,address" })
      .select()
      .maybeSingle();
    if (walletError) return json({ success: false, error: walletError.message }, 500);

    await admin.from("external_wallet_challenges").update({ used_at: now }).eq("id", challenge.id);
    return json({ success: true, wallet });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "VERIFICATION_FAILED" }, 400);
  }
});

function bs58Decode(input: string): Uint8Array {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = 0n;
  for (const c of input) {
    const i = alphabet.indexOf(c);
    if (i < 0) throw new Error("INVALID_SOLANA_ADDRESS");
    n = n * 58n + BigInt(i);
  }
  const bytes: number[] = [];
  while (n > 0n) { bytes.push(Number(n % 256n)); n /= 256n; }
  bytes.reverse();
  let leading = 0;
  for (const c of input) { if (c === "1") leading++; else break; }
  return new Uint8Array([...new Array(leading).fill(0), ...bytes]);
}
