import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { Address, Cell, contractAddress, loadStateInit } from "npm:@ton/core@0.63.1";
import { WalletContractV1R1, WalletContractV1R2, WalletContractV1R3, WalletContractV2R1, WalletContractV2R2, WalletContractV3R1, WalletContractV3R2, WalletContractV4 as WalletContractV4R2, WalletContractV5R1 } from "npm:@ton/ton@16.0.0";
import { ed25519 } from "npm:@noble/curves@1.9.7/ed25519";
import { Buffer } from "node:buffer";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS")!;
const admin = createClient(supabaseUrl, serviceKey);
const EXPECTED_DOMAIN = new URL(
  Deno.env.get("AURA_PUBLIC_APP_URL") ??
  Deno.env.get("PUBLIC_APP_URL") ??
  Deno.env.get("APP_URL") ??
  "https://aura-8bom.onrender.com",
).hostname.toLowerCase();

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}
function concat(...parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
function utf8(value: string) { return new TextEncoder().encode(value); }
async function sha256(value: Uint8Array) {
  const copy = new Uint8Array(value.length);
  copy.set(value);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", copy.buffer as ArrayBuffer));
}
function randomPayload() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}
function littleEndianU32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}
function littleEndianU64(value: number) {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(value), true);
  return bytes;
}
function bigEndianI32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setInt32(0, value, false);
  return bytes;
}
function decodeBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
function publicKeyFromSupportedStateInit(stateInit: ReturnType<typeof loadStateInit>, workchain: number) {
  if (!stateInit.code || !stateInit.data) throw new Error("STATE_INIT_INCOMPLETE");
  const dummyKey = Buffer.alloc(32);
  const v5WalletId = { networkGlobalId: -239 };
  const knownWallets = [
    { hash: bytesToHex(WalletContractV1R1.create({ workchain, publicKey: dummyKey }).init.code.hash()), layout: "v1" },
    { hash: bytesToHex(WalletContractV1R2.create({ workchain, publicKey: dummyKey }).init.code.hash()), layout: "v1" },
    { hash: bytesToHex(WalletContractV1R3.create({ workchain, publicKey: dummyKey }).init.code.hash()), layout: "v1" },
    { hash: bytesToHex(WalletContractV2R1.create({ workchain, publicKey: dummyKey }).init.code.hash()), layout: "v2" },
    { hash: bytesToHex(WalletContractV2R2.create({ workchain, publicKey: dummyKey }).init.code.hash()), layout: "v2" },
    { hash: bytesToHex(WalletContractV3R1.create({ workchain, publicKey: dummyKey }).init.code.hash()), layout: "v3" },
    { hash: bytesToHex(WalletContractV3R2.create({ workchain, publicKey: dummyKey }).init.code.hash()), layout: "v3" },
    { hash: bytesToHex(WalletContractV4R2.create({ workchain, publicKey: dummyKey }).init.code.hash()), layout: "v4" },
    { hash: bytesToHex(WalletContractV5R1.create({ workchain, publicKey: dummyKey, walletId: v5WalletId }).init.code.hash()), layout: "v5" },
  ];
  const layout = knownWallets.find((wallet) => wallet.hash === bytesToHex(stateInit.code!.hash()))?.layout;
  if (!layout) throw new Error("UNSUPPORTED_TON_WALLET_VERSION");
  const data = stateInit.data.beginParse();
  if (layout === "v5") data.loadBit(); // signature-auth flag
  data.loadUint(32); // seqno
  if (layout === "v3" || layout === "v4" || layout === "v5") data.loadUint(32); // wallet id / subwallet id
  return data.loadBuffer(32);
}
async function verifyTonProof(input: {
  address: Address;
  stateInitBoc: string;
  proof: { timestamp: number; domain: { lengthBytes: number; value: string }; signature: string; payload: string };
  publicKey?: string;
}) {
  const { address, stateInitBoc, proof, publicKey } = input;
  if (!Number.isSafeInteger(proof.timestamp) || Math.abs(Math.floor(Date.now() / 1000) - proof.timestamp) > 600) {
    throw new Error("TON_PROOF_EXPIRED");
  }
  if (proof.domain.value.toLowerCase() !== EXPECTED_DOMAIN) throw new Error("TON_PROOF_DOMAIN_MISMATCH");
  const domainBytes = utf8(proof.domain.value);
  if (proof.domain.lengthBytes !== domainBytes.length || domainBytes.length > 128) throw new Error("TON_PROOF_DOMAIN_LENGTH_INVALID");
  const payloadBytes = utf8(proof.payload);
  if (payloadBytes.length === 0 || payloadBytes.length > 128) throw new Error("TON_PROOF_PAYLOAD_INVALID");
  if (typeof stateInitBoc !== "string" || stateInitBoc.length > 20000) throw new Error("TON_STATE_INIT_INVALID");

  const stateInit = loadStateInit(Cell.fromBase64(stateInitBoc).beginParse());
  const derivedAddress = contractAddress(address.workChain, stateInit);
  if (!derivedAddress.equals(address)) throw new Error("TON_STATE_INIT_ADDRESS_MISMATCH");
  const publicKeyBytes = publicKeyFromSupportedStateInit(stateInit, address.workChain);
  if (publicKeyBytes.length !== 32) throw new Error("TON_PUBLIC_KEY_INVALID");
  if (publicKey && publicKey.replace(/^0x/i, "").toLowerCase() !== bytesToHex(publicKeyBytes)) {
    throw new Error("TON_PUBLIC_KEY_MISMATCH");
  }

  const message = concat(
    utf8("ton-proof-item-v2/"),
    bigEndianI32(address.workChain),
    address.hash,
    littleEndianU32(domainBytes.length),
    domainBytes,
    littleEndianU64(proof.timestamp),
    payloadBytes,
  );
  const messageHash = await sha256(message);
  const digest = await sha256(concat(new Uint8Array([0xff, 0xff]), utf8("ton-connect"), messageHash));
  const signature = decodeBase64(proof.signature);
  if (signature.length !== 64 || !ed25519.verify(signature, digest, publicKeyBytes)) {
    throw new Error("TON_PROOF_SIGNATURE_INVALID");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ success: false, error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ success: false, error: "AUTH_REQUIRED" }, 401);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ success: false, error: "AUTH_REQUIRED" }, 401);

    const body = await req.json();
    if (body?.action === "challenge") {
      const payload = randomPayload();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { error } = await admin.from("external_wallet_ton_challenges").insert({
        user_id: user.id, payload, expires_at: expiresAt,
      });
      if (error) return json({ success: false, error: "TON_CHALLENGE_CREATE_FAILED" }, 500);
      return json({ success: true, payload, expiresAt });
    }

    if (body?.action !== "verify" || body?.network !== "-239" ||
        typeof body?.address !== "string" || typeof body?.walletStateInit !== "string" ||
        typeof body?.proof?.payload !== "string" || typeof body?.proof?.signature !== "string" ||
        !body?.proof?.domain || !Number.isSafeInteger(body?.proof?.timestamp)) {
      return json({ success: false, error: "INVALID_TON_PROOF_REQUEST" }, 400);
    }

    const address = Address.parse(body.address);
    if (address.workChain !== 0) return json({ success: false, error: "TON_MAINNET_WORKCHAIN_REQUIRED" }, 400);
    const payload = body.proof.payload as string;
    const now = new Date().toISOString();
    const { data: challenge, error: challengeError } = await admin.from("external_wallet_ton_challenges")
      .select("id")
      .eq("user_id", user.id)
      .eq("payload", payload)
      .is("used_at", null)
      .gt("expires_at", now)
      .maybeSingle();
    if (challengeError || !challenge) return json({ success: false, error: "TON_CHALLENGE_EXPIRED_OR_USED" }, 400);

    await verifyTonProof({
      address,
      stateInitBoc: body.walletStateInit,
      proof: body.proof,
      publicKey: typeof body.publicKey === "string" ? body.publicKey : undefined,
    });

    const { data: claimed, error: claimError } = await admin.from("external_wallet_ton_challenges")
      .update({ used_at: now })
      .eq("id", challenge.id)
      .eq("user_id", user.id)
      .is("used_at", null)
      .gt("expires_at", now)
      .select("id")
      .maybeSingle();
    if (claimError || !claimed) return json({ success: false, error: "TON_CHALLENGE_ALREADY_USED" }, 400);

    const rawAddress = address.toRawString().toLowerCase();
    const { data: wallet, error: walletError } = await admin.from("external_wallets")
      .upsert({
        user_id: user.id, provider: "TON Connect", network: "ton", address: rawAddress,
        verified_at: now, connected_at: now,
      }, { onConflict: "user_id,provider,network,address" })
      .select()
      .maybeSingle();
    if (walletError) return json({ success: false, error: "TON_WALLET_SAVE_FAILED" }, 500);
    return json({ success: true, wallet });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const known = [
      "TON_PROOF_EXPIRED", "TON_PROOF_DOMAIN_MISMATCH", "TON_PROOF_DOMAIN_LENGTH_INVALID",
      "TON_PROOF_PAYLOAD_INVALID", "TON_STATE_INIT_INVALID", "TON_STATE_INIT_INCOMPLETE",
      "TON_STATE_INIT_ADDRESS_MISMATCH", "UNSUPPORTED_TON_WALLET_VERSION",
      "TON_PUBLIC_KEY_INVALID", "TON_PUBLIC_KEY_MISMATCH", "TON_PROOF_SIGNATURE_INVALID",
      "TON_MAINNET_WORKCHAIN_REQUIRED",
    ];
    return json({ success: false, error: known.includes(message) ? message : "TON_PROOF_VERIFICATION_FAILED" }, 400);
  }
});
