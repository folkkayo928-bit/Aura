import React from 'react';
import { useApp } from '../context/AppContext';
import { ChevronLeft, MessageCircle, Smartphone, X } from 'lucide-react';

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

  return (
    <div className="min-h-screen bg-[#040407] text-stone-100 flex flex-col items-center py-2 sm:py-4 px-1 sm:px-4">
      <div className="mb-2 z-50 flex items-center gap-1 p-1 bg-[#12121a]/90 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl max-w-md w-full">
        <button
          onClick={() => setTelegramViewMode('bot_profile')}
          className={`flex-1 py-2 rounded-xl text-[11px] font-medium ${telegramViewMode === 'bot_profile' ? 'bg-[#2481cc] text-white' : 'text-stone-400 hover:text-stone-200'}`}
        >
          Profile
        </button>
        <button
          onClick={() => setTelegramViewMode('bot_chat')}
          className={`flex-1 py-2 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1 ${telegramViewMode === 'bot_chat' ? 'bg-[#2481cc] text-white' : 'text-stone-400 hover:text-stone-200'}`}
        >
          <MessageCircle className="w-3 h-3" />
          Telegram
        </button>
        <button
          onClick={() => setTelegramViewMode('miniapp')}
          className={`flex-1 py-2 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1 ${telegramViewMode === 'miniapp' ? 'bg-amber-400 text-stone-950 font-bold' : 'text-stone-400 hover:text-stone-200'}`}
        >
          <Smartphone className="w-3 h-3" />
          Mini App
        </button>
      </div>

      <div className={`w-full transition-all ${isTelegramShellMode ? 'max-w-md min-h-[90vh] bg-[#09090d] shadow-2xl relative sm:rounded-[36px] sm:border sm:border-white/10 overflow-hidden' : 'max-w-xl min-h-screen bg-[#09090d]'}`}>
        {isTelegramShellMode && telegramViewMode === 'miniapp' && (
          <div className="bg-[#101017] px-4 py-2 flex items-center justify-between border-b border-white/5 sticky top-0 z-40">
            <div>
              {selectedArtwork ? (
                <button onClick={() => setSelectedArtwork(null)} className="flex items-center text-xs text-cyan-400">
                  <ChevronLeft className="w-4 h-4 -ml-1" />
                  Back
                </button>
              ) : activeTab !== 'home' ? (
                <button onClick={() => setActiveTab('home')} className="flex items-center text-xs text-cyan-400">
                  <ChevronLeft className="w-4 h-4 -ml-1" />
                  Gallery
                </button>
              ) : (
                <button onClick={() => setTelegramViewMode('bot_profile')} className="text-stone-400 p-1" aria-label="Close Mini App">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="text-center">
              <div className="text-xs font-semibold text-stone-200">AURA Mini App <span className="text-emerald-400">●</span></div>
              <span className="text-[10px] text-stone-400 font-mono">@myaura1_bot</span>
            </div>
            <button onClick={() => setTelegramViewMode('bot_chat')} className="text-stone-400 hover:text-cyan-300 p-1" aria-label="Open Telegram chat">
              <MessageCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        <main className="w-full relative">{children}</main>
      </div>
    </div>
  );
};
