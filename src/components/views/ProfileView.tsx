import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Artwork } from '../../types';
import { ArtworkCanvas } from '../ArtworkCanvas';
import {
  ShieldCheck,
  Award,
  Sparkles,
  Camera,
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
  Share2,
  Globe2,
  LockKeyhole,
  Users,
  Trophy,
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
    transactions,
  } = useApp();
  const [selectedCertArtwork, setSelectedCertArtwork] = useState<Artwork | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [profileMode, setProfileMode] = useState<'private' | 'public'>('private');
  const [profileSection, setProfileSection] = useState<'collection' | 'created' | 'activity'>('collection');

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
      {/* PROFILE HERO */}
      <div className="px-1">
        <div className="overflow-hidden rounded-[30px] bg-[#111118] border border-white/10 shadow-2xl">
          <div
            className="relative h-32 overflow-hidden"
            style={{
              backgroundImage: userProfile.coverImage
                ? "linear-gradient(180deg, rgba(8,8,12,.08), rgba(8,8,12,.94)), url(" + userProfile.coverImage + ")"
                : "radial-gradient(circle at 18% 20%, rgba(245,158,11,.24), transparent 35%), radial-gradient(circle at 82% 10%, rgba(34,211,238,.18), transparent 30%), linear-gradient(135deg, #181620, #09090d 70%)",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,.06),transparent)]" />
            <button
              onClick={() => setSettingsModalOpen(true)}
              className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/35 px-3 py-2 text-[10px] font-semibold text-white backdrop-blur-md"
            >
              <Settings className="w-3.5 h-3.5" />
              Edit profile
            </button>
          </div>

          <div className="relative px-5 pb-5">
            <div className="-mt-11 flex items-end justify-between">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[#111118] bg-[#1b1b25] shadow-xl">
                  <img src={userProfile.avatar} alt={userProfile.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </div>
                <div className="absolute bottom-1 right-1 w-7 h-7 rounded-full border-2 border-[#111118] bg-amber-400 text-stone-950 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <button onClick={() => setSettingsModalOpen(true)} className="mb-1 p-2.5 rounded-xl bg-white/5 border border-white/10 text-stone-300" title="Edit profile">
                <Camera className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-serif text-3xl text-stone-50 leading-none">{userProfile.name}</h2>
                <span className="text-[9px] font-mono uppercase tracking-wider text-amber-300 bg-amber-400/10 border border-amber-400/20 px-2 py-1 rounded-full">Curator</span>
                <span className="text-[9px] font-mono uppercase tracking-wider text-cyan-300 bg-cyan-400/10 border border-cyan-400/20 px-2 py-1 rounded-full">Verified</span>
              </div>
              <span className="text-xs text-stone-500 font-mono block mt-1">{userProfile.telegramHandle}</span>
              <p className="text-sm text-stone-300 mt-3 leading-6 max-w-xl">{userProfile.bio}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 text-[10px] text-stone-500 font-mono">
                <span>Member since {userProfile.joinedDate}</span>
                <span className="text-white/15">•</span>
                <span>{userProfile.vaultId}</span>
                <button onClick={handleCopyVault} className="text-amber-300 hover:text-amber-200">{copied ? "Copied" : "Copy ID"}</button>
              </div>
            </div>

            <div className="grid grid-cols-4 divide-x divide-white/5 mt-5 rounded-2xl bg-white/[0.025] border border-white/5">
              <div className="text-center py-3 px-1"><span className="font-serif text-lg text-stone-100 block">{ownedArtworks.length}</span><span className="text-[9px] text-stone-500 font-mono uppercase">Works</span></div>
              <div className="text-center py-3 px-1"><span className="font-serif text-lg text-stone-100 block">{artworks.filter((a) => a.creator?.handle === userProfile.telegramHandle).length}</span><span className="text-[9px] text-stone-500 font-mono uppercase">Created</span></div>
              <div className="text-center py-3 px-1"><span className="font-serif text-lg text-stone-100 block">{artworks.filter((a) => a.isLiked || a.isLoved).length}</span><span className="text-[9px] text-stone-500 font-mono uppercase">Favorites</span></div>
              <div className="text-center py-3 px-1"><span className="font-serif text-lg text-stone-100 block">{"$" + Math.round(totalCurrentValue).toLocaleString()}</span><span className="text-[9px] text-stone-500 font-mono uppercase">Value</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* PROFILE ACTIONS */}
      <div className="flex items-center gap-2 px-1">
        <div className="flex flex-1 rounded-2xl bg-white/[0.03] border border-white/10 p-1">
          <button onClick={() => setProfileMode('private')} className={profileMode === 'private' ? 'flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-white/10 py-2.5 text-[10px] font-semibold text-stone-100' : 'flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[10px] text-stone-500'}><LockKeyhole className="w-3.5 h-3.5" /> My profile</button>
          <button onClick={() => setProfileMode('public')} className={profileMode === 'public' ? 'flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-white/10 py-2.5 text-[10px] font-semibold text-stone-100' : 'flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[10px] text-stone-500'}><Globe2 className="w-3.5 h-3.5" /> Public preview</button>
        </div>
        <button onClick={async () => {
          const shareUrl = window.location.origin + '/#profile/' + encodeURIComponent(userProfile.telegramHandle.replace('@', ''));
          try {
            if (navigator.share) await navigator.share({ title: userProfile.name + ' · AURA', text: userProfile.bio, url: shareUrl });
            else { await navigator.clipboard?.writeText(shareUrl); setShareCopied(true); setTimeout(() => setShareCopied(false), 1800); }
          } catch {}
        }} className="shrink-0 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-2.5 text-[10px] font-semibold text-amber-300">
          {shareCopied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
        </button>
      </div>

      {/* PROFILE SNAPSHOT */}
      {profileMode === 'private' && (<>
      <div className="grid grid-cols-2 gap-3 px-1 mt-4">
        <div className="rounded-2xl bg-amber-400/[0.05] border border-amber-400/15 p-4">
          <div className="flex items-center gap-2 text-[10px] text-amber-300 font-mono uppercase tracking-widest"><Sparkles className="w-3.5 h-3.5" /> Vault performance</div>
          <div className="flex items-end justify-between mt-2">
            <span className="font-serif text-2xl text-stone-100">{"$" + Math.round(totalCurrentValue).toLocaleString()}</span>
            <span className={gainPercentage >= 0 ? "text-xs font-mono text-emerald-400" : "text-xs font-mono text-rose-400"}>{gainPercentage >= 0 ? "+" : ""}{gainPercentage}%</span>
          </div>
        </div>
        <button onClick={() => setSettingsModalOpen(true)} className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 text-left hover:bg-white/[0.06]">
          <div className="flex items-center gap-2 text-[10px] text-cyan-300 font-mono uppercase tracking-widest"><LinkIcon className="w-3.5 h-3.5" /> Connected</div>
          <div className="font-serif text-2xl text-stone-100 mt-2">{connectedWallets.length}</div>
          <div className="text-[10px] text-stone-500">Web3 wallets linked</div>
        </button>
      </div>
      </>)}

      {/* PROFILE REPUTATION */}
      <div className="rounded-3xl border border-white/10 bg-[#111118] p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-cyan-300"><Trophy className="w-3.5 h-3.5" /> AURA reputation</div>
            <p className="mt-1 text-xs text-stone-500">A transparent signal built from your AURA activity.</p>
          </div>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[9px] font-mono text-emerald-300">Verified</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white/[0.03] p-3 text-center"><Award className="mx-auto h-4 w-4 text-amber-300" /><div className="mt-1 text-sm font-semibold text-stone-100">{ownedArtworks.length + connectedWallets.length}</div><div className="text-[9px] uppercase tracking-wider text-stone-600">Signals</div></div>
          <div className="rounded-2xl bg-white/[0.03] p-3 text-center"><Users className="mx-auto h-4 w-4 text-cyan-300" /><div className="mt-1 text-sm font-semibold text-stone-100">{ownedArtworks.reduce((sum, a) => sum + a.collectorsCount, 0)}</div><div className="text-[9px] uppercase tracking-wider text-stone-600">Collector reach</div></div>
          <div className="rounded-2xl bg-white/[0.03] p-3 text-center"><Sparkles className="mx-auto h-4 w-4 text-violet-300" /><div className="mt-1 text-sm font-semibold text-stone-100">{artworks.filter((a) => a.creator?.handle === userProfile.telegramHandle).length}</div><div className="text-[9px] uppercase tracking-wider text-stone-600">Creations</div></div>
        </div>
      </div>

      {/* PROFILE CONTENT TABS */}
      <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.02] p-1">
        {[['collection', 'Collection'], ['created', 'Created'], ['activity', 'Activity']].map(([id, label]) => (
          <button key={id} onClick={() => setProfileSection(id as typeof profileSection)} className={profileSection === id ? 'flex-1 rounded-xl bg-white/10 py-2.5 text-[10px] font-semibold text-stone-100' : 'flex-1 rounded-xl py-2.5 text-[10px] text-stone-500'}>{label}</button>
        ))}
      </div>
      {profileMode === 'public' && <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.04] px-4 py-3 text-xs text-stone-400"><span className="font-semibold text-cyan-300">Public preview.</span> Private vault performance, connected wallets and security controls are hidden.</div>}

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

        {profileSection === 'collection' && (
          ownedArtworks.length === 0 ? (
            <div className="py-12 text-center p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-3">
              <Award className="w-10 h-10 text-stone-600 mx-auto" />
              <h4 className="font-serif text-lg text-stone-300">Your Vault is Empty</h4>
              <p className="text-xs text-stone-500 max-w-xs mx-auto">Discover fine digital art in the gallery and collect editions to start growing your collection.</p>
              <button onClick={() => setActiveTab('home')} className="px-4 py-2 rounded-xl bg-amber-400 text-stone-950 font-semibold text-xs mt-2">Browse Gallery</button>
            </div>
          ) : (
            <div className="space-y-4">
              {ownedArtworks.map((artwork) => (
                <div key={artwork.id} className="rounded-3xl bg-[#111118] border border-white/5 overflow-hidden p-4 shadow-lg">
                  <div className="flex items-start gap-4">
                    <button type="button" onClick={() => onOpenDetail(artwork)} className="w-24 h-32 rounded-2xl overflow-hidden shrink-0 border border-white/10 relative">
                      <ArtworkCanvas artwork={artwork} showOverlayGrain={false} />
                    </button>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-300">{artwork.edition}</span>
                          <h4 className="mt-1 font-serif text-lg text-stone-100 truncate">{artwork.title}</h4>
                          <p className="text-xs text-stone-400 truncate">by {artwork.creator.name}</p>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-mono font-medium shrink-0">${artwork.currentValue.toLocaleString()} USDT</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/5 text-[11px]">
                        <div><span className="text-stone-400 block">Acquired:</span><span className="font-mono text-stone-300">${(artwork.purchasePrice || artwork.originalPrice).toLocaleString()} USDT</span></div>
                        <div><span className="text-stone-400 block">Current Value:</span><span className="font-mono text-amber-300 font-semibold">${artwork.currentValue.toLocaleString()} USDT</span></div>
                      </div>
                      <div className="flex items-center gap-1.5 pt-1">
                        <button type="button" onClick={() => setSelectedCertArtwork(artwork)} className="py-2 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-stone-300 text-xs font-medium"><FileCheck className="w-3.5 h-3.5 text-cyan-400 inline-block mr-1" /> Cert</button>
                        <button type="button" onClick={() => setConvertModalArtwork(artwork)} className="flex-1 py-2 px-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-medium"><ArrowRightLeft className="w-3 h-3 inline-block mr-1" /> Convert</button>
                        <button type="button" onClick={() => setSellArtworkP2PModal(artwork)} className="flex-1 py-2 px-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-medium"><ArrowUpDown className="w-3 h-3 inline-block mr-1" /> {artwork.isListedOnP2P ? 'P2P Live' : 'Sell P2P'}</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {profileSection === 'created' && (
          <div className="grid grid-cols-2 gap-3">
            {artworks.filter((a) => a.creator?.handle === userProfile.telegramHandle).length === 0 ? (
              <div className="col-span-2 rounded-3xl border border-white/5 bg-white/[0.02] p-8 text-center">
                <Sparkles className="mx-auto h-8 w-8 text-stone-600" />
                <p className="mt-3 text-xs text-stone-500">Your minted creations will appear here.</p>
                <button onClick={() => setActiveTab('create')} className="mt-4 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-bold text-stone-950">Create a work</button>
              </div>
            ) : (
              artworks.filter((a) => a.creator?.handle === userProfile.telegramHandle).map((artwork) => (
                <button key={artwork.id} onClick={() => onOpenDetail(artwork)} className="overflow-hidden rounded-2xl border border-white/10 bg-[#111118] text-left">
                  <div className="aspect-square"><ArtworkCanvas artwork={artwork} showOverlayGrain={false} /></div>
                  <div className="p-3"><div className="truncate text-xs font-semibold text-stone-100">{artwork.title}</div><div className="mt-1 text-[10px] text-stone-500">${artwork.currentValue.toLocaleString()} USDT</div></div>
                </button>
              ))
            )}
          </div>
        )}
        {profileSection === 'activity' && (
          <div className="space-y-2">
            {transactions.length === 0 ? (
              <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-8 text-center text-xs text-stone-500">Your AURA activity will appear here.</div>
            ) : (
              transactions.slice(0, 12).map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-[#111118] p-3">
                  <div className="h-9 w-9 shrink-0 rounded-xl bg-amber-400/10 flex items-center justify-center text-amber-300"><ArrowUpDown className="w-4 h-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-stone-200">{tx.type.replaceAll('_', ' ')}</div>
                    <div className="mt-1 text-[10px] text-stone-500">{tx.date} · {tx.status}</div>
                  </div>
                  <span className="font-mono text-[11px] text-stone-300">{tx.amount} {tx.currency}</span>
                </div>
              ))
            )}
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
