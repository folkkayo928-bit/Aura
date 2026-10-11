import { createClient } from "npm:@supabase/supabase-js@2";
import { Contract, HDNodeWallet, JsonRpcProvider, parseUnits, formatUnits } from "npm:ethers@6";

const CHAINS = {
  ethereum: {
    rpc: "AURA_EVM_RPC_ETHEREUM",
    alchemy: "eth-mainnet",
    token: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    treasury: "AURA_EVM_TREASURY_ETHEREUM",
    tokenDecimals: 6,
  },
  polygon: {
    rpc: "AURA_EVM_RPC_POLYGON",
    alchemy: "polygon-mainnet",
    token: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    treasury: "AURA_EVM_TREASURY_POLYGON",
    tokenDecimals: 6,
  },
  arbitrum: {
    rpc: "AURA_EVM_RPC_ARBITRUM",
    alchemy: "arb-mainnet",
    token: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    treasury: "AURA_EVM_TREASURY_ARBITRUM",
    tokenDecimals: 6,
  },
  bsc: {
    rpc: "AURA_EVM_RPC_BSC",
    alchemy: "bnb-mainnet",
    token: "0x55d398326f99059fF775485246999027B3197955",
    treasury: "AURA_EVM_TREASURY_BSC",
    tokenDecimals: 18,
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

async function custodySecret(client: ReturnType<typeof db>, name: "xprv" | "mnemonic" | "alchemy" | "xpub") {
  const fn = name === "xprv"
    ? "get_aura_evm_deposit_xprv"
    : name === "mnemonic"
      ? "get_aura_evm_deposit_mnemonic"
      : name === "xpub"
        ? "get_aura_evm_deposit_xpub"
        : "get_aura_alchemy_api_key";
  const { data } = await client.rpc(fn);
  return String(data || "").trim();
}
function rpcEndpoint(chain: keyof typeof CHAINS, apiKey: string) {
  const configured = Deno.env.get(CHAINS[chain].rpc)?.trim();
  if (configured) return configured;
  // Prefer the connected Alchemy app when configured; public fallbacks keep
  // all four supported mainnet chains available without a separate RPC secret.
  if (apiKey) return `https://${CHAINS[chain].alchemy}.g.alchemy.com/v2/${apiKey}`;
  const fallback: Record<keyof typeof CHAINS, string> = {
    ethereum: "https://ethereum-rpc.publicnode.com",
    polygon: "https://polygon-bor-rpc.publicnode.com",
    arbitrum: "https://arb1.arbitrum.io/rpc",
    bsc: "https://bsc-rpc.publicnode.com",
  };
  return fallback[chain];
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

  const xprv = Deno.env.get("AURA_EVM_DEPOSIT_XPRV")?.trim() || await custodySecret(client, "xprv");
  const mnemonic = Deno.env.get("AURA_EVM_DEPOSIT_MNEMONIC")?.trim() || await custodySecret(client, "mnemonic");
  const alchemy = Deno.env.get("ALCHEMY_API_KEY")?.trim() || await custodySecret(client, "alchemy");
  const xpub = Deno.env.get("AURA_EVM_DEPOSIT_XPUB")?.trim() || await custodySecret(client, "xpub");
  if (!xprv && !mnemonic) {
    return json({
      ok: true,
      ready: false,
      skipped: true,
      reason: "DEPOSIT_SWEEP_CUSTODY_NOT_CONFIGURED",
      message: "Automatic sweeps are installed and scheduled, but remain idle until server-only EVM signing custody is configured.",
    });
  }

  if (!xpub) {
    return json({ ok: false, ready: false, skipped: true, reason: "DEPOSIT_CUSTODY_XPUB_NOT_CONFIGURED" }, 503);
  }

  // Provisioning derives each address as <configured-xpub-root>/0/<index>.
  // Historical AURA configuration can store either the account-level xpub
  // (m/44'/60'/0') or its first non-hardened branch xpub (m/44'/60'/0'/0).
  // Resolve which root is actually paired with this xpub; never assume one.
  let mnemonicRootPath: string | null = null;
  let xprvRoot: HDNodeWallet | null = null;
  let xprvRootMode: "configured_root" | "parent_of_configured_root" | null = null;

  if (xprv) {
    try {
      const candidate = HDNodeWallet.fromExtendedKey(xprv);
      if (candidate.neuter().extendedKey === xpub) {
        xprvRoot = candidate;
        xprvRootMode = "configured_root";
      } else if (candidate.derivePath("0").neuter().extendedKey === xpub) {
        xprvRoot = candidate;
        xprvRootMode = "parent_of_configured_root";
      }
    } catch {
      // Try the verified mnemonic/xpub pair below; never broadcast from an unverified key.
    }
  }

  if (mnemonic) {
    try {
      const accountRoot = HDNodeWallet.fromPhrase(mnemonic, undefined, "m/44'/60'/0'");
      if (accountRoot.neuter().extendedKey === xpub) {
        mnemonicRootPath = "m/44'/60'/0'";
      } else if (accountRoot.derivePath("0").neuter().extendedKey === xpub) {
        mnemonicRootPath = "m/44'/60'/0'/0";
      }
    } catch {
      // A verified xprv/xpub pair can still be used if the mnemonic secret is invalid.
    }
  }

  if (!xprvRootMode && !mnemonicRootPath) {
    return json({
      ok: false,
      ready: false,
      skipped: true,
      reason: mnemonic ? "DEPOSIT_CUSTODY_XPUB_MNEMONIC_MISMATCH" : "DEPOSIT_CUSTODY_XPUB_PRIVATE_KEY_MISMATCH",
    }, 503);
  }

  const summaries: Array<Record<string, unknown>> = [];
  let swept = 0;
  let skipped = 0;
  let failed = 0;

  try {
    for (const [chain, cfg] of Object.entries(CHAINS)) {
      const rpcUrl = rpcEndpoint(chain as keyof typeof CHAINS, alchemy);
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
        // Credits are stored with status="credited" after the internal ledger
        // posts. Accept the earlier "confirmed" state too, but always require
        // credited_at so uncredited deposits can never be swept.
        .in("status", ["confirmed", "credited"])
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
          // Match the exact xpub root used to provision this address. If an
          // extended private root is the parent of the stored xpub root, mirror
          // the provisioner's extra /0 level. The derived address equality check
          // below is mandatory and prevents transfer from any other key.
          const indexPath = xprvRootMode === "parent_of_configured_root"
            ? `0/0/${Number(wallet.derivation_index)}`
            : `0/${Number(wallet.derivation_index)}`;
          const root = xprvRootMode
            ? xprvRoot!
            : HDNodeWallet.fromPhrase(mnemonic, undefined, mnemonicRootPath!);
          const signer = root.derivePath(indexPath).connect(provider);
          const from = await signer.getAddress();
          if (from.toLowerCase() !== String(wallet.address).toLowerCase()) {
            throw new Error("DERIVED_SIGNER_ADDRESS_MISMATCH");
          }
          const token = new Contract(cfg.token, ERC20_ABI, signer);
          const tokenBalance = BigInt(await token.balanceOf(from));
          if (tokenBalance === 0n) {
            throw new Error("NO_USDT_BALANCE_AT_CUSTODY_ADDRESS");
          }

          const actualDecimals = Number(await token.decimals());
          if (actualDecimals !== cfg.tokenDecimals) throw new Error("TOKEN_DECIMALS_MISMATCH");
          const usdtAmount = parseUnits(String(deposit.amount), cfg.tokenDecimals);
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
            amount: formatUnits(amount, cfg.tokenDecimals),
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
