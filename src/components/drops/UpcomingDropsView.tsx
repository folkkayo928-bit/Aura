import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { UpcomingDrop } from '../../types';
import {
  Calendar,
  Clock,
  Bell,
  Sparkles,
  CheckCircle2,
  Users,
  Flame,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

export const UpcomingDropsView: React.FC = () => {
  const { upcomingDrops, toggleDropReminder } = useApp();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (targetTimestamp: number) => {
    const diff = Math.max(0, targetTimestamp - now);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="pt-2 px-1">
        <div className="flex items-center gap-2 mb-1 text-xs font-mono uppercase tracking-widest text-cyan-400">
          <Calendar className="w-4 h-4 text-cyan-400" />
          <span>Launchpad & Scheduled Drops</span>
        </div>
        <h2 className="font-serif text-3xl text-stone-100 font-light">
          What Is Coming
        </h2>
        <p className="text-xs text-stone-400 mt-1">
          Exclusive upcoming generative art, anime drops, and virtual brand streetwear. Set Telegram alerts before minting opens.
        </p>
      </div>

      {/* Drops Cards List */}
      <div className="space-y-5 px-1">
        {upcomingDrops.map((drop) => {
          const countdownStr = formatCountdown(drop.mintTimestamp);

          return (
            <div
              key={drop.id}
              className="rounded-3xl bg-[#111119] border border-white/10 overflow-hidden shadow-2xl space-y-4 hover:border-cyan-500/30 transition-all group"
            >
              {/* Banner Area */}
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-black">
                <img
                  src={drop.banner}
                  alt={drop.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#111119] via-transparent to-black/30" />

                {/* Live Countdown Badge */}
                <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-white/15 text-xs font-mono font-bold text-amber-300 flex items-center gap-1.5 shadow-lg">
                  <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span>{countdownStr}</span>
                </div>

                {/* Whitelist status */}
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-cyan-950/80 backdrop-blur-md border border-cyan-500/30 text-[10px] font-mono text-cyan-300 uppercase">
                  {drop.whitelistOpen ? 'Whitelist Open' : 'Public Launch'}
                </div>

                {/* Creator Avatar badge */}
                <div className="absolute bottom-3 left-4 flex items-center gap-2.5">
                  <img
                    src={drop.avatar}
                    alt={drop.creator.name}
                    className="w-10 h-10 rounded-full object-cover border-2 border-white/20 shadow-md"
                  />
                  <div>
                    <span className="text-xs font-bold text-stone-100 block drop-shadow-md">
                      {drop.creator.name}
                    </span>
                    <span className="text-[10px] text-stone-300 font-mono drop-shadow">
                      {drop.collectionName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 pt-0 space-y-3">
                <h3 className="font-serif text-2xl text-stone-100 font-normal leading-snug">
                  {drop.title}
                </h3>
                <p className="text-xs text-stone-400 leading-relaxed">
                  {drop.description}
                </p>

                {/* Pricing & Supply Grid */}
                <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-center">
                  <div>
                    <span className="text-[10px] text-stone-500 block font-mono">Mint Price</span>
                    <span className="font-serif font-bold text-stone-100">${(drop.mintPriceUSDT ?? 0).toLocaleString()} USDT</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-500 block font-mono">Total Supply</span>
                    <span className="font-serif font-bold text-stone-100">{(drop.supply ?? 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-500 block font-mono">Date</span>
                    <span className="font-mono text-[11px] text-stone-300 block truncate">{drop.mintDate}</span>
                  </div>
                </div>

                {/* Drop Perks */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500 block">
                    Drop Utilities & Inclusions
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {drop.perks.map((perk, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-[11px] text-stone-300 flex items-center gap-1"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                        <span>{perk}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Telegram Reminder Action Button */}
                <div className="pt-2">
                  <button
                    onClick={() => toggleDropReminder(drop.id)}
                    className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${
                      drop.isReminded
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-white/10 hover:bg-cyan-500 hover:text-stone-950 text-stone-200 border border-white/10'
                    }`}
                  >
                    <Bell className={`w-4 h-4 ${drop.isReminded ? 'fill-emerald-400 text-emerald-400' : ''}`} />
                    <span>
                      {drop.isReminded ? 'Telegram Reminder Set' : 'Remind Me on Telegram'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
