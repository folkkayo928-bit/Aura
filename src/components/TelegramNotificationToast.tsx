import React from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, ArrowRightLeft, Heart, CheckCircle2, X } from 'lucide-react';

export const TelegramNotificationToast: React.FC = () => {
  const { notifications, dismissNotification } = useApp();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-2 inset-x-0 z-50 flex flex-col items-center pointer-events-none px-3 space-y-2">
      {notifications.map((notif) => {
        const getIcon = () => {
          switch (notif.type) {
            case 'collect':
              return <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />;
            case 'convert':
              return <ArrowRightLeft className="w-4 h-4 text-emerald-400 shrink-0" />;
            case 'value_surge':
              return <Heart className="w-4 h-4 text-rose-400 shrink-0" />;
            default:
              return <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />;
          }
        };

        return (
          <div
            key={notif.id}
            className="pointer-events-auto w-full max-w-sm bg-[#161622]/95 border border-white/10 shadow-2xl rounded-2xl p-3.5 backdrop-blur-xl transition-all duration-300 animate-in slide-in-from-top-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shrink-0 mt-0.5">
                {getIcon()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="text-xs font-semibold text-stone-200 tracking-tight flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                    Telegram Bot Notification
                  </span>
                  <span className="text-[10px] text-stone-400">{notif.timestamp}</span>
                </div>
                <p className="text-xs font-medium text-stone-300 leading-snug">{notif.title}</p>
                <p className="text-[11px] text-stone-400 mt-0.5 line-clamp-2 leading-relaxed">
                  {notif.message}
                </p>
              </div>
              <button
                onClick={() => dismissNotification(notif.id)}
                className="text-stone-500 hover:text-stone-300 p-1 -mr-1 rounded-lg transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
