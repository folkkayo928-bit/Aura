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
  disconnectExternalWallet: (id: string) => Promise<boolean>;
  walletBalance: number; // USDT
  transactions: Transaction[];
  notifications: TelegramNotification[];
  dismissNotification: (id: string) => void;
  addNotification: (title: string, message: string, type: TelegramNotification['type']) => void;
  toggleLike: (artworkId: string) => void;
  toggleDislike: (artworkId: string) => void;
  toggleLove: (artworkId: string) => void;
  toggleSave: (artworkId: string) => void;
  toggleWatchlist: (artworkId: string) => void;
  toggleCollectionWatchlist: (collectionId: string) => void;
  toggleDropReminder: (dropId: string) => void;
  addComment: (artworkId: string, text: string) => void;
  collectArtwork: (artwork: Artwork) => Promise<boolean>;
  quickBuyArtwork: (artwork: Artwork) => Promise<boolean>;
  makeOfferOnArtwork: (artworkId: string, offerAmount: number) => Promise<boolean>;
  convertArtwork: (artwork: Artwork, fee: number) => Promise<{ success: boolean; netPayout: number }>;
  listArtworkOnP2P: (params: {
    artworkId: string;
    fiatPrice: number;
    currency: 'USD' | 'EUR' | 'GBP';
    paymentMethods: PaymentMethodType[];
    paymentInstructions?: string;
  }) => Promise<boolean>;
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
  sendInternalFunds: (recipient: string, amount: number) => Promise<boolean>;
  sendExternalCrypto: (params: {
    network: CryptoNetwork;
    destinationAddress: string;
    amount: number;
    gasFee: number;
  }) => { success: boolean; txHash: string };
  simulateInboundDeposit: (network: CryptoNetwork, amount: number) => void;
  requestWalletWithdrawal: (params: {
    chain: CryptoNetwork;
    destinationAddress: string;
    amount: number;
    networkFee?: number;
  }) => Promise<{ success: boolean; withdrawal?: any; error?: string }>;
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
  markP2PPaymentSent: (orderId: string) => Promise<boolean>;
  completeP2POrder: (orderId: string) => Promise<boolean>;
  cancelP2POrder: (orderId: string) => Promise<boolean>;
  raiseP2PDispute: (orderId: string) => Promise<boolean>;
  createP2POffer: (offerData: Omit<P2POffer, 'id' | 'merchant' | 'isSmartEscrowLocked'>) => Promise<boolean>;
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
  dislikes: typeof art.dislikes === 'number' ? art.dislikes : 0,
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
  availableCrypto: typeof offer.availableCrypto === 'number' ? offer.availableCrypto : 0,
  minLimitFiat: typeof offer.minLimitFiat === 'number' ? offer.minLimitFiat : 0,
  maxLimitFiat: typeof offer.maxLimitFiat === 'number' ? offer.maxLimitFiat : 0,
  pricePerUnit: typeof offer.pricePerUnit === 'number' ? offer.pricePerUnit : 0,
  merchant: {
    ...offer.merchant,
    name: offer.merchant?.name || 'AURA Merchant',
    legalName: offer.merchant?.legalName || offer.merchant?.name || 'AURA Merchant',
    depositBondUSDT: typeof offer.merchant?.depositBondUSDT === 'number' ? offer.merchant.depositBondUSDT : 0,
    ordersCompleted: typeof offer.merchant?.ordersCompleted === 'number' ? offer.merchant.ordersCompleted : 0,
    completionRate: typeof offer.merchant?.completionRate === 'number' ? offer.merchant.completionRate : 0,
    avgReleaseTimeMinutes: typeof offer.merchant?.avgReleaseTimeMinutes === 'number' ? offer.merchant.avgReleaseTimeMinutes : 0,
    verifiedMerchant: offer.merchant?.verifiedMerchant === true,
    kycVerified: offer.merchant?.kycVerified === true,
    positiveFeedbackPercent: typeof offer.merchant?.positiveFeedbackPercent === 'number' ? offer.merchant.positiveFeedbackPercent : 0,
    telegramHandle: offer.merchant?.telegramHandle || '',
  },
  paymentMethods: Array.isArray(offer.paymentMethods) ? offer.paymentMethods : [],
  isSmartEscrowLocked: offer.isSmartEscrowLocked === true,
  isBuyerProtected: offer.isBuyerProtected === true,
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
  const rawStatus = String(row.status || row.transaction_status || '').toLowerCase();
  const status: Transaction['status'] =
    rawStatus === 'pending' || rawStatus === 'processing' ? 'pending' :
    rawStatus === 'failed' || rawStatus === 'rejected' || rawStatus === 'cancelled' ? 'failed' :
    'confirmed';
  return {
    id: row.id,
    type,
    amount,
    currency: 'USDT',
    date: new Date(row.created_at).toLocaleString(),
    recipientOrSender: row.memo || undefined,
    status,
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
    verified: false,
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
  valuationMode: row.valuation_mode === 'community' ? 'community' : 'market',
  dislikes: Number(row.dislikes || 0),
  communityValue: Number(row.community_value_usdt || row.current_value_usdt || 0),
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
  isDisliked: Boolean(interaction?.disliked),
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

const backendCollectionToUi = (row: any): NFTCollection => ({
  id: row.id,
  name: row.name || 'AURA Collection',
  slug: row.slug || row.id,
  avatar: row.avatar_url || row.creator?.avatar_url || '',
  banner: row.banner_url || '',
  verified: Boolean(row.verified),
  floorPriceUSDT: 0,
  totalVolumeUSDT: 0,
  ownersCount: 0,
  itemsCount: 0,
  description: row.description || '',
  category: row.category || 'generative',
  isWatched: false,
  websiteUrl: row.website_url || undefined,
  discordUrl: row.discord_url || undefined,
  telegramUrl: row.telegram_url || undefined,
});

const backendMerchantToUi = (row: any): P2PMerchant => ({
  id: row?.id || '',
  name: row?.display_name || 'AURA Member',
  legalName: row?.display_name || 'AURA Member',
  avatar: row?.avatar_url || '',
  ordersCompleted: Number(row?.p2p_stats?.completed_orders || 0),
  completionRate: Number(row?.p2p_stats?.completion_rate || 0),
  avgReleaseTimeMinutes: Number(row?.p2p_stats?.avg_release_minutes || 0),
  verifiedMerchant: Boolean(row?.p2p_stats?.verified_merchant),
  kycVerified: Boolean(row?.p2p_stats?.kyc_verified),
  depositBondUSDT: Number(row?.p2p_stats?.deposit_bond_usdt || 0),
  telegramHandle: row?.handle || '',
  positiveFeedbackPercent: Number(row?.p2p_stats?.positive_feedback_percent || 0),
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
  isSmartEscrowLocked: row.is_smart_escrow_locked === true,
  isBuyerProtected: row.is_buyer_protected === true,
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
      const [publicArtworkRes, publicCollectionRes, publicP2pRes] = await Promise.all([
        supabase
          .from('artworks')
          .select('*,profiles:creator_id(id,handle,display_name,bio,avatar_url)')
          .eq('published', true)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('collections')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('p2p_offers')
          .select('*,merchant:merchant_id(id,handle,display_name,avatar_url),artwork:artwork_id(id,title,media_url)')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      if (!user) {
        if (!publicArtworkRes.error) {
          setArtworks((publicArtworkRes.data || []).map(row => backendArtworkToUi(row)));
        }
        if (!publicCollectionRes.error) {
          setCollections((publicCollectionRes.data || []).map(row => backendCollectionToUi(row)));
        }
        if (!publicP2pRes.error) {
          setP2pOffers((publicP2pRes.data || []).map(row => backendP2POfferToUi(row)));
        }

        setWalletBalance(0);
        setTransactions([]);
        setConnectedWallets([]);
        setActiveP2POrder(null);
        return;
      }

      const [profileRes, walletRes, ledgerRes, ownedRes, interactionsRes, collectionWatchlistRes, artworkRes, extWalletsRes, p2pOffersRes, activeOrderRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('wallet_accounts').select('balance_usdt').eq('user_id', user.id).maybeSingle(),
        supabase.from('wallet_ledger').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('artwork_ownership').select('artwork_id,purchase_price_usdt').eq('owner_id', user.id),
        supabase.from('artwork_interactions').select('artwork_id,liked,disliked,loved,saved,watched').eq('user_id', user.id),
        supabase.from('collection_watchlist').select('collection_id').eq('user_id', user.id),
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

      const watchedCollectionIds = new Set(((collectionWatchlistRes.data || []) as any[]).map(row => row.collection_id));

      // For authenticated users, published backend content is authoritative.
      // Keep the existing local/demo data only as a fallback when the backend query fails.
      if (!publicCollectionRes.error) {
        setCollections((publicCollectionRes.data || []).map(row => ({
          ...backendCollectionToUi(row),
          isWatched: watchedCollectionIds.has(row.id),
        })));
      } else {
        setCollections(prev => prev.map(col => ({ ...col, isWatched: watchedCollectionIds.has(col.id) })));
      }

      if (!artworkRes.error) {
        const mapped = (artworkRes.data || []).map(row =>
          backendArtworkToUi(row, owned.has(row.id), owned.get(row.id), interactions.get(row.id))
        );
        setArtworks(mapped);
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
        'Welcome to your AURA workspace. Your profile, internal wallet, digital art collection, and P2P tools are ready.',
      'community'
    );
  };

  const persistArtworkInteraction = async (artworkId: string, kind: 'liked' | 'disliked' | 'loved' | 'saved' | 'watched') => {
    if (!isBackendArtworkId(artworkId)) return true;
    const { error } = await supabase.rpc('toggle_artwork_interaction', { p_artwork_id: artworkId, p_kind: kind });
    return !error;
  };

  const toggleLike = (artworkId: string) => {
    if (!user) { openAuth('signin'); return false; }
    const artwork = artworks.find((art) => art.id === artworkId);
    if (!artwork) return false;
    const nextLiked = !artwork.isLiked;
    const previous = artwork;
    setArtworks(prev => prev.map(art => art.id === artworkId ? {
      ...art, isLiked: nextLiked,
      likes: Math.max(0, nextLiked ? art.likes + 1 : art.likes - 1),
      eligibleInteractions: Math.max(0, nextLiked ? art.eligibleInteractions + 1 : art.eligibleInteractions - 1),
      isDisliked: nextLiked ? false : art.isDisliked,
      dislikes: nextLiked && art.isDisliked ? Math.max(0, Math.max(0, (art.dislikes ?? 0) - 1)) : art.dislikes ?? 0,
    } : art));
    void (async () => {
      if (!(await persistArtworkInteraction(artworkId, 'liked'))) {
        setArtworks(prev => prev.map(art => art.id === artworkId ? previous : art));
        addNotification('Like Failed', 'Your like could not be saved. Please try again.', 'community');
        return;
      }
      addNotification(nextLiked ? '❤️ Added to Favorites' : '↩️ Like Removed',
        nextLiked ? `You liked "${artwork.title}".` : `Your like for "${artwork.title}" was removed.`, 'value_surge');
    })();
    return true;
  };

  const toggleDislike = (artworkId: string) => {
    if (!user) { openAuth('signin'); return false; }
    const artwork = artworks.find((art) => art.id === artworkId);
    if (!artwork) return false;
    const nextDisliked = !artwork.isDisliked;
    const previous = artwork;
    setArtworks(prev => prev.map(art => art.id === artworkId ? {
      ...art, isDisliked: nextDisliked,
      dislikes: Math.max(0, nextDisliked ? (art.dislikes ?? 0) + 1 : (art.dislikes ?? 0) - 1),
      isLiked: nextDisliked ? false : art.isLiked,
      likes: nextDisliked && art.isLiked ? Math.max(0, art.likes - 1) : art.likes,
      eligibleInteractions: Math.max(0, nextDisliked ? art.eligibleInteractions : art.eligibleInteractions),
    } : art));
    void (async () => {
      if (!(await persistArtworkInteraction(artworkId, 'disliked'))) {
        setArtworks(prev => prev.map(art => art.id === artworkId ? previous : art));
        addNotification('Feedback Failed', 'Your feedback could not be saved. Please try again.', 'community');
        return;
      }
      addNotification(nextDisliked ? '👎 Feedback Recorded' : '↩️ Dislike Removed',
        nextDisliked ? `Your feedback on "${artwork.title}" was recorded.` : `Your negative feedback for "${artwork.title}" was removed.`, 'community');
    })();
    return true;
  };

  const toggleLove = (artworkId: string) => {
    if (!user) { openAuth('signin'); return false; }
    const artwork = artworks.find((art) => art.id === artworkId);
    if (!artwork) return false;
    const nextLoved = !artwork.isLoved;
    const previous = artwork;
    setArtworks(prev => prev.map(art => art.id === artworkId ? {
      ...art, isLoved: nextLoved, loves: Math.max(0, nextLoved ? art.loves + 1 : art.loves - 1),
      eligibleInteractions: Math.max(0, nextLoved ? art.eligibleInteractions + 2 : art.eligibleInteractions - 2),
    } : art));
    void (async () => {
      if (!(await persistArtworkInteraction(artworkId, 'loved'))) {
        setArtworks(prev => prev.map(art => art.id === artworkId ? previous : art));
        addNotification('Love Failed', 'Your love reaction could not be saved. Please try again.', 'community');
        return;
      }
      addNotification(nextLoved ? '💛 Added to Love List' : '↩️ Love Removed',
        nextLoved ? `"${artwork.title}" is now in your Love List.` : `"${artwork.title}" was removed from your Love List.`, 'value_surge');
    })();
    return true;
  };

  const toggleSave = (artworkId: string) => {
    if (!user) { openAuth('signin'); return false; }
    const artwork = artworks.find((art) => art.id === artworkId);
    if (!artwork) return false;
    const nextSaved = !artwork.isSaved;
    const previous = artwork;
    setArtworks(prev => prev.map(art => art.id === artworkId ? {
      ...art, isSaved: nextSaved, saves: Math.max(0, nextSaved ? art.saves + 1 : art.saves - 1),
      eligibleInteractions: Math.max(0, nextSaved ? art.eligibleInteractions + 1 : art.eligibleInteractions - 1),
    } : art));
    void (async () => {
      if (!(await persistArtworkInteraction(artworkId, 'saved'))) {
        setArtworks(prev => prev.map(art => art.id === artworkId ? previous : art));
        addNotification('Save Failed', 'Your saved state could not be saved. Please try again.', 'community');
        return;
      }
      addNotification(nextSaved ? '🔖 Saved to Your Vault' : '↩️ Removed from Saved',
        nextSaved ? `"${artwork.title}" was saved for later.` : `"${artwork.title}" was removed from your saved works.`, 'community');
    })();
    return true;
  };

  const toggleWatchlist = (artworkId: string) => {
    if (!user) { openAuth('signin'); return false; }
    const artwork = artworks.find((art) => art.id === artworkId);
    if (!artwork) return false;
    const nextWatched = !artwork.isWatched;
    const previous = artwork;
    setArtworks(prev => prev.map(a => a.id === artworkId ? { ...a, isWatched: nextWatched } : a));
    void (async () => {
      if (!(await persistArtworkInteraction(artworkId, 'watched'))) {
        setArtworks(prev => prev.map(a => a.id === artworkId ? previous : a));
        addNotification('Watchlist Update Failed', 'Your watchlist could not be updated. Please try again.', 'community');
        return;
      }
      addNotification(nextWatched ? '⭐ Added to Watchlist' : 'Removed from Watchlist',
        `"${artwork.title}" is ${nextWatched ? 'now tracked in your Watchlist' : 'removed'}.`, 'community');
    })();
  };
  const toggleCollectionWatchlist = (collectionId: string) => {
    if (!user) { openAuth('signin'); return false; }
    const collection = collections.find(col => col.id === collectionId);
    if (!collection) return;
    const nextWatched = !collection.isWatched;

    // Keep the UI responsive, but persist the watchlist in the existing backend table.
    setCollections(prev => prev.map(col => col.id === collectionId ? { ...col, isWatched: nextWatched } : col));

    void (async () => {
      const result = nextWatched
        ? await supabase.from('collection_watchlist').insert({ collection_id: collectionId, user_id: user.id })
        : await supabase.from('collection_watchlist').delete().eq('collection_id', collectionId).eq('user_id', user.id);

      if (result.error) {
        setCollections(prev => prev.map(col => col.id === collectionId ? { ...col, isWatched: !nextWatched } : col));
        addNotification('Watchlist Update Failed', result.error.message, 'community');
        return;
      }

      addNotification(
        nextWatched ? '⭐ Collection Watchlisted' : 'Collection Removed',
        `${collection.name} is ${nextWatched ? 'now saved to your collection watchlist' : 'removed from your collection watchlist'}.`,
        'community'
      );
    })();
  };

  const toggleDropReminder = (dropId: string) => {
    const drop = upcomingDrops.find(item => item.id === dropId);
    if (!drop) return;
    addNotification(
      'Drop Reminder Unavailable',
      'AURA does not currently persist drop reminders because there is no backend reminder record yet. Your account and wallet data are not changed.',
      'drop_alert'
    );
  };

  const addComment = (artworkId: string, text: string) => {
    if (!user) { openAuth('signin'); return; }
    const trimmed = text.trim();
    if (!trimmed) return;
    const artwork = artworks.find(art => art.id === artworkId);
    if (!artwork || !isBackendArtworkId(artworkId)) {
      addNotification('Live Artwork Required', 'Comments are available on live AURA artwork listings.', 'community');
      return;
    }
    void (async () => {
      const { data, error } = await supabase.rpc('add_artwork_comment', { p_artwork_id: artworkId, p_text: trimmed });
      if (error || !data) {
        addNotification('Comment Failed', error?.message || 'Your comment could not be posted.', 'community');
        return;
      }
      const row = data as any;
      setArtworks(prev => prev.map(art => art.id === artworkId ? {
        ...art,
        comments: [{
          id: row.id,
          userName: userProfile.name,
          userAvatar: userProfile.avatar,
          text: row.text || trimmed,
          timestamp: 'Just now',
        }, ...art.comments],
        eligibleInteractions: art.eligibleInteractions + 3,
      } : art));
      addNotification('💬 Comment Posted', `Your comment was added to "${artwork.title}".`, 'community');
    })();
  };
  const collectArtwork = async (artwork: Artwork): Promise<boolean> => {
    if (!user) { openAuth('signin'); return false; }
    if (!isBackendArtworkId(artwork.id)) {
      addNotification('Live Listing Required', 'This catalog item is a preview. Live collecting is available for published AURA listings.', 'community');
      return false;
    }

    const { error } = await supabase.rpc('collect_artwork', { p_artwork_id: artwork.id });
    if (error) {
      addNotification('Collect Failed', error.message.includes('INSUFFICIENT_FUNDS') ? 'Your AURA wallet needs more USDT.' : 'This artwork could not be collected right now.', 'community');
      return false;
    }

    setArtworks(prev => prev.map(a => a.id === artwork.id ? {
      ...a,
      isOwned: true,
      purchasePrice: artwork.currentValue,
      collectorsCount: a.collectorsCount + 1,
    } : a));

    const [wallet, ledger] = await Promise.all([
      supabase.from('wallet_accounts').select('balance_usdt').eq('user_id', user.id).maybeSingle(),
      supabase.from('wallet_ledger').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
    ]);
    if (wallet.data) setWalletBalance(Number((wallet.data as any).balance_usdt || 0));
    if (ledger.data) setTransactions((ledger.data as any[]).map(mapLedgerToTransaction));

    addNotification('🎨 Masterpiece Collected', `You acquired "${artwork.title}" for $${artwork.currentValue.toFixed(2)} USDT.`, 'collect');
    return true;
  };

  // Quick Buy (like in the photo!)
  const quickBuyArtwork = (artwork: Artwork): Promise<boolean> => collectArtwork(artwork);

  const makeOfferOnArtwork = async (artworkId: string, offerAmount: number): Promise<boolean> => {
    if (!user) { openAuth('signin'); return false; }
    const artwork = artworks.find((art) => art.id === artworkId);
    if (!artwork || !isBackendArtworkId(artworkId)) {
      addNotification('Live Listing Required', 'Offers can only be submitted on live AURA artwork listings.', 'p2p');
      return false;
    }
    if (!Number.isFinite(offerAmount) || offerAmount <= 0) {
      addNotification('Invalid Offer', 'Enter a positive USDT offer amount.', 'p2p');
      return false;
    }
    const { error } = await supabase.rpc('create_artwork_offer', {
      p_artwork_id: artworkId,
      p_offer_amount_usdt: offerAmount,
    });
    if (error) {
      addNotification('Offer Failed', error.message, 'p2p');
      return false;
    }
    setArtworks(prev => prev.map(art => art.id === artworkId ? { ...art, topOfferUSDT: offerAmount } : art));
    addNotification('🤝 Offer Submitted', `Your $${offerAmount.toFixed(2)} USDT offer on "${artwork.title}" was sent to the owner.`, 'p2p');
    return true;
  };

  const convertArtwork = async (artwork: Artwork, fee: number): Promise<{ success: boolean; netPayout: number }> => {
    if (!user) { openAuth('signin'); return { success: false, netPayout: 0 }; }
    if (!isBackendArtworkId(artwork.id) || !artwork.isOwned) {
      addNotification('Not Available', 'Only live AURA-owned listings can be converted to wallet USDT.', 'community');
      return { success: false, netPayout: 0 };
    }
    const { data, error } = await supabase.rpc('convert_owned_artwork', { p_artwork_id: artwork.id, p_fee_usdt: fee });
    if (error) {
      addNotification('Conversion Failed', error.message, 'community');
      return { success: false, netPayout: 0 };
    }
    const payout = Number((data as any)?.payout_usdt || 0);
    const wallet = await supabase.from('wallet_accounts').select('balance_usdt').eq('user_id', user.id).maybeSingle();
    if (wallet.data) setWalletBalance(Number((wallet.data as any).balance_usdt || 0));
    setArtworks(prev => prev.map(a => a.id === artwork.id ? { ...a, isOwned: false, purchasePrice: undefined, isListedOnP2P: false } : a));
    const ledger = await supabase.from('wallet_ledger').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    if (ledger.data) setTransactions((ledger.data as any[]).map(mapLedgerToTransaction));
    addNotification('💸 Converted to AURA Wallet', `${payout.toFixed(2)} USDT credited after the ${fee.toFixed(2)} service fee.`, 'convert');
    return { success: true, netPayout: payout };
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
    if (!user) { openAuth('signin'); return false; }

    const art = artworks.find((a) => a.id === artworkId);
    if (!art) return false;

    if (!isBackendArtworkId(artworkId) || !art.isOwned) {
      addNotification(
        'Artwork Must Be Owned',
        'Only an artwork already owned in your AURA account can be listed for P2P sale.',
        'p2p'
      );
      return false;
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
      return false;
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
    return true;
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
      p_list_on_p2p: Boolean(newArt.listOnP2P && newArt.p2pPriceFiat),
      p_p2p_price_fiat: newArt.listOnP2P && newArt.p2pPriceFiat ? newArt.p2pPriceFiat : null,
      p_p2p_currency: 'USD',
      p_p2p_payment_methods: newArt.listOnP2P ? (newArt.p2pPaymentMethods || []) : [],
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
        p_payment_instructions: (newArt as any).p2pPaymentInstructions?.trim() || 'Use the selected payment method and the order reference shown after matching. AURA transfers artwork ownership only after the seller confirms receipt.',
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
    setActiveTab('home');
  };

  const topUpBalance = (_amount: number) => {
    addNotification('Wallet Funding', 'AURA does not create money. Use Receive for a supported on-chain deposit or a verified P2P purchase.', 'community');
    return;
  };

  const sendInternalFunds = async (recipient: string, amount: number): Promise<boolean> => {
    if (!user) { openAuth('signin'); return false; }
    if (walletBalance < amount) {
      addNotification('Transfer Error', 'Insufficient AURA wallet balance.', 'community');
      return false;
    }
    const { error } = await supabase.rpc('internal_transfer', { p_recipient: recipient.trim(), p_amount_usdt: amount });
    if (error) {
      addNotification('Transfer Failed', error.message.includes('RECIPIENT_NOT_FOUND') ? 'Recipient not found. Use an @handle or AURA Vault ID.' : error.message, 'community');
      return false;
    }
    const wallet = await supabase.from('wallet_accounts').select('balance_usdt').eq('user_id', user.id).maybeSingle();
    if (wallet.data) setWalletBalance(Number((wallet.data as any).balance_usdt || 0));
    const ledger = await supabase.from('wallet_ledger').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    if (ledger.data) setTransactions((ledger.data as any[]).map(mapLedgerToTransaction));
    addNotification('Sent Successfully', `Transferred ${amount.toFixed(2)} USDT to ${recipient}.`, 'convert');
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

  const requestWalletWithdrawal = async (params: {
    chain: CryptoNetwork;
    destinationAddress: string;
    amount: number;
    networkFee?: number;
  }) => {
    if (!user) {
      openAuth('signin');
      return { success: false, error: 'AUTH_REQUIRED' };
    }

    const { data, error } = await supabase.functions.invoke('withdrawal-request', {
      body: {
        chain: params.chain,
        destinationAddress: params.destinationAddress,
        amount: params.amount,
        networkFee: params.networkFee || 0,
      },
    });

    if (error || !data?.success) {
      return { success: false, error: data?.error || error?.message || 'Withdrawal request failed.' };
    }

    const wallet = await supabase.from('wallet_accounts').select('balance_usdt').eq('user_id', user.id).maybeSingle();
    if (wallet.data) setWalletBalance(Number((wallet.data as any).balance_usdt || 0));
    const ledger = await supabase.from('wallet_ledger').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    if (ledger.data) setTransactions((ledger.data as any[]).map(mapLedgerToTransaction));

    addNotification(
      'Confirm your withdrawal',
      'A confirmation email was sent. The reserved USDT will not be broadcast until you confirm it.',
      'wallet',
    );

    return { success: true, withdrawal: data.withdrawal };
  };

  const connectExternalWallet = (name: ConnectedExternalWallet['name'], network: CryptoNetwork) => {
    if (!user) { openAuth('signin'); return; }

    void (async () => {
      let address = '';
      const win = window as any;
      try {
        if (name === 'MetaMask') {
          if (network === 'solana' || network === 'ton') {
            addNotification('Network Not Supported', 'MetaMask connection is available for EVM networks only.', 'community');
            return;
          }
          if (!win.ethereum?.request) {
            addNotification('MetaMask Not Found', 'Open Aura in a browser with MetaMask installed, then try again.', 'community');
            return;
          }

          const expectedChainIds: Record<string, string> = {
            ethereum: '0x1',
            polygon: '0x89',
            arbitrum: '0xa4b1',
          };
          const chainId = String(await win.ethereum.request({ method: 'eth_chainId' })).toLowerCase();
          if (chainId !== expectedChainIds[network]) {
            addNotification('Wrong Network', `Switch MetaMask to ${network === 'ethereum' ? 'Ethereum' : network === 'polygon' ? 'Polygon' : 'Arbitrum'} and try again.`, 'community');
            return;
          }

          const accounts = await win.ethereum.request({ method: 'eth_requestAccounts' });
          address = accounts?.[0] || '';
          if (!address) throw new Error('Wallet address missing.');

          const challenge = await supabase.functions.invoke('verify-external-wallet', {
            body: { action: 'challenge', provider: 'MetaMask', network, address },
          });
          if (challenge.error || !challenge.data?.success) throw new Error(challenge.data?.error || challenge.error?.message || 'Could not create ownership challenge.');

          const signature = await win.ethereum.request({
            method: 'personal_sign',
            params: [challenge.data.message, address],
          });

          const verified = await supabase.functions.invoke('verify-external-wallet', {
            body: { action: 'verify', provider: 'MetaMask', network, address, signature },
          });
          if (verified.error || !verified.data?.success) throw new Error(verified.data?.error || verified.error?.message || 'Wallet ownership verification failed.');
        } else if (name === 'Phantom') {
          if (network !== 'solana') {
            addNotification('Network Not Supported', 'Phantom connection currently supports Solana in Aura.', 'community');
            return;
          }
          if (!win.solana?.connect || !win.solana?.signMessage) {
            addNotification('Phantom Not Found', 'Open Aura in a browser with Phantom installed, then try again.', 'community');
            return;
          }

          const result = await win.solana.connect();
          address = result?.publicKey?.toString?.() || '';
          if (!address) throw new Error('Wallet address missing.');

          const challenge = await supabase.functions.invoke('verify-external-wallet', {
            body: { action: 'challenge', provider: 'Phantom', network: 'solana', address },
          });
          if (challenge.error || !challenge.data?.success) throw new Error(challenge.data?.error || challenge.error?.message || 'Could not create ownership challenge.');

          const signed = await win.solana.signMessage(new TextEncoder().encode(challenge.data.message), 'utf8');
          const signatureBytes = signed?.signature ? new Uint8Array(signed.signature) : null;
          if (!signatureBytes) throw new Error('Phantom did not return a signature.');
          const signature = '0x' + Array.from(signatureBytes, (b: number) => b.toString(16).padStart(2, '0')).join('');

          const verified = await supabase.functions.invoke('verify-external-wallet', {
            body: { action: 'verify', provider: 'Phantom', network: 'solana', address, signature },
          });
          if (verified.error || !verified.data?.success) throw new Error(verified.data?.error || verified.error?.message || 'Wallet ownership verification failed.');
        } else {
          addNotification('Wallet Provider Needed', `${name} connection needs its wallet provider bridge. Aura will never fabricate an address.`, 'community');
          return;
        }
      } catch (e: any) {
        addNotification('Wallet Verification Cancelled', e?.message || 'The wallet connection or signature was cancelled.', 'community');
        return;
      }

      const { data, error } = await supabase.from('external_wallets').select('*')
        .eq('user_id', user.id).eq('provider', name).eq('network', network).eq('address', address).maybeSingle();

      if (error || !data) {
        addNotification('Wallet Verification Failed', error?.message || 'The wallet was not verified by AURA.', 'community');
        return;
      }

      const connected: ConnectedExternalWallet = {
        id: data.id,
        name,
        network,
        address: data.address,
        connectedAt: new Date(data.connected_at).toLocaleDateString(),
        balance: 0,
      };
      setConnectedWallets(prev => [connected, ...prev.filter(w => w.id !== connected.id && w.address !== address)]);
      addNotification('🔐 Wallet Ownership Verified', `${name} ownership was cryptographically verified on ${network}.`, 'community');
    })();
  };
  const disconnectExternalWallet = async (id: string): Promise<boolean> => {
    if (!user) {
      openAuth('signin');
      return false;
    }
    const { error } = await supabase.from('external_wallets')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) {
      addNotification('Disconnect Failed', error.message || 'Could not disconnect this wallet.', 'community');
      return false;
    }
    setConnectedWallets(prev => prev.filter(w => w.id !== id));
    addNotification('Wallet Disconnected', 'External wallet session closed.', 'community');
    return true;
  };

  useEffect(() => {
    const win = window as any;
    const ethereum = win.ethereum;
    const solana = win.solana;
    if (!user) return;

    const expectedChainIds: Record<string, string> = {
      ethereum: '0x1',
      polygon: '0x89',
      arbitrum: '0xa4b1',
    };

    const handleEvmAccountsChanged = (accounts: string[]) => {
      const nextAddress = String(accounts?.[0] || '').toLowerCase();
      setConnectedWallets(prev => prev.filter(wallet =>
        wallet.name !== 'MetaMask' || wallet.address.toLowerCase() === nextAddress
      ));
    };

    const handleEvmChainChanged = (chainId: string) => {
      const normalized = String(chainId).toLowerCase();
      setConnectedWallets(prev => prev.filter(wallet =>
        wallet.name !== 'MetaMask' || expectedChainIds[wallet.network] === normalized
      ));
    };

    const handleSolanaAccountChanged = (publicKey: any) => {
      const nextAddress = publicKey?.toString?.().toLowerCase() || '';
      setConnectedWallets(prev => prev.filter(wallet =>
        wallet.name !== 'Phantom' || wallet.address.toLowerCase() === nextAddress
      ));
    };

    ethereum?.on?.('accountsChanged', handleEvmAccountsChanged);
    ethereum?.on?.('chainChanged', handleEvmChainChanged);
    solana?.on?.('accountChanged', handleSolanaAccountChanged);

    return () => {
      ethereum?.removeListener?.('accountsChanged', handleEvmAccountsChanged);
      ethereum?.removeListener?.('chainChanged', handleEvmChainChanged);
      solana?.removeListener?.('accountChanged', handleSolanaAccountChanged);
    };
  }, [user]);

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
    setP2pOffers(prev => prev
      .map(o => o.id === offer.id ? { ...o, availableCrypto: Math.max(0, o.availableCrypto - cryptoAmount) } : o)
      .filter(o => o.availableCrypto > 0));
    const isArtworkTrade = Boolean(orderRow.artwork_id || offer.artworkId);
    addNotification(
      isArtworkTrade ? '🔒 Artwork P2P Trade Opened' : '🔒 AURA Trade Hold Created',
      isArtworkTrade
        ? 'Payment is handled through the listed fiat method. AURA transfers the artwork only after the seller confirms payment.'
        : `${cryptoAmount} USDT is reserved until the trade completes or is cancelled.`,
      'p2p'
    );
    return uiOrder;
  };

  const markP2PPaymentSent = async (orderId: string): Promise<boolean> => {
    if (!user) { openAuth('signin'); return false; }
    const { data, error } = await supabase.rpc('mark_p2p_payment', { p_order_id: orderId });
    if (error || !data) {
      addNotification('P2P Update Failed', error?.message || 'Could not update the trade.', 'p2p');
      return false;
    }
    const row = data as any;
    const current = activeP2POrder;
    setActiveP2POrder(current ? { ...current, status: 'payment_marked' } : backendP2POrderToUi(row));
    addNotification('⏳ Payment Status Recorded', 'The counterparty can now review the payment and release the held USDT.', 'p2p');
    return true;
  };

  const completeP2POrder = async (orderId: string): Promise<boolean> => {
    if (!user) { openAuth('signin'); return false; }
    const { data, error } = await supabase.rpc('settle_p2p_order', { p_order_id: orderId });
    if (error || !data) {
      addNotification('P2P Release Failed', error?.message === 'ONLY_SELLER_CAN_RELEASE' ? 'Only the seller can release the held USDT after payment is confirmed.' : (error?.message || 'Could not release this trade.'), 'p2p');
      return false;
    }
    const row = data as any;
    const isArtworkTrade = Boolean(row.artwork_id);
    setActiveP2POrder(null);
    setP2pOffers(prev => prev.filter(o => o.id !== row.offer_id));

    if (isArtworkTrade) {
      const becameOwner = row.buyer_id === user.id;
      setArtworks(prev => prev.map(a => a.id === row.artwork_id ? {
        ...a,
        isOwned: becameOwner,
        purchasePrice: becameOwner ? Number(row.fiat_amount || 0) : a.purchasePrice,
        isListedOnP2P: false,
      } : a));
      addNotification(
        '✅ Artwork P2P Trade Completed',
        becameOwner
          ? 'Artwork ownership is now in your AURA collection.'
          : 'The artwork was transferred to the buyer after payment was confirmed.',
        'p2p'
      );
      return true;
    }

    const wallet = await supabase.from('wallet_accounts').select('balance_usdt').eq('user_id', user.id).maybeSingle();
    if (wallet.data) setWalletBalance(Number((wallet.data as any).balance_usdt || 0));
    const ledger = await supabase.from('wallet_ledger').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    if (ledger.data) setTransactions((ledger.data as any[]).map(mapLedgerToTransaction));
    addNotification('✅ P2P Trade Completed', `${row.crypto_amount} USDT was released to the buyer.`, 'p2p');
    return true;
  };

  const cancelP2POrder = async (orderId: string): Promise<boolean> => {
    if (!user) { openAuth('signin'); return false; }
    const { data, error } = await supabase.rpc('cancel_p2p_order', { p_order_id: orderId });
    if (error || !data) {
      addNotification('P2P Cancel Failed', error?.message || 'Could not cancel this order.', 'p2p');
      return false;
    }
    const row = data as any;
    const isArtworkTrade = Boolean(row.artwork_id);
    setActiveP2POrder(null);

    if (isArtworkTrade) {
      const offerRes = await supabase.from('p2p_offers')
        .select('*,merchant:merchant_id(id,handle,display_name,avatar_url),artwork:artwork_id(id,title,media_url)')
        .eq('id', row.offer_id)
        .maybeSingle();
      if (offerRes.data) {
        const restored = backendP2POfferToUi(offerRes.data as any);
        setP2pOffers(prev => [restored, ...prev.filter(o => o.id !== restored.id)]);
      }
      addNotification('P2P Artwork Order Cancelled', 'The artwork remains with the seller and is available again in the P2P desk.', 'p2p');
      return true;
    }

    const wallet = await supabase.from('wallet_accounts').select('balance_usdt').eq('user_id', user.id).maybeSingle();
    if (wallet.data) setWalletBalance(Number((wallet.data as any).balance_usdt || 0));
    const offerRes = await supabase.from('p2p_offers')
      .select('*,merchant:merchant_id(id,handle,display_name,avatar_url),artwork:artwork_id(id,title,media_url)')
      .eq('id', row.offer_id)
      .maybeSingle();
    if (offerRes.data) {
      const restored = backendP2POfferToUi(offerRes.data as any);
      setP2pOffers(prev => [restored, ...prev.filter(o => o.id !== restored.id)]);
    }
    const ledger = await supabase.from('wallet_ledger').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    if (ledger.data) setTransactions((ledger.data as any[]).map(mapLedgerToTransaction));
    addNotification('P2P Order Cancelled', 'Held USDT was returned to the seller balance.', 'p2p');
    return true;
  };

  const raiseP2PDispute = async (orderId: string): Promise<boolean> => {
    if (!user) { openAuth('signin'); return false; }
    const { data, error } = await supabase.rpc('raise_p2p_dispute', { p_order_id: orderId });
    if (error || !data) {
      addNotification('Dispute Could Not Open', error?.message || 'Could not open a dispute for this order.', 'p2p');
      return false;
    }
    setActiveP2POrder((current) => current ? { ...current, status: 'in_dispute', protectionFundActive: false } : null);
    addNotification('⚠️ P2P Dispute Opened', 'The trade is locked in dispute. Keep all payment evidence inside the trade record.', 'p2p');
    return true;
  };

  const createP2POffer = async (offerData: Omit<P2POffer, 'id' | 'merchant' | 'isSmartEscrowLocked'>): Promise<boolean> => {
    if (!user) { openAuth('signin'); return false; }
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
      return false;
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
    return true;
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
        toggleDislike,
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
        requestWalletWithdrawal,
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
