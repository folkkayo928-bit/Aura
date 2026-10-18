const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const SOLANA_MAINNET_GENESIS_HASH = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-rpc.publicnode.com',
];

type RpcEnvelope<T> = { result?: T; error?: { message?: string; code?: number } };
type TokenAccountsResult = {
  context?: { slot?: number };
  value?: Array<{
    account?: {
      data?: {
        parsed?: {
          info?: {
            tokenAmount?: { amount?: string; decimals?: number };
          };
        };
      };
    };
  }>;
};

export type SolanaUsdtBalanceSnapshot = {
  network: 'solana';
  tokenSymbol: 'USDT';
  tokenBalance: string;
  slot: number;
  available: boolean;
  error?: string;
};

async function rpc<T>(endpoint: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error('SOLANA_RPC_HTTP_ERROR');
  const payload = await response.json() as RpcEnvelope<T>;
  if (payload.error || payload.result === undefined) throw new Error('SOLANA_RPC_RESPONSE_ERROR');
  return payload.result;
}

function formatUnits(units: bigint, decimals: number) {
  const base = 10n ** BigInt(decimals);
  const whole = units / base;
  const fraction = (units % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? whole.toString() + '.' + fraction : whole.toString();
}

/** Read-only USDT balance lookup for a connected Solana wallet; never signs or sends transactions. */
export async function readSolanaUsdtBalance(ownerAddress: string): Promise<SolanaUsdtBalanceSnapshot> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ownerAddress)) {
    throw new Error('INVALID_SOLANA_WALLET_ADDRESS');
  }

  let lastError: unknown;
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const genesisHash = await rpc<string>(endpoint, 'getGenesisHash', []);
      if (genesisHash !== SOLANA_MAINNET_GENESIS_HASH) throw new Error('SOLANA_RPC_CLUSTER_MISMATCH');
      const result = await rpc<TokenAccountsResult>(endpoint, 'getTokenAccountsByOwner', [
        ownerAddress,
        { mint: USDT_MINT },
        { encoding: 'jsonParsed', commitment: 'confirmed' },
      ]);
      let totalUnits = 0n;
      for (const account of result.value || []) {
        const tokenAmount = account.account?.data?.parsed?.info?.tokenAmount;
        if (!tokenAmount || tokenAmount.decimals !== 6 || !/^\d+$/.test(String(tokenAmount.amount || ''))) {
          throw new Error('SOLANA_USDT_ACCOUNT_DATA_INVALID');
        }
        totalUnits += BigInt(tokenAmount.amount!);
      }
      return {
        network: 'solana',
        tokenSymbol: 'USDT',
        tokenBalance: formatUnits(totalUnits, 6),
        slot: Number(result.context?.slot || 0),
        available: true,
      };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    network: 'solana',
    tokenSymbol: 'USDT',
    tokenBalance: '—',
    slot: 0,
    available: false,
    error: lastError instanceof Error ? lastError.message : 'SOLANA_RPC_UNAVAILABLE',
  };
}
