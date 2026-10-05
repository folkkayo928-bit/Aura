import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Artwork } from '../types';
import { ArtworkCanvas } from './ArtworkCanvas';
import { X, Check, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';

interface CollectModalProps {
  artwork: Artwork;
  onClose: () => void;
}

export const CollectModal: React.FC<CollectModalProps> = ({ artwork, onClose }) => {
  const { walletBalance, collectArtwork, setReceiveModalOpen } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const price = artwork.currentValue;
  const hasSufficientBalance = walletBalance >= price;
  const balanceAfter = Math.max(0, walletBalance - price);

  const handleConfirmCollect = async () => {
    setIsProcessing(true);
    try {
      const ok = await collectArtwork(artwork);
      if (ok) {
        setIsSuccess(true);
        setTimeout(() => onClose(), 1500);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4">
      <div
        className="w-full max-w-md bg-[#12121a] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-6 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs uppercase tracking-widest font-mono text-stone-300">
              Collect Masterpiece
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400 hover:text-stone-100"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center animate-bounce">
              <Check className="w-8 h-8 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-serif text-2xl text-stone-100">Welcome to Ownership</h3>
              <p className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">
                "{artwork.title}" has been transferred to your private digital vault. The ownership transfer was confirmed by the AURA backend.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Artwork Preview Card */}
            <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/[0.03] border border-white/10 mb-5">
              <div className="w-20 h-24 rounded-xl overflow-hidden shrink-0 border border-white/10">
                <ArtworkCanvas artwork={artwork} showOverlayGrain={false} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-amber-400/90 font-mono tracking-wider uppercase block">
                  {artwork.edition}
                </span>
                <h4 className="font-serif text-lg text-stone-100 truncate mt-0.5">
                  {artwork.title}
                </h4>
                <p className="text-xs text-stone-400 truncate mt-0.5">
                  by {artwork.creator.name}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-stone-300">Price:</span>
                  <span className="text-sm font-serif font-semibold text-amber-300">
                    ${price} USDT
                  </span>
                </div>
              </div>
            </div>

            {/* Transparent Cost Breakdown */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2.5 mb-5 text-xs">
              <div className="flex justify-between text-stone-400">
                <span>Wallet Balance</span>
                <span className="font-mono text-stone-200 tabular-nums">
                  ${walletBalance.toFixed(2)} USDT
                </span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>Artwork Price</span>
                <span className="font-mono text-stone-200 tabular-nums">
                  -${price.toFixed(2)} USDT
                </span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>Network Fee</span>
                <span className="font-mono text-emerald-400">Not applicable · AURA ledger</span>
              </div>
              <div className="pt-2 border-t border-white/5 flex justify-between font-medium text-stone-200">
                <span>Remaining Balance</span>
                <span className="font-mono text-amber-300 tabular-nums">
                  ${balanceAfter.toFixed(2)} USDT
                </span>
              </div>
            </div>

            {/* Telegram Mini App & Vault Guarantee */}
            <div className="flex items-center gap-2 text-[11px] text-stone-300 mb-6 bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Ownership is recorded by the AURA backend after the transaction is confirmed.</span>
            </div>

            {/* Action Buttons */}
            {hasSufficientBalance ? (
              <button
                onClick={handleConfirmCollect}
                disabled={isProcessing}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-semibold text-sm transition-all shadow-lg shadow-amber-500/10 active:scale-[0.98] disabled:opacity-50"
              >
                {isProcessing ? 'Minting Ownership...' : `Confirm & Collect · $${price} USDT`}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/30 border border-rose-500/20 text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Insufficient USDT. Top up ${(price - walletBalance).toFixed(2)} to collect.
                  </span>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    setReceiveModalOpen(true);
                  }}
                  className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-stone-950 font-semibold text-sm transition-colors"
                >
                  Open Deposit Options
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
