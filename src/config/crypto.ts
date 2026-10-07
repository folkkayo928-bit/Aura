export type AURACryptoAsset = 'USDT';

export interface AURANetworkOption {
  id: 'ethereum' | 'polygon' | 'arbitrum' | 'bsc';
  label: string;
  tokenSymbol: AURACryptoAsset;
  status: 'live';
}

export const AURA_ASSETS: { id: AURACryptoAsset; label: string; status: 'live' }[] = [
  { id: 'USDT', label: 'Tether USD (USDT)', status: 'live' },
];

export const AURA_WITHDRAWAL_NETWORKS: AURANetworkOption[] = [
  { id: 'ethereum', label: 'Ethereum', tokenSymbol: 'USDT', status: 'live' },
  { id: 'polygon', label: 'Polygon', tokenSymbol: 'USDT', status: 'live' },
  { id: 'arbitrum', label: 'Arbitrum One', tokenSymbol: 'USDT', status: 'live' },
  { id: 'bsc', label: 'BNB Smart Chain', tokenSymbol: 'USDT', status: 'live' },
];

// Keep future assets/networks additive. They must not be shown as withdrawable
// until the wallet ledger, validation, broadcaster and confirmation flow support them.
