import React from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, ArrowRightLeft, Heart, CheckCircle2, X, Bell } from 'lucide-react';

export const TelegramNotificationToast: React.FC = () => {
  const { notifications, dismissNotification } = useApp();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-3 inset-x-0 z-50 flex flex-col items-center pointer-events-none px-3 space-y-2">
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
            className="pointer-events-auto w-full max-w-sm bg-[#11111a]/95 border border-white/10 shadow-[0_18px_60px_rgba(0,0,0,0.45)] rounded-2xl p-3.5 backdrop-blur-2xl transition-all duration-300 animate-in slide-in-from-top-4 ring-1 ring-white/5"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-300/20 via-white/5 to-cyan-300/10 flex items-center justify-center border border-white/10 shrink-0 mt-0.5 shadow-inner">
                {getIcon()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="text-xs font-semibold text-stone-200 tracking-tight flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-amber-300" />
                    AURA • Activity
                  </span>
                  <span className="text-[10px] text-stone-500">{notif.timestamp}</span>
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
