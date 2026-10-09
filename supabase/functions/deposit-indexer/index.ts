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
const BSC_READ_RPC_FALLBACKS = [
  "https://bsc.meowrpc.com",
  "https://bsc-mainnet.public.blastapi.io",
  "https://bsc-rpc.publicnode.com",
  "https://public.1rpc.io/bnb",
];
function rpcUrl(chain: keyof typeof EVM, apiKey: string) {
  const configured = Deno.env.get(EVM[chain].rpc)?.trim();
  if (configured) return configured;
  // The configured Alchemy application did not have BNB Mainnet enabled.
  // Start BSC reads on a log-capable provider; RPC calls fail over below.
  if (chain === "bsc") return BSC_READ_RPC_FALLBACKS[0];
  if (!apiKey) return "";
  return `https://${EVM[chain].alchemy}.g.alchemy.com/v2/${apiKey}`;
}
let preferredBscReadRpc: string | null = null;
async function rpc(url: string, method: string, params: unknown[], chain?: keyof typeof EVM) {
  const endpoints = chain === "bsc"
    ? [...new Set([...(preferredBscReadRpc ? [preferredBscReadRpc] : []), url, ...BSC_READ_RPC_FALLBACKS])]
    : [url];
  let lastError: unknown = new Error("RPC_UNAVAILABLE");
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        const detail = (await response.text().catch(() => "")).slice(0, 300);
        throw new Error("RPC_HTTP_" + response.status + ":" + detail);
      }
      const payload = await response.json();
      if (payload.error) {
        throw new Error("RPC_ERROR:" + String(payload.error.message || "unknown").slice(0, 300));
      }
      if (chain === "bsc") preferredBscReadRpc = endpoint;
      return payload.result;
    } catch (error) {
      lastError = error;
      console.warn(chain === "bsc"
        ? "BSC read RPC endpoint failed; trying the next endpoint"
        : "Read RPC endpoint failed", {
        chain: chain || "unknown",
        method,
        endpoint: new URL(endpoint).host,
        error: String(error).slice(0, 400),
      });
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
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
      .from("onchain_wallets").select("user_id,chain,address")
      .in("chain", Object.keys(EVM));
    if (walletError) throw walletError;

    const byChain = new Map<string, Array<{ user_id: string; address: string }>>();
    for (const wallet of wallets || []) {
      const chain = String(wallet.chain).toLowerCase();
      if (!/^0x[0-9a-fA-F]{40}$/.test(wallet.address || "")) continue;
      const list = byChain.get(chain) || [];
      list.push({ user_id: wallet.user_id, address: wallet.address.toLowerCase() });
      byChain.set(chain, list);
    }

    let detected = 0, confirmed = 0, credited = 0, pending = 0;
    const scanBlocks = Math.min(Math.max(Number(Deno.env.get("AURA_DEPOSIT_SCAN_BLOCKS") || "40"), 1), 200);
    const bscScanBlocks = Math.min(Math.max(Number(Deno.env.get("AURA_BSC_DEPOSIT_SCAN_BLOCKS") || "200"), 40), 200);

    for (const [chain, tracked] of byChain) {
      const typedChain = chain as keyof typeof EVM;
      const cfg = EVM[typedChain];
      if (!cfg || tracked.length === 0) continue;
      const rpcEndpoint = rpcUrl(typedChain, alchemy);
      if (!rpcEndpoint) continue;
      const chainScanBlocks = typedChain === "bsc" ? bscScanBlocks : scanBlocks;

      try {
      const latest = hexToBigInt(await rpc(rpcEndpoint, "eth_blockNumber", [], typedChain));
      const cursorQuery = await client.from("wallet_deposit_scan_cursors")
        .select("last_scanned_block").eq("chain", chain).maybeSingle();
      if (cursorQuery.error) throw cursorQuery.error;
      const cursorValue = cursorQuery.data?.last_scanned_block;
      const from = cursorValue !== null && cursorValue !== undefined
        ? BigInt(cursorValue) + 1n
        : latest >= BigInt(chainScanBlocks - 1)
          ? latest - BigInt(chainScanBlocks - 1)
          : 0n;
      if (from > latest) continue;
      const scanToBlock = from + BigInt(chainScanBlocks) - 1n < latest
        ? from + BigInt(chainScanBlocks) - 1n
        : latest;
      const recipientTopics = [...new Set(tracked.map((w) => padTopicAddress(w.address)))];

      // Persist only a successfully scanned range. BSC gets a larger window
      // because its blocks arrive much faster than the once-per-minute cron.
      // Small chunks keep this compatible with restrictive RPC providers.
      const logs: any[] = [];
      const maxLogRange = 10n;
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
        const amount = decimalFromUnits(item.amount_units, cfg.tokenDecimals);
        // AURA wallet accounting supports at most six USDT decimals.
        // Do not silently round or mis-credit BSC's 18-decimal token amounts.
        const walletPrecisionScale = 10n ** BigInt(cfg.tokenDecimals - 6);
        if (cfg.tokenDecimals > 6 && item.amount_units % walletPrecisionScale !== 0n) {
          console.warn("Deposit amount exceeds AURA wallet precision; manual reconciliation required", item.tx_hash);
          continue;
        }

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
      } catch (chainError) {
        console.warn("Deposit scan skipped for chain", chain, String(chainError).slice(0, 500));
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

    return Response.json({ ok: true, chains: [...byChain.keys()], scanned_wallets: wallets?.length || 0, detected, confirmed, credited, pending });
  } catch (error) {
    console.error("deposit-indexer failed", error);
    return Response.json({ error: "DEPOSIT_INDEXER_ERROR" }, { status: 500 });
  }
});
