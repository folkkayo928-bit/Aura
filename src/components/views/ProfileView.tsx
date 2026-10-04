import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Artwork } from '../../types';
import { ArtworkCanvas } from '../ArtworkCanvas';
import {
  ShieldCheck,
  Award,
  Sparkles,
  ArrowRightLeft,
  FileCheck,
  CheckCircle2,
  Copy,
  Check,
  X,
  Settings,
  Key,
  Link as LinkIcon,
  ArrowUpDown,
} from 'lucide-react';

interface ProfileViewProps {
  onOpenDetail: (artwork: Artwork) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onOpenDetail }) => {
  const {
    userProfile,
    artworks,
    setConvertModalArtwork,
    setSellArtworkP2PModal,
    setActiveTab,
    setSettingsModalOpen,
    setSeedPhraseModalOpen,
    connectedWallets,
  } = useApp();
  const [selectedCertArtwork, setSelectedCertArtwork] = useState<Artwork | null>(null);
  const [copied, setCopied] = useState(false);

  const ownedArtworks = artworks.filter((a) => a.isOwned);

  // Calculate total acquisition cost vs current valuation
  const totalPurchaseCost = ownedArtworks.reduce((acc, a) => acc + (a.purchasePrice || a.originalPrice), 0);
  const totalCurrentValue = ownedArtworks.reduce((acc, a) => acc + a.currentValue, 0);
  const totalGain = totalCurrentValue - totalPurchaseCost;
  const gainPercentage = totalPurchaseCost > 0 ? Math.round((totalGain / totalPurchaseCost) * 100) : 0;

  const handleCopyVault = () => {
    navigator.clipboard?.writeText(userProfile.vaultId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 pb-24">
      {/* PROFILE HEADER CARD */}
      <div className="pt-2 px-1">
        <div className="p-5 rounded-3xl bg-[#12121b] border border-white/10 relative overflow-hidden shadow-xl">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative shrink-0">
                <img
                  src={userProfile.avatar}
                  alt={userProfile.name}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-full object-cover border-2 border-amber-400/40"
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-400 text-stone-950 flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="font-serif text-xl text-stone-100 font-normal truncate">
                    {userProfile.name}
                  </h2>
                  <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-1.5 py-0.2 rounded-full shrink-0">
                    TG Patron
                  </span>
                </div>
                <span className="text-xs text-stone-400 font-mono block">
                  {userProfile.telegramHandle}
                </span>
                <p className="text-xs text-stone-400 mt-1 line-clamp-1">
                  {userProfile.bio}
                </p>
              </div>
            </div>

            {/* Settings Trigger */}
            <button
              onClick={() => setSettingsModalOpen(true)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-stone-300 hover:text-white transition-colors shrink-0"
              title="Manage Account Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {/* Telegram Vault Bar */}
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 text-xs text-stone-400 mb-4">
            <span className="font-mono text-[11px] truncate max-w-[220px]">
              {userProfile.vaultId}
            </span>
            <button
              onClick={handleCopyVault}
              className="flex items-center gap-1 text-[11px] text-amber-300 hover:text-amber-200 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Quick Security & Wallet Links */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => setSeedPhraseModalOpen(true)}
              className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 flex items-center gap-2 text-left transition-colors"
            >
              <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[11px] font-semibold text-stone-200 block truncate">Recovery Phrase</span>
                <span className="text-[9px] text-stone-500 block truncate">12-Word Backup</span>
              </div>
            </button>

            <button
              onClick={() => setSettingsModalOpen(true)}
              className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 flex items-center gap-2 text-left transition-colors"
            >
              <LinkIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[11px] font-semibold text-stone-200 block truncate">Web3 Wallets</span>
                <span className="text-[9px] text-stone-500 block truncate">
                  {connectedWallets.length > 0 ? `${connectedWallets.length} Linked` : 'Tonkeeper / EVM'}
                </span>
              </div>
            </button>
          </div>

          {/* Collection Metrics */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5 text-center">
            <div>
              <span className="text-[10px] text-stone-400 font-mono block">Owned Works</span>
              <span className="font-serif text-xl font-medium text-stone-100 tabular-nums">
                {ownedArtworks.length}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-stone-400 font-mono block">Vault Value</span>
              <span className="font-serif text-xl font-medium text-stone-100 tabular-nums">
                ${totalCurrentValue}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-stone-400 font-mono block">Appreciation</span>
              <span className="font-serif text-xl font-semibold text-emerald-400 tabular-nums">
                +{gainPercentage}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* OWNED COLLECTION GALLERY */}
      <div className="space-y-4 px-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-stone-300 uppercase tracking-widest flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Curated Collection ({ownedArtworks.length})
          </span>
          <span className="text-stone-400 font-mono text-[11px]">
            {gainPercentage >= 0 ? `+${gainPercentage}% Overall Gain` : 'Vault Secure'}
          </span>
        </div>

        {ownedArtworks.length === 0 ? (
          <div className="py-12 text-center p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-3">
            <Award className="w-10 h-10 text-stone-600 mx-auto" />
            <h4 className="font-serif text-lg text-stone-300">Your Vault is Empty</h4>
            <p className="text-xs text-stone-500 max-w-xs mx-auto">
              Discover fine digital art in the gallery and collect editions to start growing your community collection.
            </p>
            <button
              onClick={() => setActiveTab('home')}
              className="px-4 py-2 rounded-xl bg-amber-400 text-stone-950 font-semibold text-xs mt-2"
            >
              Browse Gallery
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {ownedArtworks.map((artwork) => {
              const boughtFor = artwork.purchasePrice || artwork.originalPrice;
              const currentVal = artwork.currentValue;
              const pieceGain = currentVal - boughtFor;
              const pieceGainPercent = Math.round((pieceGain / boughtFor) * 100);

              return (
                <div
                  key={artwork.id}
                  className="rounded-3xl bg-[#111118] border border-white/5 overflow-hidden p-4 shadow-lg hover:border-white/15 transition-all"
                >
                  <div className="flex items-start gap-4">
                    {/* Visual Thumbnail */}
                    <div
                      onClick={() => onOpenDetail(artwork)}
                      className="w-24 h-32 rounded-2xl overflow-hidden shrink-0 border border-white/10 cursor-pointer relative group"
                    >
                      <ArtworkCanvas artwork={artwork} showOverlayGrain={false} />
                      <div className="absolute inset-0 bg-black/30 group-hover:bg-transparent transition-colors" />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-300">
                            {artwork.edition}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-mono font-medium">
                            +{pieceGainPercent}% Gain
                          </span>
                        </div>
                        <h4
                          onClick={() => onOpenDetail(artwork)}
                          className="font-serif text-lg text-stone-100 truncate cursor-pointer hover:text-amber-200 transition-colors"
                        >
                          {artwork.title}
                        </h4>
                        <p className="text-xs text-stone-400 truncate">
                          by {artwork.creator.name}
                        </p>
                      </div>

                      {/* Pricing Comparison */}
                      <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/5 text-[11px]">
                        <div>
                          <span className="text-stone-400 block">Acquired:</span>
                          <span className="font-mono text-stone-300">${boughtFor} USDT</span>
                        </div>
                        <div>
                          <span className="text-stone-400 block">Current Value:</span>
                          <span className="font-mono text-amber-300 font-semibold">
                            ${currentVal} USDT
                          </span>
                        </div>
                      </div>

                      {/* Action buttons: Certificate, Convert to USDT, Sell on P2P for Cash */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          onClick={() => setSelectedCertArtwork(artwork)}
                          className="py-2 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-stone-300 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                          title="View provenance certificate"
                        >
                          <FileCheck className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="hidden sm:inline">Cert</span>
                        </button>

                        <button
                          onClick={() => setConvertModalArtwork(artwork)}
                          className="flex-1 py-2 px-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                          title="Convert to instant USDT crypto"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                          <span>Convert</span>
                        </button>

                        <button
                          onClick={() => setSellArtworkP2PModal(artwork)}
                          className={`flex-1 py-2 px-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                            artwork.isListedOnP2P
                              ? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
                              : 'bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
                          }`}
                          title="Sell on Binance-style P2P Escrow Desk for Real Cash"
                        >
                          <ArrowUpDown className="w-3 h-3" />
                          <span>{artwork.isListedOnP2P ? 'P2P Live' : 'Sell P2P'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CERTIFICATE OF AUTHENTICITY MODAL */}
      {selectedCertArtwork && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div
            className="w-full max-w-sm bg-[#13131d] border border-amber-400/30 rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-amber-300">
                Official Provenance
              </span>
              <button
                onClick={() => setSelectedCertArtwork(null)}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-stone-400 hover:text-stone-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-center pt-2">
              <h3 className="font-serif text-2xl text-stone-100">Certificate of Authenticity</h3>
              <p className="text-[11px] text-stone-400 font-mono mt-1">
                AURA PROTOCOL · REGISTRY № {selectedCertArtwork.id.toUpperCase()}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 text-xs space-y-2">
              <div className="flex justify-between text-stone-400">
                <span>Artwork:</span>
                <span className="font-serif text-stone-200 font-semibold">{selectedCertArtwork.title}</span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>Artist:</span>
                <span className="text-stone-200">{selectedCertArtwork.creator.name}</span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>Edition:</span>
                <span className="font-mono text-amber-300">{selectedCertArtwork.edition}</span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>Custodian:</span>
                <span className="font-mono text-cyan-300">{userProfile.telegramHandle}</span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>Medium:</span>
                <span className="text-stone-300">{selectedCertArtwork.medium}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-emerald-400 text-xs pt-2">
              <ShieldCheck className="w-4 h-4" />
              <span className="font-mono">Cryptographically Inscribed</span>
            </div>

            <button
              onClick={() => setSelectedCertArtwork(null)}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-stone-200 text-xs font-medium"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
