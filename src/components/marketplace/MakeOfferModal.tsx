import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Artwork } from '../../types';
import { ArtworkCanvas } from '../ArtworkCanvas';
import { X, Handshake, ShieldCheck, Check } from 'lucide-react';

interface MakeOfferModalProps {
  artwork: Artwork;
  onClose: () => void;
}

export const MakeOfferModal: React.FC<MakeOfferModalProps> = ({ artwork, onClose }) => {
  const { makeOfferOnArtwork, walletBalance } = useApp();
  const [offerPrice, setOfferPrice] = useState(
    ((artwork?.currentValue ?? 50) * 0.95).toFixed(2)
  );
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(offerPrice);
    if (isNaN(num) || num <= 0) return;

    setIsSubmitting(true);
    const ok = await makeOfferOnArtwork(artwork.id, num);
    setIsSubmitting(false);
    if (!ok) return;
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4">
      <div
        className="w-full max-w-md bg-[#12121a] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-6 max-h-[92vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Handshake className="w-4 h-4 text-blue-400" />
            <span className="text-xs uppercase tracking-widest font-mono text-stone-300">
              Make an Offer
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400 hover:text-stone-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30">
              <Check className="w-7 h-7" />
            </div>
            <h4 className="font-serif text-xl text-stone-100">Offer Submitted</h4>
            <p className="text-xs text-stone-400">
              Your offer of ${offerPrice} USDT was placed with smart escrow locking.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Item summary */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/10">
              <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
                <ArtworkCanvas artwork={artwork} showOverlayGrain={false} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] text-stone-400 font-mono block">
                  {artwork.collectionName || 'Collection'}
                </span>
                <h4 className="font-bold text-xs text-stone-100 truncate">{artwork.title}</h4>
                <div className="flex items-baseline gap-2 text-xs mt-1">
                  <span className="text-stone-500">Listed:</span>
                  <span className="font-serif font-bold text-stone-200">${artwork.currentValue} USDT</span>
                </div>
              </div>
            </div>

            {/* Offer Amount Input */}
            <div>
              <div className="flex justify-between text-xs text-stone-400 mb-1.5">
                <span>Your Offer Amount (USDT)</span>
                <span>Balance: ${walletBalance.toFixed(2)}</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-stone-100 font-mono focus:outline-none focus:border-blue-500/60"
                  required
                />
                <button
                  type="button"
                  onClick={() => setOfferPrice(((artwork?.currentValue ?? 50) * 0.9).toFixed(2))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-stone-300"
                >
                  -10%
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-stone-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Funds are only deducted if the owner accepts your offer. You can cancel at any time.</span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 rounded-xl bg-[#0088ff] hover:bg-[#0077ee] text-white font-bold text-xs transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]"
            >
              {isSubmitting ? 'Submitting…' : `Confirm Offer of ${offerPrice} USDT`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
