import { createClient } from "npm:@supabase/supabase-js@2";
import { createPublicClient, formatUnits, http, parseUnits, type Address } from "npm:viem@2";
import { privateKeyToAccount } from "npm:viem@2/accounts";

const ERC20_ABI = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

const CHAINS = {
  ethereum: { id: 1, label: "Ethereum", token: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, treasuryEnv: "AURA_EVM_TREASURY_ETHEREUM", rpcEnv: "AURA_EVM_RPC_ETHEREUM", native: "ETH", fallback: "https://eth.drpc.org" },
  polygon: { id: 137, label: "Polygon", token: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6, treasuryEnv: "AURA_EVM_TREASURY_POLYGON", rpcEnv: "AURA_EVM_RPC_POLYGON", native: "POL", fallback: "https://polygon.drpc.org" },
  arbitrum: { id: 42161, label: "Arbitrum", token: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6, treasuryEnv: "AURA_EVM_TREASURY_ARBITRUM", rpcEnv: "AURA_EVM_RPC_ARBITRUM", native: "ETH", fallback: "https://arbitrum.drpc.org" },
  bsc: { id: 56, label: "BNB Smart Chain", token: "0x55d398326f99059fF775485246999027B3197955", decimals: 18, treasuryEnv: "AURA_EVM_TREASURY_BSC", rpcEnv: "AURA_EVM_RPC_BSC", native: "BNB", fallback: "https://bsc.drpc.org" },
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
    let catalog: { ok: boolean; reason: string | null; wallets: Array<Record<string, unknown>> } = { ok: false, reason: secret ? "THIRDWEB_LOOKUP_NOT_RUN" : "THIRDWEB_SECRET_KEY_MISSING", wallets: [] };
    if (secret) catalog = await thirdwebWalletCatalog(secret);
    const chains = await Promise.all((Object.keys(CHAINS) as Array<keyof typeof CHAINS>).map((key) => inspectChain(key, catalog)));

    // Deposit and sweep telemetry is aggregate-only. This endpoint is finance-role
    // gated above; raw custody materials, wallet addresses, and user IDs are never returned.
    let depositOperations: Record<string, unknown> = {
      available: false,
      reason: "SERVER_DATABASE_KEY_UNAVAILABLE",
      note: "No deposit rows or custody details were exposed.",
    };
    if (serverApiKey) {
      const adminClient = createClient(url, serverApiKey);
      const [
        totalDeposits, detectedDeposits, creditedDeposits,
        pendingSweeps, activeSweeps, failedSweeps, completedSweeps,
        custodialAddresses, cursors, oldestPendingSweep,
        xpubVault, mnemonicVault,
      ] = await Promise.all([
        adminClient.from("wallet_deposits").select("id", { count: "exact", head: true }),
        adminClient.from("wallet_deposits").select("id", { count: "exact", head: true }).eq("status", "detected"),
        adminClient.from("wallet_deposits").select("id", { count: "exact", head: true }).eq("status", "credited"),
        adminClient.from("wallet_deposits").select("id", { count: "exact", head: true }).eq("sweep_status", "pending"),
        adminClient.from("wallet_deposits").select("id", { count: "exact", head: true }).eq("sweep_status", "sweeping"),
        adminClient.from("wallet_deposits").select("id", { count: "exact", head: true }).eq("sweep_status", "failed"),
        adminClient.from("wallet_deposits").select("id", { count: "exact", head: true }).eq("sweep_status", "swept"),
        adminClient.from("onchain_wallets").select("id", { count: "exact", head: true }).eq("provider", "aura_hd_wallet").eq("address_type", "custodial_deposit"),
        adminClient.from("wallet_deposit_scan_cursors").select("chain,last_scanned_block,updated_at").in("chain", Object.keys(CHAINS)),
        adminClient.from("wallet_deposits").select("chain,user_id,destination_address,amount,created_at,sweep_attempted_at,sweep_error").eq("sweep_status", "pending").is("sweep_tx_hash", null).order("created_at", { ascending: true }).limit(1),
        adminClient.rpc("get_aura_evm_deposit_xpub"),
        adminClient.rpc("get_aura_evm_deposit_mnemonic"),
      ]);

      const queryErrors = [
        totalDeposits.error, detectedDeposits.error, creditedDeposits.error,
        pendingSweeps.error, activeSweeps.error, failedSweeps.error, completedSweeps.error,
        custodialAddresses.error, cursors.error, oldestPendingSweep.error,
      ].filter(Boolean);
      const xpubConfigured = Boolean(String(Deno.env.get("AURA_EVM_DEPOSIT_XPUB") || xpubVault.data || "").trim());
      const mnemonicConfigured = Boolean(String(Deno.env.get("AURA_EVM_DEPOSIT_MNEMONIC") || mnemonicVault.data || "").trim());
      const configuredTreasuries = (Object.keys(CHAINS) as Array<keyof typeof CHAINS>).map((key) => ({
        chain: key,
        configured: isAddress(String(Deno.env.get(CHAINS[key].treasuryEnv) || "").trim()),
      }));
      const pending = oldestPendingSweep.data?.[0] || null;

      // Finance-only diagnostics for the oldest unswept deposit: public-chain
      // reads only. Never return its address, user ID, or any custody material.
      let pendingSweepGasCheck: Record<string, unknown> | null = null;
      if (pending) {
        const chainName = String(pending.chain || "");
        if (!Object.prototype.hasOwnProperty.call(CHAINS, chainName)) {
          pendingSweepGasCheck = { status: "unsupported_chain" };
        } else {
          const key = chainName as keyof typeof CHAINS;
          const cfg = CHAINS[key];
          const { data: wallet, error: walletError } = await adminClient
            .from("onchain_wallets")
            .select("address,derivation_index")
            .eq("user_id", pending.user_id)
            .eq("chain", key)
            .eq("provider", "aura_hd_wallet")
            .maybeSingle();

          if (walletError) {
            pendingSweepGasCheck = { status: "deposit_wallet_lookup_failed" };
          } else if (!wallet?.address || !isAddress(String(wallet.address)) ||
                     String(wallet.address).toLowerCase() !== String(pending.destination_address).toLowerCase()) {
            pendingSweepGasCheck = { status: wallet?.address ? "deposit_address_mismatch" : "deposit_wallet_missing" };
          } else {
            const rpcUrl = (Deno.env.get(cfg.rpcEnv) || "").trim() || cfg.fallback;
            const publicChain = {
              id: cfg.id,
              name: cfg.label,
              nativeCurrency: { name: cfg.native, symbol: cfg.native, decimals: 18 },
              rpcUrls: { default: { http: [rpcUrl] } },
            } as const;
            try {
              const publicClient = createPublicClient({ chain: publicChain, transport: http(rpcUrl, { timeout: 10000 }) });
              const actualChainId = await publicClient.getChainId();
              if (actualChainId !== cfg.id) {
                pendingSweepGasCheck = { status: "rpc_chain_mismatch", expectedChainId: cfg.id, actualChainId };
              } else {
                const address = String(wallet.address) as Address;
                const [nativeUnits, tokenUnits, tokenDecimals] = await Promise.all([
                  publicClient.getBalance({ address }),
                  publicClient.readContract({ address: cfg.token, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }),
                  publicClient.readContract({ address: cfg.token, abi: ERC20_ABI, functionName: "decimals" }),
                ]);
                let gasStatus = "blocked";
                let estimatedRequired = null as string | null;
                if (Number(tokenDecimals) !== cfg.decimals) {
                  gasStatus = "token_decimals_mismatch";
                } else if (tokenUnits === 0n) {
                  gasStatus = "no_usdt_at_deposit_address";
                } else if (!isAddress(String(Deno.env.get(cfg.treasuryEnv) || "").trim())) {
                  gasStatus = "treasury_not_configured";
                } else {
                  const recordedAmount = parseUnits(String(pending.amount), cfg.decimals);
                  const sweepAmount = tokenUnits < recordedAmount ? tokenUnits : recordedAmount;
                  if (sweepAmount > 0n) {
                    const gasEstimate = await publicClient.estimateContractGas({
                      account: address,
                      address: cfg.token,
                      abi: ERC20_ABI,
                      functionName: "transfer",
                      args: [String(Deno.env.get(cfg.treasuryEnv)).trim() as Address, sweepAmount],
                    });
                    const gasPrice = await publicClient.getGasPrice();
                    const rawGasCost = gasEstimate * gasPrice;
                    const requiredWithBuffer = rawGasCost + rawGasCost / 5n;
                    estimatedRequired = formatUnits(requiredWithBuffer, 18);
                    gasStatus = nativeUnits >= requiredWithBuffer ? "sufficient_with_20_percent_buffer" : "insufficient_native_gas";
                  } else {
                    gasStatus = "invalid_sweep_amount";
                  }
                }
                pendingSweepGasCheck = {
                  status: gasStatus,
                  nativeSymbol: cfg.native,
                  nativeBalance: formatUnits(nativeUnits, 18),
                  usdtBalance: formatUnits(tokenUnits, cfg.decimals),
                  estimatedNativeGasRequiredWithBuffer: estimatedRequired,
                  rpcChainId: actualChainId,
                };
              }
            } catch {
              pendingSweepGasCheck = { status: "rpc_or_gas_estimate_failed" };
            }
          }
        }
      }

      depositOperations = {
        available: queryErrors.length === 0,
        ...(queryErrors.length ? { reason: "DEPOSIT_TELEMETRY_QUERY_FAILED" } : {}),
        counts: {
          total: totalDeposits.count || 0,
          detected: detectedDeposits.count || 0,
          credited: creditedDeposits.count || 0,
          sweepPending: pendingSweeps.count || 0,
          sweepInProgress: activeSweeps.count || 0,
          sweepFailed: failedSweeps.count || 0,
          swept: completedSweeps.count || 0,
          custodialAddresses: custodialAddresses.count || 0,
        },
        sweepCustody: {
          mnemonicConfigured,
          xpubConfigured,
          derivationConsistencyCanBeChecked: mnemonicConfigured && xpubConfigured,
          sweepConfigurationComplete: mnemonicConfigured && xpubConfigured && configuredTreasuries.every((chain) => chain.configured),
        },
        treasuryConfiguredByChain: configuredTreasuries,
        scanCursors: (cursors.data || []).map((cursor) => ({
          chain: cursor.chain,
          lastScannedBlock: String(cursor.last_scanned_block),
          updatedAt: cursor.updated_at,
        })),
        oldestPendingSweep: pending ? {
          chain: pending.chain,
          createdAt: pending.created_at,
          attemptedAt: pending.sweep_attempted_at,
          errorCode: pending.sweep_error ? String(pending.sweep_error).split(/[:\s]/)[0].slice(0, 80) : null,
          gasCheck: pendingSweepGasCheck,
        } : null,
        note: "A deposit is credited to the AURA ledger only after indexer verification; a sweep is a separate transfer from the derived deposit address to treasury. This summary never returns raw custody secrets, addresses, or user IDs.",
      };
    }

    return json({
      ok: true,
      generatedAt: new Date().toISOString(),
      overallReady: chains.every((chain) => chain.ready),
      checkedNetworks: chains.length,
      configuredThirdwebWalletsFound: catalog.wallets.length,
      thirdwebApi: { authenticated: catalog.ok, reason: catalog.reason },
      chains,
      depositOperations,
      note: "Read-only checks; no transaction was submitted. Smart-account gas sponsorship, end-to-end deposits/sweeps, and external send flows still require controlled canary tests.",
    });
  } catch (error) {
    console.error("treasury-health failed", String(error).slice(0, 400));
    return json({ error: "TREASURY_HEALTH_CHECK_FAILED" }, 500);
  }
});
