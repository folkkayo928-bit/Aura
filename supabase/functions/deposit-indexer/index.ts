import { createClient } from "npm:@supabase/supabase-js@2";

const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55aeb5b6f7e";

const EVM = {
  ethereum: { confirmations: 12, rpc: "AURA_EVM_RPC_ETHEREUM", token: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
  polygon: { confirmations: 30, rpc: "AURA_EVM_RPC_POLYGON", token: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" },
  arbitrum: { confirmations: 20, rpc: "AURA_EVM_RPC_ARBITRUM", token: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" },
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
async function rpc(url: string, method: string, params: unknown[]) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error("RPC_HTTP_" + response.status);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message || "RPC_ERROR");
  return payload.result;
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
    const { data: wallets, error: walletError } = await client
      .from("onchain_wallets").select("user_id,chain,address")
      .in("chain", ["ethereum", "polygon", "arbitrum"]);
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

    for (const [chain, tracked] of byChain) {
      const cfg = EVM[chain as keyof typeof EVM];
      if (!cfg || tracked.length === 0) continue;
      const rpcUrl = Deno.env.get(cfg.rpc);
      if (!rpcUrl) continue;

      const latest = hexToBigInt(await rpc(rpcUrl, "eth_blockNumber", []));
      const from = latest >= BigInt(scanBlocks - 1) ? latest - BigInt(scanBlocks - 1) : 0n;
      const recipientTopics = [...new Set(tracked.map((w) => padTopicAddress(w.address)))];

      const logs = await rpc(rpcUrl, "eth_getLogs", [{
        fromBlock: "0x" + from.toString(16),
        toBlock: "0x" + latest.toString(16),
        address: cfg.token,
        topics: [ERC20_TRANSFER_TOPIC, null, recipientTopics],
      }]);

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
        const receipt = await rpc(rpcUrl, "eth_getTransactionReceipt", [item.tx_hash]);
        if (!receipt || receipt.status !== "0x1") continue;

        const confirmations = latest >= hexToBigInt(receipt.blockNumber)
          ? Number(latest - hexToBigInt(receipt.blockNumber) + 1n) : 0;
        const amount = decimalFromUnits(item.amount_units);

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
    }

    const { data: pendingDeposits, error: pendingError } = await client
      .from("wallet_deposits").select("id,chain,tx_hash,required_confirmations,status")
      .in("status", ["detected", "confirmed"]).limit(100);
    if (pendingError) throw pendingError;

    for (const deposit of pendingDeposits || []) {
      const cfg = EVM[String(deposit.chain).toLowerCase() as keyof typeof EVM];
      if (!cfg) continue;
      const rpcUrl = Deno.env.get(cfg.rpc);
      if (!rpcUrl) continue;

      const receipt = await rpc(rpcUrl, "eth_getTransactionReceipt", [deposit.tx_hash]);
      if (!receipt || receipt.status !== "0x1") { pending++; continue; }

      const latest = hexToBigInt(await rpc(rpcUrl, "eth_blockNumber", []));
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
      if (creditResult?.ok && !creditResult?.already_credited) credited++;
    }

    return Response.json({ ok: true, chains: [...byChain.keys()], scanned_wallets: wallets?.length || 0, detected, confirmed, credited, pending });
  } catch (error) {
    console.error("deposit-indexer failed", error);
    return Response.json({ error: "DEPOSIT_INDEXER_ERROR" }, { status: 500 });
  }
});
