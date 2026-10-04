import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Artwork } from '../types';
import { ArtworkCanvas } from './ArtworkCanvas';
import {
  X,
  Heart,
  Flame,
  Bookmark,
  Share2,
  Sparkles,
  ShoppingBag,
  ArrowRightLeft,
  Send,
  CheckCircle2,
  Users,
  Calendar,
  Maximize2,
  ArrowUpDown,
  Handshake,
} from 'lucide-react';

interface ArtworkModalProps {
  artwork: Artwork;
  onClose: () => void;
}

export const ArtworkModal: React.FC<ArtworkModalProps> = ({ artwork, onClose }) => {
  const {
    toggleLike,
    toggleLove,
    toggleSave,
    addComment,
    setCollectModalArtwork,
    setConvertModalArtwork,
    setCommunityDrawerArtwork,
    setSellArtworkP2PModal,
    setMakeOfferArtwork,
    setP2pModalOpen,
  } = useApp();

  const [commentText, setCommentText] = useState('');
  const [isZoomed, setIsZoomed] = useState(false);

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addComment(artwork.id, commentText);
    setCommentText('');
  };

  const appreciation = artwork.currentValue - artwork.originalPrice;
  const appreciationPercent = Math.round((appreciation / artwork.originalPrice) * 100);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#09090d]/95 backdrop-blur-2xl flex flex-col no-scrollbar">
      {/* Top Floating Utility Bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-[#09090d]/80 backdrop-blur-md border-b border-white/5">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-stone-400 hover:text-stone-100 text-xs font-mono uppercase tracking-wider py-1.5 px-2 rounded-lg bg-white/5 border border-white/5"
        >
          <X className="w-4 h-4" />
          <span>Close</span>
        </button>

        <span className="text-[11px] font-mono text-stone-300 uppercase tracking-widest truncate max-w-[160px]">
          {artwork.edition}
        </span>

        <button
          onClick={() => {
            navigator.clipboard?.writeText(window.location.href);
          }}
          className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400 hover:text-stone-100"
          title="Share Masterpiece link"
          aria-label="Share"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      <div className="max-w-xl mx-auto w-full px-4 pt-2 pb-28 space-y-6">
        {/* HERO ARTWORK VIEWER */}
        <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-black aspect-[3/4] shadow-2xl group">
          <ArtworkCanvas artwork={artwork} />

          {/* Zoom toggle button */}
          <button
            onClick={() => setIsZoomed(!isZoomed)}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-black/60 backdrop-blur-md text-stone-300 hover:text-white border border-white/10 transition-transform active:scale-95"
            title="Inspect Canvas"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* TITLE & ARTIST HERO STRIP */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest font-mono text-amber-300">
              {artwork.category} · {artwork.medium}
            </span>
            <span className="text-xs text-stone-300 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {artwork.createdDate}
            </span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl text-stone-100 font-normal leading-tight">
            {artwork.title}
          </h1>

          {/* Creator Profile Lockup */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
            <div className="flex items-center gap-3">
              <img
                src={artwork.creator.avatar}
                alt={artwork.creator.name}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-full object-cover border border-white/10"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-stone-100">
                    {artwork.creator.name}
                  </span>
                  {artwork.creator.verified && (
                    <CheckCircle2 className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                  )}
                </div>
                <span className="text-xs text-stone-300 font-mono block">
                  {artwork.creator.handle}
                </span>
              </div>
            </div>
            <div className="text-right text-[11px] text-stone-300 font-mono">
              <div>{artwork.creator.totalPieces} Works</div>
              <div>{artwork.creator.totalCollectors} Collectors</div>
            </div>
          </div>
          <p className="text-xs text-stone-300 leading-relaxed italic pl-1">
            "{artwork.creator.bio}"
          </p>
        </div>

        {/* PRICING & COMMUNITY VALUE CARD */}
        <div className="p-5 rounded-3xl bg-[#13131b] border border-white/10 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-stone-300 block mb-1">Current Community Value</span>
              <div className="flex items-baseline gap-2.5">
                <span className="font-serif text-3xl text-stone-100 font-semibold">
                  ${artwork.currentValue}
                </span>
                <span className="text-xs font-mono text-emerald-400 font-medium">
                  +{appreciationPercent}%
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-stone-300 block mb-1">Original Issue Price</span>
              <span className="text-sm font-mono text-stone-400">
                ${artwork.originalPrice} USDT
              </span>
            </div>
          </div>

          {/* Interactive Community Value trigger */}
          <button
            onClick={() => setCommunityDrawerArtwork(artwork)}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/5 transition-colors text-xs"
          >
            <div className="flex items-center gap-2 text-stone-200">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{(artwork.eligibleInteractions ?? 0).toLocaleString()} eligible interactions</span>
            </div>
            <span className="font-semibold text-emerald-400 flex items-center gap-1">
              Interest: {artwork.interestLevel} →
            </span>
          </button>
        </div>

        {/* ARTWORK STATEMENT & SPECIFICATIONS */}
        <div className="space-y-2 text-xs leading-relaxed text-stone-300">
          <h4 className="text-xs font-mono uppercase tracking-widest text-stone-300">
            Curatorial Statement
          </h4>
          <p className="text-stone-300 text-sm leading-relaxed font-light">
            {artwork.description}
          </p>
          <div className="pt-2 text-stone-400 font-mono text-[11px]">
            Resolution: {artwork.dimensions}
          </div>
        </div>

        {/* VERIFIED COLLECTORS STRIP */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              Verified Collectors ({artwork.collectorsCount})
            </span>
            <span className="text-stone-300 font-mono text-[11px]">
              Provenance Verified
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {artwork.collectors.length > 0 ? (
              artwork.collectors.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 pr-3 py-1 pl-1 bg-white/5 rounded-full border border-white/5 shrink-0"
                >
                  <img
                    src={c.avatar}
                    alt={c.name}
                    referrerPolicy="no-referrer"
                    className="w-6 h-6 rounded-full object-cover"
                  />
                  <span className="text-[11px] text-stone-300 truncate max-w-[100px]">
                    {c.name}
                  </span>
                </div>
              ))
            ) : (
              <span className="text-xs text-stone-300 italic">
                Be the first patron to vault this edition.
              </span>
            )}
          </div>
        </div>

        {/* COMMENTS THREAD */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
          <h4 className="text-xs font-mono uppercase tracking-widest text-stone-400">
            Collector Discourse ({artwork.comments.length})
          </h4>

          {/* Add Comment Form */}
          <form onSubmit={handlePostComment} className="flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Share an impression on this work..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-stone-200 placeholder:text-stone-400 focus:outline-none focus:border-amber-400/50"
            />
            <button
              type="submit"
              disabled={!commentText.trim()}
              className="px-4 py-2.5 bg-amber-400 text-stone-950 rounded-xl font-medium text-xs disabled:opacity-40 hover:bg-amber-300 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Comments List */}
          <div className="space-y-3">
            {artwork.comments.map((comment) => (
              <div key={comment.id} className="text-xs space-y-1 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between text-stone-400 text-[11px]">
                  <span className="font-semibold text-stone-200">{comment.userName}</span>
                  <span className="text-stone-400">{comment.timestamp}</span>
                </div>
                <p className="text-stone-300 leading-relaxed">{comment.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FIXED BOTTOM ACTION BAR */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-[#09090d]/90 backdrop-blur-xl border-t border-white/10 p-3 pb-safe">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          {/* Reaction Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleLike(artwork.id)}
              className="p-3 rounded-xl bg-white/5 border border-white/5 text-stone-300 hover:text-rose-400 transition-colors flex items-center gap-1.5"
              title="Like"
            >
              <Heart
                className={`w-4 h-4 ${
                  artwork.isLiked ? 'fill-rose-500 text-rose-500' : ''
                }`}
              />
              <span className="text-xs font-mono">{artwork.likes}</span>
            </button>
            <button
              onClick={() => toggleLove(artwork.id)}
              className="p-3 rounded-xl bg-white/5 border border-white/5 text-stone-300 hover:text-amber-400 transition-colors flex items-center gap-1.5"
              title="Love"
            >
              <Flame
                className={`w-4 h-4 ${
                  artwork.isLoved ? 'fill-amber-500 text-amber-500' : ''
                }`}
              />
              <span className="text-xs font-mono">{artwork.loves}</span>
            </button>
            <button
              onClick={() => toggleSave(artwork.id)}
              className="p-3 rounded-xl bg-white/5 border border-white/5 text-stone-300 hover:text-cyan-400 transition-colors"
              title="Save"
            >
              <Bookmark
                className={`w-4 h-4 ${
                  artwork.isSaved ? 'fill-cyan-400 text-cyan-400' : ''
                }`}
              />
            </button>
          </div>

          {/* Primary Action Buttons */}
          {artwork.isOwned ? (
            <div className="flex-1 flex items-center gap-2">
              <button
                onClick={() => setConvertModalArtwork(artwork)}
                className="flex-1 py-3 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-stone-950 font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/10 active:scale-[0.98]"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Convert to USDT (${Math.max(0, artwork.currentValue - 2)})</span>
              </button>

              <button
                onClick={() => setSellArtworkP2PModal(artwork)}
                className="flex-1 py-3 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-bold text-xs transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>{artwork.isListedOnP2P ? 'Update P2P Ad' : 'Sell on P2P Cash'}</span>
              </button>
            </div>
          ) : (
            <div className="flex-1 flex items-center gap-2">
              <button
                onClick={() => setMakeOfferArtwork(artwork)}
                className="py-3 px-3 rounded-xl bg-[#1e1e28] hover:bg-[#252535] text-stone-200 font-bold text-xs transition-all border border-white/10 active:scale-[0.98] flex items-center justify-center gap-1"
              >
                <Handshake className="w-3.5 h-3.5 text-blue-400" />
                <span>Offer</span>
              </button>

              <button
                onClick={() => setCollectModalArtwork(artwork)}
                className="flex-1 py-3 px-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10 active:scale-[0.98]"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Collect · ${artwork.currentValue} USDT</span>
              </button>

              {artwork.isListedOnP2P && (
                <button
                  onClick={() => {
                    onClose();
                    setP2pModalOpen(true);
                  }}
                  className="py-3 px-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-[11px] transition-all flex items-center justify-center gap-1"
                  title="Buy directly for Fiat Cash with P2P Escrow"
                >
                  <ArrowUpDown className="w-3 h-3 text-emerald-400" />
                  <span>P2P Cash</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
