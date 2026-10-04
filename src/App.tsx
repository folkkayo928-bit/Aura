/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { P2POffer } from './types';
import { TelegramFrame } from './components/TelegramFrame';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { TelegramNotificationToast } from './components/TelegramNotificationToast';

// Views
import { HomeView } from './components/views/HomeView';
import { DiscoverView } from './components/views/DiscoverView';
import { CreateView } from './components/views/CreateView';
import { WalletView } from './components/views/WalletView';
import { ProfileView } from './components/views/ProfileView';

// Modals & Drawers
import { ArtworkModal } from './components/ArtworkModal';
import { CollectModal } from './components/CollectModal';
import { ConvertModal } from './components/ConvertModal';
import { CommunityValueDrawer } from './components/CommunityValueDrawer';
import { SendModal, ReceiveModal, BuyModal } from './components/SendReceiveModals';

// Settings & Security Modals
import { SettingsModal } from './components/settings/SettingsModal';
import { SeedPhraseModal } from './components/settings/SeedPhraseModal';

// Telegram Bot Homepage & Chat Views (Matches Screenshots)
import { TelegramBotProfileView } from './components/telegram/TelegramBotProfileView';
import { TelegramBotChatView } from './components/telegram/TelegramBotChatView';

// P2P Trustless Escrow Modals
import { P2PView } from './components/p2p/P2PView';
import { P2PTradeModal } from './components/p2p/P2PTradeModal';
import { CreateP2POfferModal } from './components/p2p/CreateP2POfferModal';
import { SellArtP2PModal } from './components/p2p/SellArtP2PModal';
import { CollectionHubModal } from './components/marketplace/CollectionHubModal';
import { MakeOfferModal } from './components/marketplace/MakeOfferModal';
import { X } from 'lucide-react';

const TelegramWebAppBridge: React.FC = () => {
  const { setIsTelegramShellMode, setTelegramViewMode, updateUserProfile } = useApp();
  React.useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) return;
    tg.ready(); tg.expand(); tg.enableClosingConfirmation?.();
    tg.setHeaderColor?.('#101017'); tg.setBackgroundColor?.('#09090d');
    setIsTelegramShellMode(true); setTelegramViewMode('miniapp');
    const user = tg.initDataUnsafe?.user;
    if (user) {
      const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
      updateUserProfile({ ...(fullName ? { name: fullName } : {}), ...(user.username ? { telegramHandle: `@${user.username}` } : {}) });
    }
    if (tg.initData) fetch('/api/telegram/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({initData:tg.initData}) }).catch(()=>undefined);
  }, [setIsTelegramShellMode, setTelegramViewMode, updateUserProfile]);
  return null;
};

const AppContent: React.FC = () => {
  const {
    activeTab,
    selectedArtwork,
    setSelectedArtwork,
    selectedCollection,
    setSelectedCollection,
    makeOfferArtwork,
    setMakeOfferArtwork,
    sellArtworkP2PModal,
    setSellArtworkP2PModal,
    collectModalArtwork,
    setCollectModalArtwork,
    convertModalArtwork,
    setConvertModalArtwork,
    communityDrawerArtwork,
    setCommunityDrawerArtwork,
    p2pModalOpen,
    setP2pModalOpen,
    activeP2POrder,
    telegramViewMode,
    setTelegramViewMode,
  } = useApp();

  const [selectedP2POffer, setSelectedP2POffer] = useState<P2POffer | null>(null);
  const [createP2POfferOpen, setCreateP2POfferOpen] = useState(false);

  return (
    <>
      <TelegramWebAppBridge />
      <TelegramFrame>
      {/* Real-time simulated Telegram Bot Notification Dropdown */}
      <TelegramNotificationToast />

      {/* VIEW 1: Telegram Bot Profile & Homepage Preview (Matches Screenshot 1) */}
      {telegramViewMode === 'bot_profile' && (
        <TelegramBotProfileView onOpenChat={() => setTelegramViewMode('bot_chat')} />
      )}

      {/* VIEW 2: Telegram Bot Chat & /start Flow (Matches Screenshot 2) */}
      {telegramViewMode === 'bot_chat' && (
        <TelegramBotChatView onOpenProfile={() => setTelegramViewMode('bot_profile')} />
      )}

      {/* VIEW 3: Live Mini App */}
      {telegramViewMode === 'miniapp' && (
        <>
          {/* Top Header Bar */}
          <Header />

          {/* Main View Area */}
          <div className="px-3 pt-3">
            {activeTab === 'home' && (
              <HomeView onOpenDetail={(artwork) => setSelectedArtwork(artwork)} />
            )}
            {activeTab === 'discover' && (
              <DiscoverView onOpenDetail={(artwork) => setSelectedArtwork(artwork)} />
            )}
            {activeTab === 'create' && <CreateView />}
            {activeTab === 'wallet' && <WalletView />}
            {activeTab === 'profile' && (
              <ProfileView onOpenDetail={(artwork) => setSelectedArtwork(artwork)} />
            )}
          </div>

          {/* Bottom Ergonomic Navigation Bar */}
          <BottomNav />
        </>
      )}

      {/* Fullscreen Hero Artwork Inspector Modal */}
      {selectedArtwork && (
        <ArtworkModal
          artwork={selectedArtwork}
          onClose={() => setSelectedArtwork(null)}
        />
      )}

      {/* 1-Tap Collection Modal */}
      {collectModalArtwork && (
        <CollectModal
          artwork={collectModalArtwork}
          onClose={() => setCollectModalArtwork(null)}
        />
      )}

      {/* Artwork to Crypto Conversion Modal */}
      {convertModalArtwork && (
        <ConvertModal
          artwork={convertModalArtwork}
          onClose={() => setConvertModalArtwork(null)}
        />
      )}

      {/* Community Value 500+ Interaction Inspector Drawer */}
      {communityDrawerArtwork && (
        <CommunityValueDrawer
          artwork={communityDrawerArtwork}
          onClose={() => setCommunityDrawerArtwork(null)}
        />
      )}

      {/* Multi-Chain Web3 Send / Receive / Buy Modals */}
      <SendModal />
      <ReceiveModal />
      <BuyModal />

      {/* Account Settings & Seed Phrase Backup Modals */}
      <SettingsModal />
      <SeedPhraseModal />

      {/* Binance-style P2P Escrow Market Modal / Full Sheet */}
      {p2pModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#09090d]/95 backdrop-blur-2xl flex flex-col no-scrollbar">
          <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-[#09090d]/90 backdrop-blur-md border-b border-white/5">
            <span className="text-xs font-mono tracking-widest uppercase text-stone-300">
              AURA P2P Trading Desk
            </span>
            <button
              onClick={() => setP2pModalOpen(false)}
              className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400 hover:text-stone-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-w-xl mx-auto w-full px-3 pt-2 pb-24">
            <P2PView
              onSelectOffer={(offer) => setSelectedP2POffer(offer)}
              onOpenCreateOffer={() => setCreateP2POfferOpen(true)}
            />
          </div>
        </div>
      )}

      {/* Active P2P Trade Sheet (Smart Contract Escrow) */}
      {(selectedP2POffer || activeP2POrder) && (
        <P2PTradeModal
          offer={selectedP2POffer}
          onClose={() => setSelectedP2POffer(null)}
        />
      )}

      {/* Post P2P Ad Modal */}
      {createP2POfferOpen && (
        <CreateP2POfferModal onClose={() => setCreateP2POfferOpen(false)} />
      )}

      {/* Collection / Art Creator Hub Modal (Like photo uploaded by user) */}
      {selectedCollection && (
        <CollectionHubModal
          collection={selectedCollection}
          onClose={() => setSelectedCollection(null)}
          onOpenArtworkDetail={(artwork) => setSelectedArtwork(artwork)}
        />
      )}

      {/* Make Offer Modal */}
      {makeOfferArtwork && (
        <MakeOfferModal
          artwork={makeOfferArtwork}
          onClose={() => setMakeOfferArtwork(null)}
        />
      )}

      {/* Sell Artwork / Photo on P2P Desk for Cash Modal */}
      {sellArtworkP2PModal && (
        <SellArtP2PModal
          artwork={sellArtworkP2PModal}
          onClose={() => setSellArtworkP2PModal(null)}
        />
      )}
      </TelegramFrame>
    </>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
