export type ArtworkCategory = 'generative' | 'sculpture' | 'minimalist' | 'kinetic' | 'botanical' | 'cyber' | 'anime_pfp' | 'brand_streetwear' | 'ui_design' | 'gif_animation';

export type FeedSection = 'trending' | 'rising' | 'new' | 'loved' | 'recommended' | 'watchlist' | 'drops';

export type CryptoNetwork = 'ton' | 'polygon' | 'ethereum' | 'arbitrum' | 'solana';

export type MediaType = 'image' | 'gif' | 'video' | 'ui_design' | '3d' | 'brand_streetwear';

export interface Creator {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  verified: boolean;
  bio: string;
  totalPieces: number;
  totalCollectors: number;
}

export interface ArtworkComment {
  id: string;
  userName: string;
  userAvatar: string;
  text: string;
  timestamp: string;
}

export interface NFTTrait {
  trait_type: string;
  value: string;
  rarityPercent?: number;
}

export interface Artwork {
  id: string;
  title: string;
  edition: string;
  creator: Creator;
  visualTheme: 'obsidian_ribbons' | 'bioluminescent_bloom' | 'liquid_chrome' | 'brutalist_void' | 'quantum_lattice' | 'aurora_silk' | 'custom_upload';
  accentColor: string;
  description: string;
  medium: string;
  dimensions: string;
  originalPrice: number; // in USDT
  currentValue: number;
  valuationMode?: 'market' | 'community';
  dislikes?: number;
  communityValue?: number;
  purchasePrice?: number;
  isOwned?: boolean;
  eligibleInteractions: number;
  interestLevel: 'High' | 'Surging' | 'Rising' | 'Steady' | 'Not reported';
  interestScore: number;
  likes: number;
  loves: number;
  saves: number;
  collectorsCount: number;
  collectors: { id: string; name: string; avatar: string }[];
  isLiked?: boolean;
  isDisliked?: boolean;
  isLoved?: boolean;
  isSaved?: boolean;
  isWatched?: boolean; // Watchlist star
  createdDate: string;
  category: ArtworkCategory;
  mediaType?: MediaType;
  customMediaUrl?: string; // For uploaded GIFs, photos, UI designs, brand streetwear
  collectionId?: string;
  collectionName?: string;
  tokenId?: string; // e.g. #8781
  rarityRank?: number; // e.g. 7925
  traits?: NFTTrait[];
  topOfferUSDT?: number;
  conversionEligible: boolean;
  conversionLiquidity: 'Ample' | 'Moderate' | 'Limited' | 'Not reported';
  // P2P Direct Art Sale
  isListedOnP2P?: boolean;
  published?: boolean;
  scheduledAt?: string;
  p2pPriceFiat?: number;
  p2pCurrency?: 'USD' | 'EUR' | 'GBP';
  p2pPaymentMethods?: PaymentMethodType[];
  comments: ArtworkComment[];
}

export interface NFTCollection {
  id: string;
  creatorId?: string;
  name: string;
  slug: string;
  avatar: string;
  banner: string;
  verified: boolean;
  floorPriceUSDT: number;
  totalVolumeUSDT: number;
  itemsCount: number;
  ownersCount: number;
  description: string;
  category: ArtworkCategory;
  isWatched: boolean;
  websiteUrl?: string;
  discordUrl?: string;
  telegramUrl?: string;
}

export interface UpcomingDrop {
  id: string;
  title: string;
  collectionName: string;
  creator: Creator;
  banner: string;
  avatar: string;
  mintDate: string;
  mintTimestamp: number; // For countdown timer
  mintPriceUSDT: number;
  supply: number;
  mintedSoFar: number;
  whitelistOpen: boolean;
  category: string;
  isReminded: boolean;
  description: string;
  perks: string[];
}

export interface Transaction {
  id: string;
  type: 'collect' | 'convert' | 'receive' | 'send' | 'create' | 'p2p_buy' | 'p2p_sell' | 'p2p_art_sale';
  artworkTitle?: string;
  amount: number;
  currency: 'USDT' | 'ART' | 'TON' | 'MATIC';
  date: string;
  recipientOrSender?: string;
  status: 'confirmed' | 'processing' | 'pending' | 'failed';
  network?: CryptoNetwork;
  txHash?: string;
  isExternal?: boolean;
}

export interface TelegramNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'collect' | 'convert' | 'value_surge' | 'community' | 'p2p' | 'external_tx' | 'drop_alert' | 'wallet';
}

// Trusted P2P Protection Types
export type PaymentMethodType =
  | 'telegram_pay'
  | 'revolut'
  | 'bank_transfer'
  | 'wise'
  | 'cashapp'
  | 'crypto_ton'
  | 'zelle'
  | 'paypal'
  | 'apple_pay'
  | 'venmo'
  | (string & {});

export interface P2PMerchant {
  id: string;
  name: string;
  legalName: string;
  avatar: string;
  ordersCompleted: number;
  completionRate: number; // e.g. 99.8%
  avgReleaseTimeMinutes: number;
  verifiedMerchant: boolean;
  kycVerified: boolean;
  depositBondUSDT: number;
  telegramHandle: string;
  positiveFeedbackPercent: number;
}

export interface P2POffer {
  id: string;
  type: 'buy' | 'sell';
  merchant: P2PMerchant;
  pricePerUnit: number;
  fiatCurrency: 'ETB' | 'USD' | 'EUR' | 'GBP' | 'AED';
  availableCrypto: number;
  minLimitFiat: number;
  maxLimitFiat: number;
  paymentMethods: PaymentMethodType[];
  paymentInstructions?: string;
  isSmartEscrowLocked: boolean;
  isBuyerProtected: boolean;
  // If offer is for an artwork
  artworkId?: string;
  artworkTitle?: string;
  artworkImage?: string;
}

export interface P2PChatMessage {
  id: string;
  sender: 'buyer' | 'merchant' | 'system';
  senderName: string;
  text: string;
  timestamp: string;
}

export interface P2POrder {
  id: string;
  offerId: string;
  type: 'buy' | 'sell';
  buyerId?: string;
  sellerId?: string;
  merchant: P2PMerchant;
  cryptoAmount: number;
  fiatAmount: number;
  fiatCurrency: string;
  paymentMethod: PaymentMethodType;
  status: 'escrow_locked' | 'payment_marked' | 'completed' | 'cancelled' | 'in_dispute';
  escrowTxHash: string;
  createdAt: string;
  acceptedAt?: string;
  expiresAt?: string;
  protectionFundActive: boolean;
  artwork?: {
    id: string;
    title: string;
    image: string;
  };
  paymentDetails: {
    accountName: string;
    accountNumberOrId: string;
    referenceCode: string;
  };
  chatMessages: P2PChatMessage[];
}

export interface ConnectedExternalWallet {
  id: string;
  name: 'Tonkeeper' | 'MetaMask' | 'Phantom' | 'Trust Wallet';
  network: CryptoNetwork;
  address: string;
  connectedAt: string;
  balance: number;
}

export type TelegramViewMode = 'bot_profile' | 'bot_chat' | 'miniapp';
export type AppTab = 'home' | 'discover' | 'create' | 'wallet' | 'profile' | 'p2p_trade';
