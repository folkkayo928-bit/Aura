import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { HDNodeWallet, getAddress } from "npm:ethers@6";

const CHAINS = ["ethereum", "polygon", "arbitrum", "bsc"] as const;

type DepositRow = {
  chain: string;
  address: string;
  provider?: string | null;
  address_type?: string | null;
  is_primary?: boolean | null;
  verified_at?: string | null;
  derivation_index?: number | null;
};

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
  if (error) return "";
  return String(data || "").trim();
}

function validEvmXpub(value: string) {
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
    // Fall through to the server-side Vault mnemonic.
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

function isDuplicateDerivationError(error: unknown) {
  const code = String((error as any)?.code || "");
  const message = String((error as any)?.message || error || "").toLowerCase();
  return code === "23505" && message.includes("onchain_wallets_provider_derivation_idx");
}

async function getCustodialRows(
  client: ReturnType<typeof db>,
  userId: string,
) {
  const { data, error } = await client
    .from("onchain_wallets")
    .select("chain,address,provider,address_type,is_primary,verified_at,derivation_index")
    .eq("user_id", userId)
    .eq("provider", "aura_hd_wallet")
    .eq("address_type", "custodial_deposit")
    .in("chain", CHAINS);

  if (error) throw error;

  return new Map(
    (data || []).map((row) => [String(row.chain), row as DepositRow]),
  );
}

async function provisionChain(
  client: ReturnType<typeof db>,
  userId: string,
  chain: (typeof CHAINS)[number],
  xpub: string,
) {
  // Another Receive request can be provisioning at the same time. Check for
  // a completed row before each allocation attempt so we reuse it safely.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data: existing, error: existingError } = await client
      .from("onchain_wallets")
      .select("chain,address,provider,address_type,is_primary,verified_at,derivation_index")
      .eq("user_id", userId)
      .eq("chain", chain)
      .eq("provider", "aura_hd_wallet")
      .eq("address_type", "custodial_deposit")
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) return existing as DepositRow;

    const { data: index, error: indexError } = await client.rpc(
      "reserve_evm_deposit_derivation_index",
    );
    if (indexError) throw indexError;

    const derivationIndex = Number(index);
    if (!Number.isSafeInteger(derivationIndex) || derivationIndex < 0) {
      throw new Error("INVALID_DERIVATION_INDEX");
    }

    const address = await deriveDepositAddress(client, xpub, derivationIndex);

    const row = {
      user_id: userId,
      chain,
      address,
      address_type: "custodial_deposit",
      provider: "aura_hd_wallet",
      is_primary: true,
      verified_at: new Date().toISOString(),
      derivation_index: derivationIndex,
    };

    const { error: insertError } = await client
      .from("onchain_wallets")
      .insert(row);

    if (!insertError) return row as DepositRow;

    if (!isDuplicateDerivationError(insertError)) {
      throw insertError;
    }

    // The derivation index was claimed by another request/user between the
    // reserve call and INSERT. Re-check this user's chain first; if it exists,
    // use that address. Otherwise take the next available index.
  }

  throw new Error("DEPOSIT_DERIVATION_ALLOCATION_BUSY");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return Response.json(
      { error: "METHOD_NOT_ALLOWED" },
      { status: 405, headers: corsHeaders },
    );
  }

  const token = (req.headers.get("Authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) {
    return Response.json(
      { error: "UNAUTHORIZED" },
      { status: 401, headers: corsHeaders },
    );
  }

  const client = db();
  const { data: authData, error: authError } = await client.auth.getUser(token);
  if (authError || !authData.user) {
    return Response.json(
      { error: "UNAUTHORIZED" },
      { status: 401, headers: corsHeaders },
    );
  }

  const userId = authData.user.id;

  let requestedChain: (typeof CHAINS)[number] | null = null;
  try {
    const body = await req.json();
    const candidate = String(body?.chain || "").toLowerCase();
    if (candidate) {
      if (!(CHAINS as readonly string[]).includes(candidate)) {
        return Response.json(
          { error: "UNSUPPORTED_CHAIN" },
          { status: 400, headers: corsHeaders },
        );
      }
      requestedChain = candidate as (typeof CHAINS)[number];
    }
  } catch {
    // Empty/non-JSON POST bodies remain backward compatible and provision all
    // EVM chains for legacy callers.
  }

  let xpub = "";
  try {
    xpub = await custodyXpub(client);
  } catch {
    xpub = "";
  }

  try {
    const targetChains = requestedChain ? [requestedChain] : CHAINS;
    let byChain = await getCustodialRows(client, userId);

    for (const chain of targetChains) {
      if (byChain.has(chain)) continue;
      const row = await provisionChain(client, userId, chain, xpub);
      byChain.set(chain, row);
    }

    // Refresh from the database once more so the response is authoritative.
    byChain = await getCustodialRows(client, userId);

    const chains = targetChains.map((chain) => ({
      chain,
      address: byChain.get(chain)?.address || "",
      address_type: byChain.get(chain)?.address_type || "custodial_deposit",
      derivation_index: byChain.get(chain)?.derivation_index ?? null,
    }));

    if (chains.some((item) => !/^0x[0-9a-fA-F]{40}$/.test(item.address))) {
      throw new Error("DEPOSIT_ADDRESS_NOT_READY");
    }

    return Response.json(
      {
        ok: true,
        success: true,
        provider: "aura_hd_wallet",
        custody: "server_side",
        derivation_index: chains[0]?.derivation_index ?? null,
        chains,
        addresses: Object.fromEntries(
          chains.map((item) => [item.chain, item.address]),
        ),
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("deposit address provisioning failed", error);
    return Response.json(
      {
        error: "DEPOSIT_ADDRESS_PROVISIONING_ERROR",
        message: "Secure AURA deposit address provisioning failed. Please try again.",
      },
      { status: 500, headers: corsHeaders },
    );
  }
});
