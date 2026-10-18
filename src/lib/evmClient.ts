import {
  createPublicClient,
  createWalletClient,
  fallback,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseUnits,
  type Address,
  type Chain,
} from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { normalizeRecoveryPhrase } from './nonCustodialWallet';

export type EvmNetwork = 'ethereum' | 'polygon' | 'arbitrum' | 'bsc';

const ERC20_ABI = [
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

type NetworkConfig = {
  id: number;
  label: string;
  nativeSymbol: string;
  token: Address;
  tokenDecimals: number;
  chain: Chain;
  rpcUrls: string[];
};

const NETWORKS: Record<EvmNetwork, NetworkConfig> = {
  ethereum: {
    id: 1,
    label: 'Ethereum',
    nativeSymbol: 'ETH',
    token: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    tokenDecimals: 6,
    chain: {
      id: 1,
      name: 'Ethereum',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: ['https://eth.drpc.org', 'https://ethereum-rpc.publicnode.com'] } },
    },
    rpcUrls: ['https://eth.drpc.org', 'https://ethereum-rpc.publicnode.com'],
  },
  polygon: {
    id: 137,
    label: 'Polygon',
    nativeSymbol: 'POL',
    token: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    tokenDecimals: 6,
    chain: {
      id: 137,
      name: 'Polygon',
      nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
      rpcUrls: { default: { http: ['https://polygon.drpc.org', 'https://polygon-bor-rpc.publicnode.com'] } },
    },
    rpcUrls: ['https://polygon.drpc.org', 'https://polygon-bor-rpc.publicnode.com'],
  },
  arbitrum: {
    id: 42161,
    label: 'Arbitrum One',
    nativeSymbol: 'ETH',
    token: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    tokenDecimals: 6,
    chain: {
      id: 42161,
      name: 'Arbitrum One',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: ['https://arbitrum.drpc.org', 'https://arb1.arbitrum.io/rpc'] } },
    },
    rpcUrls: ['https://arbitrum.drpc.org', 'https://arb1.arbitrum.io/rpc'],
  },
  bsc: {
    id: 56,
    label: 'BNB Smart Chain',
    nativeSymbol: 'BNB',
    token: '0x55d398326f99059fF775485246999027B3197955',
    tokenDecimals: 18,
    chain: {
      id: 56,
      name: 'BNB Smart Chain',
      nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
      rpcUrls: { default: { http: ['https://bsc.drpc.org', 'https://bsc-rpc.publicnode.com'] } },
    },
    rpcUrls: ['https://bsc.drpc.org', 'https://bsc-rpc.publicnode.com'],
  },
};

export const EVM_NETWORKS = Object.entries(NETWORKS).map(([key, config]) => ({
  key: key as EvmNetwork,
  label: config.label,
  nativeSymbol: config.nativeSymbol,
  tokenDecimals: config.tokenDecimals,
}));

export type EvmBalanceSnapshot = {
  network: EvmNetwork;
  label: string;
  nativeSymbol: string;
  usdt: string;
  native: string;
  blockNumber: string;
  available: boolean;
  error?: string;
};

function makePublicClient(network: EvmNetwork) {
  const config = NETWORKS[network];
  return createPublicClient({
    chain: config.chain,
    transport: fallback(config.rpcUrls.map((url) => http(url, { timeout: 9000, retryCount: 1 }))),
  });
}

function validAmountText(value: string, decimals: number): bigint {
  const amount = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount)) {
    throw new Error('Enter a positive USDT amount using digits and an optional decimal point.');
  }

  const fraction = amount.split('.')[1] || '';
  if (fraction.length > decimals) {
    throw new Error('This network supports up to ' + decimals + ' decimal places for USDT.');
  }

  const parsed = parseUnits(amount, decimals);
  if (parsed <= 0n) throw new Error('Enter an amount greater than zero.');
  return parsed;
}

function validateRecipient(value: string): Address {
  const recipient = value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(recipient) || !isAddress(recipient, { strict: false })) {
    throw new Error('Enter a valid EVM recipient address.');
  }
  return getAddress(recipient);
}

export async function readEvmBalances(addressValue: string): Promise<EvmBalanceSnapshot[]> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(addressValue)) {
    throw new Error('The saved wallet address is invalid. Restore the wallet before reading balances.');
  }
  const address = getAddress(addressValue);

  return Promise.all((Object.keys(NETWORKS) as EvmNetwork[]).map(async (network) => {
    const config = NETWORKS[network];
    try {
      const client = makePublicClient(network);
      const chainId = await client.getChainId();
      if (chainId !== config.id) throw new Error('RPC_CHAIN_ID_MISMATCH');

      const [units, nativeUnits, blockNumber, actualDecimals] = await Promise.all([
        client.readContract({
          address: config.token,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address],
        }),
        client.getBalance({ address }),
        client.getBlockNumber(),
        client.readContract({ address: config.token, abi: ERC20_ABI, functionName: 'decimals' }),
      ]);

      if (Number(actualDecimals) !== config.tokenDecimals) throw new Error('USDT_TOKEN_DECIMALS_MISMATCH');

      return {
        network,
        label: config.label,
        nativeSymbol: config.nativeSymbol,
        usdt: formatUnits(units, config.tokenDecimals),
        native: formatUnits(nativeUnits, 18),
        blockNumber: blockNumber.toString(),
        available: true,
      };
    } catch {
      return {
        network,
        label: config.label,
        nativeSymbol: config.nativeSymbol,
        usdt: '—',
        native: '—',
        blockNumber: '',
        available: false,
        error: 'Network data is temporarily unavailable. Retry before making a transaction.',
      };
    }
  }));
}

/**
 * Sends USDT from the locally unlocked non-custodial wallet.
 * The mnemonic is used in memory only; no key material is transmitted to Aura servers.
 * Calling this function broadcasts a real mainnet transaction and must follow explicit
 * user review/confirmation in the UI.
 */
export async function sendEvmUsdt(
  mnemonicValue: string,
  network: EvmNetwork,
  destinationValue: string,
  amountValue: string,
): Promise<{ hash: \`0x\${string}\`; network: EvmNetwork; amount: string; destination: Address }> {
  const config = NETWORKS[network];
  if (!config) throw new Error('This EVM network is not supported.');
  const destination = validateRecipient(destinationValue);
  const amount = validAmountText(amountValue, config.tokenDecimals);
  const mnemonic = normalizeRecoveryPhrase(mnemonicValue);
  const account = mnemonicToAccount(mnemonic, { path: "m/44'/60'/0'/0/0" });
  const client = makePublicClient(network);

  const chainId = await client.getChainId();
  if (chainId !== config.id) throw new Error('Network check failed. No transaction was sent.');

  const [actualDecimals, tokenBalance, nativeBalance, gasPrice] = await Promise.all([
    client.readContract({ address: config.token, abi: ERC20_ABI, functionName: 'decimals' }),
    client.readContract({ address: config.token, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] }),
    client.getBalance({ address: account.address }),
    client.getGasPrice(),
  ]);

  if (Number(actualDecimals) !== config.tokenDecimals) throw new Error('The USDT token decimals do not match the expected network configuration.');
  if (tokenBalance < amount) throw new Error('The local wallet does not have enough USDT for this transfer.');

  const estimatedGas = await client.estimateContractGas({
    account: account.address,
    address: config.token,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [destination, amount],
  });
  const estimatedCost = estimatedGas * gasPrice;
  const requiredNative = estimatedCost + estimatedCost / 5n;
  if (nativeBalance < requiredNative) {
    throw new Error('Not enough ' + config.nativeSymbol + ' for network gas. No USDT transaction was sent.');
  }

  const { request } = await client.simulateContract({
    account,
    address: config.token,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [destination, amount],
  });

  const walletClient = createWalletClient({
    account,
    chain: config.chain,
    transport: fallback(config.rpcUrls.map((url) => http(url, { timeout: 20000, retryCount: 0 }))),
  });

  const hash = await walletClient.writeContract(request);
  return { hash, network, amount: formatUnits(amount, config.tokenDecimals), destination };
}
