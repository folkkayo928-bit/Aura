import { createClient } from "npm:@supabase/supabase-js@2";
import { HDNodeWallet, getAddress } from "npm:ethers@6";

const CHAINS = ["ethereum", "polygon", "arbitrum"] as const;

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

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });
  }

  const token = (req.headers.get("Authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const client = db();
  const { data: authData, error: authError } = await client.auth.getUser(token);
  if (authError || !authData.user) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const xpub = Deno.env.get("AURA_EVM_DEPOSIT_XPUB") || "";
  if (!xpub) {
    return Response.json({
      error: "DEPOSIT_ADDRESS_PROVISIONING_UNAVAILABLE",
      message: "Secure Aura deposit custody is not configured yet. No deposit address was created.",
    }, { status: 503 });
  }

  try {
    const { data: existing, error: existingError } = await client
      .from("onchain_wallets")
      .select("chain,address,provider,address_type,is_primary,verified_at,derivation_index")
      .eq("user_id", authData.user.id)
      .in("chain", CHAINS);

    if (existingError) throw existingError;

    const byChain = new Map((existing || []).map((row) => [String(row.chain), row]));
    const missing = CHAINS.filter((chain) => !byChain.has(chain));

    if (missing.length > 0) {
      const { data: index, error: indexError } = await client.rpc(
        "reserve_evm_deposit_derivation_index",
      );
      if (indexError) throw indexError;

      const derivationIndex = Number(index);
      if (!Number.isSafeInteger(derivationIndex) || derivationIndex < 0) {
        throw new Error("INVALID_DERIVATION_INDEX");
      }

      const root = HDNodeWallet.fromExtendedKey(xpub);
      const child = root.derivePath(`0/${derivationIndex}`);
      const address = getAddress(child.address);

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

      const { error: insertError } = await client
        .from("onchain_wallets")
        .insert(rows);
      if (insertError) throw insertError;

      for (const row of rows) byChain.set(row.chain, row);
    }

    const chains = CHAINS.map((chain) => ({
      chain,
      address: byChain.get(chain)?.address || null,
      address_type: byChain.get(chain)?.address_type || null,
    }));
    return Response.json({
      ok: true,
      success: true,
      provider: "aura_hd_wallet",
      custody: "server_side",
      chains,
      addresses: Object.fromEntries(chains.map((item) => [item.chain, item.address])),
    });
  } catch (error) {
    console.error("deposit address provisioning failed", error);
    return Response.json({ error: "DEPOSIT_ADDRESS_PROVISIONING_ERROR" }, { status: 500 });
  }
});
