import React from 'react';
import { useApp } from '../context/AppContext';
import { Wallet, Smartphone, Settings, ArrowLeftRight, MessageCircle } from 'lucide-react';

export const Header: React.FC = () => {
  const {
    walletBalance,
    setActiveTab,
    activeTab,
    isTelegramShellMode,
    setIsTelegramShellMode,
    setSettingsModalOpen,
    setP2pModalOpen,
    activeP2POrder,
    setTelegramViewMode,
  } = useApp();

  return (
    <header className="sticky top-0 z-30 bg-[#09090d]/85 backdrop-blur-md border-b border-white/5 px-4 h-14 flex items-center justify-between transition-colors">
      {/* Zone 1: Single text element wordmark */}
      <button
        onClick={() => setActiveTab('home')}
        className="flex items-center gap-2 group text-left"
      >
        <span className="font-serif text-2xl tracking-[0.2em] font-light text-stone-100 group-hover:text-amber-200 transition-colors uppercase">
          Aura
        </span>
        <span className="hidden sm:inline-block text-[10px] uppercase tracking-widest text-stone-400 font-mono">
          · Vault
        </span>
      </button>

      {/* Zone 2: Navigation & Quick P2P indicator */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setP2pModalOpen(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-all ${
            activeP2POrder
              ? 'border-amber-400/60 bg-amber-400/20 text-amber-300 font-bold animate-pulse'
              : 'border-white/10 bg-white/5 text-stone-300 hover:text-white hover:bg-white/10'
          }`}
          title="Binance-style P2P Escrow Desk"
        >
          <ArrowLeftRight className="w-3 h-3 text-emerald-400" />
          <span className="text-[11px] font-medium hidden xs:inline">
            {activeP2POrder ? 'Escrow Active' : 'P2P Desk'}
          </span>
        </button>

        <button
          onClick={() => setTelegramViewMode('bot_profile')}
          className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border border-blue-500/30 bg-blue-950/30 text-blue-300 hover:bg-blue-900/40 transition-all"
          title="Open Telegram Bot Info & Homepage Preview"
        >
          <MessageCircle className="w-3 h-3 text-[#2481cc]" />
          <span className="text-[11px] font-medium hidden sm:inline">Bot Info</span>
        </button>

        <button
          onClick={() => setIsTelegramShellMode(!isTelegramShellMode)}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full border transition-all ${
            isTelegramShellMode
              ? 'border-cyan-500/30 bg-cyan-950/20 text-cyan-300'
              : 'border-white/10 bg-white/5 text-stone-400 hover:text-stone-200'
          }`}
          title="Toggle Telegram Mini App UI Chrome"
        >
          <Smartphone className="w-3 h-3" />
        </button>
      </div>

      {/* Zone 3: Wallet Action Pill & Settings Button */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setActiveTab('wallet')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-all ${
            activeTab === 'wallet'
              ? 'bg-amber-400/10 border-amber-400/40 text-amber-300'
              : 'bg-white/5 border-white/10 text-stone-300 hover:bg-white/10 hover:border-white/20'
          }`}
        >
          <Wallet className="w-3.5 h-3.5 text-stone-400" />
          <span className="text-xs font-mono font-medium tabular-nums">
            ${walletBalance.toFixed(0)} <span className="text-[10px] text-stone-400">USDT</span>
          </span>
        </button>

        <button
          onClick={() => setSettingsModalOpen(true)}
          className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-stone-400 hover:text-stone-100 transition-colors"
          title="Account & Vault Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
