import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ArrowLeft,
  MoreVertical,
  Check,
  CheckCheck,
  Send,
  Paperclip,
  Mic,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Gift,
  Rocket,
  Swords,
  Award,
  DollarSign,
  Zap,
  Info,
  Smartphone,
  ChevronRight,
} from 'lucide-react';

interface TelegramBotChatViewProps {
  onOpenProfile: () => void;
}

export const TelegramBotChatView: React.FC<TelegramBotChatViewProps> = ({ onOpenProfile }) => {
  const { startBotAndOpenApp, addNotification, walletBalance } = useApp();
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      sender: 'user' | 'bot';
      text: string;
      timestamp: string;
      showInlineStartButton?: boolean;
    }>
  >([
    {
      id: 'm1',
      sender: 'user',
      text: '/start',
      timestamp: '6:18 PM',
    },
    {
      id: 'm2',
      sender: 'bot',
      text: `🎉 Welcome to AURA Vault!

🆓 Open the Free24 Box every day and win rare digital art gifts!
🚀 Play Rocket Mode for big wins & certified rare drops
⚔️ Trade on Certified P2P with 100% smart contract escrow
🎁 Open cases, mint photos, and collect 1 of 1 editions
💳 Custom Payment Rails: Alex's Wire, Revolut, Zelle, PayPal
🏆 Climb the collector leaderboard and win valuable TON prizes

👉 Start exploring now!`,
      timestamp: '6:18 PM',
      showInlineStartButton: true,
    },
  ]);

  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleStartCommand = () => {
    // User sends /start
    const userMsg = {
      id: Date.now().toString(),
      sender: 'user' as const,
      text: '/start',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    // Bot replies
    setTimeout(() => {
      setIsTyping(false);
      const botMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'bot' as const,
        text: `🎉 Welcome back to AURA Vault!

Your Web3 TON Vault is active with $${walletBalance.toFixed(2)} USDT liquid test funds.
Certified P2P Escrow order book is open.
Tap below to launch into the mini app!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        showInlineStartButton: true,
      };
      setMessages((prev) => [...prev, botMsg]);

      // Fire push notification!
      addNotification(
        'AURA Bot Notification',
        '🚀 AURA Mini App is ready. Tap to open and start collecting digital art!',
        'community'
      );
    }, 600);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputVal.trim();
    if (!trimmed) return;

    if (trimmed.toLowerCase() === '/start') {
      setInputVal('');
      handleStartCommand();
      return;
    }

    const userMsg = {
      id: Date.now().toString(),
      sender: 'user' as const,
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal('');
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      const botMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'bot' as const,
        text: `I received your command "${trimmed}". AURA Mini App is fully loaded with live marketplace items, certified P2P escrow trading, and instant liquidity conversion. Tap "🚀 Start" to enter!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        showInlineStartButton: true,
      };
      setMessages((prev) => [...prev, botMsg]);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#0e0e14] text-stone-100 flex flex-col font-sans select-none relative pb-32">
      {/* Top Telegram Chat Chrome (Matches Screenshot 2) */}
      <div className="sticky top-0 z-30 bg-[#161622]/95 backdrop-blur-md px-3 py-2.5 flex items-center justify-between border-b border-white/5 shadow-md">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenProfile}
            className="text-stone-300 hover:text-white transition-colors p-1 -ml-1 rounded-full"
            title="Bot Info"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Bot Avatar & Info */}
          <div
            onClick={onOpenProfile}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-amber-500 flex items-center justify-center text-white shadow-md font-bold text-sm border border-white/10 shrink-0">
              🎁
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                  AURA Vault
                </span>
                <div className="w-3.5 h-3.5 rounded-full bg-[#2481cc] flex items-center justify-center text-white">
                  <Check className="w-2 h-2 stroke-[3]" />
                </div>
              </div>
              <span className="text-[10px] text-stone-400 block font-normal">
                919,442 monthly users
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onOpenProfile}
            className="p-1.5 text-stone-300 hover:text-white transition-colors"
            title="Bot Profile"
          >
            <Info className="w-4 h-4" />
          </button>
          <button
            onClick={() =>
              addNotification(
                'Telegram Bot Menu',
                '@auravault_bot settings and notifications configured.',
                'community'
              )
            }
            className="p-1.5 text-stone-300 hover:text-white transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Chat Body */}
      <div className="flex-1 px-3 pt-3 space-y-4 max-w-md mx-auto w-full">
        {/* Verification Organization Badge Banner (Matches Screenshot 2) */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-stone-400 bg-white/[0.03] border border-white/5 py-1.5 px-3 rounded-2xl mx-auto text-center">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            This bot was verified by the organization "The Open Network".
          </span>
        </div>

        {/* Ad Callout Banner (Matches Screenshot 2) */}
        <div className="p-3 rounded-2xl bg-[#14141e] border border-white/5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-400/30 font-semibold">
              Ad
            </span>
            <span className="font-bold text-stone-200">AURA Vault</span>
            <span className="text-[10px] text-stone-500">what's this?</span>
          </div>
          <div className="w-7 h-7 rounded-xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-300">
            <Gift className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* "What can this bot do?" Hero Card (Matches Screenshot 2) */}
        <div className="rounded-3xl bg-[#14141e] border border-white/5 overflow-hidden shadow-xl">
          {/* Glossy Visual Banner */}
          <div className="relative h-44 w-full bg-gradient-to-b from-[#1c1838] via-[#161426] to-[#14141e] flex items-center justify-center overflow-hidden p-3">
            {/* Visual 3D Assets Simulation */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.25)_0,transparent_70%)]" />

            {/* Glowing Hero Composition */}
            <div className="relative z-10 flex flex-col items-center text-center space-y-1">
              <div className="flex items-center gap-2 text-2xl">
                <span className="animate-bounce">💎</span>
                <span className="text-3xl">🚀</span>
                <span className="animate-pulse">🎁</span>
              </div>
              <div className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-purple-300 to-cyan-300">
                AURA DIGITAL VAULT
              </div>
              <span className="text-[10px] text-stone-300 font-mono bg-black/60 px-2 py-0.5 rounded-full border border-white/10">
                Certified P2P · $250,000 Escrow Protection
              </span>
            </div>

            {/* Corner floating emojis */}
            <span className="absolute top-2 left-3 text-lg opacity-80">👑</span>
            <span className="absolute top-3 right-4 text-lg opacity-80">⚡</span>
            <span className="absolute bottom-2 left-4 text-base opacity-70">📦</span>
            <span className="absolute bottom-2 right-4 text-base opacity-70">✨</span>
          </div>

          {/* Description Section */}
          <div className="p-4 space-y-2.5">
            <h3 className="text-xs font-bold text-white tracking-wide">
              What can this bot do?
            </h3>
            <p className="text-xs text-stone-300 leading-relaxed font-normal">
              Open the Free24 Box every day and win gifts for free!
            </p>
            <p className="text-xs text-stone-400 leading-relaxed font-normal">
              Play Rocket, battle in PvP, upgrade or combine items, open cases, climb the leaderboard, and win valuable Telegram Gifts and USDT cashout.
            </p>
          </div>
        </div>

        {/* Date Separator (Matches Screenshot 2) */}
        <div className="flex items-center justify-center my-3">
          <span className="text-[10px] font-medium text-stone-400 bg-white/5 px-3 py-1 rounded-full border border-white/5">
            October 3
          </span>
        </div>

        {/* Chat Messages Stream */}
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs shadow-md ${
                  msg.sender === 'user'
                    ? 'bg-[#2b5278] text-white rounded-tr-sm'
                    : 'bg-[#1e1e28] text-stone-200 rounded-tl-sm border border-white/5'
                }`}
              >
                <div className="whitespace-pre-line leading-relaxed">
                  {msg.text}
                </div>

                <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-stone-400">
                  <span>{msg.timestamp}</span>
                  {msg.sender === 'user' && (
                    <CheckCheck className="w-3 h-3 text-cyan-300 stroke-[2.5]" />
                  )}
                </div>
              </div>

              {/* Inline Action Button Attached to Bot Message (Matches Screenshot 2) */}
              {msg.showInlineStartButton && (
                <div className="w-full max-w-[88%] mt-1.5">
                  <button
                    onClick={() => startBotAndOpenApp()}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#2481cc] hover:bg-[#2075b8] active:scale-[0.98] text-white font-bold text-xs transition-all shadow-lg shadow-[#2481cc]/25 flex items-center justify-center gap-2 group"
                  >
                    <span>🚀 Start</span>
                    <Smartphone className="w-3.5 h-3.5 opacity-80 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-1.5 text-xs text-stone-400 pl-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              <span className="text-[11px] italic">AURA Vault is typing...</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>
      </div>

      {/* Sticky Bottom Section: Persistent Keyboard & Message Input Bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-[#161622]/95 backdrop-blur-xl border-t border-white/5 p-2 space-y-2 max-w-md mx-auto">
        {/* Persistent Keyboard Quick Actions (Matches Screenshot 2) */}
        <div className="grid grid-cols-2 gap-2 px-1">
          <button
            onClick={() =>
              addNotification(
                'Telegram Community',
                'Joining official AURA Telegram Group with 42,800 active collectors...',
                'community'
              )
            }
            className="py-2.5 px-3 rounded-xl bg-[#222230] hover:bg-[#2a2a3c] border border-white/5 flex items-center justify-between text-xs font-semibold text-stone-200 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <span>👥</span>
              <span>Community</span>
            </div>
            <ExternalLink className="w-3 h-3 text-stone-400" />
          </button>

          <button
            onClick={() =>
              addNotification(
                'VIP Support Concierge',
                'Connecting to verified Telegram Support specialist @aurasupport...',
                'community'
              )
            }
            className="py-2.5 px-3 rounded-xl bg-[#222230] hover:bg-[#2a2a3c] border border-white/5 flex items-center justify-between text-xs font-semibold text-stone-200 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <span>🆘</span>
              <span>Support</span>
            </div>
            <ExternalLink className="w-3 h-3 text-stone-400" />
          </button>
        </div>

        {/* Message Input Bar with [📁 start] button (Matches Screenshot 2) */}
        <form onSubmit={handleSendMessage} className="flex items-center gap-2 px-1">
          {/* Quick [start] chip button */}
          <button
            type="button"
            onClick={handleStartCommand}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#2481cc]/20 hover:bg-[#2481cc]/30 border border-[#2481cc]/40 text-[#3390ec] text-xs font-bold transition-colors shrink-0"
          >
            <span>📁 start</span>
          </button>

          {/* Text Input */}
          <div className="relative flex-1">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Message"
              className="w-full bg-[#20202c] border border-white/5 rounded-2xl pl-3 pr-8 py-2 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-[#3390ec]/60"
            />
            <button
              type="button"
              onClick={() =>
                addNotification(
                  'Attachment',
                  'Select photo or digital art file to upload directly to vault.',
                  'community'
                )
              }
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 p-0.5"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Send or Voice Note Button */}
          {inputVal.trim() ? (
            <button
              type="submit"
              className="w-9 h-9 rounded-full bg-[#2481cc] hover:bg-[#2075b8] flex items-center justify-center text-white transition-colors shrink-0 shadow-md"
            >
              <Send className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                addNotification(
                  'Voice Note',
                  'Recording voice message for AURA Telegram Concierge...',
                  'community'
                )
              }
              className="w-9 h-9 rounded-full bg-[#20202c] hover:bg-[#282838] flex items-center justify-center text-[#3390ec] transition-colors shrink-0 border border-white/5"
            >
              <Mic className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
