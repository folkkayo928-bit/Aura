import React from 'react';
import { useApp } from '../../context/AppContext';
import { ArtworkCanvas } from '../ArtworkCanvas';
import {
  Star,
  ShoppingBag,
  TrendingUp,
  Layers,
  ChevronRight,
  Handshake,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

interface WatchlistViewProps {
  onOpenArtworkDetail: (art: any) => void;
  onOpenCollection: (col: any) => void;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  onOpenArtworkDetail,
  onOpenCollection,
}) => {
  const {
    artworks,
    collections,
    toggleWatchlist,
    toggleCollectionWatchlist,
    quickBuyArtwork,
    setMakeOfferArtwork,
    setActiveTab,
  } = useApp();

  const watchedArtworks = artworks.filter((a) => a.published !== false && a.isWatched);
  const watchedCollections = collections.filter((c) => c.isWatched);

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="pt-2 px-1">
        <div className="flex items-center gap-2 mb-1 text-xs font-mono uppercase tracking-widest text-amber-400">
          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          <span>Tracked Portfolio</span>
        </div>
        <h2 className="font-serif text-3xl text-stone-100 font-light">
          Your Watchlist
        </h2>
        <p className="text-xs text-stone-400 mt-1">
          Real-time price feeds, floor prices, and 1-tap quick buy for your favorited NFT items and collections.
        </p>
      </div>

      {/* WATCHLISTED COLLECTIONS */}
      <div className="space-y-3 px-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-stone-400 uppercase tracking-wider">
            Watched Collections ({watchedCollections.length})
          </span>
          <span className="text-stone-500 font-mono text-[10px]">Live Floor Feeds</span>
        </div>

        {watchedCollections.length === 0 ? (
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-stone-500 text-center">
            No collections in your watchlist yet. Tap the star icon on any collection to track its floor price.
          </div>
        ) : (
          <div className="space-y-2">
            {watchedCollections.map((col) => (
              <div
                key={col.id}
                onClick={() => onOpenCollection(col)}
                className="p-3.5 rounded-2xl bg-[#111119] border border-white/5 hover:border-amber-400/40 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={col.avatar}
                    alt={col.name}
                    className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-stone-100 truncate">{col.name}</span>
                      {col.verified && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      )}
                    </div>
                    <span className="text-[11px] text-stone-400 font-mono block">
                      {(col.itemsCount ?? 0).toLocaleString()} items
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] text-stone-500 font-mono block">Floor</span>
                    <span className="font-serif font-bold text-sm text-stone-200 tabular-nums">
                      ${(col.floorPriceUSDT ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollectionWatchlist(col.id);
                    }}
                    className="p-1.5 text-amber-400 hover:text-stone-400"
                  >
                    <Star className="w-4 h-4 fill-amber-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* WATCHLISTED NFT ITEMS */}
      <div className="space-y-3 px-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-stone-400 uppercase tracking-wider">
            Watched Items ({watchedArtworks.length})
          </span>
          <span className="text-stone-500 font-mono text-[10px]">Instant Action</span>
        </div>

        {watchedArtworks.length === 0 ? (
          <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/5 text-center space-y-2">
            <Star className="w-8 h-8 text-stone-600 mx-auto" />
            <h4 className="text-sm font-serif text-stone-300">Your item watchlist is empty</h4>
            <p className="text-xs text-stone-500 max-w-xs mx-auto">
              Tap the star icon on any artwork in the marketplace or gallery to track it here.
            </p>
            <button
              onClick={() => setActiveTab('discover')}
              className="px-4 py-2 bg-amber-400 text-stone-950 font-bold text-xs rounded-xl mt-1"
            >
              Browse Marketplace
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {watchedArtworks.map((item) => (
              <div
                key={item.id}
                onClick={() => onOpenArtworkDetail(item)}
                className="group cursor-pointer rounded-2xl bg-[#111119] border border-white/5 hover:border-amber-400/40 overflow-hidden transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="relative aspect-square w-full bg-black">
                    <ArtworkCanvas artwork={item} showOverlayGrain={false} />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWatchlist(item.id);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur-md text-amber-400"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                    </button>
                  </div>

                  <div className="p-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-stone-100 truncate">{item.title}</span>
                      {item.rarityRank && (
                        <span className="text-[10px] font-mono text-stone-400">
                          #{item.rarityRank}
                        </span>
                      )}
                    </div>
                    <div className="font-serif text-sm font-bold text-stone-200">
                      ${(item.currentValue ?? 0).toLocaleString()} USDT
                    </div>
                  </div>
                </div>

                <div className="p-3 pt-0 flex gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMakeOfferArtwork(item);
                    }}
                    className="flex-1 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[11px] font-semibold text-stone-300 transition-colors"
                  >
                    Offer
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      quickBuyArtwork(item);
                    }}
                    className="flex-1 py-1.5 rounded-xl bg-[#0088ff] hover:bg-[#0077ee] text-[11px] font-bold text-white transition-colors"
                  >
                    Buy
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
