import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ChevronLeft,
  MoreVertical,
  X,
  Database,
  Check,
  Smartphone,
  MessageCircle,
  Sparkles,
  Info,
} from 'lucide-react';

interface TelegramFrameProps {
  children: React.ReactNode;
}

export const TelegramFrame: React.FC<TelegramFrameProps> = ({ children }) => {
  const {
    isTelegramShellMode,
    activeTab,
    setActiveTab,
    selectedArtwork,
    setSelectedArtwork,
    telegramViewMode,
    setTelegramViewMode,
  } = useApp();
  const [showBackendDrawer, setShowBackendDrawer] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);

  const supabaseSqlSchema = `-- Supabase PostgreSQL Schema for AURA Web3 Digital Art Vault
-- Run this in your Supabase SQL Editor when wiring the backend!

CREATE TABLE IF NOT EXISTS public.creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id TEXT UNIQUE,
  name TEXT NOT NULL,
  handle TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.artworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  edition TEXT NOT NULL DEFAULT '1 of 1',
  creator_id UUID REFERENCES public.creators(id),
  visual_theme TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  original_price NUMERIC(10, 2) NOT NULL,
  current_value NUMERIC(10, 2) NOT NULL,
  eligible_interactions INT DEFAULT 0,
  interest_level TEXT DEFAULT 'Rising',
  likes_count INT DEFAULT 0,
  loves_count INT DEFAULT 0,
  saves_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vault_ownership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id UUID REFERENCES public.artworks(id),
  owner_telegram_handle TEXT NOT NULL,
  purchase_price NUMERIC(10, 2) NOT NULL,
  acquired_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id UUID REFERENCES public.artworks(id),
  user_handle TEXT NOT NULL,
  interaction_type TEXT NOT NULL, -- 'like', 'love', 'save', 'comment', 'collect'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.p2p_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_type TEXT NOT NULL, -- 'buy' or 'sell'
  crypto_amount NUMERIC(12, 4) NOT NULL,
  fiat_amount NUMERIC(12, 2) NOT NULL,
  fiat_currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'escrow_locked',
  escrow_tx_hash TEXT NOT NULL,
  buyer_handle TEXT NOT NULL,
  seller_handle TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.linked_web3_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_handle TEXT NOT NULL,
  wallet_provider TEXT NOT NULL, -- 'Tonkeeper', 'MetaMask', 'Phantom'
  network TEXT NOT NULL, -- 'ton', 'polygon', 'solana'
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
`;

  return (
    <div className="min-h-screen bg-[#040407] text-stone-100 flex flex-col items-center justify-start py-2 sm:py-4 px-1 sm:px-4">
      {/* Telegram Experience Switcher Pill (Quick-hop between Profile, Chat, and Mini App) */}
      <div className="mb-2 z-50 flex items-center gap-1 p-1 bg-[#12121a]/90 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl max-w-md w-full justify-between select-none">
        <button
          onClick={() => setTelegramViewMode('bot_profile')}
          className={`flex-1 py-1 px-2 rounded-xl text-[11px] font-medium transition-all flex items-center justify-center gap-1 ${
            telegramViewMode === 'bot_profile'
              ? 'bg-[#2481cc] text-white shadow-md'
              : 'text-stone-400 hover:text-stone-200'
          }`}
          title="Bot Store Profile & Preview (Screenshot 1)"
        >
          <Info className="w-3 h-3" />
          <span>Profile</span>
        </button>

        <button
          onClick={() => setTelegramViewMode('bot_chat')}
          className={`flex-1 py-1 px-2 rounded-xl text-[11px] font-medium transition-all flex items-center justify-center gap-1 ${
            telegramViewMode === 'bot_chat'
              ? 'bg-[#2481cc] text-white shadow-md'
              : 'text-stone-400 hover:text-stone-200'
          }`}
          title="Telegram Chat /start Flow (Screenshot 2)"
        >
          <MessageCircle className="w-3 h-3" />
          <span>Chat /start</span>
        </button>

        <button
          onClick={() => setTelegramViewMode('miniapp')}
          className={`flex-1 py-1 px-2 rounded-xl text-[11px] font-medium transition-all flex items-center justify-center gap-1 ${
            telegramViewMode === 'miniapp'
              ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-stone-950 font-bold shadow-md'
              : 'text-stone-400 hover:text-stone-200'
          }`}
          title="Full Web3 Digital Art & P2P Mini App"
        >
          <Smartphone className="w-3 h-3" />
          <span>Mini App</span>
        </button>
      </div>

      {/* Container simulating smartphone width or clean full width */}
      <div
        className={`w-full transition-all duration-300 ${
          isTelegramShellMode
            ? 'max-w-md min-h-[90vh] bg-[#09090d] shadow-2xl relative sm:rounded-[36px] sm:border sm:border-white/10 overflow-hidden'
            : 'max-w-xl min-h-screen bg-[#09090d]'
        }`}
      >
        {/* Telegram Mini App Native Chrome Bar (Visible only inside Mini App mode) */}
        {isTelegramShellMode && telegramViewMode === 'miniapp' && (
          <div className="bg-[#101017] px-4 py-2 flex items-center justify-between border-b border-white/5 select-none sticky top-0 z-40">
            <div className="flex items-center gap-2">
              {selectedArtwork ? (
                <button
                  onClick={() => setSelectedArtwork(null)}
                  className="flex items-center text-xs text-cyan-400 font-medium hover:text-cyan-300"
                >
                  <ChevronLeft className="w-4 h-4 -ml-1" />
                  <span>Back</span>
                </button>
              ) : activeTab !== 'home' ? (
                <button
                  onClick={() => setActiveTab('home')}
                  className="flex items-center text-xs text-cyan-400 font-medium hover:text-cyan-300"
                >
                  <ChevronLeft className="w-4 h-4 -ml-1" />
                  <span>Gallery</span>
                </button>
              ) : (
                <button
                  onClick={() => setTelegramViewMode('bot_profile')}
                  className="text-stone-400 hover:text-stone-200 text-xs p-1"
                  title="Return to Telegram Bot Profile"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Title / Bot Name */}
            <div
              onClick={() => setTelegramViewMode('bot_profile')}
              className="text-center cursor-pointer group"
              title="View Bot Profile"
            >
              <div className="text-xs font-semibold text-stone-200 flex items-center justify-center gap-1 group-hover:text-amber-300 transition-colors">
                <span>AURA Mini App</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
              </div>
              <span className="text-[10px] text-stone-400 font-mono block">
                bot @myaura1_bot
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setTelegramViewMode('bot_chat')}
                className="text-stone-400 hover:text-cyan-300 transition-colors p-1"
                title="Open Telegram Chat"
              >
                <MessageCircle className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowBackendDrawer(true)}
                className="text-stone-400 hover:text-stone-200 p-1"
                title="Menu"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Content Body */}
        <main className="w-full relative">{children}</main>
      </div>

      {/* Supabase Ready Schema Drawer */}
      {showBackendDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-lg bg-[#12121b] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono uppercase tracking-wider text-stone-300">
                  Supabase Backend Schema
                </span>
              </div>
              <button
                onClick={() => setShowBackendDrawer(false)}
                className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-stone-400 hover:text-stone-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-300 leading-relaxed">
              As requested, the frontend is built ready for seamless integration with Supabase. Here is the ready-to-run PostgreSQL table schema matching all state models in this app:
            </p>

            <div className="relative">
              <pre className="p-3.5 rounded-2xl bg-black/70 border border-white/10 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-56 no-scrollbar">
                {supabaseSqlSchema}
              </pre>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(supabaseSqlSchema);
                  setCopiedSchema(true);
                  setTimeout(() => setCopiedSchema(false), 2000);
                }}
                className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-mono text-stone-200 flex items-center gap-1 transition-colors"
              >
                {copiedSchema ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
                <span>{copiedSchema ? 'Copied' : 'Copy SQL'}</span>
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-[11px] text-stone-400 space-y-1">
              <div>• <strong>Real-time Notifications:</strong> Listen to postgres changes on <code>community_interactions</code> table.</div>
              <div>• <strong>Liquidity Pools:</strong> Wire <code>/convert</code> rpc to release treasury USDT directly.</div>
            </div>

            <button
              onClick={() => setShowBackendDrawer(false)}
              className="w-full py-3 rounded-xl bg-amber-400 text-stone-950 font-semibold text-xs hover:bg-amber-300 transition-colors"
            >
              Continue Browsing AURA
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
