import { createClient } from "npm:@supabase/supabase-js@2";
import { createPublicClient, createWalletClient, http, parseUnits, type Address, type Hex } from "npm:viem@2";
import { privateKeyToAccount } from "npm:viem@2/accounts";

const ERC20_ABI = [{
  type: "function", name: "transfer", stateMutability: "nonpayable",
  inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
  outputs: [{ name: "", type: "bool" }],
}, {
  type: "function", name: "balanceOf", stateMutability: "view",
  inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }],
}] as const;

const CHAINS: Record<string, {
  id: number; name: string; token: Address; rpcEnv: string; treasuryEnv: string;
  native: string; tokenDecimals: number; fallbackRpc: string;
}> = {
  ethereum: { id: 1, name: "Ethereum", token: "0xdAC17F958D2ee523a2206206994597C13D831ec7", rpcEnv: "AURA_EVM_RPC_ETHEREUM", treasuryEnv: "AURA_EVM_TREASURY_ETHEREUM", native: "ETH", tokenDecimals: 6, fallbackRpc: "https://ethereum-rpc.publicnode.com" },
  polygon: { id: 137, name: "Polygon", token: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", rpcEnv: "AURA_EVM_RPC_POLYGON", treasuryEnv: "AURA_EVM_TREASURY_POLYGON", native: "POL", tokenDecimals: 6, fallbackRpc: "https://polygon-bor-rpc.publicnode.com" },
  arbitrum: { id: 42161, name: "Arbitrum", token: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", rpcEnv: "AURA_EVM_RPC_ARBITRUM", treasuryEnv: "AURA_EVM_TREASURY_ARBITRUM", native: "ETH", tokenDecimals: 6, fallbackRpc: "https://arb1.arbitrum.io/rpc" },
  bsc: { id: 56, name: "BNB Smart Chain", token: "0x55d398326f99059fF775485246999027B3197955", rpcEnv: "AURA_EVM_RPC_BSC", treasuryEnv: "AURA_EVM_TREASURY_BSC", native: "BNB", tokenDecimals: 18, fallbackRpc: "https://bsc-rpc.publicnode.com" },
};

function secretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  try { return JSON.parse(raw).default as string; }
  catch { return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""; }
}
function admin() { return createClient(Deno.env.get("SUPABASE_URL")!, secretKey()); }
async function authorized(req: Request, client: ReturnType<typeof admin>) {
  const provided = req.headers.get("x-aura-worker-secret") || "";
  const { data, error } = await client.rpc("get_aura_worker_secret");
  return !error && !!data && provided.length > 0 && provided === data;
}
async function notifyTelegramWithdrawal(client: ReturnType<typeof admin>, userId: string, title: string, message: string) {
  try {
    const { data: profile, error: profileError } = await client.from("profiles").select("telegram_user_id").eq("id", userId).maybeSingle();
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
function chainObject(c: any, rpc: string) {
  return { id: c.id, name: c.name, nativeCurrency: { name: c.native, symbol: c.native, decimals: 18 }, rpcUrls: { default: { http: [rpc] }, public: { http: [rpc] } } } as const;
}
function isTxHash(value: unknown): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value);
}
async function fetchThirdwebTransaction(secret: string, id: string) {
  const response = await fetch("https://api.thirdweb.com/v1/transactions/" + encodeURIComponent(id), {
    method: "GET",
    headers: { "x-secret-key": secret },
    signal: AbortSignal.timeout(12000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error("THIRDWEB_TRANSACTION_LOOKUP_FAILED_HTTP_" + response.status);
  if (!payload?.result) throw new Error("THIRDWEB_TRANSACTION_LOOKUP_MISSING_RESULT");
  return payload.result as Record<string, unknown>;
}
async function isRegisteredThirdwebServerWallet(secret: string, address: string) {
  const response = await fetch("https://api.thirdweb.com/v1/wallets/server?limit=100&page=1", {
    method: "GET",
    headers: { "x-secret-key": secret },
    signal: AbortSignal.timeout(10000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error("THIRDWEB_SERVER_WALLET_LOOKUP_FAILED_HTTP_" + response.status);
  const wallets = payload?.result?.wallets;
  return Array.isArray(wallets) && wallets.some((wallet: any) => String(wallet?.address || "").toLowerCase() === address.toLowerCase());
}
async function updateDeferred(db: ReturnType<typeof admin>, w: any, message: string, delayMs = 300000) {
  await db.from("wallet_withdrawals").update({
    confirmation_attempts: Number(w.confirmation_attempts || 0) + 1,
    last_worker_error: message.slice(0, 1500),
    next_attempt_at: new Date(Date.now() + delayMs).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", w.id).eq("status", "queued");
}
async function completeBroadcast(db: ReturnType<typeof admin>, msgId: number, w: any, cfg: any, txHash: string) {
  const { data: updated, error } = await db.from("wallet_withdrawals").update({
    status: "broadcast",
    tx_hash: txHash,
    broadcast_at: new Date().toISOString(),
    last_worker_error: null,
    next_attempt_at: null,
    updated_at: new Date().toISOString(),
    security_note: "Secure one-time withdrawal confirmation was consumed; transaction broadcast through " +
      (w.broadcast_provider === "thirdweb" ? "the configured thirdweb Server Wallet." : "the configured server-side native signer."),
  }).eq("id", w.id).eq("status", "queued").is("tx_hash", null).select("id").maybeSingle();
  if (error) throw error;
  if (!updated) {
    // The chain may already have a transaction hash even if our DB update lost a race.
    // Never submit a second transfer here.
    console.error("Broadcast hash needs reconciliation; database row was not updated", w.id);
    await db.rpc("aura_worker_delete_withdrawal_message", { p_msg_id: msgId });
    return false;
  }
  const { error: queueError } = await db.rpc("aura_worker_enqueue_confirmation", { p_withdrawal_id: w.id, p_delay_seconds: 30 });
  if (queueError) console.error("Withdrawal confirmation enqueue failed after broadcast", w.id, queueError.message);
  await db.rpc("aura_worker_delete_withdrawal_message", { p_msg_id: msgId });
  await notifyTelegramWithdrawal(db, String(w.user_id), "Withdrawal broadcast", Number(w.amount).toFixed(8).replace(/\.?0+$/, "") +
    " USDT is broadcast on " + cfg.name + ". Transaction: " + txHash);
  return true;
}
Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });
  const db = admin();
  if (!(await authorized(req, db))) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const { data: messages, error: readError } = await db.rpc("aura_worker_read_withdrawals", { p_visibility_timeout: 300, p_qty: 5 });
    if (readError) throw readError;
    const items = Array.isArray(messages) ? messages : [];
    let processed = 0, broadcast = 0, deferred = 0, rejected = 0;

    for (const item of items) {
      const msgId = Number(item.msg_id);
      const withdrawalId = String(item.message?.withdrawal_id || "");
      if (!withdrawalId) {
        await db.rpc("aura_worker_delete_withdrawal_message", { p_msg_id: msgId });
        continue;
      }
      const { data: w, error: wError } = await db.from("wallet_withdrawals").select("*").eq("id", withdrawalId).maybeSingle();
      if (wError) throw wError;
      if (!w || w.status !== "queued") {
        await db.rpc("aura_worker_delete_withdrawal_message", { p_msg_id: msgId });
        continue;
      }
      const cfg = CHAINS[String(w.chain).toLowerCase()];
      if (!cfg) {
        await db.from("wallet_withdrawals").update({
          status: "rejected",
          rejection_reason: "CHAIN_BROADCASTER_NOT_CONFIGURED",
          last_worker_error: "No secure broadcaster adapter is configured for this chain.",
          updated_at: new Date().toISOString(),
        }).eq("id", withdrawalId).eq("status", "queued");
        await db.rpc("aura_worker_delete_withdrawal_message", { p_msg_id: msgId });
        await notifyTelegramWithdrawal(db, String(w.user_id), "Withdrawal could not be processed", "This withdrawal network is not configured for secure broadcasting. Contact AURA support; the reservation requires review.");
        rejected++; processed++;
        continue;
      }

      // If thirdweb has already accepted this request, only poll its transaction ID.
      // Never issue a second token transfer because the chain hash is not known yet.
      if (w.provider_transaction_id) {
        const thirdwebSecret = Deno.env.get("THIRDWEB_SECRET_KEY")?.trim();
        if (!thirdwebSecret) {
          await updateDeferred(db, w, "THIRDWEB_SECRET_KEY is missing while a thirdweb transaction is pending. No second broadcast was attempted.");
          deferred++; processed++;
          continue;
        }
        try {
          const providerTx = await fetchThirdwebTransaction(thirdwebSecret, String(w.provider_transaction_id));
          const txHash = providerTx.transactionHash;
          if (isTxHash(txHash)) {
            const didUpdate = await completeBroadcast(db, msgId, { ...w, broadcast_provider: "thirdweb" }, cfg, txHash);
            if (didUpdate) broadcast++;
            processed++;
            continue;
          }
          const providerStatus = String(providerTx.status || "pending").toLowerCase();
          if (["failed", "errored", "cancelled", "canceled", "rejected"].includes(providerStatus)) {
            await db.from("wallet_withdrawals").update({
              last_worker_error: "thirdweb reports terminal status '" + providerStatus + "' without an on-chain transaction hash. Automatic resubmission is stopped to avoid a duplicate payout; reconcile this provider transaction before retrying.",
              next_attempt_at: null,
              updated_at: new Date().toISOString(),
            }).eq("id", w.id).eq("status", "queued");
            await db.rpc("aura_worker_delete_withdrawal_message", { p_msg_id: msgId });
            console.error("thirdweb withdrawal requires manual reconciliation", w.id, w.provider_transaction_id, providerStatus);
            deferred++; processed++;
            continue;
          }
          await updateDeferred(db, w, "thirdweb transaction is still pending. The worker is monitoring the existing transaction ID and will not create another transfer.", 60000);
          deferred++; processed++;
          continue;
        } catch (error) {
          await updateDeferred(db, w, "Could not query the existing thirdweb transaction. No duplicate transfer was submitted. " + String(error).slice(0, 500));
          deferred++; processed++;
          continue;
        }
      }

      const thirdwebSecret = Deno.env.get("THIRDWEB_SECRET_KEY")?.trim() || "";
      const thirdwebAddress = Deno.env.get("THIRDWEB_SERVER_WALLET_ADDRESS")?.trim() || "";
      const privateKey = Deno.env.get("AURA_EVM_PRIVATE_KEY")?.trim() || "";
      const treasuryAddress = Deno.env.get(cfg.treasuryEnv)?.trim() || "";
      const rpcUrl = Deno.env.get(cfg.rpcEnv)?.trim() || cfg.fallbackRpc;

      if (!/^0x[a-fA-F0-9]{40}$/.test(treasuryAddress)) {
        await updateDeferred(db, w, "Configured network treasury is missing or invalid; withdrawal was not broadcast.");
        deferred++; processed++;
        continue;
      }

      let mode: "native" | "thirdweb" | null = null;
      let account: ReturnType<typeof privateKeyToAccount> | null = null;
      if (thirdwebSecret && /^0x[a-fA-F0-9]{40}$/.test(thirdwebAddress) && thirdwebAddress.toLowerCase() === treasuryAddress.toLowerCase()) {
        try {
          if (await isRegisteredThirdwebServerWallet(thirdwebSecret, thirdwebAddress)) mode = "thirdweb";
        } catch (error) {
          console.warn("Could not validate thirdweb Server Wallet configuration", String(error).slice(0, 300));
        }
      }
      if (!mode && privateKey) {
        try {
          const candidate = privateKeyToAccount(privateKey as Hex);
          if (candidate.address.toLowerCase() === treasuryAddress.toLowerCase()) {
            account = candidate;
            mode = "native";
          }
        } catch {
          // Do not include private-key material in logs or error messages.
        }
      }
      if (!mode) {
        await updateDeferred(db, w,
          "Withdrawal broadcast is not configured. Configure either a matching AURA_EVM_PRIVATE_KEY, or THIRDWEB_SECRET_KEY plus a registered THIRDWEB_SERVER_WALLET_ADDRESS matching the selected network treasury. No transfer was sent.");
        deferred++; processed++;
        continue;
      }

      try {
        const chain = chainObject(cfg, rpcUrl);
        const publicClient = createPublicClient({ chain, transport: http(rpcUrl, { timeout: 15000 }) });
        const walletAddress = (mode === "thirdweb" ? thirdwebAddress : account!.address) as Address;
        const amount = parseUnits(String(w.amount), cfg.tokenDecimals);
        const [balance, nativeBalance, gasEstimate, gasPrice] = await Promise.all([
          publicClient.readContract({ address: cfg.token, abi: ERC20_ABI, functionName: "balanceOf", args: [walletAddress] }),
          publicClient.getBalance({ address: walletAddress }),
          publicClient.estimateContractGas({ account: walletAddress, address: cfg.token, abi: ERC20_ABI, functionName: "transfer", args: [String(w.destination_address) as Address, amount] }),
          publicClient.getGasPrice(),
        ]);
        if (balance < amount) throw new Error("WITHDRAWAL_LIQUIDITY_UNAVAILABLE: selected treasury lacks sufficient USDT.");
        if (nativeBalance < gasEstimate * gasPrice) throw new Error("WITHDRAWAL_GAS_UNAVAILABLE: selected treasury lacks native gas token.");
        if (mode === "native") {
          const { request } = await publicClient.simulateContract({
            account: account!, address: cfg.token, abi: ERC20_ABI,
            functionName: "transfer", args: [String(w.destination_address) as Address, amount],
          });
          // Claim the submission before asking the signer to broadcast. If the
          // response is lost, the next run will stop instead of paying twice.
          const { data: claimed, error: claimError } = await db.from("wallet_withdrawals").update({
            broadcast_provider: "native", submission_started_at: new Date().toISOString(),
            last_worker_error: "Native broadcast submission started; awaiting a recoverable transaction hash.",
            updated_at: new Date().toISOString(),
          }).eq("id", w.id).eq("status", "queued").is("submission_started_at", null).select("id").maybeSingle();
          if (claimError) throw claimError;
          if (!claimed) {
            await updateDeferred(db, w, "Another worker already claimed this broadcast; no second transfer was submitted.", 60000);
            deferred++; processed++;
            continue;
          }
          const walletClient = createWalletClient({ account: account!, chain, transport: http(rpcUrl, { timeout: 20000 }) });
          const txHash = await walletClient.writeContract(request);
          const didUpdate = await completeBroadcast(db, msgId, { ...w, broadcast_provider: "native" }, cfg, txHash);
          if (didUpdate) broadcast++;
          processed++;
          continue;
        }

        if (w.submission_started_at) {
          const startedAt = Date.parse(String(w.submission_started_at));
          const ageMs = Date.now() - startedAt;
          if (ageMs > 120000) {
            await db.from("wallet_withdrawals").update({
              last_worker_error: "A prior broadcast submission started but its provider transaction ID or chain hash was not saved. Automatic resubmission is stopped to prevent a duplicate payout; reconcile the configured signer/provider transaction before retrying.",
              next_attempt_at: null,
              updated_at: new Date().toISOString(),
            }).eq("id", w.id).eq("status", "queued");
            await db.rpc("aura_worker_delete_withdrawal_message", { p_msg_id: msgId });
            console.error("Withdrawal requires manual broadcast reconciliation", w.id);
          } else {
            await updateDeferred(db, w, "A broadcast submission is already in progress; waiting for its existing reference rather than resubmitting.", 60000);
          }
          deferred++; processed++;
          continue;
        }

        // Mark the attempt before sending to thirdweb. If the HTTP response is
        // lost after thirdweb accepted the call, this row will not blindly retry.
        const { data: claimed, error: claimError } = await db.from("wallet_withdrawals").update({
          broadcast_provider: "thirdweb",
          submission_started_at: new Date().toISOString(),
          last_worker_error: "Thirdweb Server Wallet submission started; awaiting provider transaction ID.",
          updated_at: new Date().toISOString(),
        }).eq("id", w.id).eq("status", "queued").is("submission_started_at", null).select("id").maybeSingle();
        if (claimError) throw claimError;
        if (!claimed) {
          await updateDeferred(db, w, "Another worker already claimed this broadcast; no second transfer was submitted.", 60000);
          deferred++; processed++;
          continue;
        }

        const response = await fetch("https://api.thirdweb.com/v1/contracts/write", {
          method: "POST",
          headers: { "content-type": "application/json", "x-secret-key": thirdwebSecret },
          body: JSON.stringify({
            chainId: cfg.id,
            from: thirdwebAddress,
            calls: [{
              contractAddress: cfg.token,
              method: "function transfer(address to, uint256 amount)",
              params: [String(w.destination_address), amount.toString()],
            }],
          }),
          signal: AbortSignal.timeout(20000),
        });
        const payload = await response.json().catch(() => null);
        const providerId = payload?.result?.transactionIds?.[0];
        if (!response.ok || typeof providerId !== "string" || !providerId) {
          const detail = "thirdweb transaction submission did not return a provider transaction ID (HTTP " + response.status + ").";
          // A definite client/config rejection did not enqueue a transaction; clear
          // the claim so the request can retry after configuration is fixed.
          if (response.status >= 400 && response.status < 500) {
            await db.from("wallet_withdrawals").update({
              submission_started_at: null,
              last_worker_error: detail,
              next_attempt_at: new Date(Date.now() + 300000).toISOString(),
              updated_at: new Date().toISOString(),
            }).eq("id", w.id).eq("status", "queued").is("provider_transaction_id", null);
          } else {
            await updateDeferred(db, w, detail + " Provider acceptance is uncertain; the worker will not blindly resubmit.");
          }
          deferred++; processed++;
          continue;
        }

        const { error: providerSaveError } = await db.from("wallet_withdrawals").update({
          provider_transaction_id: providerId,
          last_worker_error: "thirdweb accepted the withdrawal; monitoring its transaction ID until an on-chain hash is available.",
          next_attempt_at: new Date(Date.now() + 60000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", w.id).eq("status", "queued").is("provider_transaction_id", null);
        if (providerSaveError) {
          console.error("thirdweb accepted transaction but its ID could not be saved; manual reconciliation required", w.id, providerId);
          deferred++; processed++;
          continue;
        }

        const providerTx = await fetchThirdwebTransaction(thirdwebSecret, providerId);
        if (isTxHash(providerTx.transactionHash)) {
          const didUpdate = await completeBroadcast(db, msgId, { ...w, broadcast_provider: "thirdweb" }, cfg, providerTx.transactionHash);
          if (didUpdate) broadcast++;
        } else {
          await updateDeferred(db, { ...w, provider_transaction_id: providerId }, "thirdweb accepted this payout. AURA is tracking the same provider transaction and will not submit a second payout.", 60000);
          deferred++;
        }
        processed++;
      } catch (error) {
        const message = String(error instanceof Error ? error.message : error).slice(0, 1200);
        // If a broadcast marker exists, leave it in place. It protects against
        // duplicate transfers after network timeouts or lost responses.
        const { data: latest } = await db.from("wallet_withdrawals").select("submission_started_at,provider_transaction_id").eq("id", w.id).maybeSingle();
        if (!latest?.submission_started_at) {
          await updateDeferred(db, w, message);
        } else {
          await db.from("wallet_withdrawals").update({
            confirmation_attempts: Number(w.confirmation_attempts || 0) + 1,
            last_worker_error: ("Broadcast result is uncertain; no automatic resubmission. " + message).slice(0, 1500),
            next_attempt_at: new Date(Date.now() + 300000).toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", w.id).eq("status", "queued");
        }
        deferred++; processed++;
        console.error("Withdrawal broadcaster could not finish", w.id, message);
      }
    }
    return Response.json({ ok: true, processed, broadcast, deferred, rejected });
  } catch (error) {
    console.error("withdrawal-broadcaster failed", error);
    return Response.json({ error: "WORKER_ERROR" }, { status: 500 });
  }
});
