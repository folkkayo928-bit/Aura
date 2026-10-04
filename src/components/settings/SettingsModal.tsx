import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Settings,
  User,
  Key,
  Link,
  Bell,
  ShieldCheck,
  Check,
  Smartphone,
  ExternalLink,
  Trash2,
  Plus,
} from 'lucide-react';

export const SettingsModal: React.FC = () => {
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

  const [activeTab, setActiveTab] = useState<'profile' | 'wallets' | 'security' | 'preferences'>('profile');

  // Form states
  const [name, setName] = useState(userProfile.name);
  const [telegramHandle, setTelegramHandle] = useState(userProfile.telegramHandle);
  const [bio, setBio] = useState(userProfile.bio);
  const [avatar, setAvatar] = useState(userProfile.avatar);
  const [defaultCurrency, setDefaultCurrency] = useState(userProfile.defaultCurrency);
  const [telegramBotAlerts, setTelegramBotAlerts] = useState(userProfile.telegramBotAlerts);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(userProfile.twoFactorEnabled);
  const [biometricAuth, setBiometricAuth] = useState(userProfile.biometricAuth);

  const [connectWalletPickerOpen, setConnectWalletPickerOpen] = useState(false);

  if (!settingsModalOpen) return null;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserProfile({
      name: name.trim(),
      telegramHandle: telegramHandle.trim(),
      bio: bio.trim(),
      avatar: avatar.trim(),
      defaultCurrency,
      telegramBotAlerts,
      twoFactorEnabled,
      biometricAuth,
    });
    setSettingsModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4">
      <div
        className="w-full max-w-md bg-[#12121a] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-6 max-h-[92vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-amber-400" />
            <span className="text-xs uppercase tracking-widest font-mono text-stone-300">
              Account & Vault Settings
            </span>
          </div>
          <button
            onClick={() => setSettingsModalOpen(false)}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400 hover:text-stone-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-white/5 rounded-2xl border border-white/5 mb-5 overflow-x-auto no-scrollbar">
          {[
            { id: 'profile', label: 'Profile', icon: User },
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-amber-400 text-stone-950 font-semibold shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: PROFILE MANAGEMENT */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <img
                src={avatar || userProfile.avatar}
                alt={name}
                className="w-14 h-14 rounded-full object-cover border-2 border-amber-400/40 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <label className="text-[11px] text-stone-400 block mb-1">Avatar Image URL</label>
                <input
                  type="text"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-stone-200 font-mono truncate focus:outline-none focus:border-amber-400/60"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-stone-400 block mb-1 font-medium">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-400/60"
                required
              />
            </div>

            <div>
              <label className="text-xs text-stone-400 block mb-1 font-medium">Telegram Handle</label>
              <div className="relative">
                <input
                  type="text"
                  value={telegramHandle}
                  onChange={(e) => setTelegramHandle(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-400/60"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-stone-400 block mb-1 font-medium">Collector Bio / Statement</label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-400/60 resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-amber-400 text-stone-950 font-bold text-xs hover:bg-amber-300 transition-colors shadow-lg shadow-amber-500/10"
            >
              Save Profile Changes
            </button>
          </form>
        )}

        {/* TAB 2: EXTERNAL WEB3 WALLETS */}
        {activeTab === 'wallets' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-mono text-stone-400 uppercase tracking-wider">Linked Web3 Wallets</span>
              <button
                onClick={() => setConnectWalletPickerOpen(!connectWalletPickerOpen)}
                className="flex items-center gap-1 text-amber-300 hover:text-amber-200 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Link Wallet</span>
              </button>
            </div>

            {connectWalletPickerOpen && (
              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-amber-400/30 space-y-2 animate-in fade-in-50">
                <span className="text-[11px] text-amber-300 font-semibold block">Select Web3 Provider to Connect</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      connectExternalWallet('Tonkeeper', 'ton');
                      setConnectWalletPickerOpen(false);
                    }}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-cyan-500/20 border border-white/10 text-center transition-colors"
                  >
                    <span className="text-xs font-semibold block text-stone-200">Tonkeeper</span>
                    <span className="text-[9px] text-cyan-300 font-mono">TON Network</span>
                  </button>
                  <button
                    onClick={() => {
                      connectExternalWallet('MetaMask', 'polygon');
                      setConnectWalletPickerOpen(false);
                    }}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-amber-500/20 border border-white/10 text-center transition-colors"
                  >
                    <span className="text-xs font-semibold block text-stone-200">MetaMask</span>
                    <span className="text-[9px] text-amber-300 font-mono">Polygon / EVM</span>
                  </button>
                  <button
                    onClick={() => {
                      connectExternalWallet('Phantom', 'solana');
                      setConnectWalletPickerOpen(false);
                    }}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-purple-500/20 border border-white/10 text-center transition-colors"
                  >
                    <span className="text-xs font-semibold block text-stone-200">Phantom</span>
                    <span className="text-[9px] text-purple-300 font-mono">Solana</span>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {connectedWallets.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-stone-500">
                  No external Web3 wallets linked yet. Click "+ Link Wallet" above to connect Tonkeeper, MetaMask, or Phantom.
                </div>
              ) : (
                connectedWallets.map((wallet) => (
                  <div
                    key={wallet.id}
                    className="p-3.5 rounded-2xl bg-[#151520] border border-white/5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-amber-300 border border-white/10">
                        <Link className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-stone-200">{wallet.name}</span>
                          <span className="text-[9px] font-mono text-cyan-300 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-500/20 uppercase">
                            {wallet.network}
                          </span>
                        </div>
                        <span className="text-[10px] text-stone-400 font-mono block mt-0.5">
                          {wallet.address}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => disconnectExternalWallet(wallet.id)}
                      className="p-2 text-stone-500 hover:text-rose-400 transition-colors"
                      title="Disconnect wallet"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: VAULT SECURITY & RECOVERY PHRASE */}
        {activeTab === 'security' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/20 space-y-2">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Key className="w-4 h-4" />
                Non-Custodial Recovery Phrase
              </span>
              <p className="text-xs text-stone-300 leading-relaxed">
                Your 12-word cryptographic seed phrase controls your entire art vault and funds across all Web3 networks. Back it up safely.
              </p>
              <button
                onClick={() => setSeedPhraseModalOpen(true)}
                className="w-full mt-2 py-3 rounded-xl bg-amber-400 text-stone-950 font-bold text-xs hover:bg-amber-300 transition-colors"
              >
                View 12-Word Seed Phrase
              </button>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
                <div>
                  <span className="text-xs font-medium text-stone-200 block">Telegram 2-Step Verification</span>
                  <span className="text-[11px] text-stone-500 block">Require password for big transfers</span>
                </div>
                <input
                  type="checkbox"
                  checked={twoFactorEnabled}
                  onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                  className="w-4 h-4 accent-amber-400"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
                <div>
                  <span className="text-xs font-medium text-stone-200 block">Biometric Vault Unlock</span>
                  <span className="text-[11px] text-stone-500 block">FaceID / TouchID biometric auth</span>
                </div>
                <input
                  type="checkbox"
                  checked={biometricAuth}
                  onChange={(e) => setBiometricAuth(e.target.checked)}
                  className="w-4 h-4 accent-amber-400"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PREFERENCES */}
        {activeTab === 'preferences' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-stone-400 block mb-1 font-medium">Default Display Currency</label>
              <select
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value as any)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-stone-200 focus:outline-none focus:border-amber-400/60"
              >
                <option value="USD" className="bg-[#12121a]">USD ($)</option>
                <option value="EUR" className="bg-[#12121a]">EUR (€)</option>
                <option value="GBP" className="bg-[#12121a]">GBP (£)</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
              <div>
                <span className="text-xs font-medium text-stone-200 block">Telegram Bot In-Chat Alerts</span>
                <span className="text-[11px] text-stone-500 block">Real-time alerts directly in Telegram chat</span>
              </div>
              <input
                type="checkbox"
                checked={telegramBotAlerts}
                onChange={(e) => setTelegramBotAlerts(e.target.checked)}
                className="w-4 h-4 accent-amber-400"
              />
            </div>

            <button
              onClick={() => {
                updateUserProfile({ defaultCurrency, telegramBotAlerts });
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
  );
};
