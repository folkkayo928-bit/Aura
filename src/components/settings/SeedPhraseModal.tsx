import React from 'react';
import { useApp } from '../../context/AppContext';
import { X, ShieldCheck } from 'lucide-react';

export const SeedPhraseModal: React.FC = () => {
  const { seedPhraseModalOpen, setSeedPhraseModalOpen } = useApp();
  if (!seedPhraseModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-md p-0 sm:p-4">
      <div className="w-full max-w-md bg-[#13131d] border border-cyan-500/20 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span className="text-xs uppercase tracking-widest font-mono text-stone-300">AURA Wallet Security</span>
          </div>
          <button onClick={() => setSeedPhraseModalOpen(false)} className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400 hover:text-stone-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 text-sm text-stone-200 leading-relaxed">
            <strong className="block text-cyan-300 mb-1">No seed phrase is stored by AURA</strong>
            Your AURA account uses secure account authentication and an internal ledger. AURA does not place a private seed phrase in the browser or database.
          </div>
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-xs text-stone-400 leading-relaxed space-y-2">
            <p>External wallets such as MetaMask, Phantom, or Tonkeeper keep their own recovery credentials.</p>
            <p>AURA will never ask you to paste a recovery phrase into the app.</p>
          </div>
          <button onClick={() => setSeedPhraseModalOpen(false)} className="w-full py-3.5 rounded-xl bg-stone-100 text-stone-950 font-bold text-xs">Done</button>
        </div>
      </div>
    </div>
  );
};