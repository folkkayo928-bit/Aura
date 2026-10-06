import React from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Wallet, Settings, ArrowLeftRight, LogIn } from 'lucide-react';

export const Header: React.FC = () => {
  const { walletBalance, setActiveTab, activeTab, setSettingsModalOpen, setP2pModalOpen, activeP2POrder } = useApp();
  const { user, openAuth } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-[#09090d]/88 backdrop-blur-xl border-b border-white/5 px-4 h-14 flex items-center justify-between">
      <button onClick={() => setActiveTab('home')} className="flex items-center gap-2 group text-left">
        <span className="font-serif text-2xl tracking-[0.2em] font-light text-stone-100 group-hover:text-amber-200 transition-colors uppercase">Aura</span>
        <span className="hidden sm:inline text-[10px] uppercase tracking-widest text-stone-500 font-mono">· Vault</span>
      </button>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setP2pModalOpen(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-full border transition-all ${
            activeP2POrder
              ? 'border-amber-400/60 bg-amber-400/20 text-amber-300 font-bold'
              : 'border-white/10 bg-white/5 text-stone-300 hover:bg-white/10'
          }`}
          title="P2P Desk"
        >
          <ArrowLeftRight className="w-3 h-3 text-emerald-400" />
          <span>{activeP2POrder ? 'P2P Hold' : 'P2P'}</span>
        </button>

        <button
          onClick={() => setActiveTab('wallet')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-all ${
            activeTab === 'wallet'
              ? 'bg-amber-400/10 border-amber-400/40 text-amber-300'
              : 'bg-white/5 border-white/10 text-stone-300 hover:bg-white/10'
          }`}
        >
          <Wallet className="w-3.5 h-3.5 text-stone-400" />
          <span className="text-[11px] font-mono tabular-nums">
            {user ? `$${walletBalance.toFixed(2)}` : 'Sign in'} <span className="text-[9px] text-stone-500">{user ? 'USDT' : ''}</span>
          </span>
        </button>

        {user ? (
          <button onClick={() => setSettingsModalOpen(true)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-stone-400 hover:text-stone-100" title="Account settings">
            <Settings className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={() => openAuth('signin')} className="p-2 rounded-full bg-amber-400 text-stone-950 hover:bg-amber-300" title="Sign in">
            <LogIn className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};