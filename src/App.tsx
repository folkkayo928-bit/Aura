/** 
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/auth/AuthModal';
import { MfaSessionGate } from './components/auth/MfaSessionGate';
import { P2POffer } from './types';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';

import { HomeView } from './components/views/HomeView';
import { DiscoverView } from './components/views/DiscoverView';
import { CreateView } from './components/views/CreateView';
import { WalletView } from './components/views/WalletView';
import { ProfileView } from './components/views/ProfileView';
import { PublicProfileView } from './components/views/PublicProfileView';
import { Creator } from './types';

import { ArtworkModal } from './components/ArtworkModal';
import { CollectModal } from './components/CollectModal';
import { ConvertModal } from './components/ConvertModal';
import { CommunityValueDrawer } from './components/CommunityValueDrawer';
import { SendModal, ReceiveModal, BuyModal } from './components/SendReceiveModals';

import { SettingsModal } from './components/settings/SettingsModal';
import { SeedPhraseModal } from './components/settings/SeedPhraseModal';

import { P2PView } from './components/p2p/P2PView';
import { P2PTradeCenterView } from './components/p2p/P2PTradeCenterView';
import { P2PTradeModal } from './components/p2p/P2PTradeModal';
import { CreateP2POfferModal } from './components/p2p/CreateP2POfferModal';
import { SellArtP2PModal } from './components/p2p/SellArtP2PModal';
import { CollectionHubModal } from './components/marketplace/CollectionHubModal';
import { MakeOfferModal } from './components/marketplace/MakeOfferModal';
import { X } from 'lucide-react';
import { AdminView } from './components/admin/AdminView';

const TelegramWebAppBridge: React.FC = () => {
  const { setIsTelegramShellMode, setTelegramViewMode, updateUserProfile } = useApp();
  const { user, signInWithTelegram, signOut, closeAuth } = useAuth();
  const autoAuthAttempted = React.useRef<string | null>(null);

  React.useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) return;

    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation?.();
    tg.setHeaderColor?.('#101017');
    tg.setBackgroundColor?.('#09090d');
    setIsTelegramShellMode(true);
    setTelegramViewMode('miniapp');

    const initData = String(tg.initData || '').trim();
    const tgUser = tg.initDataUnsafe?.user;
    const telegramId = String(tgUser?.id || '').trim();
    // Only telegram_id is trusted here. Never use Supabase/provider `sub` as a
    // Telegram identity because it can represent a different subject namespace.
    const sessionTelegramId = String(user?.user_metadata?.telegram_id || '').trim();
    let signedOutForTelegramId = '';
    try { signedOutForTelegramId = sessionStorage.getItem('aura_telegram_signed_out_id') || ''; } catch {}

    // Telegram's numeric user ID is the immutable external identity. Never
    // reuse another Telegram account's persisted Supabase session in the same
    // Mini App webview. A different Telegram ID means this is a different AURA account.
    const telegramSessionMismatch = Boolean(
      initData && telegramId && user && sessionTelegramId !== telegramId
    );
    const shouldAutoAuth = Boolean(
      initData && telegramId && !user && signedOutForTelegramId !== telegramId
    );

    if ((shouldAutoAuth || telegramSessionMismatch) && autoAuthAttempted.current !== telegramId) {
      autoAuthAttempted.current = telegramId;
      void (async () => {
        // Fully clear the previous account before authenticating the Telegram
        // identity currently opening AURA. This prevents cross-account reuse
        // of the persisted Supabase session in Telegram's shared WebView.
        if (telegramSessionMismatch && user) await signOut();
        const result = await signInWithTelegram();
        if (!result.error && result.telegramId === telegramId) {
          try { sessionStorage.removeItem('aura_telegram_signed_out_id'); } catch {}
          closeAuth();
        } else if (!result.error) {
          await signOut();
        }
      })();
      return;
    }

    if (user && tgUser && sessionTelegramId === telegramId) {
      const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').trim();
      void updateUserProfile({
        ...(fullName ? { name: fullName } : {}),
        ...(tgUser.username ? { telegramHandle: `@${tgUser.username}` } : {}),
      });
    }
  }, [user, signInWithTelegram, closeAuth, setIsTelegramShellMode, setTelegramViewMode, updateUserProfile]);

  return null;
};

const AppContent: React.FC = () => {
  const {
    artworks,
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
    setActiveP2POrder,
    isTelegramShellMode,
  } = useApp();

  const { user, loading: authLoading, openAuth } = useAuth();
  const [selectedP2POffer, setSelectedP2POffer] = useState<P2POffer | null>(null);

  React.useEffect(() => {
    if (!isTelegramShellMode || authLoading || user) return;
    const timer = window.setTimeout(() => openAuth('signup'), 1200);
    return () => window.clearTimeout(timer);
  }, [isTelegramShellMode, authLoading, user, openAuth]);
  const [adminOpen, setAdminOpen] = useState(false);
  const [publicProfileCreator, setPublicProfileCreator] = useState<Creator | null>(null);

  const openPublicProfile = (creator: Creator) => {
    // Public creator profiles must always take priority over an artwork/collection overlay.
    setSelectedArtwork(null);
    setSelectedCollection(null);
    setPublicProfileCreator(creator);
  };

  React.useEffect(() => {
    const open = () => setAdminOpen(true);
    window.addEventListener('aura-admin-open', open);
    return () => window.removeEventListener('aura-admin-open', open);
  }, []);
  const [createP2POfferOpen, setCreateP2POfferOpen] = useState(false);

  const openP2PTrade = (offer: P2POffer) => {
    setP2pModalOpen(false);
    setSelectedP2POffer(offer);
  };

  const closeP2PTrade = () => {
    setSelectedP2POffer(null);
    // The order remains server-side; clearing local state only exits the trade screen.
    setActiveP2POrder(null);
    setP2pModalOpen(true);
  };

  const telegramAccountRequired = isTelegramShellMode && !authLoading && !user;

  return (
    <MfaSessionGate>
      <TelegramWebAppBridge />
      {telegramAccountRequired ? (
        <div className="min-h-screen bg-[#09090d] px-5 pt-24 text-center text-stone-100">
          <div className="mx-auto max-w-sm rounded-3xl border border-amber-400/15 bg-white/[0.03] p-7 shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300 text-xl">A</div>
            <h1 className="mt-5 text-2xl font-light">Create your AURA account</h1>
            <p className="mt-2 text-xs leading-5 text-stone-500">
              An account is required to enter the AURA Mini App. Create one with Google, Apple, Telegram, or email.
            </p>
            <button type="button" onClick={() => openAuth('signup')} className="mt-5 w-full rounded-2xl bg-amber-400 py-3.5 text-sm font-bold text-stone-950">
              Create account / Sign in
            </button>
          </div>
        </div>
      ) : (
        <>
          {adminOpen && <AdminView onBack={() => setAdminOpen(false)} />}
          <Header />
          <div className="px-3 pt-3">
            {activeTab === 'home' && <HomeView onOpenDetail={(artwork) => setSelectedArtwork(artwork)} onOpenProfile={openPublicProfile} />}
            {activeTab === 'discover' && <DiscoverView onOpenDetail={(artwork) => setSelectedArtwork(artwork)} onOpenProfile={openPublicProfile} />}
            {activeTab === 'create' && <CreateView />}
            {activeTab === 'wallet' && <WalletView />}
            {activeTab === 'profile' && <ProfileView onOpenDetail={(artwork) => setSelectedArtwork(artwork)} />}
            {activeTab === 'p2p_trade' && <P2PTradeCenterView onResume={() => setP2pModalOpen(true)} />}
          </div>
          <BottomNav />
          {selectedArtwork && <ArtworkModal artwork={selectedArtwork} onClose={() => setSelectedArtwork(null)} />}
          {collectModalArtwork && <CollectModal artwork={collectModalArtwork} onClose={() => setCollectModalArtwork(null)} />}
          {convertModalArtwork && <ConvertModal artwork={convertModalArtwork} onClose={() => setConvertModalArtwork(null)} />}
          {communityDrawerArtwork && <CommunityValueDrawer artwork={communityDrawerArtwork} onClose={() => setCommunityDrawerArtwork(null)} />}
          <SendModal />
          <ReceiveModal />
          <BuyModal />
          <SettingsModal />
          <SeedPhraseModal />
          {p2pModalOpen && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-[#09090d]/95 backdrop-blur-2xl flex flex-col no-scrollbar">
              <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-[#09090d]/90 backdrop-blur-md border-b border-white/5">
                <span className="text-xs font-mono tracking-widest uppercase text-stone-300">AURA P2P Trading Desk</span>
                <button onClick={() => setP2pModalOpen(false)} className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400 hover:text-stone-100"><X className="w-4 h-4" /></button>
              </div>
              <div className="max-w-xl mx-auto w-full px-3 pt-2 pb-24">
                <P2PView onSelectOffer={openP2PTrade} onOpenCreateOffer={() => setCreateP2POfferOpen(true)} />
              </div>
            </div>
          )}
          {(selectedP2POffer || activeP2POrder) && <P2PTradeModal offer={selectedP2POffer} onClose={closeP2PTrade} />}
          {createP2POfferOpen && <CreateP2POfferModal onClose={() => setCreateP2POfferOpen(false)} />}
          {selectedCollection && <CollectionHubModal collection={selectedCollection} onClose={() => setSelectedCollection(null)} onOpenArtworkDetail={(artwork) => setSelectedArtwork(artwork)} />}
          {makeOfferArtwork && <MakeOfferModal artwork={makeOfferArtwork} onClose={() => setMakeOfferArtwork(null)} />}
          {sellArtworkP2PModal && <SellArtP2PModal artwork={sellArtworkP2PModal} onClose={() => setSellArtworkP2PModal(null)} />}
          {publicProfileCreator && (
            <PublicProfileView
              creator={publicProfileCreator}
              artworks={artworks}
              onBack={() => setPublicProfileCreator(null)}
              onOpenDetail={(artwork) => { setPublicProfileCreator(null); setSelectedArtwork(artwork); }}
            />
          )}
        </>
      )}
      <AuthModal />
    </MfaSessionGate>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AuthProvider>
  );
}
