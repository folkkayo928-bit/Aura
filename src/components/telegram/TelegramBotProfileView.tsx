import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ArrowLeft,
  Bell,
  BellOff,
  Check,
  ExternalLink,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react';

interface TelegramBotProfileViewProps {
  onOpenChat: () => void;
}

type BotHealth = {
  ok?: boolean;
  status?: string;
  bot?: string;
};

export const TelegramBotProfileView: React.FC<TelegramBotProfileViewProps> = ({ onOpenChat }) => {
  const { startBotAndOpenApp } = useApp();
  const [muted, setMuted] = useState(false);
  const [health, setHealth] = useState<BotHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const loadHealth = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/telegram/health', { headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => ({}));
      setHealth({ ...data, ok: response.ok && data?.ok !== false });
    } catch {
      setHealth({ ok: false, status: 'unreachable' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHealth();
  }, []);

  return (
    <div className="min-h-screen bg-[#000000] text-stone-100 flex flex-col pb-12">
      <div className="sticky top-0 z-30 bg-black/90 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-white/5">
        <button onClick={onOpenChat} className="p-1 text-stone-300 hover:text-white" aria-label="Back to chat">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-semibold text-stone-300">Bot Info</span>
        <a href="https://t.me/myaura1_bot" target="_blank" rel="noreferrer" className="p-1 text-stone-300 hover:text-white" aria-label="Open Telegram">
          <ExternalLink className="w-5 h-5" />
        </a>
      </div>

      <div className="px-4 pt-6 pb-8 space-y-5 max-w-md mx-auto w-full">
        <div className="text-center">
          <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-tr from-purple-600 to-amber-500 flex items-center justify-center text-4xl shadow-2xl border-2 border-white/10">
            ◆
          </div>
          <div className="mt-4 flex items-center justify-center gap-1.5">
            <h1 className="text-xl font-bold text-white">AURA Vault</h1>
            <span className="w-4 h-4 rounded-full bg-[#2481cc] flex items-center justify-center">
              <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-1">@myaura1_bot</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <a href="https://t.me/myaura1_bot" target="_blank" rel="noreferrer" className="rounded-2xl bg-[#1c1c24] border border-white/5 p-3 flex flex-col items-center gap-2 text-stone-200">
            <MessageCircle className="w-5 h-5" />
            <span className="text-[11px]">Message</span>
          </a>
          <button onClick={() => setMuted(value => !value)} className="rounded-2xl bg-[#1c1c24] border border-white/5 p-3 flex flex-col items-center gap-2 text-stone-200">
            {muted ? <BellOff className="w-5 h-5 text-rose-400" /> : <Bell className="w-5 h-5 text-amber-400" />}
            <span className="text-[11px]">{muted ? 'Muted' : 'Alerts'}</span>
          </button>
          <button onClick={() => void loadHealth()} className="rounded-2xl bg-[#1c1c24] border border-white/5 p-3 flex flex-col items-center gap-2 text-stone-200">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-[11px]">Refresh</span>
          </button>
        </div>

        <div className="rounded-3xl bg-[#181820] border border-white/5 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-stone-100">Live bot connection</div>
              <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                Status is read from AURA's real Telegram backend. User counts and bot conversations are not fabricated.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3 flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${health?.ok ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-wider text-stone-500">Backend</div>
              <div className="text-xs text-stone-200">{loading ? 'Checking…' : health?.ok ? 'Online' : 'Unavailable'}</div>
            </div>
            <span className="ml-auto text-[10px] font-mono text-stone-500 truncate">{health?.bot || '@myaura1_bot'}</span>
          </div>

          <p className="text-xs text-stone-400 leading-relaxed">
            AURA Mini App gives signed-in users the live account, wallet, digital art, collections, and P2P features. Telegram itself handles the chat interface.
          </p>

          <a href="https://t.me/myaura1_bot" target="_blank" rel="noreferrer" className="w-full py-3.5 rounded-2xl bg-[#2481cc] text-white font-bold text-xs flex items-center justify-center gap-2">
            <ExternalLink className="w-4 h-4" />
            Open @myaura1_bot
          </a>
          <button onClick={() => startBotAndOpenApp()} className="w-full py-3.5 rounded-2xl bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-2">
            <Smartphone className="w-4 h-4" />
            Open AURA Mini App
          </button>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 flex items-center gap-3 text-[11px] text-stone-500">
          <Users className="w-4 h-4 text-stone-600 shrink-0" />
          Telegram member counts are shown only when the real Telegram service reports them.
        </div>
      </div>
    </div>
  );
};
