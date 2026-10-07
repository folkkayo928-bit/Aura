import { createClient } from "npm:@supabase/supabase-js@2";
import { Contract, HDNodeWallet, JsonRpcProvider, parseUnits, formatUnits } from "npm:ethers@6";

const CHAINS = {
  ethereum: {
    rpc: "AURA_EVM_RPC_ETHEREUM",
    token: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    treasury: "AURA_EVM_TREASURY_ETHEREUM",
  },
  polygon: {
    rpc: "AURA_EVM_RPC_POLYGON",
    token: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    treasury: "AURA_EVM_TREASURY_POLYGON",
  },
  arbitrum: {
    rpc: "AURA_EVM_RPC_ARBITRUM",
    token: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    treasury: "AURA_EVM_TREASURY_ARBITRUM",
  },
} as const;

const ERC20_ABI = [
  "function transfer(address to,uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

function secretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  try {
    return JSON.parse(raw).default as string;
  } catch {
    return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  }
}

function db() {
  return createClient(Deno.env.get("SUPABASE_URL")!, secretKey());
}

async function authorized(client: ReturnType<typeof db>, req: Request) {
  const provided = req.headers.get("x-aura-worker-secret") || "";
  const { data, error } = await client.rpc("get_aura_worker_secret");
  return !error && !!data && provided.length > 0 && provided === data;
}

function validAddress(value: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const client = db();
  if (!(await authorized(client, req))) return json({ error: "UNAUTHORIZED" }, 401);

  const xprv = Deno.env.get("AURA_EVM_DEPOSIT_XPRV") || "";
  if (!xprv) {
    return json({
      ok: true,
      ready: false,
      skipped: true,
      reason: "DEPOSIT_SWEEP_CUSTODY_NOT_CONFIGURED",
      message: "Automatic sweeps are installed and scheduled, but remain idle until server-only EVM custody is configured.",
    });
  }

  const summaries: Array<Record<string, unknown>> = [];
  let swept = 0;
  let skipped = 0;
  let failed = 0;

  try {
    for (const [chain, cfg] of Object.entries(CHAINS)) {
      const rpcUrl = Deno.env.get(cfg.rpc) || "";
      const treasury = Deno.env.get(cfg.treasury) || "";
      if (!rpcUrl || !treasury) {
        skipped++;
        summaries.push({ chain, status: "configuration_missing" });
        continue;
      }
      if (!validAddress(treasury)) {
        failed++;
        summaries.push({ chain, status: "invalid_treasury_address" });
        continue;
      }

      const provider = new JsonRpcProvider(rpcUrl);
      const pendingQuery = await client
        .from("wallet_deposits")
        .select("id,user_id,amount,destination_address,sweep_status,sweep_tx_hash")
        .eq("chain", chain)
        .eq("status", "confirmed")
        .not("credited_at", "is", null)
        .in("sweep_status", ["pending", "failed"])
        .is("sweep_tx_hash", null)
        .order("created_at", { ascending: true })
        .limit(25);

      if (pendingQuery.error) throw pendingQuery.error;

      for (const deposit of pendingQuery.data || []) {
        const { data: wallet, error: walletError } = await client
          .from("onchain_wallets")
          .select("address,derivation_index,provider")
          .eq("user_id", deposit.user_id)
          .eq("chain", chain)
          .eq("provider", "aura_hd_wallet")
          .maybeSingle();

        if (walletError) throw walletError;
        if (!wallet?.address || wallet.derivation_index === null || wallet.derivation_index === undefined) {
          failed++;
          await client.from("wallet_deposits").update({
            sweep_status: "failed",
            sweep_attempted_at: new Date().toISOString(),
            sweep_error: "CUSTODIAL_DERIVATION_METADATA_MISSING",
          }).eq("id", deposit.id).is("sweep_tx_hash", null);
          continue;
        }
        if (String(wallet.address).toLowerCase() !== String(deposit.destination_address).toLowerCase()) {
          failed++;
          await client.from("wallet_deposits").update({
            sweep_status: "failed",
            sweep_attempted_at: new Date().toISOString(),
            sweep_error: "DEPOSIT_ADDRESS_MISMATCH",
          }).eq("id", deposit.id).is("sweep_tx_hash", null);
          continue;
        }

        const claimed = await client
          .from("wallet_deposits")
          .update({
            sweep_status: "sweeping",
            sweep_attempted_at: new Date().toISOString(),
            sweep_error: null,
          })
          .eq("id", deposit.id)
          .in("sweep_status", ["pending", "failed"])
          .is("sweep_tx_hash", null)
          .select("id")
          .maybeSingle();

        if (claimed.error || !claimed.data) {
          skipped++;
          continue;
        }

        try {
          const root = HDNodeWallet.fromExtendedKey(xprv);
          const signer = root.derivePath(`0/${Number(wallet.derivation_index)}`).connect(provider);
          const from = await signer.getAddress();
          const token = new Contract(cfg.token, ERC20_ABI, signer);
          const tokenBalance = BigInt(await token.balanceOf(from));
          if (tokenBalance === 0n) {
            throw new Error("NO_USDT_BALANCE_AT_CUSTODY_ADDRESS");
          }

          const usdtAmount = parseUnits(String(deposit.amount), 6);
          const amount = tokenBalance < usdtAmount ? tokenBalance : usdtAmount;
          if (amount <= 0n) throw new Error("INVALID_SWEEP_AMOUNT");

          const gasEstimate = await token.transfer.estimateGas(treasury, amount);
          const feeData = await provider.getFeeData();

          const estimatedGasCost = feeData.maxFeePerGas
            ? gasEstimate * feeData.maxFeePerGas
            : gasEstimate * (feeData.gasPrice || 0n);
          const nativeBalance = await provider.getBalance(from);
          if (nativeBalance < estimatedGasCost) {
            throw new Error("INSUFFICIENT_NATIVE_GAS_FOR_SWEEP");
          }

          const tx = await token.transfer(treasury, amount);
          await client.from("wallet_deposits")
            .update({
              sweep_tx_hash: tx.hash,
              sweep_status: "sweeping",
              sweep_error: null,
            })
            .eq("id", deposit.id)
            .is("sweep_tx_hash", null);

          const receipt = await tx.wait(1);
          if (!receipt || receipt.status !== 1) throw new Error("SWEEP_TRANSACTION_FAILED");

          await client.from("wallet_deposits")
            .update({
              sweep_status: "swept",
              swept_at: new Date().toISOString(),
              sweep_tx_hash: tx.hash,
              sweep_error: null,
            })
            .eq("id", deposit.id);

          swept++;
          summaries.push({
            chain,
            deposit_id: deposit.id,
            status: "swept",
            tx_hash: tx.hash,
            amount: formatUnits(amount, 6),
          });
        } catch (error) {
          failed++;
          const message = error instanceof Error ? error.message : "SWEEP_FAILED";
          await client.from("wallet_deposits").update({
            sweep_status: "failed",
            sweep_error: message.slice(0, 500),
          }).eq("id", deposit.id).is("sweep_tx_hash", null);

          summaries.push({ chain, deposit_id: deposit.id, status: "failed", error: message });
        }
      }
    }

    return json({ ok: true, swept, skipped, failed, summaries });
  } catch (error) {
    console.error("deposit-sweep failed", error);
    return json({ ok: false, error: "DEPOSIT_SWEEP_ERROR" }, 500);
  }
});
