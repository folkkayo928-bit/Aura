import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, ShieldAlert, Copy, Check, Eye, EyeOff } from 'lucide-react';

export const SeedPhraseModal: React.FC = () => {
  const { seedPhraseModalOpen, setSeedPhraseModalOpen, vaultAddresses } = useApp();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!seedPhraseModalOpen) return null;

  const words = vaultAddresses.seedPhrase.split(' ');

  const handleCopy = () => {
    navigator.clipboard?.writeText(vaultAddresses.seedPhrase);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-md p-0 sm:p-4">
      <div
        className="w-full max-w-md bg-[#13131d] border border-amber-500/30 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-6 max-h-[92vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span className="text-xs uppercase tracking-widest font-mono text-stone-300">
              Vault Recovery Phrase
            </span>
          </div>
          <button
            onClick={() => {
              setSeedPhraseModalOpen(false);
              setRevealed(false);
            }}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400 hover:text-stone-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed">
            <strong className="block text-amber-300 mb-1">Non-Custodial Ownership Key</strong>
            These 12 words allow you to restore your digital art collection and crypto balances in any external Web3 wallet (such as Tonkeeper, Trust Wallet, or MetaMask). Never disclose them to anyone.
          </div>

          {/* Seed Words Grid */}
          <div className="relative p-4 rounded-2xl bg-black/60 border border-white/10">
            <div className={`grid grid-cols-3 gap-2 ${!revealed ? 'filter blur-sm select-none' : ''}`}>
              {words.map((word, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-xl bg-white/5 border border-white/5 text-center font-mono text-xs text-stone-200"
                >
                  <span className="text-[10px] text-stone-500 mr-1.5">{idx + 1}.</span>
                  <span>{word}</span>
                </div>
              ))}
            </div>

            {!revealed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-2xl p-4">
                <p className="text-xs text-stone-300 mb-3 font-medium">Click to unhide secret words</p>
                <button
                  onClick={() => setRevealed(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 text-stone-950 font-bold text-xs hover:bg-amber-300 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Reveal Phrase</span>
                </button>
              </div>
            )}
          </div>

          {revealed && (
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-stone-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied to Clipboard' : 'Copy All Words'}</span>
              </button>
              <button
                onClick={() => setRevealed(false)}
                className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-stone-400 text-xs flex items-center justify-center"
                title="Hide words"
              >
                <EyeOff className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            onClick={() => {
              setSeedPhraseModalOpen(false);
              setRevealed(false);
            }}
            className="w-full py-3.5 rounded-xl bg-stone-100 text-stone-950 font-bold text-xs"
          >
            I Have Saved My Seed Phrase
          </button>
        </div>
      </div>
    </div>
  );
};
