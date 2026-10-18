import { createClient } from "npm:@supabase/supabase-js@2";
import { Contract, HDNodeWallet, JsonRpcProvider, parseUnits, formatUnits, keccak256 } from "npm:ethers@6";

const CHAINS = {
  ethereum: {
    rpc: "AURA_EVM_RPC_ETHEREUM",
    chainId: 1,
confirmations: 12,
    token: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    treasury: "AURA_EVM_TREASURY_ETHEREUM",
    tokenDecimals: 6,
  },
  polygon: {
    rpc: "AURA_EVM_RPC_POLYGON",
    chainId: 137,
confirmations: 30,
    token: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    treasury: "AURA_EVM_TREASURY_POLYGON",
    tokenDecimals: 6,
  },
  arbitrum: {
    rpc: "AURA_EVM_RPC_ARBITRUM",
    chainId: 42161,
confirmations: 20,
    token: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    treasury: "AURA_EVM_TREASURY_ARBITRUM",
    tokenDecimals: 6,
  },
  bsc: {
    rpc: "AURA_EVM_RPC_BSC",
    chainId: 56,
confirmations: 15,
    token: "0x55d398326f99059fF775485246999027B3197955",
    treasury: "AURA_EVM_TREASURY_BSC",
    tokenDecimals: 18,
  },
} as const;

const ERC20_ABI = [
  "function transfer(address to,uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from,address indexed to,uint256 value)",
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

async function custodySecret(client: ReturnType<typeof db>, name: "xprv" | "mnemonic" | "xpub") {
  const fn = name === "xprv"
    ? "get_aura_evm_deposit_xprv"
    : name === "mnemonic"
      ? "get_aura_evm_deposit_mnemonic"
      : "get_aura_evm_deposit_xpub";
  const { data } = await client.rpc(fn);
  return String(data || "").trim();
}
function rpcEndpoint(chain: keyof typeof CHAINS) {
  const configured = Deno.env.get(CHAINS[chain].rpc)?.trim();
  if (configured) return configured;
  // The legacy sweep uses the same dRPC endpoints as the personal wallet.
  const fallback: Record<keyof typeof CHAINS, string> = {
    ethereum: "https://eth.drpc.org",
    polygon: "https://polygon.drpc.org",
    arbitrum: "https://arbitrum.drpc.org",
    bsc: "https://bsc.drpc.org",
  };
  return fallback[chain];
}
function validAddress(value: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

function matchingTransferAmount(
  token: Contract,
  logs: readonly any[],
  expectedFrom: string,
  expectedTo: string,
  maximumAmount: bigint,
): bigint | null {
  const matches: bigint[] = [];
  for (const log of logs) {
    if (String(log.address || "").toLowerCase() !== String(token.target).toLowerCase()) continue;
    try {
      const parsed = token.interface.parseLog(log);
      if (!parsed || parsed.name !== "Transfer") continue;
      const from = String(parsed.args[0]).toLowerCase();
      const to = String(parsed.args[1]).toLowerCase();
      const amount = BigInt(parsed.args[2]);
      if (from === expectedFrom.toLowerCase() && to === expectedTo.toLowerCase()
          && amount > 0n && amount <= maximumAmount) matches.push(amount);
    } catch {
      // Ignore logs that do not decode as the expected token Transfer event.
    }
  }
  return matches.length === 1 ? matches[0] : null;
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
  if (!xprv && !mnemonic) {
    return json({
      ok: true,
      ready: false,
      skipped: true,
      reason: "DEPOSIT_SWEEP_CUSTODY_NOT_CONFIGURED",
      message: "Automatic sweeps are installed and scheduled, but remain idle until server-only EVM signing custody is configured.",
    });
  }

  let xprvRoot: HDNodeWallet | null = null;
  let mnemonicRoot: HDNodeWallet | null = null;
  if (xprv) {
    try {
      // Extended-key parsing can yield a public-only node. Only keep a signer
      // object when the parsed key actually exposes private key material.
      const parsed = HDNodeWallet.fromExtendedKey(xprv) as HDNodeWallet;
      if (typeof parsed.privateKey === "string" && parsed.privateKey.length > 2) {
        xprvRoot = parsed;
      }
    } catch {
      xprvRoot = null;
    }
  }
  if (mnemonic) {
    try {
      mnemonicRoot = HDNodeWallet.fromPhrase(mnemonic, undefined, "m/44'/60'/0'");
    } catch {
      mnemonicRoot = null;
    }
  }
  if (!xprvRoot && !mnemonicRoot) {
    return json({
      ok: false,
      ready: false,
      skipped: true,
      reason: xprv || mnemonic ? "DEPOSIT_CUSTODY_PRIVATE_KEY_OR_MNEMONIC_INVALID" : "DEPOSIT_SWEEP_CUSTODY_NOT_CONFIGURED",
    }, 503);
  }

  // We do not infer a signing path from the configured xpub. Existing addresses
  // may have been provisioned from an account-level root or a nested branch root.
  // We only authorize a sweep below after one candidate private derivation exactly
  // matches both the stored custodial address and the deposit destination address.

  const summaries: Array<Record<string, unknown>> = [];
  let swept = 0;
  let skipped = 0;
  let failed = 0;

  try {
    for (const [chain, cfg] of Object.entries(CHAINS)) {
      const rpcUrl = rpcEndpoint(chain as keyof typeof CHAINS);
      const treasury = Deno.env.get(cfg.treasury) || "";
      if (!rpcUrl || !treasury) {
        skipped++;
        summaries.push({
          chain,
          status: "configuration_missing",
          missing_settings: [
            !rpcUrl ? cfg.rpc : null,
            !treasury ? cfg.treasury : null,
          ].filter(Boolean),
        });
        continue;
      }
      if (!validAddress(treasury)) {
        failed++;
        summaries.push({ chain, status: "invalid_treasury_address" });
        continue;
      }

      const provider = new JsonRpcProvider(rpcUrl);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== cfg.chainId) {
        skipped++;
        summaries.push({ chain, status: "rpc_chain_id_mismatch", expected_chain_id: cfg.chainId, actual_chain_id: Number(network.chainId) });
        continue;
      }

      // Reconcile known sweeps before preparing any new ones. The stored tx hash
      // is written BEFORE broadcast, so an uncertain provider response can never
      // cause this worker to submit the same deposit sweep a second time.
      const inflightQuery = await client
        .from("wallet_deposits")
        .select("id,amount,destination_address,sweep_tx_hash")
        .eq("chain", chain)
        .eq("sweep_status", "sweeping")
        .not("sweep_tx_hash", "is", null)
        .limit(50);
      if (inflightQuery.error) throw inflightQuery.error;
      const readToken = new Contract(cfg.token, ERC20_ABI, provider);
      for (const inflight of inflightQuery.data || []) {
        const hash = String(inflight.sweep_tx_hash || "");
        if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
          skipped++;
          summaries.push({ chain, deposit_id: inflight.id, status: "reconciliation_hash_invalid" });
          continue;
        }
        let receipt;
        try {
          receipt = await provider.getTransactionReceipt(hash);
        } catch {
          receipt = null;
        }
        if (!receipt) {
          skipped++;
          summaries.push({ chain, deposit_id: inflight.id, status: "awaiting_existing_transaction", tx_hash: hash });
          continue;
        }
        const currentBlock = await provider.getBlockNumber();
        const confirmations = Math.max(0, currentBlock - receipt.blockNumber + 1);
        if (confirmations < cfg.confirmations) {
          await client.from("wallet_deposits")
            .update({ sweep_error: "WAITING_FOR_CONFIRMATIONS:" + confirmations + "/" + cfg.confirmations })
            .eq("id", inflight.id).eq("sweep_tx_hash", hash).eq("sweep_status", "sweeping");
          skipped++;
          summaries.push({ chain, deposit_id: inflight.id, status: "waiting_for_confirmations", confirmations, required_confirmations: cfg.confirmations, tx_hash: hash });
          continue;
        }
        if (receipt.status !== 1) {
          await client.from("wallet_deposits")
            .update({ sweep_status: "failed", sweep_error: "SWEEP_TRANSACTION_REVERTED:" + hash })
            .eq("id", inflight.id).eq("sweep_tx_hash", hash).eq("sweep_status", "sweeping");
          failed++;
          summaries.push({ chain, deposit_id: inflight.id, status: "transaction_reverted", tx_hash: hash });
          continue;
        }
        let maximumAmount: bigint;
        try {
          maximumAmount = parseUnits(String(inflight.amount), cfg.tokenDecimals);
        } catch {
          maximumAmount = 0n;
        }
        const actualAmount = matchingTransferAmount(
          readToken, receipt.logs, String(inflight.destination_address), treasury, maximumAmount,
        );
        if (actualAmount === null) {
          await client.from("wallet_deposits")
            .update({ sweep_error: "SWEEP_RECEIPT_EVENT_MISMATCH:" + hash })
            .eq("id", inflight.id).eq("sweep_tx_hash", hash).eq("sweep_status", "sweeping");
          skipped++;
          summaries.push({ chain, deposit_id: inflight.id, status: "receipt_requires_reconciliation", tx_hash: hash });
          continue;
        }
        const reconciled = await client.from("wallet_deposits")
          .update({ sweep_status: "swept", swept_at: new Date().toISOString(), sweep_error: null })
          .eq("id", inflight.id).eq("sweep_tx_hash", hash).eq("sweep_status", "sweeping")
          .select("id").maybeSingle();
        if (reconciled.error || !reconciled.data) {
          skipped++;
          summaries.push({ chain, deposit_id: inflight.id, status: "receipt_verified_database_update_pending", tx_hash: hash });
          continue;
        }
        swept++;
        summaries.push({ chain, deposit_id: inflight.id, status: "swept_reconciled", tx_hash: hash, amount: formatUnits(actualAmount, cfg.tokenDecimals) });
      }

      // A crash after claiming but before persisting the signed-transaction hash
      // is safe to retry only for the new PREPARING marker. No transaction is
      // broadcast until its hash has been committed to the row.
      const retryBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const interruptedPreparation = await client.from("wallet_deposits")
        .select("id")
        .eq("chain", chain)
        .eq("sweep_status", "sweeping")
        .eq("sweep_error", "PREPARING_SIGNED_TRANSACTION")
        .is("sweep_tx_hash", null)
        .lt("sweep_attempted_at", retryBefore)
        .limit(25);
      if (interruptedPreparation.error) throw interruptedPreparation.error;
      for (const interrupted of interruptedPreparation.data || []) {
        await client.from("wallet_deposits").update({
          sweep_status: "pending",
          sweep_error: "PREPARATION_INTERRUPTED_BEFORE_BROADCAST",
        }).eq("id", interrupted.id)
          .eq("sweep_status", "sweeping")
          .eq("sweep_error", "PREPARING_SIGNED_TRANSACTION")
          .is("sweep_tx_hash", null);
      }

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
            sweep_error: "PREPARING_SIGNED_TRANSACTION",
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

        let persistedSweepHash: string | null = null;
        try {
          const index = Number(wallet.derivation_index);
          if (!Number.isSafeInteger(index) || index < 0 || index > 2147483647) {
            throw new Error("INVALID_DERIVATION_INDEX");
          }
          // Probe the common historical EVM roots used by address provisioning:
          // m/44'/60'/0' with one or more /0 levels. This is read-only key derivation.
          // A candidate is never used unless its address exactly equals the stored row.
          const candidateNodes: HDNodeWallet[] = [];
          const addCandidates = (root: HDNodeWallet) => {
            for (let zeroLevels = 1; zeroLevels <= 4; zeroLevels++) {
              const candidatePath = [...Array(zeroLevels).fill("0"), String(index)].join("/");
              try {
                candidateNodes.push(root.derivePath(candidatePath));
              } catch {
                // Ignore paths a configured extended key cannot derive.
              }
            }
          };
          if (xprvRoot) addCandidates(xprvRoot);
          if (mnemonicRoot) addCandidates(mnemonicRoot);
          const targetAddress = String(wallet.address).toLowerCase();
          const matchingCandidates = candidateNodes.filter((candidate) =>
            candidate.address.toLowerCase() === targetAddress
          );
          const uniqueMatches = [...new Map(matchingCandidates.map((candidate) => [candidate.privateKey, candidate])).values()];
          if (uniqueMatches.length === 0) throw new Error("DERIVED_SIGNER_ADDRESS_MISMATCH");
          if (uniqueMatches.length > 1) throw new Error("AMBIGUOUS_SIGNER_DERIVATION");
          const signer = uniqueMatches[0].connect(provider);
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
          let gasUnitPrice: bigint;
          let feeOverrides: { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } | { gasPrice: bigint };
          if (feeData.maxFeePerGas !== null && feeData.maxPriorityFeePerGas !== null) {
            gasUnitPrice = feeData.maxFeePerGas;
            feeOverrides = { maxFeePerGas: feeData.maxFeePerGas, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas };
          } else if (feeData.gasPrice !== null) {
            gasUnitPrice = feeData.gasPrice;
            feeOverrides = { gasPrice: feeData.gasPrice };
          } else {
            throw new Error("GAS_PRICE_UNAVAILABLE");
          }
          const rawGasCost = gasEstimate * gasUnitPrice;
          const estimatedGasCostWithBuffer = rawGasCost + rawGasCost / 5n;
          const nativeBalance = await provider.getBalance(from);
          if (nativeBalance < estimatedGasCostWithBuffer) {
            throw new Error("INSUFFICIENT_NATIVE_GAS_FOR_SWEEP");
          }

          const nonce = await provider.getTransactionCount(from, "pending");
          const unsignedTransaction = {
            to: cfg.token,
            data: token.interface.encodeFunctionData("transfer", [treasury, amount]),
            nonce,
            chainId: cfg.chainId,
            gasLimit: gasEstimate + gasEstimate / 5n,
            ...feeOverrides,
          };
          const signedTransaction = await signer.signTransaction(unsignedTransaction);
          const txHash = keccak256(signedTransaction);
          const saved = await client.from("wallet_deposits")
            .update({
              sweep_tx_hash: txHash,
              sweep_status: "sweeping",
              sweep_error: "SIGNED_TRANSACTION_RECORDED_BEFORE_BROADCAST",
            })
            .eq("id", deposit.id)
            .eq("sweep_status", "sweeping")
            .is("sweep_tx_hash", null)
            .select("id")
            .maybeSingle();
          if (saved.error || !saved.data) {
            throw new Error("SWEEP_TRANSACTION_MARKER_NOT_SAVED_NO_BROADCAST");
          }
          persistedSweepHash = txHash;

          const tx = await provider.broadcastTransaction(signedTransaction);
          if (tx.hash.toLowerCase() !== txHash.toLowerCase()) {
            throw new Error("BROADCAST_TRANSACTION_HASH_MISMATCH");
          }
          const receipt = await tx.wait(1);
          if (!receipt || receipt.status !== 1) throw new Error("SWEEP_TRANSACTION_FAILED");
          const actualAmount = matchingTransferAmount(token, receipt.logs, from, treasury, amount);
          if (actualAmount !== amount) throw new Error("SWEEP_RECEIPT_EVENT_MISMATCH");
          const currentBlock = await provider.getBlockNumber();
          const confirmations = Math.max(0, currentBlock - receipt.blockNumber + 1);
          if (confirmations < cfg.confirmations) {
            await client.from("wallet_deposits").update({
              sweep_error: "WAITING_FOR_CONFIRMATIONS:" + confirmations + "/" + cfg.confirmations,
            }).eq("id", deposit.id).eq("sweep_tx_hash", txHash).eq("sweep_status", "sweeping");
            skipped++;
            summaries.push({
              chain,
              deposit_id: deposit.id,
              status: "waiting_for_confirmations",
              confirmations,
              required_confirmations: cfg.confirmations,
              tx_hash: txHash,
              amount: formatUnits(amount, cfg.tokenDecimals),
            });
            continue;
          }

          const completed = await client.from("wallet_deposits")
            .update({
              sweep_status: "swept",
              swept_at: new Date().toISOString(),
              sweep_error: null,
            })
            .eq("id", deposit.id)
            .eq("sweep_tx_hash", txHash)
            .eq("sweep_status", "sweeping")
            .select("id")
            .maybeSingle();
          if (completed.error || !completed.data) {
            throw new Error("SWEEP_RECEIPT_CONFIRMED_DATABASE_RECONCILIATION_PENDING");
          }

          swept++;
          summaries.push({
            chain,
            deposit_id: deposit.id,
            status: "swept",
            tx_hash: txHash,
            amount: formatUnits(amount, cfg.tokenDecimals),
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "SWEEP_FAILED";
          if (persistedSweepHash) {
            // The transaction may already be in the mempool/mined. Keep its hash
            // and reconcile the same transaction on the next worker run.
            await client.from("wallet_deposits").update({
              sweep_status: "sweeping",
              sweep_error: "BROADCAST_RESULT_UNCERTAIN:" + message.slice(0, 350),
            }).eq("id", deposit.id).eq("sweep_tx_hash", persistedSweepHash);
            skipped++;
            summaries.push({ chain, deposit_id: deposit.id, status: "reconcile_existing_transaction", tx_hash: persistedSweepHash });
          } else {
            failed++;
            await client.from("wallet_deposits").update({
              sweep_status: "failed",
              sweep_error: message.slice(0, 500),
            }).eq("id", deposit.id).is("sweep_tx_hash", null);

            summaries.push({ chain, deposit_id: deposit.id, status: "failed", error: message });
          }
        }
      }
    }

    const blockedChains = summaries.filter((item) =>
      ["configuration_missing", "invalid_treasury_address", "rpc_chain_id_mismatch"].includes(String(item.status))
    );
    return json({
      ok: true,
      ready: failed === 0 && blockedChains.length === 0,
      swept,
      skipped,
      failed,
      blocked_chains: blockedChains,
      summaries,
    });
  } catch (error) {
    console.error("deposit-sweep failed", error);
    return json({ ok: false, error: "DEPOSIT_SWEEP_ERROR" }, 500);
  }
});
