import { createClient } from "npm:@supabase/supabase-js@2";

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const EVM = {
  ethereum: { confirmations: 12, rpc: "AURA_EVM_RPC_ETHEREUM", token: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, symbol: "USDT", scanBlocks: 1000 },
  polygon: { confirmations: 30, rpc: "AURA_EVM_RPC_POLYGON", token: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6, symbol: "USDT0", scanBlocks: 1000 },
  arbitrum: { confirmations: 20, rpc: "AURA_EVM_RPC_ARBITRUM", token: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6, symbol: "USDT", scanBlocks: 1000 },
  bsc: { confirmations: 15, rpc: "AURA_EVM_RPC_BSC", token: "0x55d398326f99059fF775485246999027B3197955", decimals: 18, symbol: "USDT", scanBlocks: 2000 },
} as const;
type Chain = keyof typeof EVM;

const FALLBACKS: Record<Chain, string[]> = {
  ethereum: ["https://eth.drpc.org", "https://ethereum-rpc.publicnode.com"],
  polygon: ["https://polygon.drpc.org", "https://polygon-bor-rpc.publicnode.com"],
  arbitrum: ["https://arbitrum.drpc.org", "https://arb1.arbitrum.io/rpc", "https://arbitrum-one-rpc.publicnode.com"],
  bsc: ["https://bsc.drpc.org", "https://bsc-rpc.publicnode.com", "https://public.1rpc.io/bnb"],
};

function serviceKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  try { return JSON.parse(raw).default as string; }
  catch { return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""; }
}
function db() { return createClient(Deno.env.get("SUPABASE_URL")!, serviceKey()); }

async function authorized(client: ReturnType<typeof db>, req: Request) {
  const provided = req.headers.get("x-aura-worker-secret") || "";
  const { data, error } = await client.rpc("get_aura_worker_secret");
  return !error && !!data && provided.length > 0 && provided === data;
}

const preferredRpc: Partial<Record<Chain, string>> = {};
async function rpc(chain: Chain, method: string, params: unknown[]) {
  const endpoints = [...new Set([
    ...(preferredRpc[chain] ? [preferredRpc[chain]!] : []),
    Deno.env.get(EVM[chain].rpc)?.trim() || "",
    ...FALLBACKS[chain],
  ].filter(Boolean))];
  let lastError: unknown = new Error("RPC_UNAVAILABLE");
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(7000),
      });
      if (!response.ok) throw new Error("RPC_HTTP_" + response.status);
      const payload = await response.json();
      if (payload.error) throw new Error("RPC_ERROR:" + String(payload.error.message || "unknown").slice(0, 200));
      preferredRpc[chain] = endpoint;
      return payload.result;
    } catch (error) {
      lastError = error;
      console.warn("Personal wallet indexer RPC failed; trying fallback", {
        chain, method, host: safeHost(endpoint), error: String(error).slice(0, 240),
      });
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
function safeHost(value: string) {
  try { return new URL(value).host; } catch { return "invalid-rpc-url"; }
}
function asBigInt(value: unknown) {
  try { return BigInt(String(value || "0x0")); } catch { return 0n; }
}
function addressFromTopic(value: string) {
  return ("0x" + value.slice(-40)).toLowerCase();
}
function padAddress(value: string) {
  return "0x" + value.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}
function amountFromUnits(units: bigint, decimals: number) {
  const base = 10n ** BigInt(decimals);
  const whole = units / base;
  const fraction = (units % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? whole.toString() + "." + fraction : whole.toString();
}

function canonicalDecimal(value: string) {
  const [wholeRaw, fractionRaw = ""] = value.split(".");
  const whole = wholeRaw.replace(/^0+(?=\\d)/, "") || "0";
  const fraction = fractionRaw.replace(/0+$/, "");
  return fraction ? whole + "." + fraction : whole;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  if (req.method !== "POST") return Response.json({ ok: false, error: "METHOD_NOT_ALLOWED" }, { status: 405 });
  const client = db();
  if (!(await authorized(client, req))) return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  try {
    const { data: trackedRows, error: trackedError } = await client
      .from("personal_wallet_addresses")
      .select("user_id,address,created_at")
      .order("created_at", { ascending: true });
    if (trackedError) throw trackedError;
    const tracked = (trackedRows || [])
      .filter((row) => /^0x[0-9a-f]{40}$/.test(String(row.address || "")))
      .map((row) => ({ user_id: String(row.user_id), address: String(row.address).toLowerCase(), created_at: String(row.created_at) }));
    if (!tracked.length) return Response.json({ ok: true, tracked_wallets: 0, chains: [], detected: 0, confirmed: 0 });

    const byAddress = new Map<string, string>();
    for (const wallet of tracked) byAddress.set(wallet.address, wallet.user_id);
    const addressTopics = [...new Set(tracked.map((wallet) => padAddress(wallet.address)))];
    const detectedBefore = Date.now();
    let detected = 0;
    let confirmed = 0;
    const chainResults: Array<Record<string, unknown>> = [];
    const latestByChain: Partial<Record<Chain, bigint>> = {};

    for (const chain of Object.keys(EVM) as Chain[]) {
      const cfg = EVM[chain];
      try {
        const latest = asBigInt(await rpc(chain, "eth_blockNumber", []));
        latestByChain[chain] = latest;
        const decimalsResult = await rpc(chain, "eth_call", [{ to: cfg.token, data: "0x313ce567" }, "latest"]);
        const actualDecimals = Number(asBigInt(decimalsResult));
        if (actualDecimals !== cfg.decimals) throw new Error("TOKEN_DECIMALS_MISMATCH");

        const cursorResult = await client.from("personal_wallet_scan_cursors")
          .select("last_scanned_block").eq("network", chain).maybeSingle();
        if (cursorResult.error) throw cursorResult.error;
        const previousCursor = cursorResult.data?.last_scanned_block;
        // First-time tracking is deliberately bounded: it is not a claim of full historical backfill.
        const from = previousCursor === null || previousCursor === undefined
          ? (latest > BigInt(cfg.scanBlocks) ? latest - BigInt(cfg.scanBlocks) : 0n)
          : BigInt(previousCursor) + 1n;
        if (from > latest) {
          chainResults.push({ network: chain, ok: true, scanned_blocks: 0, latest_block: latest.toString() });
          continue;
        }
        const scanTo = from + BigInt(cfg.scanBlocks) - 1n < latest
          ? from + BigInt(cfg.scanBlocks) - 1n
          : latest;
        const logs: any[] = [];
        const topicBatches: string[][] = [];
        for (let i = 0; i < addressTopics.length; i += 100) topicBatches.push(addressTopics.slice(i, i + 100));

        for (let chunkFrom = from; chunkFrom <= scanTo;) {
          const chunkTo = chunkFrom + 9n < scanTo ? chunkFrom + 9n : scanTo;
          for (const batch of topicBatches) {
            const batchLogs = await rpc(chain, "eth_getLogs", [{
              fromBlock: "0x" + chunkFrom.toString(16),
              toBlock: "0x" + chunkTo.toString(16),
              address: cfg.token,
              topics: [TRANSFER_TOPIC, null, batch],
            }]);
            if (Array.isArray(batchLogs)) logs.push(...batchLogs);
          }
          chunkFrom = chunkTo + 1n;
        }

        const records = new Map<string, Record<string, unknown>>();
        for (const log of logs) {
          if (!Array.isArray(log.topics) || log.topics.length < 3) continue;
          if (String(log.address || "").toLowerCase() !== cfg.token.toLowerCase()) continue;
          const destination = addressFromTopic(String(log.topics[2]));
          const userId = byAddress.get(destination);
          const txHash = String(log.transactionHash || "").toLowerCase();
          if (!userId || !/^0x[0-9a-f]{64}$/.test(txHash)) continue;
          const units = asBigInt(log.data);
          if (units <= 0n) continue;
          const logIndex = Number(asBigInt(log.logIndex));
          const blockNumber = asBigInt(log.blockNumber);
          if (!Number.isSafeInteger(logIndex) || logIndex < 0) continue;
          const key = txHash + ":" + logIndex + ":" + destination;
          records.set(key, {
            user_id: userId,
            address: destination,
            network: chain,
            tx_hash: txHash,
            log_index: logIndex,
            block_number: blockNumber.toString(),
            from_address: addressFromTopic(String(log.topics[1])),
            to_address: destination,
            amount: amountFromUnits(units, cfg.decimals),
            token_symbol: cfg.symbol,
            token_contract: cfg.token.toLowerCase(),
            confirmations: Number(latest >= blockNumber ? latest - blockNumber + 1n : 0n),
            required_confirmations: cfg.confirmations,
            status: "detected",
          });
        }
        const rows = [...records.values()];
        if (rows.length) {
          const { error } = await client.from("personal_wallet_transfers").upsert(rows, {
            onConflict: "network,tx_hash,log_index,address",
            ignoreDuplicates: true,
          });
          if (error) throw error;
          detected += rows.length;
        }

        const { error: cursorError } = await client.from("personal_wallet_scan_cursors").upsert({
          network: chain,
          last_scanned_block: scanTo.toString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "network" });
        if (cursorError) throw cursorError;
        const { error: trackingError } = await client.from("personal_wallet_addresses")
          .update({ last_scanned_at: new Date().toISOString() }).in("address", tracked.map((wallet) => wallet.address));
        if (trackingError) throw trackingError;
        chainResults.push({
          network: chain, ok: true, from_block: from.toString(), to_block: scanTo.toString(),
          scanned_blocks: Number(scanTo - from + 1n), logs_found: rows.length, rpc_host: safeHost(preferredRpc[chain] || FALLBACKS[chain][0]),
        });
      } catch (error) {
        console.warn("Personal wallet transfer scan deferred", chain, String(error).slice(0, 400));
        chainResults.push({ network: chain, ok: false, error: "NETWORK_SCAN_UNAVAILABLE" });
      }
    }

    const { data: pendingRows, error: pendingError } = await client.from("personal_wallet_transfers")
      .select("id,network,tx_hash,log_index,block_number,from_address,to_address,amount,token_contract,required_confirmations,status")
      .eq("status", "detected")
      .limit(200);
    if (pendingError) throw pendingError;
    for (const transfer of pendingRows || []) {
      const chain = String(transfer.network) as Chain;
      if (!(chain in EVM)) continue;
      try {
        const latest = latestByChain[chain] ?? asBigInt(await rpc(chain, "eth_blockNumber", []));
        const receipt = await rpc(chain, "eth_getTransactionReceipt", [transfer.tx_hash]);
        if (!receipt) continue;
        if (String(receipt.status) !== "0x1") {
          const { error } = await client.from("personal_wallet_transfers").update({ status: "failed", confirmations: 0 }).eq("id", transfer.id).eq("status", "detected");
          if (error) throw error;
          continue;
        }
        const minedBlock = asBigInt(receipt.blockNumber);
        const confirmationsCount = Number(latest >= minedBlock ? latest - minedBlock + 1n : 0n);
        const expectedLogIndex = Number(transfer.log_index);
        const expectedFrom = String(transfer.from_address).toLowerCase();
        const expectedTo = String(transfer.to_address).toLowerCase();
        const expectedToken = String(transfer.token_contract).toLowerCase();
        const expectedAmount = String(transfer.amount);
        const verified = Array.isArray(receipt.logs) && receipt.logs.some((log: any) => {
          if (Number(asBigInt(log.logIndex)) !== expectedLogIndex ||
              String(log.address || "").toLowerCase() !== expectedToken ||
              !Array.isArray(log.topics) || log.topics.length < 3 ||
              String(log.topics[0]).toLowerCase() !== TRANSFER_TOPIC ||
              addressFromTopic(String(log.topics[1])) !== expectedFrom ||
              addressFromTopic(String(log.topics[2])) !== expectedTo) return false;
          return canonicalDecimal(amountFromUnits(asBigInt(log.data), EVM[chain].decimals)) === canonicalDecimal(expectedAmount);
        });
        const now = new Date().toISOString();
        if (verified && confirmationsCount >= Number(transfer.required_confirmations)) {
          const { error } = await client.from("personal_wallet_transfers").update({
            status: "confirmed", confirmations: confirmationsCount, block_number: minedBlock.toString(), confirmed_at: now,
          }).eq("id", transfer.id).eq("status", "detected");
          if (error) throw error;
          confirmed++;
        } else {
          const { error } = await client.from("personal_wallet_transfers").update({
            confirmations: confirmationsCount,
          }).eq("id", transfer.id).eq("status", "detected");
          if (error) throw error;
        }
      } catch (error) {
        console.warn("Personal wallet confirmation check deferred", String(transfer.network), String(error).slice(0, 240));
      }
    }

    return Response.json({
      ok: chainResults.every((item) => item.ok === true),
      tracked_wallets: tracked.length,
      chains: chainResults,
      detected,
      confirmed,
      duration_ms: Date.now() - detectedBefore,
      ledger_credit: false,
    });
  } catch (error) {
    console.error("personal-wallet-indexer failed", String(error).slice(0, 500));
    return Response.json({ ok: false, error: "PERSONAL_WALLET_INDEXER_ERROR" }, { status: 500 });
  }
});
