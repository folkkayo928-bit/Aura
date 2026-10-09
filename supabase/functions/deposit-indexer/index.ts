import { createClient } from "npm:@supabase/supabase-js@2";

const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const EVM = {
  ethereum: { confirmations: 12, rpc: "AURA_EVM_RPC_ETHEREUM", alchemy: "eth-mainnet", token: "0xdAC17F958D2ee523a2206206994597C13D831ec7", tokenDecimals: 6 },
  polygon: { confirmations: 30, rpc: "AURA_EVM_RPC_POLYGON", alchemy: "polygon-mainnet", token: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", tokenDecimals: 6 },
  arbitrum: { confirmations: 20, rpc: "AURA_EVM_RPC_ARBITRUM", alchemy: "arb-mainnet", token: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", tokenDecimals: 6 },
  bsc: { confirmations: 15, rpc: "AURA_EVM_RPC_BSC", alchemy: "bnb-mainnet", token: "0x55d398326f99059fF775485246999027B3197955", tokenDecimals: 18 },
} as const;

function secretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  try { return JSON.parse(raw).default as string; }
  catch { return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""; }
}
function db() { return createClient(Deno.env.get("SUPABASE_URL")!, secretKey()); }

async function authorized(client: ReturnType<typeof db>, req: Request) {
  const provided = req.headers.get("x-aura-worker-secret") || "";
  const { data, error } = await client.rpc("get_aura_worker_secret");
  return !error && !!data && provided.length > 0 && provided === data;
}
async function alchemyKey(client: ReturnType<typeof db>) {
  const { data } = await client.rpc("get_aura_alchemy_api_key");
  return String(data || "").trim();
}
type Chain = keyof typeof EVM;

const EVM_READ_RPC_FALLBACKS: Record<Chain, string[]> = {
  ethereum: [
    "https://ethereum-rpc.publicnode.com",
    "https://eth.drpc.org",
  ],
  polygon: [
    "https://polygon.drpc.org",
    "https://polygon-bor-rpc.publicnode.com",
  ],
  arbitrum: [
    "https://arb1.arbitrum.io/rpc",
    "https://arbitrum.drpc.org",
    "https://arbitrum-one.public.blastapi.io",
    "https://arbitrum-one-rpc.publicnode.com",
  ],
  bsc: [
    "https://bsc-rpc.publicnode.com",
    "https://bsc-mainnet.public.blastapi.io",
    "https://public.1rpc.io/bnb",
  ],
};

const preferredReadRpc: Partial<Record<Chain, string>> = {};

function rpcUrl(chain: Chain, apiKey: string) {
  const configured = Deno.env.get(EVM[chain].rpc)?.trim();
  if (configured) return configured;
  if (apiKey) return `https://${EVM[chain].alchemy}.g.alchemy.com/v2/${apiKey}`;
  return EVM_READ_RPC_FALLBACKS[chain][0] || "";
}

async function rpc(url: string, method: string, params: unknown[], chain?: Chain) {
  const fallbacks = chain ? EVM_READ_RPC_FALLBACKS[chain] : [];
  const endpoints = [...new Set([
    ...(chain && preferredReadRpc[chain] ? [preferredReadRpc[chain]!] : []),
    ...(url ? [url] : []),
    ...fallbacks,
  ])];
  let lastError: unknown = new Error("RPC_UNAVAILABLE");
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        const detail = (await response.text().catch(() => "")).slice(0, 300);
        throw new Error("RPC_HTTP_" + response.status + ":" + detail);
      }
      const payload = await response.json();
      if (payload.error) {
        throw new Error("RPC_ERROR:" + String(payload.error.message || "unknown").slice(0, 300));
      }
      if (chain) preferredReadRpc[chain] = endpoint;
      return payload.result;
    } catch (error) {
      lastError = error;
      console.warn("EVM read RPC endpoint failed; trying the next endpoint", {
        chain: chain || "unknown",
        method,
        endpoint: new URL(endpoint).host,
        error: String(error).slice(0, 400),
      });
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function firstBlockAtOrAfterTimestamp(
  url: string,
  chain: Chain,
  latest: bigint,
  targetTimestamp: bigint,
): Promise<bigint> {
  let low = 0n;
  let high = latest;
  while (low < high) {
    const middle = (low + high) / 2n;
    const block = await rpc(
      url,
      "eth_getBlockByNumber",
      ["0x" + middle.toString(16), false],
      chain,
    );
    if (!block?.timestamp) throw new Error("BLOCK_TIMESTAMP_UNAVAILABLE");
    if (hexToBigInt(String(block.timestamp)) < targetTimestamp) low = middle + 1n;
    else high = middle;
  }
  // Start a little before wallet creation to avoid missing a deposit at the boundary.
  return low > 100n ? low - 100n : 0n;
}

function padTopicAddress(address: string) {
  return "0x" + address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}
function topicAddress(topic: string) {
  return "0x" + topic.slice(-40).toLowerCase();
}
function hexToBigInt(value: string | null | undefined) {
  return value ? BigInt(value) : 0n;
}
function decimalFromUnits(units: bigint, decimals = 6) {
  const base = 10n ** BigInt(decimals);
  const whole = units / base;
  const fraction = (units % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });

  const client = db();
  if (!(await authorized(client, req))) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  try {
    const alchemy = await alchemyKey(client);
    const { data: wallets, error: walletError } = await client
      .from("onchain_wallets").select("user_id,chain,address,created_at")
      .in("chain", Object.keys(EVM));
    if (walletError) throw walletError;

    const byChain = new Map<string, Array<{ user_id: string; address: string; created_at: string }>>();
    for (const wallet of wallets || []) {
      const chain = String(wallet.chain).toLowerCase();
      if (!/^0x[0-9a-fA-F]{40}$/.test(wallet.address || "")) continue;
      const list = byChain.get(chain) || [];
      list.push({ user_id: wallet.user_id, address: wallet.address.toLowerCase(), created_at: String(wallet.created_at || new Date().toISOString()) });
      byChain.set(chain, list);
    }

    let detected = 0, confirmed = 0, credited = 0, pending = 0;
    // Startup backfills begin near wallet creation, so allow enough filtered history
    // per minute to catch up without silently jumping over unscanned blocks.
    const standardScanBlocks = Math.min(Math.max(Number(Deno.env.get("AURA_DEPOSIT_SCAN_BLOCKS") || "2000"), 1000), 5000);
    const arbitrumScanBlocks = Math.min(Math.max(Number(Deno.env.get("AURA_ARBITRUM_DEPOSIT_SCAN_BLOCKS") || "5000"), 2000), 10000);
    const bscScanBlocks = Math.min(Math.max(Number(Deno.env.get("AURA_BSC_DEPOSIT_SCAN_BLOCKS") || "5000"), 2000), 10000);
    const chainResults: Array<Record<string, unknown>> = [];

    for (const [chain, tracked] of byChain) {
      const typedChain = chain as keyof typeof EVM;
      const cfg = EVM[typedChain];
      if (!cfg || tracked.length === 0) continue;
      const rpcEndpoint = rpcUrl(typedChain, alchemy);
      if (!rpcEndpoint) continue;
      const chainScanBlocks = typedChain === "bsc"
        ? bscScanBlocks
        : typedChain === "arbitrum"
          ? arbitrumScanBlocks
          : standardScanBlocks;

      try {
      const latest = hexToBigInt(await rpc(rpcEndpoint, "eth_blockNumber", [], typedChain));
      const tokenDecimalsResult = await rpc(rpcEndpoint, "eth_call", [
        { to: cfg.token, data: "0x313ce567" },
        "latest",
      ], typedChain);
      const tokenDecimals = Number(hexToBigInt(String(tokenDecimalsResult || "0x0")));
      if (!Number.isInteger(tokenDecimals) || tokenDecimals < 0 || tokenDecimals > 36) {
        throw new Error("INVALID_TOKEN_DECIMALS");
      }
      if (tokenDecimals !== cfg.tokenDecimals) {
        throw new Error(`TOKEN_DECIMALS_MISMATCH:configured=${cfg.tokenDecimals},actual=${tokenDecimals}`);
      }

      const cursorQuery = await client.from("wallet_deposit_scan_cursors")
        .select("last_scanned_block").eq("chain", chain).maybeSingle();
      if (cursorQuery.error) throw cursorQuery.error;
      const cursorValue = cursorQuery.data?.last_scanned_block;
      let from: bigint;
      if (cursorValue !== null && cursorValue !== undefined) {
        from = BigInt(cursorValue) + 1n;
      } else {
        const oldestWalletCreatedAt = tracked.reduce((oldest, wallet) =>
          Date.parse(wallet.created_at) < Date.parse(oldest) ? wallet.created_at : oldest,
          tracked[0].created_at,
        );
        const targetTimestamp = BigInt(Math.max(0, Math.floor(Date.parse(oldestWalletCreatedAt) / 1000) - 600));
        from = await firstBlockAtOrAfterTimestamp(rpcEndpoint, typedChain, latest, targetTimestamp);
      }
      if (from > latest) {
        chainResults.push({ chain, ok: true, from: from.toString(), to: latest.toString(), scanned_blocks: 0 });
        continue;
      }
      const scanToBlock = from + BigInt(chainScanBlocks) - 1n < latest
        ? from + BigInt(chainScanBlocks) - 1n
        : latest;
      const recipientTopics = [...new Set(tracked.map((w) => padTopicAddress(w.address)))];

      // Persist only a successfully scanned range. BSC gets a larger window
      // because its blocks arrive much faster than the once-per-minute cron.
      // Small chunks keep this compatible with restrictive RPC providers.
      const logs: any[] = [];
      // Filtered logs for all four configured USDT contracts were tested at 100-block ranges.
      const maxLogRange = 100n;
      for (let chunkFrom = from; chunkFrom <= scanToBlock;) {
        const chunkTo = chunkFrom + maxLogRange - 1n < scanToBlock
          ? chunkFrom + maxLogRange - 1n
          : scanToBlock;
        const chunkLogs = await rpc(rpcEndpoint, "eth_getLogs", [{
          fromBlock: "0x" + chunkFrom.toString(16),
          toBlock: "0x" + chunkTo.toString(16),
          address: cfg.token,
          topics: [ERC20_TRANSFER_TOPIC, null, recipientTopics],
        }], chain as keyof typeof EVM);
        if (Array.isArray(chunkLogs)) logs.push(...chunkLogs);
        chunkFrom = chunkTo + 1n;
      }

      const userByAddress = new Map(tracked.map((w) => [w.address, w.user_id]));
      const grouped = new Map<string, { user_id: string; destination_address: string; tx_hash: string; amount_units: bigint }>();

      for (const log of Array.isArray(logs) ? logs : []) {
        if (!Array.isArray(log.topics) || log.topics.length < 3) continue;
        const destination = topicAddress(String(log.topics[2]));
        const userId = userByAddress.get(destination);
        const txHash = String(log.transactionHash || "");
        if (!userId || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) continue;

        const key = txHash.toLowerCase() + ":" + destination;
        const current = grouped.get(key) || { user_id: userId, destination_address: destination, tx_hash: txHash, amount_units: 0n };
        current.amount_units += hexToBigInt(String(log.data || "0x0"));
        grouped.set(key, current);
      }

      for (const item of grouped.values()) {
        if (item.amount_units <= 0n) continue;
        const receipt = await rpc(rpcEndpoint, "eth_getTransactionReceipt", [item.tx_hash], chain as keyof typeof EVM);
        if (!receipt || receipt.status !== "0x1") continue;

        const confirmations = latest >= hexToBigInt(receipt.blockNumber)
          ? Number(latest - hexToBigInt(receipt.blockNumber) + 1n) : 0;
        // Wallet balances and ledger rows are stored as NUMERIC(..., 8).
        // Keep the original on-chain amount available from the tx hash, but
        // floor the amount credited to the wallet's supported 8-decimal precision.
        // Reject only deposits too small to represent at that precision.
        const walletDecimals = 8;
        const walletPrecisionScale = tokenDecimals > walletDecimals
          ? 10n ** BigInt(tokenDecimals - walletDecimals)
          : 1n;
        const creditUnits = (item.amount_units / walletPrecisionScale) * walletPrecisionScale;
        if (creditUnits <= 0n) {
          console.warn("Deposit is below AURA wallet precision; manual reconciliation required", item.tx_hash);
          continue;
        }
        if (creditUnits !== item.amount_units) {
          console.warn("Deposit amount normalized down to AURA wallet precision", {
            tx_hash: item.tx_hash,
            chain,
            on_chain_amount: decimalFromUnits(item.amount_units, tokenDecimals),
            credited_amount: decimalFromUnits(creditUnits, cfg.tokenDecimals),
            discarded_subprecision_units: (item.amount_units - creditUnits).toString(),
          });
        }
        const amount = decimalFromUnits(creditUnits, tokenDecimals);

        const { data: existing } = await client.from("wallet_deposits")
          .select("id,status,credited_at")
          .eq("chain", chain).eq("tx_hash", item.tx_hash)
          .eq("token_contract", cfg.token).maybeSingle();

        if (!existing) {
          const { error } = await client.from("wallet_deposits").insert({
            user_id: item.user_id, chain, token_symbol: "USDT", token_contract: cfg.token,
            destination_address: item.destination_address, tx_hash: item.tx_hash, amount,
            confirmations, required_confirmations: cfg.confirmations,
            status: confirmations >= cfg.confirmations ? "confirmed" : "detected",
            detected_at: new Date().toISOString(),
            confirmed_at: confirmations >= cfg.confirmations ? new Date().toISOString() : null,
          });
          if (error && !String(error.message).toLowerCase().includes("duplicate")) throw error;
          if (!error) detected++;
        }
      }
      const { error: cursorWriteError } = await client.from("wallet_deposit_scan_cursors").upsert({
        chain,
        last_scanned_block: scanToBlock.toString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "chain" });
      if (cursorWriteError) throw cursorWriteError;
      chainResults.push({
        chain,
        ok: true,
        from: from.toString(),
        to: scanToBlock.toString(),
        scanned_blocks: Number(scanToBlock - from + 1n),
        rpc_host: new URL(preferredReadRpc[typedChain] || rpcEndpoint).host,
      });
      } catch (chainError) {
        console.warn("Deposit scan skipped for chain", chain, String(chainError).slice(0, 500));
        chainResults.push({ chain, ok: false, error: String(chainError).slice(0, 500) });
      }
    }

    const { data: pendingDeposits, error: pendingError } = await client
      .from("wallet_deposits").select("id,user_id,amount,chain,tx_hash,required_confirmations,status")
      .in("status", ["detected", "confirmed"]).limit(100);
    if (pendingError) throw pendingError;

    for (const deposit of pendingDeposits || []) {
      const cfg = EVM[String(deposit.chain).toLowerCase() as keyof typeof EVM];
      if (!cfg) continue;
      const chain = String(deposit.chain).toLowerCase() as keyof typeof EVM;
      const rpcEndpoint = rpcUrl(chain, alchemy);
      if (!rpcEndpoint) continue;

      try {
      const receipt = await rpc(rpcEndpoint, "eth_getTransactionReceipt", [deposit.tx_hash], chain);
      if (!receipt || receipt.status !== "0x1") { pending++; continue; }

      const latest = hexToBigInt(await rpc(rpcEndpoint, "eth_blockNumber", [], chain));
      const mined = hexToBigInt(receipt.blockNumber);
      const confirmations = latest >= mined ? Number(latest - mined + 1n) : 0;
      const required = Number(deposit.required_confirmations || cfg.confirmations);

      if (confirmations < required) {
        await client.from("wallet_deposits").update({ confirmations, status: "detected" }).eq("id", deposit.id);
        pending++;
        continue;
      }

      const { error: confirmError } = await client.from("wallet_deposits").update({
        confirmations, status: "confirmed", confirmed_at: new Date().toISOString(),
      }).eq("id", deposit.id).in("status", ["detected", "confirmed"]);
      if (confirmError) throw confirmError;

      confirmed++;
      const { data: creditResult, error: creditError } = await client.rpc(
        "credit_confirmed_wallet_deposit", { p_deposit_id: deposit.id },
      );
      if (creditError) throw creditError;
      if (creditResult?.ok && !creditResult?.already_credited) {
        credited++;
        // Notification failures must never undo or block an already completed deposit credit.
        try {
          const { data: profile } = await client.from("profiles")
            .select("telegram_user_id,telegram_bot_alerts").eq("id", deposit.user_id).maybeSingle();
          const telegramUserId = String(profile?.telegram_user_id || "").trim();
          if (/^\d{1,20}$/.test(telegramUserId) && profile?.telegram_bot_alerts !== false) {
            const { error: queueError } = await client.from("aura_telegram_notification_queue").insert({
              user_id: deposit.user_id,
              event_type: "deposit_confirmed",
              title: "USDT deposit confirmed",
              message: `Your ${String(deposit.amount)} USDT deposit on ${chain.toUpperCase()} is confirmed and has been credited to your AURA Vault. Transaction: ${String(deposit.tx_hash)}`,
            });
            if (queueError) console.warn("Unable to queue Telegram deposit notification", queueError.message);
          }
        } catch (notificationError) {
          console.warn("Telegram deposit notification enqueue failed", String(notificationError).slice(0, 500));
        }
      }
      } catch (depositError) {
        console.warn("Pending deposit processing deferred", String(deposit.chain), String(depositError).slice(0, 500));
        pending++;
      }
    }

    return Response.json({
      ok: chainResults.every((result) => result.ok === true),
      chains: [...byChain.keys()],
      chain_results: chainResults,
      scanned_wallets: wallets?.length || 0,
      detected,
      confirmed,
      credited,
      pending,
    });
  } catch (error) {
    console.error("deposit-indexer failed", error);
    return Response.json({ error: "DEPOSIT_INDEXER_ERROR" }, { status: 500 });
  }
});
