import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import { MfaEnrollmentModal } from '../auth/MfaEnrollmentModal';
import { PaymentMethodsPanel } from './PaymentMethodsPanel';
import {
  X,
  Settings,
  User,
  Key,
  Link,
  Bell,
  ShieldCheck,
  Check,
  Trash2,
  Plus,
  Camera,
  Image as ImageIcon,
  AlertTriangle,
  CreditCard,
  Fingerprint,
  Loader2,
} from 'lucide-react';

export const SettingsModal: React.FC = () => {
  const { user, signOut, updatePassword } = useAuth();
  const {
    settingsModalOpen,
    setSettingsModalOpen,
    userProfile,
    updateUserProfile,
    setSeedPhraseModalOpen,
    connectedWallets,
    connectExternalWallet,
    disconnectExternalWallet,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'profile' | 'payments' | 'wallets' | 'security' | 'preferences'>('profile');

  const [name, setName] = useState(userProfile.name);
  const [telegramHandle, setTelegramHandle] = useState(userProfile.telegramHandle);
  const [bio, setBio] = useState(userProfile.bio);
  const [avatar, setAvatar] = useState(userProfile.avatar);
  const [coverImage, setCoverImage] = useState(userProfile.coverImage || '');
  const [defaultCurrency, setDefaultCurrency] = useState(userProfile.defaultCurrency);
  const [telegramBotAlerts, setTelegramBotAlerts] = useState(userProfile.telegramBotAlerts);

  const [connectWalletPickerOpen, setConnectWalletPickerOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [mfaEnrollmentOpen, setMfaEnrollmentOpen] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState('');
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [passkeys, setPasskeys] = useState<Array<{ id: string; friendly_name?: string; created_at?: string }>>([]);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyError, setPasskeyError] = useState('');
  const [passkeyMessage, setPasskeyMessage] = useState('');
  const [pendingDeletePasskeyId, setPendingDeletePasskeyId] = useState<string | null>(null);

  useEffect(() => {
    const handleSettingsTab = (event: Event) => {
      const requested = (event as CustomEvent<{ tab?: string }>).detail?.tab;
      if (requested && ['profile', 'payments', 'wallets', 'security', 'preferences'].includes(requested)) {
        setActiveTab(requested as 'profile' | 'payments' | 'wallets' | 'security' | 'preferences');
      }
    };
    window.addEventListener('aura-settings-tab', handleSettingsTab);
    return () => window.removeEventListener('aura-settings-tab', handleSettingsTab);
  }, []);

  useEffect(() => {
    if (!settingsModalOpen || activeTab !== 'security' || !user) return;
    let cancelled = false;

    setMfaLoading(true);
    setMfaError('');
    void supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (cancelled) return;
      setMfaLoading(false);
      if (error) {
        setMfaError(error.message);
        return;
      }
      const verified = data.totp.find((factor) => factor.status === 'verified');
      setMfaFactorId(verified?.id || null);
    });

    return () => {
      cancelled = true;
    };
  }, [settingsModalOpen, activeTab, user]);

  const refreshPasskeys = async () => {
    if (!user) return;
    setPasskeyLoading(true);
    setPasskeyError('');
    try {
      const { data, error } = await supabase.auth.passkey.list();
      if (error) {
        const lower = error.message.toLowerCase();
        setPasskeyError(lower.includes('passkey_disabled')
          ? 'Passkeys are not enabled in the hosted Supabase Auth project yet. Use Google, Apple, Telegram or email until the project WebAuthn settings are enabled.'
          : error.message);
        setPasskeys([]);
      } else {
        setPasskeys((data || []) as Array<{ id: string; friendly_name?: string; created_at?: string }>);
      }
    } catch (cause) {
      setPasskeyError(cause instanceof Error ? cause.message : 'Could not load passkeys.');
    } finally {
      setPasskeyLoading(false);
    }
  };

  const registerPasskey = async () => {
    if (!user) return;
    setPasskeyBusy(true);
    setPasskeyError('');
    setPasskeyMessage('');
    try {
      const { data, error } = await supabase.auth.registerPasskey();
      if (error) {
        const lower = error.message.toLowerCase();
        setPasskeyError(lower.includes('passkey_disabled')
          ? 'Passkeys are not enabled in the hosted Supabase Auth project yet. No credential was registered.'
          : lower.includes('notallowederror') || lower.includes('cancelled')
            ? 'Passkey creation was canceled or not allowed by this device.'
            : error.message);
        return;
      }
      setPasskeyMessage('Passkey registered on this device: ' + String(data?.friendly_name || 'Passkey') + '.');
      await refreshPasskeys();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause || '');
      setPasskeyError(message.toLowerCase().includes('passkey_disabled')
        ? 'Passkeys are not enabled in the hosted Supabase Auth project yet. No credential was registered.'
        : message || 'Could not register a passkey.');
    } finally {
      setPasskeyBusy(false);
    }
  };

  const deletePasskey = async (passkeyId: string) => {
    setPasskeyBusy(true);
    setPasskeyError('');
    setPasskeyMessage('');
    try {
      const { error } = await supabase.auth.passkey.delete({ passkeyId });
      if (error) {
        setPasskeyError(error.message);
      } else {
        setPasskeyMessage('Passkey removed from this AURA account.');
        setPendingDeletePasskeyId(null);
        await refreshPasskeys();
      }
    } catch (cause) {
      setPasskeyError(cause instanceof Error ? cause.message : 'Could not remove the passkey.');
    } finally {
      setPasskeyBusy(false);
    }
  };

  useEffect(() => {
    if (!settingsModalOpen || activeTab !== 'security' || !user) return;
    let cancelled = false;
    setPasskeyLoading(true);
    setPasskeyError('');
    void supabase.auth.passkey.list().then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        const lower = error.message.toLowerCase();
        setPasskeyError(lower.includes('passkey_disabled')
          ? 'Passkeys are not enabled in the hosted Supabase Auth project yet. Use the existing login methods until WebAuthn settings are enabled.'
          : error.message);
        setPasskeys([]);
      } else {
        setPasskeys((data || []) as Array<{ id: string; friendly_name?: string; created_at?: string }>);
      }
    }).catch((cause) => {
      if (!cancelled) setPasskeyError(cause instanceof Error ? cause.message : 'Could not load passkeys.');
    }).finally(() => {
      if (!cancelled) setPasskeyLoading(false);
    });
    return () => { cancelled = true; };
  }, [settingsModalOpen, activeTab, user]);

  const handleImageUpload = async (file: File, setter: (value: string) => void) => {
    if (!user || !file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${user.id}/profile-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('aura-artworks').upload(path, file, {
      upsert: true,
      cacheControl: '31536000',
      contentType: file.type,
    });
    if (error) return;
    const { data } = supabase.storage.from('aura-artworks').getPublicUrl(path);
    setter(data.publicUrl);
  };

  if (!settingsModalOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const saved = await updateUserProfile({
      name: name.trim(),
      telegramHandle: telegramHandle.trim(),
      bio: bio.trim(),
      avatar: avatar.trim(),
      coverImage: coverImage.trim(),
      defaultCurrency,
      telegramBotAlerts,
      twoFactorEnabled: Boolean(mfaFactorId),
    });
    if (saved) setSettingsModalOpen(false);
  };

  const refreshMfaState = async () => {
    if (!user) return;
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setMfaError(error.message);
      return;
    }
    const verified = data.totp.find((factor) => factor.status === 'verified');
    setMfaFactorId(verified?.id || null);
  };

  const disableMfa = async () => {
    if (!mfaFactorId) return;
    setMfaLoading(true);
    setMfaError('');
    const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
    if (error) {
      setMfaError(error.message);
      setMfaLoading(false);
      return;
    }
    await refreshMfaState();
    await updateUserProfile({ twoFactorEnabled: false });
    setMfaLoading(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4">
        <div
          className="w-full max-w-md bg-[#12121a] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-6 max-h-[92vh] overflow-y-auto no-scrollbar"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-400" />
              <span className="text-xs uppercase tracking-widest font-mono text-stone-300">Account & Vault Settings</span>
            </div>
            <button onClick={() => setSettingsModalOpen(false)} className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400 hover:text-stone-100">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 bg-white/5 rounded-2xl border border-white/5 mb-5 overflow-x-auto no-scrollbar">
            {[
              { id: 'profile', label: 'Profile', icon: User },
              { id: 'payments', label: 'Payment Methods', icon: CreditCard },
              { id: 'wallets', label: 'Web3 Wallets', icon: Link },
              { id: 'security', label: 'Vault & Keys', icon: Key },
              { id: 'preferences', label: 'Preferences', icon: Bell },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${isActive ? 'bg-amber-400 text-stone-950 font-semibold shadow-sm' : 'text-stone-400 hover:text-stone-200'}`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-3">
                <div className="relative h-24 overflow-hidden rounded-2xl border border-white/10 bg-[#191923]">
                  {coverImage ? <img src={coverImage} alt="Profile cover" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-[radial-gradient(circle_at_20%_20%,rgba(245,158,11,.25),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(34,211,238,.2),transparent_30%),linear-gradient(135deg,#181620,#09090d)]" />}
                  <label className="absolute right-2 bottom-2 cursor-pointer rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-[10px] font-semibold text-white backdrop-blur-md">
                    <span className="flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" /> Change cover</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], setCoverImage)} />
                  </label>
                </div>

                <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                  <div className="relative shrink-0">
                    <img src={avatar || userProfile.avatar} alt={name} className="w-16 h-16 rounded-full object-cover border-2 border-amber-400/40" />
                    <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-full bg-amber-400 p-2 text-stone-950 border-2 border-[#12121a]">
                      <Camera className="w-3.5 h-3.5" />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], setAvatar)} />
                    </label>
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="text-[11px] text-stone-400 block mb-1">Profile picture URL or upload</label>
                    <input type="text" value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://..." className="w-full bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-stone-200 font-mono truncate focus:outline-none focus:border-amber-400/60" />
                    <p className="mt-1 text-[9px] text-stone-600">Images are stored in your AURA profile media bucket.</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-stone-400 block mb-1 font-medium">Display Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-400/60" required />
              </div>

              <div>
                <label className="text-xs text-stone-400 block mb-1 font-medium">Telegram Handle</label>
                <input type="text" value={telegramHandle} onChange={(e) => setTelegramHandle(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-400/60" required />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-stone-400 font-medium">Bio / About you</label>
                  <span className="text-[10px] text-stone-600">{bio.length}/280</span>
                </div>
                <textarea
                  rows={4}
                  maxLength={280}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell collectors what you create, collect, or care about."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-stone-100 placeholder:text-stone-600 focus:outline-none focus:border-amber-400/60 resize-none"
                />
              </div>

              <button type="submit" className="w-full py-3.5 rounded-xl bg-amber-400 text-stone-950 font-bold text-xs hover:bg-amber-300 transition-colors shadow-lg shadow-amber-500/10">Save Profile Changes</button>
            </form>
          )}

          {activeTab === 'payments' && <PaymentMethodsPanel />}

          {activeTab === 'wallets' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-mono text-stone-400 uppercase tracking-wider">Linked Web3 Wallets</span>
                <button onClick={() => setConnectWalletPickerOpen(!connectWalletPickerOpen)} className="flex items-center gap-1 text-amber-300 hover:text-amber-200 font-medium">
                  <Plus className="w-3.5 h-3.5" /><span>Link Wallet</span>
                </button>
              </div>

              {connectWalletPickerOpen && (
                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-amber-400/30 space-y-2 animate-in fade-in-50">
                  <span className="text-[11px] text-amber-300 font-semibold block">Select Web3 Provider to Connect</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { connectExternalWallet('MetaMask', 'ethereum'); setConnectWalletPickerOpen(false); }} className="p-2.5 rounded-xl bg-white/5 hover:bg-amber-500/20 border border-white/10 text-center transition-colors">
                      <span className="text-xs font-semibold block text-stone-200">MetaMask</span>
                      <span className="text-[9px] text-amber-300 font-mono">Ethereum</span>
                    </button>
                    <button onClick={() => { connectExternalWallet('MetaMask', 'polygon'); setConnectWalletPickerOpen(false); }} className="p-2.5 rounded-xl bg-white/5 hover:bg-amber-500/20 border border-white/10 text-center transition-colors">
                      <span className="text-xs font-semibold block text-stone-200">MetaMask</span>
                      <span className="text-[9px] text-amber-300 font-mono">Polygon</span>
                    </button>
                    <button onClick={() => { connectExternalWallet('MetaMask', 'arbitrum'); setConnectWalletPickerOpen(false); }} className="p-2.5 rounded-xl bg-white/5 hover:bg-amber-500/20 border border-white/10 text-center transition-colors">
                      <span className="text-xs font-semibold block text-stone-200">MetaMask</span>
                      <span className="text-[9px] text-amber-300 font-mono">Arbitrum</span>
                    </button>
                    <button onClick={() => { connectExternalWallet('MetaMask', 'bsc'); setConnectWalletPickerOpen(false); }} className="p-2.5 rounded-xl bg-white/5 hover:bg-amber-500/20 border border-white/10 text-center transition-colors">
                      <span className="text-xs font-semibold block text-stone-200">MetaMask</span>
                      <span className="text-[9px] text-amber-300 font-mono">BNB Smart Chain</span>
                    </button>
                    <button onClick={() => { connectExternalWallet('Phantom', 'solana'); setConnectWalletPickerOpen(false); }} className="p-2.5 rounded-xl bg-white/5 hover:bg-purple-500/20 border border-white/10 text-center transition-colors">
                      <span className="text-xs font-semibold block text-stone-200">Phantom</span>
                      <span className="text-[9px] text-purple-300 font-mono">Solana</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {connectedWallets.length === 0 ? (
                  <div className="p-6 text-center rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-stone-500">No external Web3 wallets linked yet. Choose the correct EVM network for MetaMask, or connect Phantom on Solana.</div>
                ) : (
                  connectedWallets.map((wallet) => (
                    <div key={wallet.id} className="p-3.5 rounded-2xl bg-[#151520] border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-amber-300 border border-white/10"><Link className="w-4 h-4" /></div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-stone-200">{wallet.name}</span>
                            <span className="text-[9px] font-mono text-cyan-300 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-500/20 uppercase">{wallet.network}</span>
                          </div>
                          <span className="text-[10px] text-stone-400 font-mono block mt-0.5">{wallet.address}</span>
                        </div>
                      </div>
                      <button onClick={() => disconnectExternalWallet(wallet.id)} className="p-2 text-stone-500 hover:text-rose-400 transition-colors" title="Disconnect wallet"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 space-y-2">
                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" />AURA Account Security</span>
                <p className="text-xs text-stone-300 leading-relaxed">AURA does not show or store a recovery phrase in the browser. External wallet providers keep their own recovery credentials.</p>
                <button onClick={() => setSeedPhraseModalOpen(true)} className="w-full mt-2 py-3 rounded-xl bg-cyan-400 text-stone-950 font-bold text-xs hover:bg-cyan-300 transition-colors">Wallet Security Guide</button>
              </div>

              {user?.email && (
                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500">Account email</span>
                  <span className="mt-1 block text-sm text-stone-200 break-all">{user.email}</span>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                <span className="text-xs font-semibold text-stone-200">Change password</span>
                <div className="flex gap-2">
                  <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" minLength={6} placeholder="New password" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-400/60" />
                  <button
                    type="button"
                    onClick={async () => {
                      setPasswordMessage('');
                      if (newPassword.length < 6) { setPasswordMessage('Use at least 6 characters.'); return; }
                      const result = await updatePassword(newPassword);
                      setPasswordMessage(result.error || 'Password updated.');
                      if (!result.error) setNewPassword('');
                    }}
                    className="px-3 rounded-xl bg-white/10 text-xs font-semibold text-stone-200"
                  >
                    Update
                  </button>
                </div>
                {passwordMessage && <p className="text-[10px] text-stone-400">{passwordMessage}</p>}
              </div>

              <div className="p-4 rounded-2xl bg-amber-400/[0.04] border border-amber-400/15 space-y-3">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-stone-100 block">Two-Step Protection</span>
                    <span className="text-[11px] text-stone-500 block mt-1">
                      {mfaFactorId
                        ? 'Enabled with a real authenticator-app factor. AURA will require a code before opening the account.'
                        : 'Not enabled. Add an authenticator app to protect sign-ins with a second factor.'}
                    </span>
                  </div>
                </div>

                {mfaLoading ? (
                  <div className="text-[11px] text-stone-500">Checking authenticator status…</div>
                ) : mfaFactorId ? (
                  <div className="flex gap-2">
                    <div className="flex-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5 text-xs text-emerald-300 flex items-center gap-2">
                      <Check className="w-3.5 h-3.5" /> Authenticator verified
                    </div>
                    <button type="button" onClick={() => void disableMfa()} className="px-3 rounded-xl bg-white/5 border border-white/10 text-xs text-stone-300">
                      Disable
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setMfaEnrollmentOpen(true)} className="w-full rounded-xl bg-amber-400 text-stone-950 py-3 font-bold text-xs">
                    Set up authenticator
                  </button>
                )}

                {mfaError && (
                  <div className="flex gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-[11px] text-rose-300">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{mfaError}</span>
                  </div>
                )}

                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-3">
                  <div className="flex items-center gap-2 text-left">
                    <Fingerprint className="h-4 w-4 text-cyan-300" />
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-stone-200">Passkeys</span>
                      <span className="mt-0.5 block text-[10px] leading-relaxed text-stone-500">Use your device unlock, biometrics or security key to sign in. This protects your AURA account; it does not replace your wallet recovery phrase.</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => void registerPasskey()} disabled={passkeyBusy || passkeyLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 py-2.5 text-[11px] font-bold text-stone-950 disabled:opacity-50">
                    {passkeyBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Fingerprint className="h-3.5 w-3.5" />}
                    Add this device's passkey
                  </button>
                  {passkeyLoading ? (
                    <p className="text-[10px] text-stone-500">Checking registered passkeys…</p>
                  ) : passkeys.length > 0 ? (
                    <div className="space-y-2">
                      {passkeys.map((key) => (
                        <div key={key.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/20 p-2.5">
                          <div className="min-w-0">
                            <span className="block break-words text-[10px] text-stone-200">{key.friendly_name || 'AURA passkey'}</span>
                            <span className="mt-0.5 block text-[9px] text-stone-500">{key.created_at ? 'Added ' + new Date(key.created_at).toLocaleDateString() : 'Registered passkey'}</span>
                          </div>
                          {pendingDeletePasskeyId === key.id ? (
                            <div className="flex shrink-0 gap-1.5">
                              <button type="button" disabled={passkeyBusy} onClick={() => void deletePasskey(key.id)} className="rounded-lg bg-rose-500/15 px-2 py-1.5 text-[9px] text-rose-200 disabled:opacity-50">Remove</button>
                              <button type="button" disabled={passkeyBusy} onClick={() => setPendingDeletePasskeyId(null)} className="rounded-lg border border-white/10 px-2 py-1.5 text-[9px] text-stone-300">Keep</button>
                            </div>
                          ) : (
                            <button type="button" disabled={passkeyBusy} onClick={() => setPendingDeletePasskeyId(key.id)} className="shrink-0 rounded-lg border border-white/10 px-2 py-1.5 text-[9px] text-stone-300 disabled:opacity-50">Remove</button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-stone-500">No passkeys registered on this account yet.</p>
                  )}
                  {pendingDeletePasskeyId && <p className="text-[9px] leading-relaxed text-amber-100">Removing a passkey can remove access from its device. Keep Google, Apple, email or Telegram recovery available first.</p>}
                  {passkeyMessage && <p className="rounded-lg border border-emerald-400/15 bg-emerald-400/[0.04] p-2 text-[10px] text-emerald-200">{passkeyMessage}</p>}
                  {passkeyError && <p className="rounded-lg border border-amber-400/15 bg-amber-400/[0.04] p-2 text-[10px] leading-relaxed text-amber-100">{passkeyError}</p>}
                </div>
              </div>

              <button type="button" onClick={() => void signOut()} className="w-full py-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-300 font-semibold text-xs hover:bg-rose-500/10">Sign out of AURA</button>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-stone-400 block mb-1 font-medium">Default Display Currency</label>
                <select value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value as any)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-stone-200 focus:outline-none focus:border-amber-400/60">
                  <option value="USD" className="bg-[#12121a]">USD ($)</option>
                  <option value="EUR" className="bg-[#12121a]">EUR (€)</option>
                  <option value="GBP" className="bg-[#12121a]">GBP (£)</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
                <div>
                  <span className="text-xs font-medium text-stone-200 block">Telegram Alerts Preference</span>
                  <span className="text-[11px] text-stone-500 block">Stored as an account preference; real-time alert delivery is not yet connected to every event.</span>
                </div>
                <input type="checkbox" checked={telegramBotAlerts} onChange={(e) => setTelegramBotAlerts(e.target.checked)} className="w-4 h-4 accent-amber-400" />
              </div>

              <button
                onClick={() => {
                  void updateUserProfile({ defaultCurrency, telegramBotAlerts, twoFactorEnabled: Boolean(mfaFactorId) });
                  setSettingsModalOpen(false);
                }}
                className="w-full py-3.5 rounded-xl bg-amber-400 text-stone-950 font-bold text-xs"
              >
                Save Preferences
              </button>
            </div>
          )}
        </div>
      </div>

      <MfaEnrollmentModal
        open={mfaEnrollmentOpen}
        onClose={() => setMfaEnrollmentOpen(false)}
        onEnabled={() => {
          void refreshMfaState();
          void updateUserProfile({ twoFactorEnabled: true });
        }}
      />
    </>
  );
};
