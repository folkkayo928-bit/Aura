import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { HDNodeWallet, getAddress } from "npm:ethers@6";

const CHAINS = ["ethereum", "polygon", "arbitrum", "bsc"] as const;

function secretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  try {
    const parsed = JSON.parse(raw);
    return parsed.default as string;
  } catch {
    return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  }
}

function db() {
  return createClient(Deno.env.get("SUPABASE_URL")!, secretKey());
}

async function custodyXpub(client: ReturnType<typeof db>) {
  const envXpub = Deno.env.get("AURA_EVM_DEPOSIT_XPUB")?.trim();
  if (envXpub) return envXpub;
  const { data, error } = await client.rpc("get_aura_evm_deposit_xpub");
  if (error) throw new Error("CUSTODY_XPUB_UNAVAILABLE");
  return String(data || "").trim();
}

function validEvmXpub(value: string) {
  // ethers v6 supports standard xpub/xpriv serialization here.
  return /^xpub[1-9A-HJ-NP-Za-km-z]+$/.test(value);
}

async function deriveDepositAddress(
  client: ReturnType<typeof db>,
  xpub: string,
  derivationIndex: number,
) {
  try {
    if (validEvmXpub(xpub)) {
      const root = HDNodeWallet.fromExtendedKey(xpub);
      const child = root.derivePath(`0/${derivationIndex}`);
      return getAddress(child.address);
    }
  } catch {
    // Fall through to the server-side Vault mnemonic. This keeps custody
    // server-only and prevents a bad/stale xpub from breaking deposits.
  }

  const { data: mnemonic, error } = await client.rpc("get_aura_evm_deposit_mnemonic");
  if (error || !String(mnemonic || "").trim()) {
    throw new Error("CUSTODY_DERIVATION_UNAVAILABLE");
  }

  const root = HDNodeWallet.fromPhrase(
    String(mnemonic).trim(),
    undefined,
    "m/44'/60'/0'",
  );
  const child = root.derivePath(`0/${derivationIndex}`);
  return getAddress(child.address);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: corsHeaders });

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return Response.json({ error: "UNAUTHORIZED" }, { status: 401, headers: corsHeaders });

  const client = db();
  const { data: authData, error: authError } = await client.auth.getUser(token);
  if (authError || !authData.user) return Response.json({ error: "UNAUTHORIZED" }, { status: 401, headers: corsHeaders });

  let xpub = "";
  try {
    xpub = await custodyXpub(client);
  } catch {
    return Response.json({
      error: "DEPOSIT_ADDRESS_PROVISIONING_UNAVAILABLE",
      message: "Secure AURA deposit custody is not configured yet. No deposit address was created.",
    }, { status: 503, headers: corsHeaders });
  }

  if (!validEvmXpub(xpub)) {
    return Response.json({
      error: "DEPOSIT_CUSTODY_XPUB_INVALID",
      message: "The server-side EVM deposit xpub is invalid. No address was created.",
    }, { status: 503, headers: corsHeaders });
  }

  try {
    const { data: existing, error: existingError } = await client
      .from("onchain_wallets")
      .select("chain,address,provider,address_type,is_primary,verified_at,derivation_index")
      .eq("user_id", authData.user.id)
      .in("chain", CHAINS);
    if (existingError) throw existingError;

    const byChain = new Map((existing || []).map((row) => [String(row.chain), row]));
    const existingEvm = (existing || []).find(
      (row) => row.provider === "aura_hd_wallet" &&
        row.address_type === "custodial_deposit" &&
        Number.isSafeInteger(Number(row.derivation_index)) &&
        Number(row.derivation_index) >= 0 &&
        /^0x[0-9a-fA-F]{40}$/.test(String(row.address || "")),
    );

    let derivationIndex: number;
    let address: string;

    if (existingEvm) {
      derivationIndex = Number(existingEvm.derivation_index);
      address = getAddress(String(existingEvm.address));
    } else {
      const { data: index, error: indexError } = await client.rpc("reserve_evm_deposit_derivation_index");
      if (indexError) throw indexError;
      derivationIndex = Number(index);
      if (!Number.isSafeInteger(derivationIndex) || derivationIndex < 0) throw new Error("INVALID_DERIVATION_INDEX");

      address = await deriveDepositAddress(client, xpub, derivationIndex);
    }

    const missing = CHAINS.filter((chain) => !byChain.has(chain));
    if (missing.length > 0) {
      const rows = missing.map((chain) => ({
        user_id: authData.user.id,
        chain,
        address,
        address_type: "custodial_deposit",
        provider: "aura_hd_wallet",
        is_primary: true,
        verified_at: new Date().toISOString(),
        derivation_index: derivationIndex,
      }));

      const { error: insertError } = await client.from("onchain_wallets").insert(rows);
      if (insertError) throw insertError;
      for (const row of rows) byChain.set(row.chain, row);
    }

    const chains = CHAINS.map((chain) => ({
      chain,
      address: byChain.get(chain)?.address || address,
      address_type: byChain.get(chain)?.address_type || "custodial_deposit",
      derivation_index: byChain.get(chain)?.derivation_index ?? derivationIndex,
    }));

    return Response.json({
      ok: true,
      success: true,
      provider: "aura_hd_wallet",
      custody: "server_side",
      derivation_index: derivationIndex,
      chains,
      addresses: Object.fromEntries(chains.map((item) => [item.chain, item.address])),
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("deposit address provisioning failed", error);
    return Response.json({ error: "DEPOSIT_ADDRESS_PROVISIONING_ERROR" }, { status: 500, headers: corsHeaders });
  }
});
