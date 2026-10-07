import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

interface TelegramBotChatViewProps {
  onOpenProfile: () => void;
}

type BotHealth = {
  ok?: boolean;
  status?: string;
  bot?: string;
};

export const TelegramBotChatView: React.FC<TelegramBotChatViewProps> = ({ onOpenProfile }) => {
  const { startBotAndOpenApp } = useApp();
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
    <div className="min-h-screen bg-[#0e0e14] text-stone-100 flex flex-col pb-24">
      <div className="sticky top-0 z-30 bg-[#161622]/95 backdrop-blur-md px-3 py-3 flex items-center justify-between border-b border-white/5">
        <button onClick={onOpenProfile} className="p-2 -ml-1 rounded-full text-stone-300 hover:text-white" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button onClick={onOpenProfile} className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-amber-500 flex items-center justify-center font-bold">◆</div>
          <div className="text-left">
            <div className="flex items-center gap-1 text-xs font-bold text-white">
              AURA Vault
              <span className="w-3.5 h-3.5 rounded-full bg-[#2481cc] flex items-center justify-center"><Check className="w-2 h-2 stroke-[3]" /></span>
            </div>
            <div className="text-[10px] text-stone-400">@myaura1_bot</div>
          </div>
        </button>
        <a
          href="https://t.me/myaura1_bot"
          target="_blank"
          rel="noreferrer"
          className="p-2 text-stone-300 hover:text-white"
          aria-label="Open Telegram"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      <div className="max-w-md mx-auto w-full px-4 pt-5 space-y-4">
        <div className="rounded-3xl bg-[#14141e] border border-white/5 overflow-hidden shadow-xl">
          <div className="h-36 bg-[radial-gradient(circle_at_50%_20%,rgba(168,85,247,.35),transparent_55%),linear-gradient(135deg,#181620,#09090d)] flex items-center justify-center">
            <div className="text-4xl">◆</div>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-100">
              <MessageCircle className="w-4 h-4 text-cyan-300" />
              Real Telegram bot
            </div>
            <p className="text-xs leading-relaxed text-stone-400">
              Telegram handles the real conversation. AURA does not invent bot messages or display fake balances here.
            </p>
            <div className="flex items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.03] p-3">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-stone-500">Bot backend</div>
                <div className="text-xs text-stone-200 truncate">
                  {loading ? 'Checking…' : health?.ok ? 'Online' : 'Temporarily unavailable'}
                </div>
              </div>
              <button onClick={() => void loadHealth()} className="ml-auto p-2 rounded-xl bg-white/5 text-stone-400 hover:text-white" aria-label="Refresh bot status">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <a
          href="https://t.me/myaura1_bot"
          target="_blank"
          rel="noreferrer"
          className="w-full py-3.5 rounded-2xl bg-[#2481cc] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#2481cc]/20"
        >
          <ExternalLink className="w-4 h-4" />
          Open @myaura1_bot in Telegram
        </a>

        <button
          onClick={() => startBotAndOpenApp()}
          className="w-full py-3.5 rounded-2xl bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-2"
        >
          <Smartphone className="w-4 h-4" />
          Open AURA Mini App
        </button>

        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-[11px] text-stone-500 leading-relaxed">
          Use Telegram for the real <strong className="text-stone-300">/start</strong> conversation and account actions. Use the Mini App for the live AURA wallet, marketplace, artwork, and P2P features.
        </div>
      </div>
    </div>
  );
};
