import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer";
import { createPublicClient, http, parseUnits, type Address } from "npm:viem@2";
import { privateKeyToAccount } from "npm:viem@2/accounts";

const ERC20_ABI = [{
  type: "function",
  name: "balanceOf",
  stateMutability: "view",
  inputs: [{ name: "account", type: "address" }],
  outputs: [{ name: "", type: "uint256" }],
}, {
  type: "function",
  name: "transfer",
  stateMutability: "nonpayable",
  inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
  outputs: [{ name: "", type: "bool" }],
}] as const;

const WITHDRAWAL_CHAINS = {
  ethereum: {
    id: 1, name: "Ethereum", native: "ETH", decimals: 6,
    token: "0xdAC17F958D2ee523a2206206994597C13D831ec7" as Address,
    rpcEnv: "AURA_EVM_RPC_ETHEREUM", treasuryEnv: "AURA_EVM_TREASURY_ETHEREUM",
    fallbackRpc: "https://ethereum-rpc.publicnode.com",
  },
  polygon: {
    id: 137, name: "Polygon", native: "POL", decimals: 6,
    token: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" as Address,
    rpcEnv: "AURA_EVM_RPC_POLYGON", treasuryEnv: "AURA_EVM_TREASURY_POLYGON",
    fallbackRpc: "https://polygon-bor-rpc.publicnode.com",
  },
  arbitrum: {
    id: 42161, name: "Arbitrum", native: "ETH", decimals: 6,
    token: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" as Address,
    rpcEnv: "AURA_EVM_RPC_ARBITRUM", treasuryEnv: "AURA_EVM_TREASURY_ARBITRUM",
    fallbackRpc: "https://arb1.arbitrum.io/rpc",
  },
  bsc: {
    id: 56, name: "BNB Smart Chain", native: "BNB", decimals: 18,
    token: "0x55d398326f99059fF775485246999027B3197955" as Address,
    rpcEnv: "AURA_EVM_RPC_BSC", treasuryEnv: "AURA_EVM_TREASURY_BSC",
    fallbackRpc: "https://bsc-rpc.publicnode.com",
  },
} as const;

async function withdrawalReadinessError(chainName: keyof typeof WITHDRAWAL_CHAINS, destination: string, amount: number) {
  const config = WITHDRAWAL_CHAINS[chainName];
  const treasury = Deno.env.get(config.treasuryEnv)?.trim();
  if (!treasury || !/^0x[a-fA-F0-9]{40}$/.test(treasury)) {
    return {
      status: 503,
      error: "WITHDRAWAL_TREASURY_NOT_CONFIGURED",
      message: "The selected network's AURA treasury is not configured. No funds have been reserved.",
    };
  }

  const privateKey = Deno.env.get("AURA_EVM_PRIVATE_KEY")?.trim();
  const thirdwebSecret = Deno.env.get("THIRDWEB_SECRET_KEY")?.trim();
  const thirdwebAddress = Deno.env.get("THIRDWEB_SERVER_WALLET_ADDRESS")?.trim();
  let signerAddress: Address | null = null;
  let signer;
  let invalidPrivateKey = false;

  if (privateKey) {
    try {
      signer = privateKeyToAccount(privateKey as `0x${string}`);
      if (signer.address.toLowerCase() === treasury.toLowerCase()) signerAddress = signer.address;
    } catch {
      invalidPrivateKey = true;
    }
  }

  // thirdweb Server Wallet is the backend treasury signer, not the user's
  // ERC-4337 smart account. The configured wallet must be the same address
  // as this network's funded treasury before any withdrawal can be reserved.
  if (!signerAddress && thirdwebSecret && thirdwebAddress && /^0x[a-fA-F0-9]{40}$/.test(thirdwebAddress)) {
    if (thirdwebAddress.toLowerCase() === treasury.toLowerCase()) {
      try {
        const response = await fetch("https://api.thirdweb.com/v1/wallets/server?limit=100&page=1", {
          method: "GET",
          headers: { "x-secret-key": thirdwebSecret },
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) {
          return {
            status: 503,
            error: "THIRDWEB_SERVER_WALLET_VALIDATION_FAILED",
            message: "AURA could not validate the configured thirdweb Server Wallet. No funds have been reserved.",
          };
        }
        const payload = await response.json();
        const wallets = payload?.result?.wallets;
        if (!Array.isArray(wallets) || !wallets.some((wallet: any) =>
          String(wallet?.address || "").toLowerCase() === treasury.toLowerCase()
        )) {
          return {
            status: 503,
            error: "THIRDWEB_SERVER_WALLET_NOT_REGISTERED",
            message: "The configured treasury address is not registered as a thirdweb Server Wallet in this project. No funds have been reserved.",
          };
        }
        signerAddress = thirdwebAddress as Address;
      } catch {
        return {
          status: 503,
          error: "THIRDWEB_SERVER_WALLET_VALIDATION_FAILED",
          message: "AURA could not validate the configured thirdweb Server Wallet. No funds have been reserved.",
        };
      }
    }
  }

  if (!signerAddress) {
    if (privateKey && !invalidPrivateKey) {
      return {
        status: 503,
        error: "WITHDRAWAL_TREASURY_SIGNER_MISMATCH",
        message: "AURA's configured signer does not match the selected network treasury. No funds have been reserved.",
      };
    }
    if (invalidPrivateKey && !thirdwebSecret) {
      return {
        status: 503,
        error: "WITHDRAWAL_SIGNER_INVALID",
        message: "AURA could not validate its configured withdrawal signer. No funds have been reserved.",
      };
    }
    if (!thirdwebSecret || !thirdwebAddress) {
      return {
        status: 503,
        error: "WITHDRAWAL_BROADCASTER_NOT_CONFIGURED",
        message: "AURA's server-side withdrawal signer is not configured. Configure a native signer or the thirdweb Server Wallet and treasury match; no funds have been reserved.",
      };
    }
    return {
      status: 503,
      error: "WITHDRAWAL_TREASURY_SIGNER_MISMATCH",
      message: "AURA's configured thirdweb Server Wallet does not match the selected network treasury. No funds have been reserved.",
    };
  }

  // Use the same safe RPC fallback policy as the broadcaster; provider secrets
  // remain server-side and are never copied into the browser.
  const rpcUrl = Deno.env.get(config.rpcEnv)?.trim() || config.fallbackRpc;

  try {
    const chain = {
      id: config.id,
      name: config.name,
      nativeCurrency: { name: config.native, symbol: config.native, decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    } as const;
    const client = createPublicClient({ chain, transport: http(rpcUrl, { timeout: 10000 }) });
    const tokenAmount = parseUnits(String(amount), config.decimals);
    const [balance, nativeBalance] = await Promise.all([
      client.readContract({
        address: config.token,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [signerAddress],
      }),
      client.getBalance({ address: signerAddress }),
    ]);

    if (balance < tokenAmount) {
      return {
        status: 409,
        error: "WITHDRAWAL_LIQUIDITY_UNAVAILABLE",
        message: "AURA's " + config.name + " treasury does not currently have enough USDT available. No funds have been reserved.",
      };
    }

    const [gasEstimate, gasPrice] = await Promise.all([
      client.estimateContractGas({
        account: signerAddress,
        address: config.token,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [destination as Address, tokenAmount],
      }),
      client.getGasPrice(),
    ]);
    if (nativeBalance < gasEstimate * gasPrice) {
      return {
        status: 409,
        error: "WITHDRAWAL_GAS_UNAVAILABLE",
        message: "AURA's " + config.name + " treasury does not have enough native gas token available. No funds have been reserved.",
      };
    }

    return null;
  } catch {
    return {
      status: 503,
      error: "WITHDRAWAL_READINESS_CHECK_FAILED",
      message: "AURA could not verify the selected network's USDT and gas readiness. No funds have been reserved.",
    };
  }
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function publicKey() {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "";
  try { return JSON.parse(raw).default as string; } catch { return Deno.env.get("SUPABASE_ANON_KEY") || ""; }
}

function secretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  try { return JSON.parse(raw).default as string; } catch { return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""; }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  }[char] || char));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "AUTH_REQUIRED" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, publicKey(), { global: { headers: { Authorization: auth } } });
  const adminClient = createClient(url, secretKey());

  try {
    const body = await req.json();
    const chain = String(body.chain || "").trim().toLowerCase();
    const destinationAddress = String(body.destinationAddress || "").trim();
    const amount = Number(body.amount);
    const networkFee = Number(body.networkFee || 0);

    if (!chain || !destinationAddress || !Number.isFinite(amount) || amount <= 0) {
      return json({ error: "INVALID_WITHDRAWAL_REQUEST" }, 400);
    }
    if (!["ethereum", "polygon", "arbitrum", "bsc"].includes(chain)) {
      return json({ error: "CHAIN_NOT_YET_SUPPORTED_FOR_REAL_WITHDRAWAL" }, 400);
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(destinationAddress)) {
      return json({ error: "INVALID_EVM_DESTINATION_ADDRESS" }, 400);
    }

    // Never reserve internal USDT until the actual network signer, treasury,
    // token liquidity, and gas readiness have been verified for this chain.
    const readinessError = await withdrawalReadinessError(
      chain as keyof typeof WITHDRAWAL_CHAINS,
      destinationAddress,
      amount,
    );
    if (readinessError) {
      return json({
        error: readinessError.error,
        message: readinessError.message,
      }, readinessError.status);
    }

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "AUTH_REQUIRED" }, 401);

    const { data: withdrawal, error: withdrawalError } = await userClient.rpc("request_wallet_withdrawal", {
      p_chain: chain,
      p_token_symbol: "USDT",
      p_destination_address: destinationAddress,
      p_amount: amount,
      p_network_fee: Number.isFinite(networkFee) && networkFee >= 0 ? networkFee : 0,
      p_idempotency_key: crypto.randomUUID(),
    });
    if (withdrawalError || !withdrawal) {
      return json({ error: withdrawalError?.message || "WITHDRAWAL_REQUEST_FAILED" }, 400);
    }

    const { data: confirmation, error: confirmationError } = await userClient.rpc("issue_wallet_withdrawal_email_confirmation", {
      p_withdrawal_id: withdrawal.id,
    });
    if (confirmationError || !confirmation?.token) {
      await userClient.rpc("cancel_wallet_withdrawal", { p_withdrawal_id: withdrawal.id });
      return json({ error: confirmationError?.message || "CONFIRMATION_TOKEN_FAILED" }, 500);
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles").select("telegram_user_id").eq("id", userData.user.id).maybeSingle();
    if (profileError) {
      await userClient.rpc("cancel_wallet_withdrawal", { p_withdrawal_id: withdrawal.id });
      return json({ error: "ACCOUNT_NOTIFICATION_SETTINGS_UNAVAILABLE" }, 503);
    }

    const telegramUserId = String(profile?.telegram_user_id || "").trim();
    const confirmUrl = `${url}/functions/v1/withdrawal-confirm?token=${encodeURIComponent(String(confirmation.token))}`;
    let telegramSent = false;
    let telegramError = "";

    // Telegram is the primary confirmation channel for Mini App users.
    // The numeric ID comes from the server-side linked profile, never the request body.
    if (/^\d{1,20}$/.test(telegramUserId)) {
      const { data: notifySecret, error: notifySecretError } = await adminClient.rpc("get_aura_telegram_notify_secret");
      if (!notifySecretError && notifySecret) {
        try {
          const response = await fetch("https://aura-8bom.onrender.com/api/internal/telegram/withdrawal-notify", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-aura-telegram-notify-secret": String(notifySecret),
            },
            body: JSON.stringify({
              telegram_user_id: telegramUserId,
              title: "Confirm your USDT withdrawal",
              message: `You requested ${amount.toFixed(6)} USDT on ${chain.toUpperCase()}.\nDestination: ${destinationAddress}\nYour funds are reserved. Nothing will be sent until you confirm. This link expires in 30 minutes.`,
              confirm_url: confirmUrl,
            }),
            signal: AbortSignal.timeout(10000),
          });
          const result = await response.json().catch(() => ({}));
          telegramSent = response.ok && result?.ok === true && result?.sent === true;
          if (!telegramSent) telegramError = String(result?.error || `TELEGRAM_HTTP_${response.status}`);
        } catch (error) {
          telegramError = String(error instanceof Error ? error.message : error).slice(0, 300);
        }
      } else {
        telegramError = "TELEGRAM_NOTIFY_TRANSPORT_NOT_CONFIGURED";
      }
    }

    // Email is an optional fallback, not a prerequisite for Telegram-linked accounts.
    if (!telegramSent) {
      const { data: authUser, error: adminUserError } = await adminClient.auth.admin.getUserById(userData.user.id);
      const email = authUser?.user?.email;
      const isSyntheticTelegramEmail = String(email || "").toLowerCase().endsWith("@users.aura");
      if (adminUserError || !email || isSyntheticTelegramEmail) {
        await userClient.rpc("cancel_wallet_withdrawal", { p_withdrawal_id: withdrawal.id });
        return json({
          error: telegramError || "NO_CONFIRMATION_CHANNEL",
          message: "Telegram confirmation could not be delivered. Start the AURA bot in Telegram and retry, or add a real email address.",
        }, 409);
      }

      const smtpHost = Deno.env.get("BREVO_SMTP_HOST") || "smtp-relay.brevo.com";
      const smtpPort = Number(Deno.env.get("BREVO_SMTP_PORT") || "587");
      const smtpUser = Deno.env.get("BREVO_SMTP_USER");
      const smtpPassword = Deno.env.get("BREVO_SMTP_PASSWORD");
      const from = Deno.env.get("BREVO_FROM_EMAIL") || "Aura@brevosend.com";
      const fromName = Deno.env.get("BREVO_FROM_NAME") || "AURA";

      if (!smtpUser || !smtpPassword || !from) {
        await userClient.rpc("cancel_wallet_withdrawal", { p_withdrawal_id: withdrawal.id });
        return json({ error: "EMAIL_PROVIDER_NOT_CONFIGURED" }, 503);
      }

      const safeChain = escapeHtml(chain.toUpperCase());
      const safeDestination = escapeHtml(destinationAddress);
      const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#0b0b10;color:#f5f5f4;padding:32px">
        <div style="max-width:560px;margin:auto;background:#15151c;border:1px solid #292933;border-radius:20px;padding:28px">
          <h2 style="margin-top:0">Confirm your AURA withdrawal</h2>
          <p>A withdrawal request was created for <strong>${amount.toFixed(6)} USDT</strong> on <strong>${safeChain}</strong>.</p>
          <p>Destination: <code>${safeDestination}</code></p>
          <p>Your funds are reserved, but nothing will be broadcast until you confirm.</p>
          <p><a href="${confirmUrl}" style="display:inline-block;padding:13px 18px;background:#fbbf24;color:#111;border-radius:12px;text-decoration:none;font-weight:700">Confirm withdrawal</a></p>
          <p style="font-size:12px;color:#a8a29e">This confirmation expires in 30 minutes. If you did not request this withdrawal, do not confirm it.</p>
        </div>
      </body></html>`;

      const transporter = nodemailer.createTransport({
        host: smtpHost, port: smtpPort, secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPassword },
        connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
      });
      try {
        await transporter.sendMail({
          from: `"${fromName}" <${from}>`,
          to: email,
          subject: "Confirm your AURA withdrawal",
          html,
          headers: { "X-Entity-Ref-ID": `aura-withdrawal-${withdrawal.id}` },
        });
      } catch (mailError) {
        await userClient.rpc("cancel_wallet_withdrawal", { p_withdrawal_id: withdrawal.id });
        console.error("Withdrawal email fallback failed", String(mailError).slice(0, 1000));
        return json({ error: "CONFIRMATION_DELIVERY_FAILED" }, 502);
      } finally {
        try { transporter.close(); } catch { /* best effort */ }
      }
    }

    return json({
      success: true,
      confirmationChannel: telegramSent ? "telegram" : "email",
      telegramFallbackReason: telegramSent ? undefined : telegramError || undefined,
      withdrawal: {
        id: withdrawal.id,
        status: withdrawal.status,
        confirmationExpiresAt: confirmation.expires_at,
      },
    });
  } catch (error) {
    console.error("withdrawal-request failed", error);
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});
