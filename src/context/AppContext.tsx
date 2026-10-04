import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Artwork,
  FeedSection,
  TelegramNotification,
  Transaction,
  ArtworkCategory,
  CryptoNetwork,
  P2POffer,
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
  updateUserProfile: (updates: Partial<UserProfile>) => void;
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
  }) => void;
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
  }) => void;
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
  }) => P2POrder;
  markP2PPaymentSent: (orderId: string) => void;
  completeP2POrder: (orderId: string) => void;
  cancelP2POrder: (orderId: string) => void;
  createP2POffer: (offerData: Omit<P2POffer, 'id' | 'merchant' | 'isSmartEscrowLocked'>) => void;
  // Telegram Bot Homepage & Chat integration
  telegramViewMode: TelegramViewMode;
  setTelegramViewMode: (mode: TelegramViewMode) => void;
  startBotAndOpenApp: (options?: {
    destinationTab?: 'home' | 'discover' | 'create' | 'wallet' | 'profile';
    customNotification?: string;
  }) => void;
  addNotification: (title: string, message: string, type: TelegramNotification['type']) => void;
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

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  const [walletBalance, setWalletBalance] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_WALLET);
      return saved ? Number(saved) : 2450.0;
    } catch {
      return 2450.0;
    }
  });

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROFILE);
      return saved
        ? JSON.parse(saved)
        : {
            name: 'Julian Vance',
            telegramHandle: '@artcollector',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
            coverImage: '',
            bio: 'Curating anime PFPs, digital fashion, and generative fine art.',
            vaultId: 'aura.tg://vance.884',
            joinedDate: 'February 2026',
            defaultCurrency: 'USD',
            notificationsEnabled: true,
            telegramBotAlerts: true,
            twoFactorEnabled: true,
            biometricAuth: false,
          };
    } catch {
      return {
        name: 'Julian Vance',
        telegramHandle: '@artcollector',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        coverImage: '',
        bio: 'Curating anime PFPs, digital fashion, and generative fine art.',
        vaultId: 'aura.tg://vance.884',
        joinedDate: 'February 2026',
        defaultCurrency: 'USD',
        notificationsEnabled: true,
        telegramBotAlerts: true,
        twoFactorEnabled: true,
        biometricAuth: false,
      };
    }
  });

  const vaultAddresses: Web3VaultAddresses = {
    ton: 'EQB3r_k7J8QYlX7w1mU6H0zJqfD8E9xV3yG5tK2nB1aP9x',
    polygon: '0x71C5681E999E6a9a9972828b86866Fe49411a49B',
    ethereum: '0x71C5681E999E6a9a9972828b86866Fe49411a49B',
    arbitrum: '0x71C5681E999E6a9a9972828b86866Fe49411a49B',
    solana: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    seedPhrase: 'velvet museum obsidian crystal beacon vault echo lunar prism kinetic harmony apex',
  };

  const [connectedWallets, setConnectedWallets] = useState<ConnectedExternalWallet[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_WALLETS);
      return saved
        ? JSON.parse(saved)
        : [
            {
              id: 'w-tonkeeper',
              name: 'Tonkeeper',
              network: 'ton',
              address: 'EQA_9kX8t...B2nP',
              connectedAt: 'March 2026',
              balance: 42.5,
            },
          ];
    } catch {
      return [];
    }
  });

  const [p2pOffers, setP2pOffers] = useState<P2POffer[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_P2P);
      return saved ? JSON.parse(saved).map(sanitizeP2POffer) : INITIAL_P2P_OFFERS;
    } catch {
      return INITIAL_P2P_OFFERS;
    }
  });

  const [activeP2POrder, setActiveP2POrder] = useState<P2POrder | null>(null);

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TXS);
      return saved
        ? JSON.parse(saved)
        : [
            {
              id: 'tx-101',
              type: 'collect',
              artworkTitle: 'Azuki #8781',
              amount: 1752.03,
              currency: 'USDT',
              date: 'Yesterday, 18:24',
              recipientOrSender: '@chirulabs',
              status: 'confirmed',
            },
            {
              id: 'tx-ext-01',
              type: 'receive',
              amount: 1500,
              currency: 'USDT',
              date: '2 days ago',
              recipientOrSender: '0x8b32...F91a',
              status: 'confirmed',
              network: 'polygon',
              txHash: '0x49c9f28a8d11e9...b8c1',
              isExternal: true,
            },
          ];
    } catch {
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState<'home' | 'discover' | 'create' | 'wallet' | 'profile'>('home');
  const [feedFilter, setFeedFilter] = useState<FeedSection>('trending');
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<NFTCollection | null>(null);
  const [makeOfferArtwork, setMakeOfferArtwork] = useState<Artwork | null>(null);
  const [sellArtworkP2PModal, setSellArtworkP2PModal] = useState<Artwork | null>(null);
  const [isTelegramShellMode, setIsTelegramShellMode] = useState<boolean>(true);
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

  const updateUserProfile = (updates: Partial<UserProfile>) => {
    setUserProfile((prev) => ({ ...prev, ...updates }));
    addNotification('Settings Updated', 'Your profile and preferences were saved.', 'community');
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
    setArtworks((prev) =>
      prev.map((art) => {
        if (art.id === artworkId) {
          const isLiked = !art.isLiked;
          const nextLikes = isLiked ? art.likes + 1 : art.likes - 1;
          const nextInteractions = isLiked ? art.eligibleInteractions + 1 : art.eligibleInteractions;
          return {
            ...art,
            isLiked,
            likes: Math.max(0, nextLikes),
            eligibleInteractions: nextInteractions,
          };
        }
        return art;
      })
    );
  };

  const toggleLove = (artworkId: string) => {
    setArtworks((prev) =>
      prev.map((art) => {
        if (art.id === artworkId) {
          const isLoved = !art.isLoved;
          const nextLoves = isLoved ? art.loves + 1 : art.loves - 1;
          const nextInteractions = isLoved ? art.eligibleInteractions + 2 : art.eligibleInteractions;
          return {
            ...art,
            isLoved,
            loves: Math.max(0, nextLoves),
            eligibleInteractions: nextInteractions,
          };
        }
        return art;
      })
    );
  };

  const toggleSave = (artworkId: string) => {
    setArtworks((prev) =>
      prev.map((art) => {
        if (art.id === artworkId) {
          const isSaved = !art.isSaved;
          const nextSaves = isSaved ? art.saves + 1 : art.saves - 1;
          const nextInteractions = isSaved ? art.eligibleInteractions + 1 : art.eligibleInteractions;
          return {
            ...art,
            isSaved,
            saves: Math.max(0, nextSaves),
            eligibleInteractions: nextInteractions,
          };
        }
        return art;
      })
    );
  };

  const toggleWatchlist = (artworkId: string) => {
    setArtworks((prev) =>
      prev.map((art) => {
        if (art.id === artworkId) {
          const isWatched = !art.isWatched;
          addNotification(
            isWatched ? '⭐ Added to Watchlist' : 'Removed from Watchlist',
            `"${art.title}" is ${isWatched ? 'now tracked in your Watchlist' : 'removed'}.`,
            'community'
          );
          return { ...art, isWatched };
        }
        return art;
      })
    );
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
    if (!text.trim()) return;
    setArtworks((prev) =>
      prev.map((art) => {
        if (art.id === artworkId) {
          const newComment = {
            id: `cmt-${Date.now()}`,
            userName: userProfile.name,
            userAvatar: userProfile.avatar,
            text: text.trim(),
            timestamp: 'Just now',
          };
          return {
            ...art,
            comments: [newComment, ...art.comments],
            eligibleInteractions: art.eligibleInteractions + 3,
          };
        }
        return art;
      })
    );
  };

  const collectArtwork = (artwork: Artwork): boolean => {
    if (walletBalance < artwork.currentValue) {
      addNotification(
        'Insufficient Balance',
        `You need $${(artwork.currentValue - walletBalance).toFixed(2)} more USDT to collect "${artwork.title}".`,
        'community'
      );
      return false;
    }

    const cost = artwork.currentValue;
    setWalletBalance((prev) => prev - cost);

    setArtworks((prev) =>
      prev.map((art) => {
        if (art.id === artwork.id) {
          return {
            ...art,
            isOwned: true,
            purchasePrice: cost,
            collectorsCount: art.collectorsCount + 1,
            eligibleInteractions: art.eligibleInteractions + 15,
            collectors: [
              { id: 'me', name: userProfile.name, avatar: userProfile.avatar },
              ...art.collectors,
            ],
          };
        }
        return art;
      })
    );

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      type: 'collect',
      artworkTitle: artwork.title,
      amount: cost,
      currency: 'USDT',
      date: 'Just now',
      recipientOrSender: artwork.creator.handle,
      status: 'confirmed',
    };
    setTransactions((prev) => [newTx, ...prev]);

    addNotification(
      '🎨 Masterpiece Collected',
      `You acquired "${artwork.title}" for $${cost} USDT. Vault certificate minted!`,
      'collect'
    );

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
    if (!artwork.isOwned) {
      return { success: false, netPayout: 0 };
    }

    const netPayout = Math.max(0, artwork.currentValue - fee);
    setWalletBalance((prev) => prev + netPayout);

    setArtworks((prev) =>
      prev.map((art) => {
        if (art.id === artwork.id) {
          return {
            ...art,
            isOwned: false,
            purchasePrice: undefined,
            collectorsCount: Math.max(0, art.collectorsCount - 1),
          };
        }
        return art;
      })
    );

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      type: 'convert',
      artworkTitle: artwork.title,
      amount: netPayout,
      currency: 'USDT',
      date: 'Just now',
      recipientOrSender: 'AURA Liquidity Treasury',
      status: 'confirmed',
    };
    setTransactions((prev) => [newTx, ...prev]);

    addNotification(
      '💸 Converted to Crypto',
      `"${artwork.title}" converted to $${netPayout.toFixed(2)} USDT. Funds credited to wallet!`,
      'convert'
    );

    return { success: true, netPayout };
  };

  // Direct Art-to-Money Selling on P2P
  const listArtworkOnP2P = ({
    artworkId,
    fiatPrice,
    currency,
    paymentMethods,
  }: {
    artworkId: string;
    fiatPrice: number;
    currency: 'USD' | 'EUR' | 'GBP';
    paymentMethods: PaymentMethodType[];
  }) => {
    const art = artworks.find((a) => a.id === artworkId);
    if (!art) return;

    // Update artwork
    setArtworks((prev) =>
      prev.map((a) => {
        if (a.id === artworkId) {
          return {
            ...a,
            isListedOnP2P: true,
            p2pPriceFiat: fiatPrice,
            p2pCurrency: currency,
            p2pPaymentMethods: paymentMethods,
          };
        }
        return a;
      })
    );

    // Create P2P offer for art
    const newOffer: P2POffer = {
      id: `p2p-art-${Date.now()}`,
      type: 'sell',
      merchant: {
        id: 'me',
        name: userProfile.name,
        legalName: `${userProfile.name} (Verified Patron)`,
        avatar: userProfile.avatar,
        ordersCompleted: 2,
        completionRate: 100,
        avgReleaseTimeMinutes: 1,
        verifiedMerchant: true,
        kycVerified: true,
        depositBondUSDT: 5000,
        positiveFeedbackPercent: 100,
        telegramHandle: userProfile.telegramHandle,
      },
      pricePerUnit: fiatPrice,
      fiatCurrency: currency,
      availableCrypto: 1,
      minLimitFiat: fiatPrice,
      maxLimitFiat: fiatPrice,
      paymentMethods,
      paymentInstructions: `P2P Sale of Verified NFT Artwork: "${art.title}". Smart escrow transfers digital ownership upon payment confirmation.`,
      isSmartEscrowLocked: true,
      isBuyerProtected: true,
      artworkId: art.id,
      artworkTitle: art.title,
      artworkImage: art.customMediaUrl || '',
    };

    setP2pOffers((prev) => [newOffer, ...prev]);

    addNotification(
      '🏷️ Listed for Sale on P2P',
      `"${art.title}" is now available for direct cash purchase on the P2P Desk for $${fiatPrice} ${currency}!`,
      'p2p'
    );
  };

  const createArtwork = (newArt: {
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
    const created: Artwork = {
      id: `art-created-${Date.now()}`,
      title: newArt.title,
      edition: '1 of 1 · Genesis',
      creator: {
        id: 'me',
        name: userProfile.name,
        handle: userProfile.telegramHandle,
        avatar: userProfile.avatar,
        verified: true,
        bio: userProfile.bio,
        totalPieces: 1,
        totalCollectors: 0,
      },
      visualTheme: newArt.visualTheme,
      accentColor: '#e0c070',
      description: newArt.description,
      medium: newArt.mediaType === 'gif' ? 'Animated GIF 60FPS' : newArt.mediaType === 'brand_streetwear' ? 'Brand Wearable' : newArt.mediaType === 'ui_design' ? 'Figma UI Design' : 'Digital Fine Art',
      dimensions: '4096 × 4096 px · Master File',
      originalPrice: newArt.price,
      currentValue: newArt.price,
      purchasePrice: newArt.price,
      isOwned: true,
      eligibleInteractions: 1,
      interestLevel: 'Rising',
      interestScore: 70,
      likes: 1,
      loves: 1,
      saves: 0,
      collectorsCount: 1,
      collectors: [{ id: 'me', name: userProfile.name, avatar: userProfile.avatar }],
      createdDate: 'Today',
      category: newArt.category,
      mediaType: newArt.mediaType || 'image',
      customMediaUrl: newArt.customMediaUrl,
      collectionName: newArt.collectionName || 'Creator Vault Series',
      traits: newArt.traits || [],
      conversionEligible: true,
      conversionLiquidity: 'Ample',
      isListedOnP2P: newArt.listOnP2P,
      p2pPriceFiat: newArt.p2pPriceFiat,
      p2pPaymentMethods: newArt.p2pPaymentMethods,
      comments: [],
    };

    setArtworks((prev) => [created, ...prev]);

    // If also listed on P2P
    if (newArt.listOnP2P && newArt.p2pPriceFiat && newArt.p2pPaymentMethods) {
      listArtworkOnP2P({
        artworkId: created.id,
        fiatPrice: newArt.p2pPriceFiat,
        currency: 'USD',
        paymentMethods: newArt.p2pPaymentMethods,
      });
    }

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      type: 'create',
      artworkTitle: created.title,
      amount: created.originalPrice,
      currency: 'ART',
      date: 'Just now',
      recipientOrSender: 'Creator Vault',
      status: 'confirmed',
    };
    setTransactions((prev) => [newTx, ...prev]);

    addNotification(
      '✨ Masterpiece Minted & Listed',
      `"${created.title}" is now inscribed in your vault and live on the marketplace!`,
      'community'
    );

    setActiveTab('home');
  };

  const topUpBalance = (amount: number) => {
    setWalletBalance((prev) => prev + amount);
    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      type: 'receive',
      amount: amount,
      currency: 'USDT',
      date: 'Just now',
      recipientOrSender: 'Top Up Deposit',
      status: 'confirmed',
    };
    setTransactions((prev) => [newTx, ...prev]);
    addNotification('💳 Balance Credited', `+$${amount} USDT added to your wallet.`, 'convert');
  };

  const sendInternalFunds = (recipient: string, amount: number): boolean => {
    if (walletBalance < amount) {
      addNotification('Transfer Error', 'Insufficient balance for transfer.', 'community');
      return false;
    }
    setWalletBalance((prev) => prev - amount);
    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      type: 'send',
      amount: amount,
      currency: 'USDT',
      date: 'Just now',
      recipientOrSender: recipient,
      status: 'confirmed',
    };
    setTransactions((prev) => [newTx, ...prev]);
    addNotification('Sent Successfully', `Transferred $${amount} USDT to ${recipient}.`, 'convert');
    return true;
  };

  const sendExternalCrypto = ({
    network,
    destinationAddress,
    amount,
    gasFee,
  }: {
    network: CryptoNetwork;
    destinationAddress: string;
    amount: number;
    gasFee: number;
  }): { success: boolean; txHash: string } => {
    const totalDeduction = amount + gasFee;
    if (walletBalance < totalDeduction) {
      addNotification('External Send Failed', 'Insufficient funds for amount + network gas fee.', 'external_tx');
      return { success: false, txHash: '' };
    }

    const randomHex = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const txHash = network === 'ton' ? `ton://tx/${randomHex.slice(0, 32)}` : `0x${randomHex}`;

    setWalletBalance((prev) => prev - totalDeduction);

    const newTx: Transaction = {
      id: `tx-ext-${Date.now()}`,
      type: 'send',
      amount,
      currency: 'USDT',
      date: 'Just now',
      recipientOrSender: `${destinationAddress.slice(0, 6)}...${destinationAddress.slice(-4)}`,
      status: 'confirmed',
      network,
      txHash,
      isExternal: true,
    };
    setTransactions((prev) => [newTx, ...prev]);

    addNotification(
      '🚀 External Web3 Broadcast',
      `Sent ${amount} USDT to external address on ${network.toUpperCase()}. Gas: $${gasFee}. TxHash: ${txHash.slice(0, 10)}...`,
      'external_tx'
    );

    return { success: true, txHash };
  };

  const simulateInboundDeposit = (network: CryptoNetwork, amount: number) => {
    const randomHex = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const txHash = network === 'ton' ? `ton://tx/${randomHex.slice(0, 32)}` : `0x${randomHex}`;

    setWalletBalance((prev) => prev + amount);

    const newTx: Transaction = {
      id: `tx-dep-${Date.now()}`,
      type: 'receive',
      amount,
      currency: 'USDT',
      date: 'Just now',
      recipientOrSender: `External Deposit (${network.toUpperCase()})`,
      status: 'confirmed',
      network,
      txHash,
      isExternal: true,
    };
    setTransactions((prev) => [newTx, ...prev]);

    addNotification(
      '📥 External Web3 Deposit Received',
      `+$${amount} USDT confirmed from external wallet on ${network.toUpperCase()}!`,
      'external_tx'
    );
  };

  const connectExternalWallet = (name: ConnectedExternalWallet['name'], network: CryptoNetwork) => {
    const id = `wallet-${Date.now()}`;
    const generatedAddr =
      network === 'ton'
        ? 'EQC' + Math.random().toString(36).substring(2, 15) + '...tg'
        : '0x' + Math.random().toString(16).substring(2, 10) + '...' + Math.random().toString(16).substring(2, 6);

    const newWallet: ConnectedExternalWallet = {
      id,
      name,
      network,
      address: generatedAddr,
      connectedAt: 'Today',
      balance: Math.floor(Math.random() * 80) + 10,
    };

    setConnectedWallets((prev) => [newWallet, ...prev]);
    addNotification('🔗 External Wallet Connected', `${name} (${network.toUpperCase()}) linked successfully.`, 'community');
  };

  const disconnectExternalWallet = (id: string) => {
    setConnectedWallets((prev) => prev.filter((w) => w.id !== id));
    addNotification('Wallet Disconnected', 'External wallet session closed.', 'community');
  };

  const startP2POrder = ({
    offer,
    cryptoAmount,
    paymentMethod,
  }: {
    offer: P2POffer;
    cryptoAmount: number;
    paymentMethod: PaymentMethodType;
  }): P2POrder => {
    const fiatAmount = cryptoAmount * offer.pricePerUnit;
    const randomHash = '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    const newOrder: P2POrder = {
      id: `p2p-ord-${Date.now()}`,
      offerId: offer.id,
      type: offer.type,
      merchant: offer.merchant,
      cryptoAmount,
      fiatAmount,
      fiatCurrency: offer.fiatCurrency,
      paymentMethod,
      status: 'escrow_locked',
      escrowTxHash: randomHash,
      createdAt: 'Just now',
      protectionFundActive: true,
      artwork: offer.artworkId ? {
        id: offer.artworkId,
        title: offer.artworkTitle || 'NFT Masterpiece',
        image: offer.artworkImage || '',
      } : undefined,
      paymentDetails: {
        accountName: offer.merchant.name,
        accountNumberOrId:
          paymentMethod === 'telegram_pay'
            ? offer.merchant.telegramHandle
            : paymentMethod === 'revolut'
            ? `rev.me/${offer.merchant.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`
            : paymentMethod.toLowerCase().includes('paypal')
            ? `paypal.me/${offer.merchant.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`
            : paymentMethod.toLowerCase().includes('zelle')
            ? `${offer.merchant.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@pay.net`
            : paymentMethod.toLowerCase().includes('bank')
            ? 'GB29 REVO 0099 8812 3456 78'
            : `${offer.merchant.name} · ${paymentMethod}`,
        referenceCode: `AURA-${Math.floor(100000 + Math.random() * 900000)}`,
      },
      chatMessages: [
        {
          id: `sys-${Date.now()}`,
          sender: 'system',
          senderName: 'AURA Security Escrow',
          text: `Escrow initialized. ${offer.artworkTitle ? `Artwork "${offer.artworkTitle}"` : `${cryptoAmount} USDT`} locked in smart contract. Please send payment with reference code.`,
          timestamp: 'Just now',
        },
      ],
    };

    if (offer.type === 'sell' && !offer.artworkId) {
      if (walletBalance < cryptoAmount) {
        throw new Error('Insufficient wallet balance to lock in P2P escrow.');
      }
      setWalletBalance((prev) => prev - cryptoAmount);
    }

    setActiveP2POrder(newOrder);

    addNotification(
      '🔒 Trustless Escrow Locked',
      `Smart contract escrow initialized for ${offer.artworkTitle ? offer.artworkTitle : `${cryptoAmount} USDT`}. Escrow Hash: ${randomHash.slice(0, 10)}...`,
      'p2p'
    );

    return newOrder;
  };

  const markP2PPaymentSent = (orderId: string) => {
    if (!activeP2POrder || activeP2POrder.id !== orderId) return;

    setActiveP2POrder((prev) => (prev ? { ...prev, status: 'payment_marked' } : null));

    addNotification(
      '⏳ Payment Marked as Sent',
      'The merchant has been notified to verify fiat arrival and release escrow.',
      'p2p'
    );
  };

  const completeP2POrder = (orderId: string) => {
    if (!activeP2POrder || activeP2POrder.id !== orderId) return;

    const order = activeP2POrder;

    // If it's an artwork P2P order
    if (order.artwork) {
      // Transfer artwork to buyer
      setArtworks((prev) =>
        prev.map((art) => {
          if (art.id === order.artwork?.id) {
            return {
              ...art,
              isOwned: order.type === 'buy',
              isListedOnP2P: false,
              collectorsCount: art.collectorsCount + 1,
            };
          }
          return art;
        })
      );
      // If seller, credit fiat/USDT
      if (order.type === 'sell') {
        setWalletBalance((prev) => prev + order.fiatAmount);
      }
    } else {
      // Currency P2P
      if (order.type === 'buy') {
        setWalletBalance((prev) => prev + order.cryptoAmount);
      }
    }

    const newTx: Transaction = {
      id: `tx-p2p-${Date.now()}`,
      type: order.artwork ? 'p2p_art_sale' : order.type === 'buy' ? 'p2p_buy' : 'p2p_sell',
      artworkTitle: order.artwork?.title,
      amount: order.cryptoAmount || order.fiatAmount,
      currency: 'USDT',
      date: 'Just now',
      recipientOrSender: `P2P with ${order.merchant.name}`,
      status: 'confirmed',
    };
    setTransactions((prev) => [newTx, ...prev]);

    setActiveP2POrder(null);

    addNotification(
      '✅ P2P Escrow Released',
      order.artwork
        ? `"${order.artwork.title}" has been transferred to your vault!`
        : order.type === 'buy'
        ? `+${order.cryptoAmount} USDT released from escrow to your wallet!`
        : `Payment received! ${order.cryptoAmount} USDT released to buyer.`,
      'p2p'
    );
  };

  const cancelP2POrder = (orderId: string) => {
    if (!activeP2POrder || activeP2POrder.id !== orderId) return;

    if (activeP2POrder.type === 'sell' && !activeP2POrder.artwork) {
      setWalletBalance((prev) => prev + activeP2POrder.cryptoAmount);
    }

    setActiveP2POrder(null);
    addNotification('P2P Order Cancelled', 'Escrow returned to original vault.', 'p2p');
  };

  const createP2POffer = (offerData: Omit<P2POffer, 'id' | 'merchant' | 'isSmartEscrowLocked'>) => {
    const newOffer: P2POffer = {
      ...offerData,
      id: `p2p-usr-${Date.now()}`,
      merchant: {
        id: 'me',
        name: userProfile.name,
        legalName: `${userProfile.name} (Verified Patron)`,
        avatar: userProfile.avatar,
        ordersCompleted: 1,
        completionRate: 100,
        avgReleaseTimeMinutes: 1,
        verifiedMerchant: true,
        kycVerified: true,
        depositBondUSDT: 5000,
        positiveFeedbackPercent: 100,
        telegramHandle: userProfile.telegramHandle,
      },
      isSmartEscrowLocked: true,
      isBuyerProtected: true,
    };

    setP2pOffers((prev) => [newOffer, ...prev]);
    addNotification('📣 P2P Offer Published', `Your ad is live in the verified P2P book.`, 'p2p');
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
        createP2POffer,
        telegramViewMode,
        setTelegramViewMode,
        startBotAndOpenApp,
        addNotification,
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
