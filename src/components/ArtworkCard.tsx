import React from 'react';
import { useApp } from '../context/AppContext';
import { Artwork } from '../types';
import { ArtworkCanvas } from './ArtworkCanvas';
import { Heart, Flame, Bookmark, Sparkles, CheckCircle2, ShoppingBag, Star, ThumbsDown } from 'lucide-react';

interface ArtworkCardProps {
  artwork: Artwork;
  onOpenDetail: (artwork: Artwork) => void;
}

export const ArtworkCard: React.FC<ArtworkCardProps> = ({ artwork, onOpenDetail }) => {
  const {
    toggleLike,
    toggleDislike,
    toggleLove,
    toggleSave,
    toggleWatchlist,
    setCollectModalArtwork,
    setCommunityDrawerArtwork,
    collections,
    setSelectedCollection,
  } = useApp();

  const handleCollectionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (artwork.collectionId) {
      const match = collections.find((c) => c.id === artwork.collectionId);
      if (match) setSelectedCollection(match);
    } else if (artwork.collectionName) {
      const match = collections.find(
        (c) => c.name.toLowerCase() === artwork.collectionName?.toLowerCase()
      );
      if (match) setSelectedCollection(match);
    }
  };

  return (
    <article className="group relative bg-[#0e0e14] rounded-3xl border border-white/5 overflow-hidden transition-all duration-300 hover:border-white/15">
      {/* Creator & Collection Bar */}
      <div className="flex items-center justify-between px-4 py-3.5 bg-gradient-to-b from-[#12121b] to-transparent">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={artwork.creator.avatar}
            alt={artwork.creator.name}
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-stone-200 truncate">
                {artwork.creator.name}
              </span>
              {artwork.creator.verified && (
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 fill-amber-400/20" />
              )}
            </div>
            {artwork.collectionName ? (
              <button
                onClick={handleCollectionClick}
                className="text-[11px] text-blue-400 hover:underline font-mono block truncate text-left"
              >
                {artwork.collectionName}
              </button>
            ) : (
              <span className="text-[11px] text-stone-400 font-mono block truncate">
                {artwork.creator.handle}
              </span>
            )}
          </div>
        </div>

        {/* Watchlist Star & Edition Label */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => toggleWatchlist(artwork.id)}
            className={`p-1.5 rounded-full transition-colors ${
              artwork.isWatched ? 'text-amber-400' : 'text-stone-500 hover:text-stone-300'
            }`}
            title={artwork.isWatched ? 'Remove from Watchlist' : 'Add to Watchlist'}
          >
            <Star className={`w-4 h-4 ${artwork.isWatched ? 'fill-amber-400' : ''}`} />
          </button>
          <div className="text-[11px] font-mono text-stone-400 tracking-wider">
            {artwork.edition}
          </div>
        </div>
      </div>

      {/* Hero Visual Area - Tap to view full artwork */}
      <div
        onClick={() => onOpenDetail(artwork)}
        className="relative aspect-[3/4] w-full cursor-pointer overflow-hidden bg-black"
        role="button"
        tabIndex={0}
        aria-label={`View ${artwork.title}`}
      >
        <ArtworkCanvas artwork={artwork} />

        {/* Hover / Ambient Light Glow */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />

        {/* Bottom Title & Value Over Picture */}
        <div className="absolute bottom-3 inset-x-4 pointer-events-none">
          <span className="text-[11px] tracking-widest uppercase font-mono text-amber-300/90 block mb-0.5">
            {artwork.category}
          </span>
          <h3 className="font-serif text-2xl text-stone-100 font-normal leading-tight drop-shadow-md">
            {artwork.title}
          </h3>

          <div className="flex items-baseline justify-between mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-stone-300">Community Value</span>
              <span className="font-serif text-xl font-medium text-stone-100 tabular-nums">
                ${artwork.currentValue}
              </span>
              <span className="text-[10px] font-mono text-stone-300">
                (Orig. ${artwork.originalPrice})
              </span>
            </div>
            {artwork.isOwned && (
              <span className="text-[11px] font-mono text-emerald-400 font-medium bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                In Vault
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Community Value Status Indicator (Non-pill interactive strip) */}
      <div
        onClick={() => setCommunityDrawerArtwork(artwork)}
        className="px-4 py-2 bg-white/[0.02] border-t border-white/5 flex items-center justify-between text-xs cursor-pointer hover:bg-white/[0.04] transition-colors"
      >
        <div className="flex items-center gap-1.5 text-stone-300">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-medium text-stone-300">
            {(artwork.eligibleInteractions ?? 0).toLocaleString()} eligible interactions
          </span>
        </div>
        <div className="text-[11px] text-stone-300 flex items-center gap-1.5">
          <span>Interest:</span>
          <span className="font-semibold text-emerald-400">{artwork.interestLevel}</span>
        </div>
      </div>

      {/* Action Footer: Like, Love, Save, Collect */}
      <div className="px-4 py-3 bg-[#0e0e14] border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Like Button */}
          <button
            onClick={() => toggleLike(artwork.id)}
            className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-100 min-h-[44px] transition-colors group/btn"
            aria-label="Like"
          >
            <Heart
              className={`w-4 h-4 transition-transform group-hover/btn:scale-110 ${
                artwork.isLiked
                  ? 'fill-rose-500 text-rose-500'
                  : 'text-stone-400'
              }`}
            />
            <span className="font-mono tabular-nums text-[11px] text-stone-400">
              {artwork.likes}
            </span>
          </button>

          {/* Dislike Button */}
          <button
            onClick={() => toggleDislike(artwork.id)}
            className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-100 min-h-[44px] transition-colors group/btn"
            aria-label="Dislike"
          >
            <ThumbsDown className={`w-4 h-4 transition-transform group-hover/btn:scale-110 ${artwork.isDisliked ? 'fill-stone-300 text-stone-300' : 'text-stone-400'}`} />
            <span className="font-mono tabular-nums text-[11px] text-stone-400">
              {artwork.dislikes}
            </span>
          </button>

          {/* Love Button */}
          <button
            onClick={() => toggleLove(artwork.id)}
            className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-100 min-h-[44px] transition-colors group/btn"
            aria-label="Love"
          >
            <Flame
              className={`w-4 h-4 transition-transform group-hover/btn:scale-110 ${
                artwork.isLoved
                  ? 'fill-amber-500 text-amber-500'
                  : 'text-stone-400'
              }`}
            />
            <span className="font-mono tabular-nums text-[11px] text-stone-400">
              {artwork.loves}
            </span>
          </button>

          {/* Save Button */}
          <button
            onClick={() => toggleSave(artwork.id)}
            className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-100 min-h-[44px] transition-colors group/btn"
            aria-label="Save"
          >
            <Bookmark
              className={`w-4 h-4 transition-transform group-hover/btn:scale-110 ${
                artwork.isSaved
                  ? 'fill-cyan-400 text-cyan-400'
                  : 'text-stone-400'
              }`}
            />
            <span className="font-mono tabular-nums text-[11px] text-stone-400">
              {artwork.saves}
            </span>
          </button>
        </div>

        {/* Primary Collect Action */}
        {artwork.isOwned ? (
          <button
            onClick={() => onOpenDetail(artwork)}
            className="px-3.5 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 rounded-xl hover:bg-emerald-950/60 transition-colors"
          >
            Vault Piece
          </button>
        ) : (
          <button
            onClick={() => setCollectModalArtwork(artwork)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-amber-400 hover:text-stone-950 text-stone-100 font-medium text-xs transition-all active:scale-95"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Collect · ${artwork.currentValue}</span>
          </button>
        )}
      </div>
    </article>
  );
};
