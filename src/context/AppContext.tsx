import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import {
  Artwork,
  FeedSection,
  TelegramNotification,
  Transaction,
  ArtworkCategory,
  CryptoNetwork,
  P2POffer,
  P2PMerchant,
  P2POrder,
  PaymentMethodType,
  ConnectedExternalWallet,
  NFTCollection,
  UpcomingDrop,
  MediaType,
  NFTTrait,
  TelegramViewMode,
} from '../types';
import { INITIAL_ARTWORKS } from '../data/mockArtworks';
import { INITIAL_P2P_OFFERS } from '../data/mockP2P';
import {
  INITIAL_COLLECTIONS,
  INITIAL_UPCOMING_DROPS,
  EXTENDED_MARKETPLACE_ARTWORKS,
} from '../data/mockNFTMarketplace';

export interface UserProfile {
  name: string;
  telegramHandle: string;
  avatar: string;
  coverImage: string;
  bio: string;
  vaultId: string;
  joinedDate: string;
  defaultCurrency: 'USD' | 'EUR' | 'GBP';
  notificationsEnabled: boolean;
  telegramBotAlerts: boolean;
  twoFactorEnabled: boolean;
  biometricAuth: boolean;
}

export interface Web3VaultAddresses {
  ton: string;
  polygon: string;
  ethereum: string;
  arbitrum: string;
  solana: string;
  seedPhrase: string;
}

interface AppContextType {
  artworks: Artwork[];
  collections: NFTCollection[];
  upcomingDrops: UpcomingDrop[];
  activeTab: 'home' | 'discover' | 'create' | 'wallet' | 'profile';
  setActiveTab: (tab: 'home' | 'discover' | 'create' | 'wallet' | 'profile') => void;
  feedFilter: FeedSection;
  setFeedFilter: (filter: FeedSection) => void;
  selectedArtwork: Artwork | null;
  setSelectedArtwork: (artwork: Artwork | null) => void;
  selectedCollection: NFTCollection | null;
  setSelectedCollection: (collection: NFTCollection | null) => void;
  makeOfferArtwork: Artwork | null;
  setMakeOfferArtwork: (artwork: Artwork | null) => void;
  sellArtworkP2PModal: Artwork | null;
  setSellArtworkP2PModal: (artwork: Artwork | null) => void;
  userProfile: UserProfile;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<boolean>;
  vaultAddresses: Web3VaultAddresses;
  connectedWallets: ConnectedExternalWallet[];
  connectExternalWallet: (name: ConnectedExternalWallet['name'], network: CryptoNetwork) => void;
  disconnectExternalWallet: (id: string) => void;
  walletBalance: number; // USDT
  transactions: Transaction[];
  notifications: TelegramNotification[];
  dismissNotification: (id: string) => void;
  addNotification: (title: string, message: string, type: TelegramNotification['type']) => void;
  toggleLike: (artworkId: string) => void;
  toggleLove: (artworkId: string) => void;
  toggleSave: (artworkId: string) => void;
  toggleWatchlist: (artworkId: string) => void;
  toggleCollectionWatchlist: (collectionId: string) => void;
  toggleDropReminder: (dropId: string) => void;
  addComment: (artworkId: string, text: string) => void;
  collectArtwork: (artwork: Artwork) => boolean;
  quickBuyArtwork: (artwork: Artwork) => boolean;
  makeOfferOnArtwork: (artworkId: string, offerAmount: number) => void;
  convertArtwork: (artwork: Artwork, fee: number) => { success: boolean; netPayout: number };
  listArtworkOnP2P: (params: {
    artworkId: string;
    fiatPrice: number;
    currency: 'USD' | 'EUR' | 'GBP';
    paymentMethods: PaymentMethodType[];
    paymentInstructions?: string;
  }) => Promise<void>;
  uploadArtworkFile: (file: File) => Promise<string | null>;
  createArtwork: (newArt: {
    title: string;
    description: string;
    price: number;
    visualTheme: Artwork['visualTheme'];
    category: ArtworkCategory;
    mediaType?: MediaType;
    customMediaUrl?: string;
    collectionName?: string;
    traits?: NFTTrait[];
    listOnP2P?: boolean;
    p2pPriceFiat?: number;
    p2pPaymentMethods?: PaymentMethodType[];
    p2pPaymentInstructions?: string;
  }) => Promise<void>;
  isTelegramShellMode: boolean;
  setIsTelegramShellMode: (enabled: boolean) => void;
  // Modals state
  collectModalArtwork: Artwork | null;
  setCollectModalArtwork: (artwork: Artwork | null) => void;
  convertModalArtwork: Artwork | null;
  setConvertModalArtwork: (artwork: Artwork | null) => void;
  communityDrawerArtwork: Artwork | null;
  setCommunityDrawerArtwork: (artwork: Artwork | null) => void;
  sendModalOpen: boolean;
  setSendModalOpen: (open: boolean) => void;
  receiveModalOpen: boolean;
  setReceiveModalOpen: (open: boolean) => void;
  buyModalOpen: boolean;
  setBuyModalOpen: (open: boolean) => void;
  settingsModalOpen: boolean;
  setSettingsModalOpen: (open: boolean) => void;
  seedPhraseModalOpen: boolean;
  setSeedPhraseModalOpen: (open: boolean) => void;
  p2pModalOpen: boolean;
  setP2pModalOpen: (open: boolean) => void;
  topUpBalance: (amount: number) => void;
  sendInternalFunds: (recipient: string, amount: number) => boolean;
  sendExternalCrypto: (params: {
    network: CryptoNetwork;
    destinationAddress: string;
    amount: number;
    gasFee: number;
  }) => { success: boolean; txHash: string };
  simulateInboundDeposit: (network: CryptoNetwork, amount: number) => void;
  // P2P Trustless Escrow Market
  p2pOffers: P2POffer[];
  activeP2POrder: P2POrder | null;
  setActiveP2POrder: (order: P2POrder | null) => void;
  startP2POrder: (params: {
    offer: P2POffer;
    cryptoAmount: number;
    paymentMethod: PaymentMethodType;
    paymentDetails?: {
      accountName?: string;
      accountNumberOrId?: string;
    };
  }) => Promise<P2POrder | null>;
  markP2PPaymentSent: (orderId: string) => void;
  completeP2POrder: (orderId: string) => void;
  cancelP2POrder: (orderId: string) => void;
  raiseP2PDispute: (orderId: string) => void;
  createP2POffer: (offerData: Omit<P2POffer, 'id' | 'merchant' | 'isSmartEscrowLocked'>) => void;
  // Telegram Bot Homepage & Chat integration
  telegramViewMode: TelegramViewMode;
  setTelegramViewMode: (mode: TelegramViewMode) => void;
  startBotAndOpenApp: (options?: {
    destinationTab?: 'home' | 'discover' | 'create' | 'wallet' | 'profile';
    customNotification?: string;
  }) => void;
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEY_ARTWORKS = 'aura_artworks_v4';
const STORAGE_KEY_COLLECTIONS = 'aura_collections_v4';
const STORAGE_KEY_DROPS = 'aura_drops_v4';
const STORAGE_KEY_WALLET = 'aura_wallet_v4';
const STORAGE_KEY_TXS = 'aura_txs_v4';
const STORAGE_KEY_PROFILE = 'aura_profile_v4';
const STORAGE_KEY_P2P = 'aura_p2p_offers_v4';
const STORAGE_KEY_WALLETS = 'aura_connected_wallets_v4';

const COMBINED_INITIAL_ARTWORKS: Artwork[] = [
  ...EXTENDED_MARKETPLACE_ARTWORKS,
  ...INITIAL_ARTWORKS,
];

const sanitizeArtwork = (art: any): Artwork => ({
  ...art,
  eligibleInteractions: typeof art.eligibleInteractions === 'number' ? art.eligibleInteractions : 500,
  currentValue: typeof art.currentValue === 'number' ? art.currentValue : 25,
  originalPrice: typeof art.originalPrice === 'number' ? art.originalPrice : 25,
  likes: typeof art.likes === 'number' ? art.likes : 0,
  loves: typeof art.loves === 'number' ? art.loves : 0,
  saves: typeof art.saves === 'number' ? art.saves : 0,
  collectorsCount: typeof art.collectorsCount === 'number' ? art.collectorsCount : 0,
  interestLevel: art.interestLevel || 'High',
  isWatched: art.isWatched ?? false,
  conversionEligible: true, // Photos and artworks can be converted into money
  traits: Array.isArray(art.traits) ? art.traits : [],
  comments: Array.isArray(art.comments) ? art.comments : [],
  collectors: Array.isArray(art.collectors) ? art.collectors : [],
});

const sanitizeCollection = (col: any): NFTCollection => ({
  ...col,
  floorPriceUSDT: typeof col.floorPriceUSDT === 'number' ? col.floorPriceUSDT : 10,
  totalVolumeUSDT: typeof col.totalVolumeUSDT === 'number' ? col.totalVolumeUSDT : 1000,
  itemsCount: typeof col.itemsCount === 'number' ? col.itemsCount : 100,
  ownersCount: typeof col.ownersCount === 'number' ? col.ownersCount : 50,
  isWatched: Boolean(col.isWatched),
});

const sanitizeDrop = (drop: any): UpcomingDrop => ({
  ...drop,
  mintPriceUSDT: typeof drop.mintPriceUSDT === 'number' ? drop.mintPriceUSDT : 50,
  supply: typeof drop.supply === 'number' ? drop.supply : 1000,
  mintedSoFar: typeof drop.mintedSoFar === 'number' ? drop.mintedSoFar : 0,
  mintTimestamp: typeof drop.mintTimestamp === 'number' ? drop.mintTimestamp : Date.now() + 86400000,
  perks: Array.isArray(drop.perks) ? drop.perks : [],
});

const sanitizeP2POffer = (offer: any): P2POffer => ({
  ...offer,
  availableCrypto: typeof offer.availableCrypto === 'number' ? offer.availableCrypto : 500,
  minLimitFiat: typeof offer.minLimitFiat === 'number' ? offer.minLimitFiat : 10,
  maxLimitFiat: typeof offer.maxLimitFiat === 'number' ? offer.maxLimitFiat : 1000,
  pricePerUnit: typeof offer.pricePerUnit === 'number' ? offer.pricePerUnit : 1.0,
  merchant: {
    ...offer.merchant,
    name: offer.merchant?.name || 'Verified Merchant',
    legalName: offer.merchant?.legalName || offer.merchant?.name || 'Verified Peer',
    depositBondUSDT: typeof offer.merchant?.depositBondUSDT === 'number' ? offer.merchant.depositBondUSDT : 5000,
    ordersCompleted: typeof offer.merchant?.ordersCompleted === 'number' ? offer.merchant.ordersCompleted : 500,
    completionRate: typeof offer.merchant?.completionRate === 'number' ? offer.merchant.completionRate : 99.8,
    avgReleaseTimeMinutes: typeof offer.merchant?.avgReleaseTimeMinutes === 'number' ? offer.merchant.avgReleaseTimeMinutes : 2,
    verifiedMerchant: true,
    kycVerified: true,
    positiveFeedbackPercent: typeof offer.merchant?.positiveFeedbackPercent === 'number' ? offer.merchant.positiveFeedbackPercent : 100,
    telegramHandle: offer.merchant?.telegramHandle || '@merchant',
  },
  paymentMethods: Array.isArray(offer.paymentMethods) && offer.paymentMethods.length > 0
    ? offer.paymentMethods
    : ['telegram_pay', 'revolut'],
  isSmartEscrowLocked: true,
  isBuyerProtected: true,
});

const isBackendArtworkId = (id: string) => /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id);

const mapLedgerToTransaction = (row: any): Transaction => {
  const amount = Number(row.amount_usdt || 0);
  let type: Transaction['type'] = 'receive';
  if (String(row.kind).includes('collect')) type = 'collect';
  else if (String(row.kind).includes('convert')) type = 'convert';
  else if (String(row.kind).includes('send') || String(row.kind).includes('transfer')) type = 'send';
  else if (String(row.kind).includes('create')) type = 'create';
  else if (String(row.kind).includes('p2p_buy')) type = 'p2p_buy';
  else if (String(row.kind).includes('p2p_sell')) type = 'p2p_sell';
  return {
    id: row.id,
    type,
    amount,
    currency: 'USDT',
    date: new Date(row.created_at).toLocaleString(),
    recipientOrSender: row.memo || undefined,
    status: 'confirmed',
  };
};

const backendArtworkToUi = (row: any, owned = false, purchasePrice?: number, interaction?: any): Artwork => ({
  id: row.id,
  title: row.title,
  edition: row.edition || '1 of 1 · Genesis',
  creator: {
    id: row.creator_id,
    name: row.profiles?.display_name || 'AURA Creator',
    handle: row.profiles?.handle || '@creator',
    avatar: row.profiles?.avatar_url || '',
    verified: true,
    bio: row.profiles?.bio || '',
    totalPieces: 0,
    totalCollectors: Number(row.collectors_count || 0),
  },
  visualTheme: row.visual_theme || 'custom_upload',
  accentColor: '#e0c070',
  description: row.description || '',
  medium: row.media_type || 'Digital Art',
  dimensions: 'Master file',
  originalPrice: Number(row.original_price_usdt || 0),
  currentValue: Number(row.current_value_usdt || 0),
  purchasePrice: purchasePrice,
  isOwned: owned,
  eligibleInteractions: Number(row.eligible_interactions || 0),
  interestLevel: row.interest_level || 'Rising',
  interestScore: Number(row.interest_score || 0),
  likes: Number(row.likes || 0),
  loves: Number(row.loves || 0),
  saves: Number(row.saves || 0),
  collectorsCount: Number(row.collectors_count || 0),
  collectors: [],
  isLiked: Boolean(interaction?.liked),
  isLoved: Boolean(interaction?.loved),
  isSaved: Boolean(interaction?.saved),
  isWatched: Boolean(interaction?.watched),
  createdDate: new Date(row.created_at).toLocaleDateString(),
  category: row.category || 'generative',
  mediaType: row.media_type || 'image',
  customMediaUrl: row.media_url || undefined,
  collectionName: row.collection_name || undefined,
  traits: Array.isArray(row.traits) ? row.traits : [],
  conversionEligible: Boolean(row.conversion_eligible),
  conversionLiquidity: row.conversion_liquidity || 'Ample',
  isListedOnP2P: Boolean(row.is_listed_on_p2p),
  p2pPriceFiat: row.p2p_price_fiat ? Number(row.p2p_price_fiat) : undefined,
  p2pCurrency: row.p2p_currency || undefined,
  p2pPaymentMethods: Array.isArray(row.p2p_payment_methods) ? row.p2p_payment_methods : [],
  comments: [],
});

const backendMerchantToUi = (row: any): P2PMerchant => ({
  id: row?.id || '',
  name: row?.display_name || 'AURA Member',
  legalName: row?.display_name || 'AURA Member',
  avatar: row?.avatar_url || '',
  ordersCompleted: 0,
  completionRate: 0,
  avgReleaseTimeMinutes: 0,
  verifiedMerchant: false,
  kycVerified: false,
  depositBondUSDT: 0,
  telegramHandle: row?.handle || '',
  positiveFeedbackPercent: 0,
});

const backendP2POfferToUi = (row: any): P2POffer => ({
  id: row.id,
  type: row.type,
  merchant: backendMerchantToUi(row.merchant),
  pricePerUnit: Number(row.price_per_unit || 0),
  fiatCurrency: row.fiat_currency || 'USD',
  availableCrypto: Number(row.available_crypto || 0),
  minLimitFiat: Number(row.min_limit_fiat || 0),
  maxLimitFiat: Number(row.max_limit_fiat || 0),
  paymentMethods: Array.isArray(row.payment_methods) ? row.payment_methods : [],
  paymentInstructions: row.payment_instructions || '',
  isSmartEscrowLocked: true,
  isBuyerProtected: true,
  artworkId: row.artwork_id || undefined,
  artworkTitle: row.artwork?.title || undefined,
  artworkImage: row.artwork?.media_url || undefined,
});

const backendP2POrderToUi = (row: any): P2POrder => {
  const offer = row.offer || {};
  return {
    id: row.id,
    offerId: row.offer_id,
    type: row.type,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    merchant: backendMerchantToUi(offer.merchant),
    cryptoAmount: Number(row.crypto_amount || 0),
    fiatAmount: Number(row.fiat_amount || 0),
    fiatCurrency: row.fiat_currency || 'USD',
    paymentMethod: row.payment_method,
    status: row.status,
    escrowTxHash: row.escrow_reference || row.reference_code || '',
    createdAt: row.created_at ? new Date(row.created_at).toLocaleString() : 'Just now',
    protectionFundActive: row.status === 'escrow_locked' || row.status === 'payment_marked',
    artwork: row.artwork_id ? {
      id: row.artwork_id,
      title: offer.artwork?.title || 'AURA Artwork',
      image: offer.artwork?.media_url || '',
    } : undefined,
    paymentDetails: {
      accountName: row.payment_details?.accountName || offer.merchant?.display_name || 'AURA Counterparty',
      accountNumberOrId: row.payment_details?.accountNumberOrId || 'Use the payment method instructions.',
      referenceCode: row.payment_details?.referenceCode || row.reference_code || '',
    },
    chatMessages: [],
  };
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, openAuth } = useAuth();
  const [artworks, setArtworks] = useState<Artwork[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ARTWORKS);
      return saved ? JSON.parse(saved).map(sanitizeArtwork) : COMBINED_INITIAL_ARTWORKS;
    } catch {
      return COMBINED_INITIAL_ARTWORKS;
    }
  });

  const [collections, setCollections] = useState<NFTCollection[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COLLECTIONS);
      return saved ? JSON.parse(saved).map(sanitizeCollection) : INITIAL_COLLECTIONS;
    } catch {
      return INITIAL_COLLECTIONS;
    }
  });

  const [upcomingDrops, setUpcomingDrops] = useState<UpcomingDrop[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DROPS);
      return saved ? JSON.parse(saved).map(sanitizeDrop) : INITIAL_UPCOMING_DROPS;
    } catch {
      return INITIAL_UPCOMING_DROPS;
    }
  });

  const [walletBalance, setWalletBalance] = useState<number>(0);

  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'AURA Collector',
    telegramHandle: '@collector',
    avatar: '',
    coverImage: '',
    bio: 'Collecting digital art on AURA.',
    vaultId: 'Sign in to create your vault',
    joinedDate: 'New member',
    defaultCurrency: 'USD',
    notificationsEnabled: true,
    telegramBotAlerts: true,
    twoFactorEnabled: false,
    biometricAuth: false,
  });

  const vaultAddresses: Web3VaultAddresses = {
    ton: '',
    polygon: '',
    ethereum: '',
    arbitrum: '',
    solana: '',
    seedPhrase: '',
  };

  const [connectedWallets, setConnectedWallets] = useState<ConnectedExternalWallet[]>([]);

  const [p2pOffers, setP2pOffers] = useState<P2POffer[]>([]);

  const [activeP2POrder, setActiveP2POrder] = useState<P2POrder | null>(null);

  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [activeTab, setActiveTab] = useState<'home' | 'discover' | 'create' | 'wallet' | 'profile'>('home');
  const [feedFilter, setFeedFilter] = useState<FeedSection>('trending');
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<NFTCollection | null>(null);
  const [makeOfferArtwork, setMakeOfferArtwork] = useState<Artwork | null>(null);
  const [sellArtworkP2PModal, setSellArtworkP2PModal] = useState<Artwork | null>(null);
  const [isTelegramShellMode, setIsTelegramShellMode] = useState<boolean>(false);
  const [telegramViewMode, setTelegramViewMode] = useState<TelegramViewMode>('bot_profile');

  // Modals state
  const [collectModalArtwork, setCollectModalArtwork] = useState<Artwork | null>(null);
  const [convertModalArtwork, setConvertModalArtwork] = useState<Artwork | null>(null);
  const [communityDrawerArtwork, setCommunityDrawerArtwork] = useState<Artwork | null>(null);
  const [sendModalOpen, setSendModalOpen] = useState<boolean>(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState<boolean>(false);
  const [buyModalOpen, setBuyModalOpen] = useState<boolean>(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState<boolean>(false);
  const [seedPhraseModalOpen, setSeedPhraseModalOpen] = useState<boolean>(false);
  const [p2pModalOpen, setP2pModalOpen] = useState<boolean>(false);

  const [notifications, setNotifications] = useState<TelegramNotification[]>([]);

  // Persist
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ARTWORKS, JSON.stringify(artworks));
  }, [artworks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_COLLECTIONS, JSON.stringify(collections));
  }, [collections]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DROPS, JSON.stringify(upcomingDrops));
  }, [upcomingDrops]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WALLET, walletBalance.toString());
  }, [walletBalance]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(userProfile));
  }, [userProfile]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_P2P, JSON.stringify(p2pOffers));
  }, [p2pOffers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WALLETS, JSON.stringify(connectedWallets));
  }, [connectedWallets]);

  useEffect(() => {
    let cancelled = false;
    const loadBackendState = async () => {
      if (!user) {
        setWalletBalance(0);
        setTransactions([]);
        setConnectedWallets([]);
        setP2pOffers([]);
        setActiveP2POrder(null);
        return;
      }

      const [profileRes, walletRes, ledgerRes, ownedRes, interactionsRes, artworkRes, extWalletsRes, p2pOffersRes, activeOrderRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('wallet_accounts').select('balance_usdt').eq('user_id', user.id).maybeSingle(),
        supabase.from('wallet_ledger').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('artwork_ownership').select('artwork_id,purchase_price_usdt').eq('owner_id', user.id),
        supabase.from('artwork_interactions').select('artwork_id,liked,loved,saved,watched').eq('user_id', user.id),
        supabase.from('artworks').select('*,profiles:creator_id(id,handle,display_name,bio,avatar_url)').eq('published', true).order('created_at', { ascending: false }).limit(100),
        supabase.from('external_wallets').select('*').eq('user_id', user.id).order('connected_at', { ascending: false }),
        supabase.from('p2p_offers').select('*,merchant:merchant_id(id,handle,display_name,avatar_url),artwork:artwork_id(id,title,media_url)').eq('is_active', true).order('created_at', { ascending: false }).limit(100),
        supabase.from('p2p_orders').select('*,offer:offer_id(*,merchant:merchant_id(id,handle,display_name,avatar_url),artwork:artwork_id(id,title,media_url))').or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      if (cancelled) return;

      if (profileRes.data) {
        const p = profileRes.data as any;
        setUserProfile(prev => ({
          ...prev,
          name: p.display_name || prev.name,
          telegramHandle: p.handle || prev.telegramHandle,
          avatar: p.avatar_url || '',
          coverImage: p.cover_url || '',
          bio: p.bio || '',
          vaultId: p.vault_id || prev.vaultId,
          joinedDate: p.created_at ? new Date(p.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : prev.joinedDate,
          defaultCurrency: p.default_currency || 'USD',
          notificationsEnabled: p.notifications_enabled !== false,
          telegramBotAlerts: p.telegram_bot_alerts !== false,
          twoFactorEnabled: Boolean(p.two_factor_enabled),
          biometricAuth: Boolean(p.biometric_auth),
        }));
      }
      if (walletRes.data) setWalletBalance(Number((walletRes.data as any).balance_usdt || 0));
      if (ledgerRes.data) setTransactions((ledgerRes.data as any[]).map(mapLedgerToTransaction));
      setConnectedWallets(((extWalletsRes.data || []) as any[]).map(w => ({
        id: w.id,
        name: w.provider,
        network: w.network,
        address: w.address,
        connectedAt: new Date(w.connected_at).toLocaleDateString(),
        balance: 0,
      })));
      if (p2pOffersRes.data) setP2pOffers((p2pOffersRes.data as any[]).map(backendP2POfferToUi));
      if (activeOrderRes.data) setActiveP2POrder(backendP2POrderToUi(activeOrderRes.data));
      else setActiveP2POrder(null);

      const owned = new Map<string, number>();
      for (const row of (ownedRes.data || []) as any[]) owned.set(row.artwork_id, Number(row.purchase_price_usdt || 0));
      const interactions = new Map<string, any>();
      for (const row of (interactionsRes.data || []) as any[]) interactions.set(row.artwork_id, row);

      if (artworkRes.data) {
        const mapped = (artworkRes.data as any[]).map(row => backendArtworkToUi(row, owned.has(row.id), owned.get(row.id), interactions.get(row.id)));
        setArtworks(prev => {
          const byId = new Map(prev.map(a => [a.id, a]));
          for (const art of mapped) byId.set(art.id, { ...(byId.get(art.id) || {}), ...art });
          return Array.from(byId.values());
        });
      }
    };
    void loadBackendState();
    return () => { cancelled = true; };
  }, [user]);

  const updateUserProfile = async (updates: Partial<UserProfile>): Promise<boolean> => {
    if (user) {
      const patch: Record<string, unknown> = {};
      if (updates.name !== undefined) patch.display_name = updates.name.trim();
      if (updates.telegramHandle !== undefined) patch.handle = updates.telegramHandle.trim();
      if (updates.bio !== undefined) patch.bio = updates.bio.trim();
      if (updates.avatar !== undefined) patch.avatar_url = updates.avatar;
      if (updates.coverImage !== undefined) patch.cover_url = updates.coverImage;
      if (updates.defaultCurrency !== undefined) patch.default_currency = updates.defaultCurrency;
      if (updates.notificationsEnabled !== undefined) patch.notifications_enabled = updates.notificationsEnabled;
      if (updates.telegramBotAlerts !== undefined) patch.telegram_bot_alerts = updates.telegramBotAlerts;
      if (updates.twoFactorEnabled !== undefined) patch.two_factor_enabled = updates.twoFactorEnabled;
      if (updates.biometricAuth !== undefined) patch.biometric_auth = updates.biometricAuth;

      const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
      if (error) {
        addNotification('Profile Update Failed', error.message.includes('duplicate') ? 'That AURA handle is already taken.' : error.message, 'community');
        return false;
      }
    }

    setUserProfile((prev) => ({ ...prev, ...updates }));
    addNotification('Settings Updated', 'Your profile and preferences were saved.', 'community');
    return true;
  };

  const addNotification = (title: string, message: string, type: TelegramNotification['type']) => {
    const id = Date.now().toString();
    const newNotif: TelegramNotification = {
      id,
      title,
      message,
      timestamp: 'Just now',
      type,
    };
    setNotifications((prev) => [newNotif, ...prev.slice(0, 4)]);

    setTimeout(() => {
      dismissNotification(id);
    }, 6000);
  };

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const startBotAndOpenApp = (options?: {
    destinationTab?: 'home' | 'discover' | 'create' | 'wallet' | 'profile';
    customNotification?: string;
  }) => {
    if (options?.destinationTab) {
      setActiveTab(options.destinationTab);
    }
    setTelegramViewMode('miniapp');
    addNotification(
      '🎉 AURA Mini App Activated',
      options?.customNotification ||
        'Welcome! Your Telegram Web3 Vault is active with $2,450.00 USDT test balance. Certified P2P exchange and digital art ready.',
      'community'
    );
  };

  const toggleLike = (artworkId: string) => {
    if (!user) { openAuth('signin'); return; }
    const artwork = artworks.find((art) => art.id === artworkId);
    if (!artwork) return;
    const nextLiked = !artwork.isLiked;
    setArtworks((prev) => prev.map((art) => art.id === artworkId ? {
      ...art, isLiked: nextLiked, likes: Math.max(0, nextLiked ? art.likes + 1 : art.likes - 1),
      eligibleInteractions: nextLiked ? art.eligibleInteractions + 1 : art.eligibleInteractions,
    } : art));
    if (isBackendArtworkId(artworkId)) void supabase.rpc('toggle_artwork_interaction', { p_artwork_id: artworkId, p_kind: 'liked' });
    addNotification(nextLiked ? '❤️ Added to Favorites' : '↩️ Like Removed',
      nextLiked ? `You liked "${artwork.title}".` : `Your like for "${artwork.title}" was removed.`, 'value_surge');
  };

  const toggleLove = (artworkId: string) => {
    if (!user) { openAuth('signin'); return; }
    const artwork = artworks.find((art) => art.id === artworkId);
    if (!artwork) return;
    const nextLoved = !artwork.isLoved;
    setArtworks((prev) => prev.map((art) => art.id === artworkId ? {
      ...art, isLoved: nextLoved, loves: Math.max(0, nextLoved ? art.loves + 1 : art.loves - 1),
      eligibleInteractions: nextLoved ? art.eligibleInteractions + 2 : art.eligibleInteractions,
    } : art));
    if (isBackendArtworkId(artworkId)) void supabase.rpc('toggle_artwork_interaction', { p_artwork_id: artworkId, p_kind: 'loved' });
    addNotification(nextLoved ? '💛 Added to Love List' : '↩️ Love Removed',
      nextLoved ? `"${artwork.title}" is now in your Love List.` : `"${artwork.title}" was removed from your Love List.`, 'value_surge');
  };

  const toggleSave = (artworkId: string) => {
    if (!user) { openAuth('signin'); return; }
    const artwork = artworks.find((art) => art.id === artworkId);
    if (!artwork) return;
    const nextSaved = !artwork.isSaved;
    setArtworks((prev) => prev.map((art) => art.id === artworkId ? {
      ...art, isSaved: nextSaved, saves: Math.max(0, nextSaved ? art.saves + 1 : art.saves - 1),
      eligibleInteractions: nextSaved ? art.eligibleInteractions + 1 : art.eligibleInteractions,
    } : art));
    if (isBackendArtworkId(artworkId)) void supabase.rpc('toggle_artwork_interaction', { p_artwork_id: artworkId, p_kind: 'saved' });
    addNotification(nextSaved ? '🔖 Saved to Your Vault' : '↩️ Removed from Saved',
      nextSaved ? `"${artwork.title}" was saved for later.` : `"${artwork.title}" was removed from your saved works.`, 'community');
  };

  const toggleWatchlist = (artworkId: string) => {
    if (!user) { openAuth('signin'); return; }
    const artwork = artworks.find((art) => art.id === artworkId);
    if (!artwork) return;
    const isWatched = !artwork.isWatched;
    setArtworks(prev => prev.map(a => a.id === artworkId ? { ...a, isWatched } : a));
    if (isBackendArtworkId(artworkId)) void supabase.rpc('toggle_artwork_interaction', { p_artwork_id: artworkId, p_kind: 'watched' });
    addNotification(isWatched ? '⭐ Added to Watchlist' : 'Removed from Watchlist',
      `"${artwork.title}" is ${isWatched ? 'now tracked in your Watchlist' : 'removed'}.`, 'community');
  };

  const toggleCollectionWatchlist = (collectionId: string) => {
    setCollections((prev) =>
      prev.map((col) => {
        if (col.id === collectionId) {
          const isWatched = !col.isWatched;
          addNotification(
            isWatched ? '⭐ Collection Watchlisted' : 'Collection Removed',
            `${col.name} floor price alerts are ${isWatched ? 'enabled' : 'disabled'}.`,
            'community'
          );
          return { ...col, isWatched };
        }
        return col;
      })
    );
  };

  const toggleDropReminder = (dropId: string) => {
    setUpcomingDrops((prev) =>
      prev.map((drop) => {
        if (drop.id === dropId) {
          const isReminded = !drop.isReminded;
          addNotification(
            isReminded ? '🔔 Drop Reminder Set' : 'Drop Reminder Cancelled',
            `We will notify you on Telegram 15 minutes before "${drop.title}" mints!`,
            'drop_alert'
          );
          return { ...drop, isReminded };
        }
        return drop;
      })
    );
  };

  const addComment = (artworkId: string, text: string) => {
    if (!user) { openAuth('signin'); return; }
    if (!text.trim()) return;
    setArtworks(prev => prev.map(art => art.id === artworkId ? {
      ...art,
      comments: [{
        id: `cmt-${Date.now()}`,
        userName: userProfile.name,
        userAvatar: userProfile.avatar,
        text: text.trim(),
        timestamp: 'Just now',
      }, ...art.comments],
      eligibleInteractions: art.eligibleInteractions + 3,
    } : art));
    if (isBackendArtworkId(artworkId)) {
      void supabase.rpc('add_artwork_comment', { p_artwork_id: artworkId, p_text: text.trim() });
    }
    const artwork = artworks.find((art) => art.id === artworkId);
    if (artwork) addNotification('💬 Comment Posted', `Your comment was added to "${artwork.title}".`, 'community');
  };

  const collectArtwork = (artwork: Artwork): boolean => {
    if (!user) { openAuth('signin'); return false; }
    if (!isBackendArtworkId(artwork.id)) {
      addNotification('Live Listing Required', 'This catalog item is a preview. Live collecting is available for verified AURA listings.', 'community');
      return false;
    }
    void (async () => {
      const { error } = await supabase.rpc('collect_artwork', { p_artwork_id: artwork.id });
      if (error) {
        addNotification('Collect Failed', error.message.includes('INSUFFICIENT_FUNDS') ? 'Your AURA wallet needs more USDT.' : 'This artwork could not be collected right now.', 'community');
        return;
      }
      setArtworks(prev => prev.map(a => a.id === artwork.id ? { ...a, isOwned: true, purchasePrice: artwork.currentValue, collectorsCount: a.collectorsCount + 1 } : a));
      const wallet = await supabase.from('wallet_accounts').select('balance_usdt').eq('user_id', user.id).maybeSingle();
      if (wallet.data) setWalletBalance(Number((wallet.data as any).balance_usdt || 0));
      setTransactions(prev => [{
        id: `tx-${Date.now()}`,
        type: 'collect',
        artworkTitle: artwork.title,
        amount: artwork.currentValue,
        currency: 'USDT',
        date: 'Just now',
        recipientOrSender: artwork.creator.handle,
        status: 'confirmed',
      }, ...prev]);
      addNotification('🎨 Masterpiece Collected', `You acquired "${artwork.title}" for $${artwork.currentValue.toFixed(2)} USDT.`, 'collect');
    })();
    return true;
  };

  // Quick Buy (like in the photo!)
  const quickBuyArtwork = (artwork: Artwork): boolean => {
    return collectArtwork(artwork);
  };

  const makeOfferOnArtwork = (artworkId: string, offerAmount: number) => {
    setArtworks((prev) =>
      prev.map((art) => {
        if (art.id === artworkId) {
          return {
            ...art,
            topOfferUSDT: offerAmount,
          };
        }
        return art;
      })
    );

    addNotification(
      '🤝 Offer Submitted',
      `Your offer of $${offerAmount} USDT on "${artworks.find((a) => a.id === artworkId)?.title}" was relayed to the owner.`,
      'p2p'
    );
  };

  const convertArtwork = (artwork: Artwork, fee: number) => {
    if (!user) { openAuth('signin'); return { success: false, netPayout: 0 }; }
    if (!isBackendArtworkId(artwork.id) || !artwork.isOwned) {
      addNotification('Not Available', 'Only verified AURA-owned listings can be converted to wallet USDT.', 'community');
      return { success: false, netPayout: 0 };
    }
    void (async () => {
      const { data, error } = await supabase.rpc('convert_owned_artwork', { p_artwork_id: artwork.id, p_fee_usdt: fee });
      if (error) {
        addNotification('Conversion Failed', error.message, 'community');
        return;
      }
      const payout = Number((data as any)?.payout_usdt || 0);
      setWalletBalance(prev => prev + payout);
      setArtworks(prev => prev.map(a => a.id === artwork.id ? { ...a, isOwned: false, purchasePrice: undefined, isListedOnP2P: false } : a));
      setTransactions(prev => [{ id: `tx-${Date.now()}`, type: 'convert', artworkTitle: artwork.title, amount: payout, currency: 'USDT', date: 'Just now', recipientOrSender: 'AURA Liquidity', status: 'confirmed' }, ...prev]);
      addNotification('💸 Converted to AURA Wallet', `$${payout.toFixed(2)} USDT credited after the $${fee.toFixed(2)} service fee.`, 'convert');
    })();
    return { success: true, netPayout: Math.max(0, artwork.currentValue - fee) };
  };

  // Artwork-to-Fiat P2P listing. The backend keeps ownership authoritative
  // and the order flow transfers artwork ownership only after the seller releases it.
  const listArtworkOnP2P = async ({
    artworkId,
    fiatPrice,
    currency,
    paymentMethods,
    paymentInstructions,
  }: {
    artworkId: string;
    fiatPrice: number;
    currency: 'USD' | 'EUR' | 'GBP';
    paymentMethods: PaymentMethodType[];
    paymentInstructions?: string;
  }) => {
    if (!user) { openAuth('signin'); return; }

    const art = artworks.find((a) => a.id === artworkId);
    if (!art) return;

    if (!isBackendArtworkId(artworkId) || !art.isOwned) {
      addNotification(
        'Artwork Must Be Owned',
        'Only an artwork already owned in your AURA account can be listed for P2P sale.',
        'p2p'
      );
      return;
    }

    const { data, error } = await supabase.rpc('create_p2p_offer', {
      p_type: 'sell',
      p_price_per_unit: fiatPrice,
      p_fiat_currency: currency,
      p_available_crypto: 1,
      p_min_limit_fiat: fiatPrice,
      p_max_limit_fiat: fiatPrice,
      p_payment_methods: paymentMethods || [],
      p_payment_instructions: paymentInstructions?.trim() || 'Use the selected payment method and the order reference shown after matching. AURA transfers artwork ownership only after the seller confirms receipt.',
      p_artwork_id: artworkId,
    });

    if (error || !data) {
      addNotification(
        'Artwork Listing Failed',
        error?.message || 'Could not publish this artwork listing.',
        'p2p'
      );
      return;
    }

    const localOffer: P2POffer = backendP2POfferToUi({
      ...(data as any),
      merchant: {
        id: user.id,
        handle: userProfile.telegramHandle,
        display_name: userProfile.name,
        avatar_url: userProfile.avatar,
      },
      artwork: {
        id: artworkId,
        title: art.title,
        media_url: art.customMediaUrl || '',
      },
    });

    setP2pOffers(prev => [localOffer, ...prev.filter(o => o.id !== localOffer.id)]);
    setArtworks(prev => prev.map(a => a.id === artworkId ? {
      ...a,
      isListedOnP2P: true,
      p2pPriceFiat: fiatPrice,
      p2pCurrency: currency,
      p2pPaymentMethods: paymentMethods,
    } : a));

    addNotification(
      '🏷️ Artwork Listed on P2P',
      `"${art.title}" is now available for direct fiat purchase on the AURA P2P Desk.`,
      'p2p'
    );
  };

  const uploadArtworkFile = async (file: File): Promise<string | null> => {
    if (!user) {
      openAuth('signin');
      return null;
    }
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      addNotification('Unsupported File', 'Please choose an image or video asset.', 'community');
      return null;
    }
    const maxBytes = 50 * 1024 * 1024;
    if (file.size > maxBytes) {
      addNotification('File Too Large', 'Artwork uploads are limited to 50 MB.', 'community');
      return null;
    }

    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const safeName = file.name
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'artwork';
    const path = `${user.id}/${crypto.randomUUID()}-${safeName || `asset.${extension}`}`;
    const { error } = await supabase.storage.from('aura-artworks').upload(path, file, {
      cacheControl: '31536000',
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) {
      addNotification('Upload Failed', error.message, 'community');
      return null;
    }
    const { data } = supabase.storage.from('aura-artworks').getPublicUrl(path);
    return data.publicUrl;
  };

  const createArtwork = async (newArt: {
    title: string;
    description: string;
    price: number;
    visualTheme: Artwork['visualTheme'];
    category: ArtworkCategory;
    mediaType?: MediaType;
    customMediaUrl?: string;
    collectionName?: string;
    traits?: NFTTrait[];
    listOnP2P?: boolean;
    p2pPriceFiat?: number;
    p2pPaymentMethods?: PaymentMethodType[];
  }) => {
    if (!user) {
      openAuth('signin');
      return;
    }

    const { data, error } = await supabase.rpc('create_my_artwork', {
      p_title: newArt.title.trim(),
      p_description: newArt.description.trim(),
      p_price_usdt: newArt.price,
      p_visual_theme: newArt.visualTheme,
      p_category: newArt.category,
      p_media_type: newArt.mediaType || 'image',
      p_media_url: newArt.customMediaUrl || null,
      p_collection_name: newArt.collectionName?.trim() || null,
      p_traits: newArt.traits || [],
      p_list_on_p2p: false,
      p_p2p_price_fiat: null,
      p_p2p_currency: 'USD',
      p_p2p_payment_methods: [],
    });

    if (error || !data) {
      addNotification('Mint Failed', error?.message || 'Could not create the artwork.', 'community');
      return;
    }

    const createdRow: any = data;
    const created = backendArtworkToUi(createdRow, true, newArt.price, {
      profile: userProfile,
    });
    setArtworks(prev => [created, ...prev.filter(a => a.id !== created.id)]);

    if (newArt.listOnP2P && newArt.p2pPriceFiat) {
      const { error: offerError } = await supabase.rpc('create_p2p_offer', {
        p_type: 'sell',
        p_price_per_unit: newArt.p2pPriceFiat,
        p_fiat_currency: 'USD',
        p_available_crypto: 1,
        p_min_limit_fiat: newArt.p2pPriceFiat,
        p_max_limit_fiat: newArt.p2pPriceFiat,
        p_payment_methods: newArt.p2pPaymentMethods || [],
        p_payment_instructions: newArt.p2pPaymentInstructions?.trim() || 'Use the selected payment method and the order reference shown after matching. AURA transfers artwork ownership only after the seller confirms receipt.',
        p_artwork_id: created.id,
      });

      if (offerError) {
        addNotification('Artwork Minted', 'The artwork is live, but the P2P listing could not be created yet.', 'p2p');
      } else {
        setArtworks(prev => prev.map(a => a.id === created.id ? {
          ...a,
          isListedOnP2P: true,
          p2pPriceFiat: newArt.p2pPriceFiat,
          p2pCurrency: 'USD',
          p2pPaymentMethods: newArt.p2pPaymentMethods || [],
        } : a));
      }
    }

    addNotification(
      '✨ Artwork Published',
      `"${newArt.title}" is now in your AURA collection.`,
      'community'
    );
    setTransactions(prev => [{
      id: `local-${Date.now()}`,
      type: 'create',
      artworkTitle: newArt.title,
      amount: newArt.price,
      currency: 'ART',
      date: 'Just now',
      recipientOrSender: 'AURA Creator Vault',
      status: 'confirmed',
    }, ...prev]);
    setActiveTab('home');
  };

  const topUpBalance = (_amount: number) => {
    addNotification('Wallet Funding', 'AURA does not create money. Use Receive for a supported on-chain deposit or a verified P2P purchase.', 'community');
    return;
  };

  const sendInternalFunds = (recipient: string, amount: number): boolean => {
    if (!user) { openAuth('signin'); return false; }
    if (walletBalance < amount) {
      addNotification('Transfer Error', 'Insufficient AURA wallet balance.', 'community');
      return false;
    }
    void (async () => {
      const { error } = await supabase.rpc('internal_transfer', { p_recipient: recipient.trim(), p_amount_usdt: amount });
      if (error) {
        addNotification('Transfer Failed', error.message.includes('RECIPIENT_NOT_FOUND') ? 'Recipient not found. Use an @handle or AURA Vault ID.' : error.message, 'community');
        return;
      }
      setWalletBalance(prev => prev - amount);
      setTransactions(prev => [{ id: `tx-${Date.now()}`, type: 'send', amount, currency: 'USDT', date: 'Just now', recipientOrSender: recipient, status: 'confirmed' }, ...prev]);
      addNotification('Sent Successfully', `Transferred $${amount.toFixed(2)} USDT to ${recipient}.`, 'convert');
    })();
    return true;
  };

  const sendExternalCrypto = ({
    network,
    destinationAddress,
    amount,
    gasFee: _gasFee,
  }: {
    network: CryptoNetwork;
    destinationAddress: string;
    amount: number;
    gasFee: number;
  }): { success: boolean; txHash: string } => {
    if (!user) { openAuth('signin'); return { success: false, txHash: '' }; }
    addNotification('External Send Not Connected', `AURA will not fake a blockchain broadcast. Connect a real ${network.toUpperCase()} wallet/provider before sending on-chain.`, 'external_tx');
    return { success: false, txHash: '' };
  };

  const simulateInboundDeposit = (_network: CryptoNetwork, _amount: number) => {
    addNotification('Deposit Waiting', 'AURA does not simulate real deposits. A supported on-chain wallet/provider will credit the account after confirmation.', 'external_tx');
  };

  const connectExternalWallet = (name: ConnectedExternalWallet['name'], network: CryptoNetwork) => {
    if (!user) { openAuth('signin'); return; }

    void (async () => {
      let address = '';
      const win = window as any;
      try {
        if (name === 'MetaMask' && win.ethereum?.request) {
          const accounts = await win.ethereum.request({ method: 'eth_requestAccounts' });
          address = accounts?.[0] || '';
        } else if (name === 'Phantom' && win.solana?.connect) {
          const result = await win.solana.connect();
          address = result?.publicKey?.toString?.() || '';
        } else {
          addNotification('Wallet Provider Needed', `${name} connection needs its wallet provider extension/app bridge. AURA will never fabricate an address.`, 'community');
          return;
        }
      } catch (e: any) {
        addNotification('Wallet Connection Cancelled', e?.message || 'The wallet connection was cancelled.', 'community');
        return;
      }

      if (!address) {
        addNotification('Wallet Address Missing', 'The connected provider did not return an address.', 'community');
        return;
      }

      const { data, error } = await supabase.from('external_wallets').upsert(
        { user_id: user.id, provider: name, network, address },
        { onConflict: 'user_id,provider,address' }
      ).select().maybeSingle();

      if (error) {
        addNotification('Wallet Save Failed', error.message, 'community');
        return;
      }

      const walletRow = data as any;
      const connected: ConnectedExternalWallet = {
        id: walletRow?.id || `wallet-${Date.now()}`,
        name,
        network,
        address,
        connectedAt: new Date().toLocaleDateString(),
        balance: 0,
      };
      setConnectedWallets(prev => [connected, ...prev.filter(w => w.address !== address)]);
      addNotification('🔗 External Wallet Connected', `${name} is linked to AURA. Balance data will appear when a provider indexer is connected.`, 'community');
    })();
  };

  const disconnectExternalWallet = (id: string) => {
    if (user) void supabase.from('external_wallets').delete().eq('id', id).eq('user_id', user.id);
    setConnectedWallets(prev => prev.filter(w => w.id !== id));
    addNotification('Wallet Disconnected', 'External wallet session closed.', 'community');
  };

  const startP2POrder = async ({
    offer,
    cryptoAmount,
    paymentMethod,
    paymentDetails,
  }: {
    offer: P2POffer;
    cryptoAmount: number;
    paymentMethod: PaymentMethodType;
    paymentDetails?: {
      accountName?: string;
      accountNumberOrId?: string;
    };
  }): Promise<P2POrder | null> => {
    if (!user) {
      openAuth('signin');
      return null;
    }
    const { data, error } = await supabase.rpc('create_p2p_order', {
      p_offer_id: offer.id,
      p_crypto_amount: cryptoAmount,
      p_payment_method: paymentMethod,
      p_payment_details: paymentDetails || {},
    });
    if (error || !data) {
      addNotification('P2P Order Failed', error?.message || 'Could not create this trade.', 'p2p');
      return null;
    }
    const orderRow = data as any;
    const enriched = {
      ...orderRow,
      offer: {
        ...offer,
        merchant: { id: offer.merchant.id, handle: offer.merchant.telegramHandle, display_name: offer.merchant.name, avatar_url: offer.merchant.avatar },
        artwork: offer.artworkId ? { id: offer.artworkId, title: offer.artworkTitle, media_url: offer.artworkImage } : null,
      },
    };
    const uiOrder = backendP2POrderToUi(enriched);
    setActiveP2POrder(uiOrder);
    addNotification('🔒 AURA Trade Hold Created', `${cryptoAmount} USDT is reserved until the trade completes or is cancelled.`, 'p2p');
    return uiOrder;
  };

  const markP2PPaymentSent = async (orderId: string) => {
    if (!user) { openAuth('signin'); return; }
    const { data, error } = await supabase.rpc('mark_p2p_payment', { p_order_id: orderId });
    if (error || !data) {
      addNotification('P2P Update Failed', error?.message || 'Could not update the trade.', 'p2p');
      return;
    }
    const row = data as any;
    const current = activeP2POrder;
    setActiveP2POrder(current ? { ...current, status: 'payment_marked' } : backendP2POrderToUi(row));
    addNotification('⏳ Payment Status Recorded', 'The counterparty can now review the payment and release the held USDT.', 'p2p');
  };

  const completeP2POrder = async (orderId: string) => {
    if (!user) { openAuth('signin'); return; }
    const { data, error } = await supabase.rpc('complete_p2p_order', { p_order_id: orderId });
    if (error || !data) {
      addNotification('P2P Release Failed', error?.message === 'ONLY_SELLER_CAN_RELEASE' ? 'Only the seller can release the held USDT after payment is confirmed.' : (error?.message || 'Could not release this trade.'), 'p2p');
      return;
    }
    const row = data as any;
    setActiveP2POrder(null);
    const wallet = await supabase.from('wallet_accounts').select('balance_usdt').eq('user_id', user.id).maybeSingle();
    if (wallet.data) setWalletBalance(Number((wallet.data as any).balance_usdt || 0));
    const ledger = await supabase.from('wallet_ledger').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    if (ledger.data) setTransactions((ledger.data as any[]).map(mapLedgerToTransaction));
    addNotification('✅ P2P Trade Completed', `${row.crypto_amount} USDT was released to the buyer.`, 'p2p');
  };

  const cancelP2POrder = async (orderId: string) => {
    if (!user) { openAuth('signin'); return; }
    const { data, error } = await supabase.rpc('cancel_p2p_order', { p_order_id: orderId });
    if (error || !data) {
      addNotification('P2P Cancel Failed', error?.message || 'Could not cancel this order.', 'p2p');
      return;
    }
    setActiveP2POrder(null);
    const wallet = await supabase.from('wallet_accounts').select('balance_usdt').eq('user_id', user.id).maybeSingle();
    if (wallet.data) setWalletBalance(Number((wallet.data as any).balance_usdt || 0));
    addNotification('P2P Order Cancelled', 'Held USDT was returned to the seller balance.', 'p2p');
  };

  const raiseP2PDispute = async (orderId: string) => {
    if (!user) { openAuth('signin'); return; }
    const { data, error } = await supabase.rpc('raise_p2p_dispute', { p_order_id: orderId });
    if (error || !data) {
      addNotification('Dispute Could Not Open', error?.message || 'Could not open a dispute for this order.', 'p2p');
      return;
    }
    setActiveP2POrder((current) => current ? { ...current, status: 'in_dispute', protectionFundActive: false } : null);
    addNotification('⚠️ P2P Dispute Opened', 'The trade is locked in dispute. Keep all payment evidence inside the trade record.', 'p2p');
  };

  const createP2POffer = async (offerData: Omit<P2POffer, 'id' | 'merchant' | 'isSmartEscrowLocked'>) => {
    if (!user) { openAuth('signin'); return; }
    const { data, error } = await supabase.rpc('create_p2p_offer', {
      p_type: offerData.type,
      p_price_per_unit: offerData.pricePerUnit,
      p_fiat_currency: offerData.fiatCurrency,
      p_available_crypto: offerData.availableCrypto,
      p_min_limit_fiat: offerData.minLimitFiat,
      p_max_limit_fiat: offerData.maxLimitFiat,
      p_payment_methods: offerData.paymentMethods || [],
      p_payment_instructions: offerData.paymentInstructions || null,
      p_artwork_id: offerData.artworkId || null,
    });
    if (error || !data) {
      addNotification('P2P Ad Failed', error?.message || 'Could not publish the offer.', 'p2p');
      return;
    }
    const localOffer: P2POffer = {
      ...backendP2POfferToUi({
        ...data,
        merchant: { id: user.id, handle: userProfile.telegramHandle, display_name: userProfile.name, avatar_url: userProfile.avatar },
        artwork: null,
      }),
    };
    setP2pOffers(prev => [localOffer, ...prev]);
    addNotification('📣 P2P Offer Published', 'Your live offer was saved to the AURA order book.', 'p2p');
  };

  return (
    <AppContext.Provider
      value={{
        artworks,
        collections,
        upcomingDrops,
        activeTab,
        setActiveTab,
        feedFilter,
        setFeedFilter,
        selectedArtwork,
        setSelectedArtwork,
        selectedCollection,
        setSelectedCollection,
        makeOfferArtwork,
        setMakeOfferArtwork,
        sellArtworkP2PModal,
        setSellArtworkP2PModal,
        userProfile,
        updateUserProfile,
        vaultAddresses,
        connectedWallets,
        connectExternalWallet,
        disconnectExternalWallet,
        walletBalance,
        transactions,
        notifications,
        dismissNotification,
        addNotification,
        toggleLike,
        toggleLove,
        toggleSave,
        toggleWatchlist,
        toggleCollectionWatchlist,
        toggleDropReminder,
        addComment,
        collectArtwork,
        quickBuyArtwork,
        makeOfferOnArtwork,
        convertArtwork,
        listArtworkOnP2P,
        uploadArtworkFile,
        createArtwork,
        isTelegramShellMode,
        setIsTelegramShellMode,
        collectModalArtwork,
        setCollectModalArtwork,
        convertModalArtwork,
        setConvertModalArtwork,
        communityDrawerArtwork,
        setCommunityDrawerArtwork,
        sendModalOpen,
        setSendModalOpen,
        receiveModalOpen,
        setReceiveModalOpen,
        buyModalOpen,
        setBuyModalOpen,
        settingsModalOpen,
        setSettingsModalOpen,
        seedPhraseModalOpen,
        setSeedPhraseModalOpen,
        p2pModalOpen,
        setP2pModalOpen,
        topUpBalance,
        sendInternalFunds,
        sendExternalCrypto,
        simulateInboundDeposit,
        p2pOffers,
        activeP2POrder,
        setActiveP2POrder,
        startP2POrder,
        markP2PPaymentSent,
        completeP2POrder,
        cancelP2POrder,
        raiseP2PDispute,
        createP2POffer,
        telegramViewMode,
        setTelegramViewMode,
        startBotAndOpenApp,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
