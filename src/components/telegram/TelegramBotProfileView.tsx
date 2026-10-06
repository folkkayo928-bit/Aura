import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ArrowLeft,
  MoreVertical,
  CheckCircle2,
  MessageCircle,
  Bell,
  BellOff,
  Share2,
  Ban,
  QrCode,
  Users,
  Play,
  ExternalLink,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Zap,
  Flame,
  Award,
  Smartphone,
  Eye,
  X,
  Copy,
  Check,
} from 'lucide-react';

interface TelegramBotProfileViewProps {
  onOpenChat: () => void;
}

export const TelegramBotProfileView: React.FC<TelegramBotProfileViewProps> = ({ onOpenChat }) => {
  const { startBotAndOpenApp, addNotification, walletBalance } = useApp();
  const [activeTab, setActiveTab] = useState<'preview' | 'similar'>('preview');
  const [isMuted, setIsMuted] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedPreviewScreen, setSelectedPreviewScreen] = useState<number | null>(null);

  const toggleMute = () => {
    const nextState = !isMuted;
    setIsMuted(nextState);
    addNotification(
      nextState ? 'Notifications Muted' : 'Notifications Unmuted',
      nextState
        ? 'You will not receive instant alerts from @myaura1_bot.'
        : 'Live AURA account, marketplace, wallet, and P2P features are available from the Mini App.',
      'community'
    );
  };

  const handleShare = () => {
    navigator.clipboard?.writeText('https://t.me/myaura1_bot');
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    addNotification(
      'Bot Link Copied',
      'Share https://t.me/myaura1_bot with your friends on Telegram!',
      'community'
    );
  };

  const handleStopBot = () => {
    addNotification(
      'Bot Status: Active',
      '@myaura1_bot provides access to the AURA Mini App and connected account services.',
      'community'
    );
  };

  const previews = [
    {
      id: 1,
      title: 'Digital Art Marketplace',
      tag: 'Trending Feed',
      duration: '0:26',
      accent: 'from-amber-500/20 to-rose-500/20',
      actionTab: 'home' as const,
      screenshot: (
        <div className="w-full h-full bg-[#0c0c14] p-3 text-left flex flex-col justify-between select-none">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[9px] text-stone-400 font-mono">
              <span className="text-amber-400 font-bold flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" /> AURA MARKET
              </span>
              <span>Floor 25 USDT</span>
            </div>
            <div className="w-full h-24 rounded-xl overflow-hidden bg-gradient-to-tr from-purple-900/60 to-amber-700/60 relative border border-white/10">
              <img
                src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=280&auto=format&fit=crop&q=80"
                alt="Artwork"
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-1 right-1 text-[8px] bg-black/70 px-1.5 py-0.5 rounded text-amber-300 font-mono">
                1 of 1 Edition
              </span>
            </div>
            <div className="text-[10px] font-bold text-stone-100 truncate">
              Neon Solitude · Cyberscape
            </div>
            <div className="flex items-center justify-between text-[9px]">
              <span className="text-stone-400 font-mono">$120.00 USDT</span>
              <span className="text-emerald-400 font-semibold bg-emerald-950/60 px-1 rounded">
                +14.2% Surge
              </span>
            </div>
          </div>
          <div className="w-full py-1.5 rounded-lg bg-amber-400 text-stone-950 font-bold text-[9px] text-center shadow-sm">
            Instant 1-Tap Collect
          </div>
        </div>
      ),
    },
    {
      id: 2,
      title: 'Certified P2P Desk',
      tag: 'Internal Hold',
      duration: '0:18',
      accent: 'from-emerald-500/20 to-teal-500/20',
      actionTab: 'discover' as const,
      screenshot: (
        <div className="w-full h-full bg-[#0c0c14] p-3 text-left flex flex-col justify-between select-none">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[9px] text-stone-400 font-mono">
              <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                <ShieldCheck className="w-2.5 h-2.5" /> P2P DESK
              </span>
              <span className="text-cyan-300">$250k Pool</span>
            </div>
            <div className="p-2 rounded-xl bg-white/5 border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-[9px]">
                <span className="font-bold text-stone-200">Geneva Trust S.A.</span>
                <span className="text-emerald-400">99.9%</span>
              </div>
              <div className="text-[11px] font-mono font-bold text-stone-100">$1.00 USD / USDT</div>
              <div className="flex gap-1 flex-wrap text-[8px]">
                <span className="px-1 py-0.5 bg-blue-950 text-blue-300 rounded">Revolut</span>
                <span className="px-1 py-0.5 bg-amber-950 text-amber-300 rounded">Bank Wire</span>
                <span className="px-1 py-0.5 bg-teal-950 text-teal-300 rounded">Alex's Wire</span>
              </div>
            </div>
            <div className="text-[9px] text-stone-400 leading-tight">
              Protected by smart contract lock & deposit bond.
            </div>
          </div>
          <div className="w-full py-1.5 rounded-lg bg-emerald-500 text-stone-950 font-bold text-[9px] text-center shadow-sm">
            Buy USDT via Peer Rail
          </div>
        </div>
      ),
    },
    {
      id: 3,
      title: 'Web3 Multi-Chain Vault',
      tag: 'TON & Polygon',
      duration: '0:31',
      accent: 'from-cyan-500/20 to-blue-500/20',
      actionTab: 'wallet' as const,
      screenshot: (
        <div className="w-full h-full bg-[#0c0c14] p-3 text-left flex flex-col justify-between select-none">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[9px] text-stone-400 font-mono">
              <span className="text-cyan-300 font-bold flex items-center gap-0.5">
                <Zap className="w-2.5 h-2.5" /> SECURE VAULT
              </span>
              <span className="text-stone-300">TON Jettons</span>
            </div>
            <div className="p-2 rounded-xl bg-gradient-to-r from-emerald-950/60 to-cyan-950/60 border border-emerald-500/30 text-center space-y-0.5">
              <span className="text-[9px] text-stone-400">Total Liquid Balance</span>
              <div className="text-base font-serif font-bold text-stone-100">${walletBalance.toFixed(2)}</div>
              <span className="text-[8px] text-emerald-300 font-mono">Instant Cashout Ready</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[8px] text-center">
              <div className="p-1 rounded bg-white/5 text-stone-300">Convert to Fiat</div>
              <div className="p-1 rounded bg-white/5 text-stone-300">Send External</div>
            </div>
          </div>
          <div className="w-full py-1.5 rounded-lg bg-cyan-500 text-stone-950 font-bold text-[9px] text-center shadow-sm">
            Manage Multi-Chain Keys
          </div>
        </div>
      ),
    },
    {
      id: 4,
      title: 'Photo to Cash Studio',
      tag: 'Instant Minting',
      duration: '0:22',
      accent: 'from-purple-500/20 to-pink-500/20',
      actionTab: 'create' as const,
      screenshot: (
        <div className="w-full h-full bg-[#0c0c14] p-3 text-left flex flex-col justify-between select-none">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[9px] text-stone-400 font-mono">
              <span className="text-purple-400 font-bold flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" /> CREATOR HUB
              </span>
              <span>Upload & Sell</span>
            </div>
            <div className="w-full h-20 rounded-xl overflow-hidden bg-white/5 border border-dashed border-white/20 flex flex-col items-center justify-center p-2 text-center">
              <Smartphone className="w-4 h-4 text-purple-400 mb-1" />
              <span className="text-[8px] text-stone-300">Upload Photo or Art</span>
              <span className="text-[7px] text-stone-500">Auto-convert to USDT</span>
            </div>
            <div className="text-[8px] text-stone-400 leading-tight">
              List on P2P with your chosen payment method (Revolut, Alex's Wire, Zelle).
            </div>
          </div>
          <div className="w-full py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-stone-100 font-bold text-[9px] text-center shadow-sm">
            Mint & Convert to Cash
          </div>
        </div>
      ),
    },
  ];

  const similarBots = [
    {
      name: 'TON Dating',
      handle: '@tondating',
      users: 'User count not reported',
      category: 'Social & Dating',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      verified: false,
    },
    {
      name: 'Epic Gift',
      handle: '@epicgift_bot',
      users: 'User count not reported',
      category: 'Gifts & Gaming',
      avatar: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=100&auto=format&fit=crop&q=80',
      verified: false,
    },
    {
      name: 'Major',
      handle: '@major',
      users: 'User count not reported',
      category: 'TON Stars & Tasks',
      avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80',
      verified: false,
    },
    {
      name: 'Blum Crypto',
      handle: '@blumcrypto',
      users: 'User count not reported',
      category: 'DeFi & Exchange',
      avatar: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=100&auto=format&fit=crop&q=80',
      verified: false,
    },
  ];

  return (
    <div className="min-h-screen bg-[#000000] text-stone-100 flex flex-col font-sans select-none pb-12">
      {/* Top Telegram Chrome Header */}
      <div className="sticky top-0 z-30 bg-[#000000]/90 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-white/5">
        <button
          onClick={onOpenChat}
          className="text-stone-300 hover:text-white transition-colors p-1 -ml-1 rounded-full"
          title="Back to Chat"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <span className="text-xs font-semibold text-stone-300 tracking-tight">
          Bot Info
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowQrModal(true)}
            className="p-1 text-stone-300 hover:text-white transition-colors"
            title="Scan QR Code"
          >
            <QrCode className="w-4 h-4" />
          </button>
          <button
            onClick={handleShare}
            className="p-1 text-stone-300 hover:text-white transition-colors"
            title="Share Bot"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-6 max-w-md mx-auto w-full">
        {/* Bot Logo / Avatar Hero (Matches Screenshot 1) */}
        <div className="flex flex-col items-center text-center pt-2">
          <div className="relative mb-3.5">
            <div className="w-24 h-24 rounded-full bg-gradient-to-b from-[#181825] to-[#0c0c14] border-2 border-white/20 shadow-2xl flex items-center justify-center p-1.5 relative overflow-hidden group">
              <div className="w-full h-full rounded-full bg-black flex items-center justify-center border border-white/10 shadow-inner">
                {/* Heart / Stylized Vault Crest Logo */}
                <div className="relative flex items-center justify-center">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-rose-500 flex items-center justify-center text-stone-950 font-black text-xl shadow-lg">
                    💎
                  </div>
                </div>
              </div>
            </div>

            {/* Online Pulse Dot */}
            <span className="absolute bottom-1 right-2 w-4 h-4 rounded-full bg-emerald-500 border-2 border-black" />
          </div>

          {/* Bot Title & Verified Checkmark */}
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-white">
              AURA Vault
            </h1>
          </div>

          {/* Monthly Users Counter */}
          <p className="text-xs text-stone-400 italic font-normal tracking-wide">
            User count not reported
          </p>
        </div>

        {/* 4 Action Buttons Row (Matches Screenshot 1) */}
        <div className="grid grid-cols-4 gap-2 pt-1">
          {/* 1. Message (Opens Bot Chat) */}
          <button
            onClick={onOpenChat}
            className="flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl bg-[#1c1c24] hover:bg-[#262632] active:scale-95 transition-all text-center space-y-1.5 border border-white/5"
          >
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-stone-200">
              <MessageCircle className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-medium text-stone-300">Message</span>
          </button>

          {/* 2. Unmute / Mute */}
          <button
            onClick={toggleMute}
            className="flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl bg-[#1c1c24] hover:bg-[#262632] active:scale-95 transition-all text-center space-y-1.5 border border-white/5"
          >
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-stone-200">
              {isMuted ? <BellOff className="w-4 h-4 text-rose-400" /> : <Bell className="w-4 h-4 text-amber-400" />}
            </div>
            <span className="text-[11px] font-medium text-stone-300">
              {isMuted ? 'Muted' : 'Unmute'}
            </span>
          </button>

          {/* 3. Share */}
          <button
            onClick={handleShare}
            className="flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl bg-[#1c1c24] hover:bg-[#262632] active:scale-95 transition-all text-center space-y-1.5 border border-white/5"
          >
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-stone-200">
              <Share2 className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-medium text-stone-300">
              {copiedLink ? 'Copied!' : 'Share'}
            </span>
          </button>

          {/* 4. Stop */}
          <button
            onClick={handleStopBot}
            className="flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl bg-[#1c1c24] hover:bg-[#262632] active:scale-95 transition-all text-center space-y-1.5 border border-white/5"
          >
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-stone-400">
              <Ban className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-medium text-stone-400">Stop</span>
          </button>
        </div>

        {/* Bio Card (Matches Screenshot 1) */}
        <div className="rounded-3xl bg-[#181820] border border-white/5 p-4 space-y-3 shadow-lg">
          <p className="text-xs text-stone-200 leading-relaxed italic font-normal">
            The selective digital art community & certified P2P exchange.
          </p>

          <div className="text-xs text-stone-400 space-y-1">
            <div>
              <span className="text-stone-500">Channel: </span>
              <a
                href="#channel"
                onClick={(e) => {
                  e.preventDefault();
                  addNotification('Telegram Channel', 'Opening @aurachannel with 42,000 members...', 'community');
                }}
                className="text-[#3390ec] hover:underline"
              >
                @aurachannel
              </a>
              <span className="text-stone-500 ml-2">Support: </span>
              <a
                href="#support"
                onClick={(e) => {
                  e.preventDefault();
                  addNotification('Telegram Support', 'Opening live support concierge @aurasupport...', 'community');
                }}
                className="text-[#3390ec] hover:underline"
              >
                more
              </a>
            </div>
            <div className="text-[10px] text-stone-500 italic pt-0.5">Bio</div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <div>
              <div className="text-xs font-semibold text-[#3390ec]">
                @myaura1_bot
              </div>
              <div className="text-[10px] text-stone-400 italic">
                also @myaura1_bot
              </div>
            </div>

            <button
              onClick={() => setShowQrModal(true)}
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-stone-300 transition-colors"
              title="QR Code"
            >
              <QrCode className="w-4 h-4" />
            </button>
          </div>

          {/* Big Open App Button (Matches Screenshot 1) */}
          <button
            onClick={() => startBotAndOpenApp()}
            className="w-full py-3.5 rounded-2xl bg-[#2481cc] hover:bg-[#2075b8] active:scale-[0.98] text-white font-semibold text-sm transition-all shadow-lg shadow-[#2481cc]/25 text-center mt-2 flex items-center justify-center gap-2"
          >
            <span>Open App</span>
          </button>
        </div>

        {/* Disclaimer below button */}
        <p className="text-[11px] text-stone-500 italic text-center px-4 leading-tight">
          By launching this mini app, you agree to the{' '}
          <span className="text-[#3390ec] underline cursor-pointer">
            Terms of Service for Mini Apps
          </span>
          .
        </p>

        {/* Add to Group or Channel Button (Matches Screenshot 1) */}
        <div className="space-y-1">
          <button
            onClick={() =>
              addNotification(
                'Telegram Bot Integration',
                '@myaura1_bot can be used to open the AURA Mini App when Telegram integration is configured.',
                'community'
              )
            }
            className="w-full py-3 px-4 rounded-2xl bg-[#181820] hover:bg-[#20202c] border border-white/5 flex items-center gap-3 text-xs font-medium text-stone-200 transition-colors"
          >
            <Users className="w-4 h-4 text-stone-400" />
            <span className="italic">Add to Group or Channel</span>
          </button>
          <p className="text-[10px] text-stone-500 italic px-2">
            This bot is able to manage a group or channel.
          </p>
        </div>

        {/* Tabs: Preview / Similar Bots (Matches Screenshot 1) */}
        <div className="pt-2">
          <div className="flex items-center justify-center gap-2 p-1 bg-[#181820] rounded-2xl border border-white/5 mb-4">
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'preview'
                  ? 'bg-[#2a2a38] text-white shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => setActiveTab('similar')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'similar'
                  ? 'bg-[#2a2a38] text-white shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Similar Bots
            </button>
          </div>

          {/* TAB 1: PREVIEW CAROUSEL (Matches Screenshot 1) */}
          {activeTab === 'preview' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-stone-400 px-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-stone-400">
                  Interactive App Screens
                </span>
                <span className="text-[11px] text-cyan-400 font-medium">
                  Tap to launch
                </span>
              </div>

              {/* Horizontal Scrollable Phone Mockup Cards */}
              <div className="flex items-center gap-3.5 overflow-x-auto no-scrollbar py-2 px-1">
                {previews.map((item) => (
                  <div
                    key={item.id}
                    onClick={() =>
                      startBotAndOpenApp({
                        destinationTab: item.actionTab,
                        customNotification: `🚀 Launched directly into ${item.title}!`,
                      })
                    }
                    className="shrink-0 w-44 rounded-3xl bg-[#14141e] border border-white/10 hover:border-amber-400/50 shadow-xl overflow-hidden cursor-pointer group transition-all transform active:scale-95"
                  >
                    {/* Simulated Phone Top Speaker & Camera Notch */}
                    <div className="bg-black/60 pt-2 pb-1 px-4 flex items-center justify-between border-b border-white/5">
                      <div className="w-1.5 h-1.5 rounded-full bg-stone-700"></div>
                      <div className="w-8 h-1 rounded-full bg-stone-700"></div>
                      <span className="text-[7px] font-mono text-stone-500">AURA</span>
                    </div>

                    {/* Screenshot Body */}
                    <div className="h-64 relative bg-[#09090f]">
                      {item.screenshot}

                      {/* Video Play Indicator like Screenshot 1 */}
                      <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-white/10 text-[9px] text-stone-300 font-mono">
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>{item.duration}</span>
                      </div>
                    </div>

                    {/* Card Footer Caption */}
                    <div className="p-2.5 bg-[#12121a] border-t border-white/5">
                      <span className="text-[11px] font-bold text-stone-100 block truncate group-hover:text-amber-300 transition-colors">
                        {item.title}
                      </span>
                      <span className="text-[9px] text-stone-400 font-mono">
                        {item.tag}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-center pt-2">
                <button
                  onClick={() => startBotAndOpenApp()}
                  className="inline-flex items-center gap-1.5 text-xs text-stone-300 hover:text-white bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl transition-colors border border-white/10"
                >
                  <span>Launch Full App Experience</span>
                  <ChevronRight className="w-3.5 h-3.5 text-cyan-400" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: SIMILAR BOTS */}
          {activeTab === 'similar' && (
            <div className="space-y-2.5">
              {similarBots.map((bot) => (
                <div
                  key={bot.handle}
                  className="p-3 rounded-2xl bg-[#161622] border border-white/5 flex items-center justify-between hover:border-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={bot.avatar}
                      alt={bot.name}
                      className="w-10 h-10 rounded-full object-cover border border-white/10"
                    />
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-stone-100">
                          {bot.name}
                        </span>
                        <div className="w-3 h-3 rounded-full bg-[#2481cc] flex items-center justify-center text-white">
                          <Check className="w-2 h-2 stroke-[3]" />
                        </div>
                      </div>
                      <span className="text-[10px] text-stone-400 block font-mono">
                        {bot.users}
                      </span>
                      <span className="text-[9px] text-stone-500">
                        {bot.category}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      addNotification(
                        `${bot.name} Telegram Bot`,
                        `Opening mini app ${bot.handle}...`,
                        'community'
                      )
                    }
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-stone-200 transition-colors"
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-xs bg-[#161622] border border-white/10 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-200">
                Scan Telegram Mini App
              </span>
              <button
                onClick={() => setShowQrModal(false)}
                className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-stone-400 hover:text-stone-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl mx-auto w-48 h-48 flex items-center justify-center shadow-lg">
              {/* Simulated QR Code Canvas */}
              <div className="w-full h-full border-4 border-stone-900 p-2 flex flex-col justify-between">
                <div className="flex justify-between">
                  <div className="w-8 h-8 bg-stone-950 border-2 border-white"></div>
                  <div className="w-8 h-8 bg-stone-950 border-2 border-white"></div>
                </div>
                <div className="text-center font-mono text-[9px] font-black tracking-widest text-stone-950">
                  AURA.TG
                </div>
                <div className="flex justify-between">
                  <div className="w-8 h-8 bg-stone-950 border-2 border-white"></div>
                  <div className="w-8 h-8 bg-stone-950 border-2 border-white"></div>
                </div>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <div className="font-semibold text-stone-200">@myaura1_bot</div>
              <p className="text-[11px] text-stone-400">
                Scan with any smartphone camera or Telegram scanner to open on mobile.
              </p>
            </div>

            <button
              onClick={() => {
                setShowQrModal(false);
                startBotAndOpenApp();
              }}
              className="w-full py-2.5 rounded-xl bg-[#2481cc] text-white font-semibold text-xs hover:bg-[#2075b8] transition-colors"
            >
              Open App on this Device
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
