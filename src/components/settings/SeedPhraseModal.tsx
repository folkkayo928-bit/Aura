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
            <strong className="block text-cyan-300 mb-1">Your recovery phrase stays under your control</strong>
            AURA's personal EVM wallet creates or imports the phrase on your device and stores only an encrypted local copy protected by your wallet PIN. The phrase is never uploaded to AURA's database or server.
          </div>
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-xs text-stone-400 leading-relaxed space-y-2">
            <p>Your AURA login, Google sign-in and authenticator app protect your AURA account; they cannot recover or decrypt your wallet.</p>
            <p>Never share the phrase with anyone or paste it into support chats. If this device is lost, restore using your offline backup phrase.</p>
          </div>
          <button onClick={() => setSeedPhraseModalOpen(false)} className="w-full py-3.5 rounded-xl bg-stone-100 text-stone-950 font-bold text-xs">Done</button>
        </div>
      </div>
    </div>
  );
};