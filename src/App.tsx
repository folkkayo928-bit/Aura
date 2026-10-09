/** 
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { supabase } from './lib/supabase';
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

const TelegramWebAppBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setIsTelegramShellMode, setTelegramViewMode, updateUserProfile } = useApp();
  const { user, loading: authLoading, signInWithTelegram, signOut, closeAuth } = useAuth();
  const autoAuthAttempted = React.useRef<string | null>(null);
  const switchingAccount = React.useRef(false);
  const [identityStatus, setIdentityStatus] = React.useState<'checking' | 'ready' | 'error'>('checking');
  const [identityError, setIdentityError] = React.useState('');

  React.useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) {
      setIdentityStatus('ready');
      return;
    }

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

    // Without signed Mini App initData, don't guess which Telegram identity is
    // active. The server verifies initData before it issues a Supabase session.
    if (!initData || !/^\d{1,20}$/.test(telegramId)) {
      setIdentityError('Telegram did not provide a valid signed Mini App session. Reopen AURA from Telegram and retry.');
      setIdentityStatus('error');
      return;
    }
    if (authLoading || switchingAccount.current) {
      setIdentityStatus('checking');
      return;
    }

    // A persisted Supabase session belongs to a specific Telegram numeric ID.
    // Never let MFA or the wallet UI render until that ID matches this Mini App.
    const sessionTelegramId = String(user?.user_metadata?.telegram_id || '').trim();
    let signedOutForTelegramId = '';
    try { signedOutForTelegramId = sessionStorage.getItem('aura_telegram_signed_out_id') || ''; } catch {}

    const telegramSessionMismatch = Boolean(user && sessionTelegramId !== telegramId);
    const shouldAutoAuth = Boolean(!user && signedOutForTelegramId !== telegramId);

    if ((shouldAutoAuth || telegramSessionMismatch) && autoAuthAttempted.current !== telegramId) {
      autoAuthAttempted.current = telegramId;
      switchingAccount.current = true;
      setIdentityStatus('checking');
      setIdentityError('');

      void (async () => {
        let matchedSession = false;
        let errorMessage = '';
        try {
          // Sign out the old identity before creating a session for this one.
          // AuthContext records explicit Telegram sign-outs to prevent auto-login;
          // this is an account switch, so clear that marker after signOut or a
          // transient auth/network error would block the current account on reload.
          if (telegramSessionMismatch && user) {
            try { sessionStorage.removeItem('aura_telegram_signed_out_id'); } catch {}
            await signOut();
            try { sessionStorage.removeItem('aura_telegram_signed_out_id'); } catch {}
          }

          const result = await signInWithTelegram();
          if (result.error) {
            errorMessage = result.error;
          } else if (result.telegramId !== telegramId) {
            errorMessage = 'The Telegram account returned by authentication did not match this Mini App.';
            await signOut();
          } else {
            const { data: activeSession, error: sessionError } = await supabase.auth.getUser();
            const activeTelegramId = String(activeSession.user?.user_metadata?.telegram_id || '').trim();
            if (sessionError || !activeSession.user || activeTelegramId !== telegramId) {
              errorMessage = 'AURA could not verify that the active session belongs to this Telegram account.';
              await signOut();
            } else {
              matchedSession = true;
              try { sessionStorage.removeItem('aura_telegram_signed_out_id'); } catch {}
              closeAuth();
            }
          }
        } catch (error) {
          errorMessage = error instanceof Error ? error.message : 'Telegram account verification failed.';
        } finally {
          switchingAccount.current = false;
          if (matchedSession) {
            setIdentityError('');
            setIdentityStatus('ready');
          } else {
            setIdentityError(errorMessage || 'AURA could not securely switch to this Telegram account. Reload to retry.');
            setIdentityStatus('error');
          }
        }
      })();
      return;
    }

    if (telegramSessionMismatch) {
      // An attempted switch failed. Showing the stale session is never safe,
      // particularly when the old account has a verified authenticator factor.
      setIdentityError('The saved AURA session belongs to a different Telegram account. Reload to verify the current account.');
      setIdentityStatus('error');
      return;
    }

    if (user && tgUser && sessionTelegramId === telegramId) {
      const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').trim();
      void updateUserProfile({
        ...(fullName ? { name: fullName } : {}),
        ...(tgUser.username ? { telegramHandle: `@${tgUser.username}` } : {}),
      });
    }

    setIdentityStatus('ready');
  }, [user, authLoading, signInWithTelegram, signOut, closeAuth, setIsTelegramShellMode, setTelegramViewMode, updateUserProfile]);

  if (identityStatus === 'checking') {
    return (
      <div className="fixed inset-0 z-[110] bg-[#09090d] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-amber-300/25 border-t-amber-300 animate-spin" />
          <p className="mt-4 text-xs text-stone-400">Verifying your Telegram account securely…</p>
        </div>
      </div>
    );
  }

  if (identityStatus === 'error') {
    return (
      <div className="fixed inset-0 z-[110] bg-[#09090d] flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-3xl border border-rose-500/20 bg-[#12121a] p-6 text-center">
          <h2 className="text-lg font-serif text-stone-100">Account verification needed</h2>
          <p className="mt-3 text-xs leading-5 text-stone-400">{identityError}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 w-full rounded-xl bg-amber-400 py-3 text-xs font-bold text-stone-950">
            Reload and retry
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
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
    <TelegramWebAppBridge>
      <MfaSessionGate>
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
    </TelegramWebAppBridge>
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
