import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Artwork } from '../types';
import { ArtworkCanvas } from './ArtworkCanvas';
import { X, ArrowRightLeft, ShieldCheck, Check, AlertTriangle, Droplets } from 'lucide-react';

interface ConvertModalProps {
  artwork: Artwork;
  onClose: () => void;
}

export const ConvertModal: React.FC<ConvertModalProps> = ({ artwork, onClose }) => {
  const { convertArtwork } = useApp();
  const [isConverting, setIsConverting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Exact formula matching prompt example: value $24, fee $2, estimated $22 USDT
  const currentVal = artwork.currentValue;
  const protocolFee = 2.0;
  const estimatedPayout = Math.max(0, currentVal - protocolFee);

  const isEligible = artwork.conversionEligible && artwork.eligibleInteractions >= 500;

  const handleConvert = async () => {
    setIsConverting(true);
    const res = await convertArtwork(artwork, protocolFee);
    setIsConverting(false);
    if (res.success) {
      setIsSuccess(true);
      setTimeout(() => onClose(), 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4">
      <div
        className="w-full max-w-md bg-[#12121a] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-6 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
            <span className="text-xs uppercase tracking-widest font-mono text-stone-300">
              Convert Artwork to Crypto
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
              <h3 className="font-serif text-2xl text-stone-100">Conversion Complete</h3>
              <p className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">
                +${estimatedPayout.toFixed(2)} USDT has been credited directly to your crypto balance.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Artwork Preview Card */}
            <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/[0.03] border border-white/10 mb-5">
              <div className="w-16 h-20 rounded-xl overflow-hidden shrink-0 border border-white/10">
                <ArtworkCanvas artwork={artwork} showOverlayGrain={false} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-serif text-base text-stone-100 truncate">
                  {artwork.title}
                </h4>
                <p className="text-xs text-stone-400 truncate">
                  {artwork.creator.name}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-stone-400">Current Value:</span>
                  <span className="text-sm font-serif font-semibold text-stone-200">
                    ${currentVal}
                  </span>
                </div>
              </div>
            </div>

            {/* Eligibility & Liquidity Notice */}
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2 mb-5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Community Eligibility
                </span>
                <span className="font-medium text-emerald-400">
                  {isEligible ? 'Eligible (500+ interactions)' : 'Pending Community Quorum'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-400 flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                  Available Liquidity Pool
                </span>
                <span className="font-mono text-cyan-300 font-medium">
                  {artwork.conversionLiquidity} Depth
                </span>
              </div>
            </div>

            {/* Transparent Calculation Breakdown */}
            <div className="p-4 rounded-2xl bg-stone-900/60 border border-white/10 space-y-3 mb-5 text-xs">
              <div className="flex justify-between text-stone-400">
                <span>Community Value</span>
                <span className="font-mono text-stone-200">${currentVal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>Liquidity Pool Protocol Fee</span>
                <span className="font-mono text-stone-300">-${protocolFee.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-white/10 flex justify-between items-baseline font-medium text-stone-100">
                <span className="text-sm">Estimated Payout</span>
                <div className="text-right">
                  <span className="text-lg font-serif font-bold text-emerald-400 tabular-nums">
                    ${estimatedPayout.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-stone-400 ml-1 font-mono">USDT</span>
                </div>
              </div>
            </div>

            {/* Transparency Disclosure */}
            <div className="flex items-start gap-2 text-[11px] text-stone-400 mb-6 bg-white/[0.02] p-3 rounded-xl border border-white/5 leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Conversion depends on verified community eligibility and available liquidity. Once converted, your artwork certificate is retired back to the community treasury.
              </span>
            </div>

            {/* Action Button */}
            {isEligible ? (
              <button
                onClick={handleConvert}
                disabled={isConverting}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-stone-950 font-semibold text-sm transition-all shadow-lg shadow-emerald-500/10 active:scale-[0.98] disabled:opacity-50"
              >
                {isConverting
                  ? 'Executing Conversion...'
                  : `Convert Art → ${estimatedPayout.toFixed(2)} USDT`}
              </button>
            ) : (
              <button
                disabled
                className="w-full py-4 rounded-xl bg-white/5 text-stone-500 font-medium text-sm border border-white/5 cursor-not-allowed"
              >
                Requires 500 Eligible Interactions
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
