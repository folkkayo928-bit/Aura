import { createClient } from "npm:@supabase/supabase-js@2";
import { createPublicClient, formatUnits, http, type Address } from "npm:viem@2";
import { privateKeyToAccount } from "npm:viem@2/accounts";

const ERC20_ABI = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

const CHAINS = {
  ethereum: { id: 1, label: "Ethereum", token: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, treasuryEnv: "AURA_EVM_TREASURY_ETHEREUM", rpcEnv: "AURA_EVM_RPC_ETHEREUM", native: "ETH", fallback: "https://ethereum-rpc.publicnode.com" },
  polygon: { id: 137, label: "Polygon", token: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6, treasuryEnv: "AURA_EVM_TREASURY_POLYGON", rpcEnv: "AURA_EVM_RPC_POLYGON", native: "POL", fallback: "https://polygon-bor-rpc.publicnode.com" },
  arbitrum: { id: 42161, label: "Arbitrum", token: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6, treasuryEnv: "AURA_EVM_TREASURY_ARBITRUM", rpcEnv: "AURA_EVM_RPC_ARBITRUM", native: "ETH", fallback: "https://arb1.arbitrum.io/rpc" },
  bsc: { id: 56, label: "BNB Smart Chain", token: "0x55d398326f99059fF775485246999027B3197955", decimals: 18, treasuryEnv: "AURA_EVM_TREASURY_BSC", rpcEnv: "AURA_EVM_RPC_BSC", native: "BNB", fallback: "https://bsc-rpc.publicnode.com" },
} as const;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

function isAddress(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function shortAddress(value: string) {
  return isAddress(value) ? value.slice(0, 8) + "…" + value.slice(-6) : null;
}

function safeHttpReason(status: number) {
  if (status === 401) return "THIRDWEB_AUTH_UNAUTHORIZED";
  if (status === 403) return "THIRDWEB_KEY_FORBIDDEN";
  if (status === 404) return "THIRDWEB_API_ROUTE_NOT_FOUND";
  if (status === 429) return "THIRDWEB_RATE_LIMITED";
  if (status >= 500) return "THIRDWEB_SERVICE_UNAVAILABLE";
  return "THIRDWEB_HTTP_" + status;
}

async function thirdwebWalletCatalog(secret: string) {
  const wallets: Array<Record<string, unknown>> = [];
  for (let page = 1; page <= 10; page++) {
    let response: Response;
    try {
      response = await fetch("https://api.thirdweb.com/v1/wallets/server?limit=100&page=" + page, {
        headers: { "x-secret-key": secret },
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      return { ok: false, reason: "THIRDWEB_API_UNREACHABLE", wallets: [] as Array<Record<string, unknown>> };
    }
    if (!response.ok) return { ok: false, reason: safeHttpReason(response.status), wallets: [] as Array<Record<string, unknown>> };
    const payload = await response.json().catch(() => null);
    const pageWallets = payload?.result?.wallets;
    if (!Array.isArray(pageWallets)) return { ok: false, reason: "THIRDWEB_INVALID_WALLET_RESPONSE", wallets: [] as Array<Record<string, unknown>> };
    wallets.push(...pageWallets);
    if (payload?.result?.pagination?.hasMore !== true) break;
  }
  return { ok: true, reason: null as string | null, wallets };
}

function matchThirdwebWallet(wallets: Array<Record<string, unknown>>, address: string) {
  const target = address.toLowerCase();
  const wallet = wallets.find((item) =>
    String(item?.address || "").toLowerCase() === target ||
    String(item?.smartWalletAddress || "").toLowerCase() === target
  );
  if (!wallet) return null;
  if (String(wallet.address || "").toLowerCase() === target) return { field: "address" as const };
  return { field: "smartWalletAddress" as const };
}

async function inspectChain(key: keyof typeof CHAINS, catalog: { ok: boolean; reason: string | null; wallets: Array<Record<string, unknown>> }) {
  const cfg = CHAINS[key];
  const blockers: string[] = [];
  const warnings: string[] = [];
  const treasury = (Deno.env.get(cfg.treasuryEnv) || "").trim();
  const thirdwebSecret = (Deno.env.get("THIRDWEB_SECRET_KEY") || "").trim();
  const thirdwebAddress = (Deno.env.get("THIRDWEB_SERVER_WALLET_ADDRESS") || "").trim();
  const privateKey = (Deno.env.get("AURA_EVM_PRIVATE_KEY") || "").trim();
  const rpcOverride = (Deno.env.get(cfg.rpcEnv) || "").trim();
  const rpcUrl = rpcOverride || cfg.fallback;

  const checks: Record<string, unknown> = {
    treasuryAddressConfigured: Boolean(treasury),
    treasuryAddressValid: isAddress(treasury),
    thirdwebSecretConfigured: Boolean(thirdwebSecret),
    thirdwebAddressConfigured: Boolean(thirdwebAddress),
    thirdwebAddressValid: isAddress(thirdwebAddress),
    treasuryMatchesThirdwebAddress: isAddress(treasury) && isAddress(thirdwebAddress) && treasury.toLowerCase() === thirdwebAddress.toLowerCase(),
    thirdwebApiAuthenticated: catalog.ok,
    thirdwebWalletRegistered: false,
    rpcResponding: false,
    expectedChainId: cfg.id,
    actualChainId: null as number | null,
    tokenContractReadable: false,
    tokenDecimalsCorrect: false,
    usdtBalancePositive: false,
    nativeBalanceAvailable: false,
    transferSimulationPassed: false,
    nativeGasSufficientForDirectTransfer: false,
    smartAccountGasVerified: String(Deno.env.get("AURA_THIRDWEB_GAS_VERIFIED_" + key.toUpperCase()) || "").trim().toLowerCase() === "true",
  };

  if (!treasury) blockers.push("Missing " + cfg.treasuryEnv + ".");
  else if (!isAddress(treasury)) blockers.push(cfg.treasuryEnv + " is not a valid EVM address.");
  if (!thirdwebSecret) warnings.push("THIRDWEB_SECRET_KEY is not configured.");
  if (!thirdwebAddress) warnings.push("THIRDWEB_SERVER_WALLET_ADDRESS is not configured.");
  else if (!isAddress(thirdwebAddress)) warnings.push("THIRDWEB_SERVER_WALLET_ADDRESS is not a valid EVM address.");

  let thirdwebMatch: { field: "address" | "smartWalletAddress" } | null = null;
  if (isAddress(treasury) && isAddress(thirdwebAddress) && treasury.toLowerCase() === thirdwebAddress.toLowerCase() && catalog.ok) {
    thirdwebMatch = matchThirdwebWallet(catalog.wallets, treasury);
    checks.thirdwebWalletRegistered = Boolean(thirdwebMatch);
  }

  let nativeSignerMatches = false;
  if (privateKey && isAddress(treasury)) {
    try {
      nativeSignerMatches = privateKeyToAccount(privateKey as `0x${string}`).address.toLowerCase() === treasury.toLowerCase();
    } catch {
      nativeSignerMatches = false;
    }
  }

  const thirdwebMode = Boolean(thirdwebSecret && catalog.ok && thirdwebMatch && isAddress(treasury) && isAddress(thirdwebAddress) && treasury.toLowerCase() === thirdwebAddress.toLowerCase());
  const senderMode = thirdwebMode ? "thirdweb" : nativeSignerMatches ? "native" : "none";
  checks.nativeSignerMatchesTreasury = nativeSignerMatches;
  checks.thirdwebAddressMatchType = thirdwebMatch?.field || null;
  checks.senderMode = senderMode;

  if (thirdwebSecret && !catalog.ok && !nativeSignerMatches) blockers.push("Thirdweb API check failed: " + String(catalog.reason || "UNKNOWN"));
  else if (thirdwebSecret && !catalog.ok && nativeSignerMatches) warnings.push("Thirdweb API check failed (" + String(catalog.reason || "UNKNOWN") + "), but a matching native signer is configured; only the native route can be considered.");
  if (thirdwebSecret && catalog.ok && isAddress(treasury) && treasury.toLowerCase() === thirdwebAddress.toLowerCase() && !thirdwebMatch) {
    blockers.push("Wallet address matches the treasury setting but is not registered in this Thirdweb project's Server Wallet list.");
  }
  if (isAddress(treasury) && isAddress(thirdwebAddress) && treasury.toLowerCase() !== thirdwebAddress.toLowerCase() && !nativeSignerMatches) {
    blockers.push("Treasury address and THIRDWEB_SERVER_WALLET_ADDRESS do not match, and no matching native signer is configured.");
  }
  if (senderMode === "none") {
    if (!thirdwebSecret) blockers.push("No Thirdweb secret is configured for payout signing.");
    if (!nativeSignerMatches) blockers.push("No registered Thirdweb Server Wallet or matching native signer is available for this treasury.");
  }
  if (senderMode === "thirdweb" && thirdwebMatch?.field === "smartWalletAddress" && checks.smartAccountGasVerified !== true) {
    blockers.push("Smart-account gas readiness is not verified. Complete a controlled small treasury transfer, then set AURA_THIRDWEB_GAS_VERIFIED_" + key.toUpperCase() + "=true before treating this network as payout-ready.");
  } else if (senderMode === "thirdweb" && thirdwebMatch?.field === "smartWalletAddress") {
    warnings.push("Smart-account gas readiness is marked verified by the operator; continue monitoring provider transaction results and on-chain confirmations.");
  }

  const chain = {
    id: cfg.id,
    name: cfg.label,
    nativeSymbol: cfg.native,
    tokenAddress: cfg.token,
    tokenDecimals: cfg.decimals,
    rpcUrl,
    nativeCurrency: { name: cfg.native, symbol: cfg.native, decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] }, public: { http: [rpcUrl] } },
  } as const;

  let usdtBalance = "0";
  let nativeBalance = "0";
  let gasEstimate: bigint | null = null;
  let estimatedGasCost: bigint | null = null;
  try {
    if (!isAddress(treasury)) throw new Error("TREASURY_ADDRESS_INVALID");
    const client = createPublicClient({ chain, transport: http(rpcUrl, { timeout: 10000 }) });
    const actualChainId = await client.getChainId();
    checks.rpcResponding = true;
    checks.actualChainId = actualChainId;
    if (actualChainId !== cfg.id) blockers.push("RPC_CHAIN_ID_MISMATCH: expected " + cfg.id + ", got " + actualChainId + ".");
    const latestBlock = await client.getBlockNumber();
    if (latestBlock <= 0n) blockers.push("RPC returned an invalid latest block.");
    const decimals = await client.readContract({ address: cfg.token, abi: ERC20_ABI, functionName: "decimals" });
    checks.tokenContractReadable = true;
    checks.tokenDecimalsCorrect = Number(decimals) === cfg.decimals;
    if (Number(decimals) !== cfg.decimals) blockers.push("USDT token decimals mismatch: expected " + cfg.decimals + ", got " + Number(decimals) + ".");
    const [tokenUnits, nativeUnits] = await Promise.all([
      client.readContract({ address: cfg.token, abi: ERC20_ABI, functionName: "balanceOf", args: [treasury] }),
      client.getBalance({ address: treasury }),
    ]);
    usdtBalance = formatUnits(tokenUnits, cfg.decimals);
    nativeBalance = formatUnits(nativeUnits, 18);
    checks.usdtBalancePositive = tokenUnits > 0n;
    checks.nativeBalanceAvailable = nativeUnits > 0n;
    if (tokenUnits === 0n) blockers.push("Treasury USDT balance is zero on " + cfg.label + ".");
    if (tokenUnits > 0n && Number(decimals) === cfg.decimals) {
      try {
        gasEstimate = await client.estimateContractGas({
          account: treasury,
          address: cfg.token,
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [treasury, 1n],
        });
        checks.transferSimulationPassed = true;
        const gasPrice = await client.getGasPrice();
        estimatedGasCost = gasEstimate * gasPrice;
        if (senderMode !== "thirdweb" || thirdwebMatch?.field === "address") {
          const withBuffer = estimatedGasCost + estimatedGasCost / 5n;
          checks.nativeGasSufficientForDirectTransfer = nativeUnits >= withBuffer;
          if (nativeUnits < withBuffer) blockers.push("Insufficient " + cfg.native + " to cover an estimated USDT transfer plus a 20% gas buffer.");
        } else {
          checks.nativeGasSufficientForDirectTransfer = null;
          warnings.push("Direct EVM gas estimate is informational only for a smart-account sender; confirm account-abstraction gas policy.");
        }
      } catch {
        blockers.push("USDT transfer simulation failed; RPC, token liquidity, or treasury account may be misconfigured.");
      }
    } else if (tokenUnits === 0n) {
      checks.transferSimulationPassed = false;
    }
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error).slice(0, 180);
    blockers.push("RPC/token read check failed (" + message.replace(/https?:\/\/\S+/g, "[redacted-url]") + ").");
  }

  const basicConfigReady =
    checks.treasuryAddressValid === true &&
    checks.tokenContractReadable === true &&
    checks.tokenDecimalsCorrect === true &&
    checks.rpcResponding === true &&
    checks.actualChainId === cfg.id &&
    senderMode !== "none" &&
    checks.usdtBalancePositive === true &&
    checks.transferSimulationPassed === true &&
    (senderMode === "thirdweb" && thirdwebMatch?.field === "smartWalletAddress"
      ? checks.smartAccountGasVerified === true
      : checks.nativeGasSufficientForDirectTransfer === true);

  return {
    chain: key,
    label: cfg.label,
    status: blockers.length === 0 && basicConfigReady ? "ready" : "blocked",
    ready: blockers.length === 0 && basicConfigReady,
    senderMode,
    treasuryAddress: shortAddress(treasury),
    thirdwebAddress: shortAddress(thirdwebAddress),
    treasuryMatchesThirdwebAddress: checks.treasuryMatchesThirdwebAddress,
    balances: { usdt: usdtBalance, native: nativeBalance, nativeSymbol: cfg.native },
    estimatedDirectTransferGas: gasEstimate === null ? null : gasEstimate.toString(),
    estimatedNativeGasCost: estimatedGasCost === null ? null : formatUnits(estimatedGasCost, 18),
    checks,
    blockers,
    warnings,
    rpcOverrideConfigured: Boolean(rpcOverride),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  const url = Deno.env.get("SUPABASE_URL") || "";
  const rawSecretKeys = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  let serverApiKey = "";
  try { serverApiKey = String(JSON.parse(rawSecretKeys)?.default || "").trim(); } catch { /* use legacy server key below */ }
  serverApiKey = serverApiKey || (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  const apiKey = (Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || serverApiKey).trim();
  if (!url || !apiKey || !token) return json({ error: "AUTH_REQUIRED" }, 401);

  const userClient = createClient(url, apiKey, { global: { headers: { Authorization: authHeader } } });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "INVALID_SESSION" }, 401);
  const { data: canFinance, error: roleError } = await userClient.rpc("aura_can", { p_min_role: "finance" });
  if (roleError || canFinance !== true) return json({ error: "FINANCE_ROLE_REQUIRED" }, 403);

  try {
    const secret = (Deno.env.get("THIRDWEB_SECRET_KEY") || "").trim();
    let catalog = { ok: false, reason: secret ? "THIRDWEB_LOOKUP_NOT_RUN" : "THIRDWEB_SECRET_KEY_MISSING", wallets: [] as Array<Record<string, unknown>> };
    if (secret) catalog = await thirdwebWalletCatalog(secret);
    const chains = await Promise.all((Object.keys(CHAINS) as Array<keyof typeof CHAINS>).map((key) => inspectChain(key, catalog)));
    return json({
      ok: true,
      generatedAt: new Date().toISOString(),
      overallReady: chains.every((chain) => chain.ready),
      checkedNetworks: chains.length,
      configuredThirdwebWalletsFound: catalog.wallets.length,
      thirdwebApi: { authenticated: catalog.ok, reason: catalog.reason },
      chains,
      note: "Read-only readiness checks; no transaction was submitted. Smart-account gas policy, token receipt end-to-end, deposit sweeping, and external send flows require separate controlled tests.",
    });
  } catch (error) {
    console.error("treasury-health failed", String(error).slice(0, 400));
    return json({ error: "TREASURY_HEALTH_CHECK_FAILED" }, 500);
  }
});
