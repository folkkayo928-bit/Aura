import React from 'react';
import { useApp } from '../context/AppContext';
import { Artwork } from '../types';
import { Sparkles, Shield, Users, TrendingUp, X, Info } from 'lucide-react';

interface CommunityValueDrawerProps {
  artwork: Artwork;
  onClose: () => void;
}

export const CommunityValueDrawer: React.FC<CommunityValueDrawerProps> = ({ artwork, onClose }) => {
  const interactions = artwork.eligibleInteractions ?? 0;
  const nextMilestone = interactions < 500 
    ? 500 
    : Math.ceil(interactions / 500) * 500;
  
  const progressPercent = Math.min(100, Math.round((interactions / (nextMilestone || 500)) * 100));

  const origPrice = artwork.originalPrice || 1;
  const currVal = artwork.currentValue || origPrice;
  const appreciation = currVal - origPrice;
  const appreciationPercent = Math.round((appreciation / origPrice) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md transition-opacity p-0 sm:p-4">
      <div
        className="w-full max-w-lg bg-[#111118] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-8 duration-300 max-h-[90vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab Handle */}
        <div className="w-10 h-1 bg-stone-700 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-mono tracking-widest uppercase text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Community Value System
              </span>
            </div>
            <h3 className="font-serif text-2xl text-stone-100 font-normal">
              {artwork.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400 hover:text-stone-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Primary Value Card */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-stone-400 block mb-1">Original Price</span>
              <span className="text-xl font-serif text-stone-300 font-light">
                ${artwork.originalPrice} <span className="text-xs font-mono text-stone-400">USDT</span>
              </span>
            </div>
            <div>
              <span className="text-xs text-amber-300/80 block mb-1">Current Community Value</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-serif text-amber-300 font-medium">
                  ${artwork.currentValue}
                </span>
                <span className="text-xs font-mono text-emerald-400 font-medium">
                  +{appreciationPercent}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Core Rules Callout */}
        <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/20 mb-6">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-stone-300">
              <p className="font-semibold text-stone-200 mb-1">
                Organic Discovery Without Hype
              </p>
              <p className="text-stone-400">
                Community value evolves purely from genuine community appreciation. 
                Singular trades or solitary votes never alter price. A minimum of{' '}
                <span className="text-amber-300 font-medium">500 eligible interactions</span>{' '}
                is required before any periodic evaluation.
              </p>
            </div>
          </div>
        </div>

        {/* Interaction Metrics */}
        <div className="space-y-4 mb-6">
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-stone-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                Eligible Interactions
              </span>
              <span className="font-mono text-stone-200 font-medium tabular-nums">
                {(artwork.eligibleInteractions ?? 0).toLocaleString()} / {(nextMilestone ?? 500).toLocaleString()}
              </span>
            </div>
            {/* Progress Bar */}
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-stone-300 mt-1.5 flex items-center gap-1">
              <Info className="w-3 h-3 text-stone-300 shrink-0" />
              {artwork.eligibleInteractions >= 500
                ? 'Threshold met. Active community appraisal active.'
                : `${500 - artwork.eligibleInteractions} more community interactions needed for next evaluation tier.`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-[11px] text-stone-400 block mb-1">Community Interest</span>
              <span className="text-sm font-semibold text-stone-100 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                {artwork.interestLevel}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-[11px] text-stone-400 block mb-1">Verified Collectors</span>
              <span className="text-sm font-semibold text-stone-100 font-mono tabular-nums">
                {artwork.collectorsCount} vaults
              </span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-stone-100 font-medium text-sm transition-colors"
        >
          Close Inspector
        </button>
      </div>
    </div>
  );
};
