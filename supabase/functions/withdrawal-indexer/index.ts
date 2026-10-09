import { createClient } from "npm:@supabase/supabase-js@2";

const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function secretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  try { return JSON.parse(raw).default as string; }
  catch { return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""; }
}
function db() {
  return createClient(Deno.env.get("SUPABASE_URL")!, secretKey());
}
async function authorized(client: ReturnType<typeof db>, req: Request) {
  const provided = req.headers.get("x-aura-worker-secret") || "";
  const { data, error } = await client.rpc("get_aura_worker_secret");
  return !error && !!data && provided.length > 0 && provided === data;
}
async function notifyTelegramWithdrawal(client: ReturnType<typeof db>, userId: string, title: string, message: string) {
  try {
    const { data: profile, error: profileError } = await client.from("profiles")
      .select("telegram_user_id").eq("id", userId).maybeSingle();
    if (profileError) throw profileError;
    const telegramUserId = String(profile?.telegram_user_id || "").trim();
    if (!/^\d{1,20}$/.test(telegramUserId)) return;
    const { data: secret, error: secretError } = await client.rpc("get_aura_telegram_notify_secret");
    if (secretError || !secret) return;
    const response = await fetch("https://aura-8bom.onrender.com/api/internal/telegram/withdrawal-notify", {
      method: "POST",
      headers: { "content-type": "application/json", "x-aura-telegram-notify-secret": String(secret) },
      body: JSON.stringify({ telegram_user_id: telegramUserId, title, message }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) console.warn("Telegram withdrawal status notification was not delivered", response.status);
  } catch (error) {
    console.warn("Telegram withdrawal status notification failed", String(error).slice(0, 500));
  }
}
const EVM = {
  ethereum: { confirmations: 12, rpc: "AURA_EVM_RPC_ETHEREUM", token: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
  polygon: { confirmations: 30, rpc: "AURA_EVM_RPC_POLYGON", token: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" },
  arbitrum: { confirmations: 20, rpc: "AURA_EVM_RPC_ARBITRUM", token: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" },
} as const;

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
function hexToBigInt(value: string | null | undefined) {
  return value ? BigInt(value) : 0n;
}
function usdtToBaseUnits(value: unknown): bigint {
  const text = String(value);
  if (!/^\d+(?:\.\d{1,6})?$/.test(text)) throw new Error("INVALID_USDT_AMOUNT_PRECISION");
  const parts = text.split(".");
  return BigInt(parts[0]) * 1_000_000n + BigInt(((parts[1] || "") + "000000").slice(0, 6));
}
function matchesExpectedUsdtTransfer(receipt: any, tokenAddress: string, destinationAddress: string, amount: bigint) {
  const destinationTopic = "0x" + destinationAddress.replace(/^0x/i, "").toLowerCase().padStart(64, "0");
  return Array.isArray(receipt.logs) && receipt.logs.some((log: any) =>
    String(log.address || "").toLowerCase() === tokenAddress.toLowerCase()
    && Array.isArray(log.topics)
    && String(log.topics[0] || "").toLowerCase() === ERC20_TRANSFER_TOPIC
    && String(log.topics[2] || "").toLowerCase() === destinationTopic
    && hexToBigInt(String(log.data || "0x")) === amount
  );
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });
  const client = db();
  if (!(await authorized(client, req))) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  try {
    const { data: messages, error } = await client.rpc("aura_worker_read_confirmations", {
      p_visibility_timeout: 300,
      p_qty: 10,
    });
    if (error) throw error;
    const items = Array.isArray(messages) ? messages : [];
    let checked = 0, confirmed = 0, pending = 0, failed = 0;

    for (const item of items) {
      const msgId = Number(item.msg_id);
      const withdrawalId = String(item.message?.withdrawal_id || "");
      if (!withdrawalId) {
        await client.rpc("aura_worker_delete_confirmation_message", { p_msg_id: msgId });
        continue;
      }

      const { data: withdrawal, error: withdrawalError } = await client
        .from("wallet_withdrawals").select("*").eq("id", withdrawalId).maybeSingle();
      if (withdrawalError) throw withdrawalError;
      if (!withdrawal || withdrawal.status !== "broadcast" || !withdrawal.tx_hash) {
        await client.rpc("aura_worker_delete_confirmation_message", { p_msg_id: msgId });
        continue;
      }

      const chain = String(withdrawal.chain).toLowerCase() as keyof typeof EVM;
      const config = EVM[chain];
      if (!config) {
        failed++;
        console.error("Unsupported withdrawal chain", withdrawalId, chain);
        continue;
      }
      const rpcUrl = Deno.env.get(config.rpc);
      if (!rpcUrl) {
        pending++;
        console.error("Missing RPC configuration for withdrawal chain", chain);
        continue;
      }

      try {
        const receipt = await rpc(rpcUrl, "eth_getTransactionReceipt", [withdrawal.tx_hash]);
        if (!receipt) {
          pending++;
          continue;
        }
        if (receipt.status !== "0x1") {
          const { data: refundResult, error: refundError } = await client.rpc("refund_reverted_wallet_withdrawal", {
            p_withdrawal_id: withdrawalId,
          });
          if (refundError || !refundResult?.ok) {
            throw new Error(refundError?.message || "WITHDRAWAL_REFUND_FAILED");
          }
          await client.rpc("aura_worker_delete_confirmation_message", { p_msg_id: msgId });
          await notifyTelegramWithdrawal(client, String(withdrawal.user_id), "Withdrawal failed on-chain", `The ${String(withdrawal.amount)} USDT withdrawal transaction reverted. AURA has processed the refund path for the reserved amount and fee.`);
          failed++;
          continue;
        }

        const expectedAmount = usdtToBaseUnits(withdrawal.amount);
        const matched = matchesExpectedUsdtTransfer(receipt, config.token, withdrawal.destination_address, expectedAmount);
        if (!matched) {
          await client.from("wallet_withdrawals").update({
            status: "rejected",
            rejection_reason: "ONCHAIN_TRANSFER_NOT_MATCHED",
            last_worker_error: "Receipt succeeded but the expected USDT token, destination, and amount did not all match.",
            updated_at: new Date().toISOString(),
          }).eq("id", withdrawalId).eq("status", "broadcast");
          await client.rpc("aura_worker_delete_confirmation_message", { p_msg_id: msgId });
          await notifyTelegramWithdrawal(client, String(withdrawal.user_id), "Withdrawal needs review", "The blockchain transaction did not match the expected USDT token, destination, and amount. AURA has stopped automatic confirmation for security.");
          failed++;
          continue;
        }

        const latest = hexToBigInt(await rpc(rpcUrl, "eth_blockNumber", []));
        const mined = hexToBigInt(receipt.blockNumber);
        const confirmations = latest >= mined ? Number(latest - mined + 1n) : 0;
        const required = Number(config.confirmations);
        if (confirmations >= required) {
          await client.from("wallet_withdrawals").update({
            status: "confirmed_onchain",
            confirmed_onchain_at: new Date().toISOString(),
            last_worker_error: null,
            updated_at: new Date().toISOString(),
            security_note: "On-chain USDT transfer confirmed with " + confirmations + " confirmations.",
          }).eq("id", withdrawalId).eq("status", "broadcast");
          await client.rpc("aura_worker_delete_confirmation_message", { p_msg_id: msgId });
          await notifyTelegramWithdrawal(client, String(withdrawal.user_id), "Withdrawal confirmed", `${String(withdrawal.amount)} USDT is confirmed on ${chain.toUpperCase()} with ${confirmations} blockchain confirmations. Transaction: ${withdrawal.tx_hash}`);
          confirmed++;
        } else {
          pending++;
        }
        checked++;
      } catch (error) {
        pending++;
        console.error("Withdrawal confirmation attempt failed", withdrawalId, String(error).slice(0, 1000));
      }
    }
    return Response.json({ ok: true, checked, confirmed, pending, failed });
  } catch (error) {
    console.error("withdrawal-indexer failed", error);
    return Response.json({ error: "INDEXER_ERROR" }, { status: 500 });
  }
});