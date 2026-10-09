import React, { useState } from 'react';
import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Bell, ChevronRight, Clock3, Compass, CreditCard, FileImage, Fingerprint, Globe2, Image as ImageIcon, Layers3, LockKeyhole, Palette, Plus, Settings, ShieldCheck, Wallet, X, Zap } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import type { Artwork, ArtworkCategory, NFTCollection, Transaction } from '../../types';
import { createNeutralAvatar } from '../../lib/avatar';
import { ArtworkCanvas } from '../ArtworkCanvas';

export type ProfileMenuPage = 'collection' | 'created' | 'collections' | 'activity' | 'public' | 'notifications' | 'settings';
interface Props { page: ProfileMenuPage; onBack: () => void; onOpenDetail: (artwork: Artwork) => void; }

const meta: Record<ProfileMenuPage, { title: string; eyebrow: string; description: string; icon: React.ElementType }> = {
  collection: { title: 'My Collection', eyebrow: 'Your private vault', description: 'Every piece you have collected, in one focused space.', icon: Layers3 },
  created: { title: 'Created Works', eyebrow: 'Your studio', description: 'Manage your published art and upcoming releases.', icon: Palette },
  collections: { title: 'Collections', eyebrow: 'Your curation', description: 'Shape collections that tell your creative story.', icon: Layers3 },
  activity: { title: 'Activity', eyebrow: 'Your timeline', description: 'A clear record of movements and milestones in AURA.', icon: Clock3 },
  public: { title: 'Public Profile', eyebrow: 'Your public presence', description: 'See the AURA identity other collectors can discover.', icon: Globe2 },
  notifications: { title: 'Notifications', eyebrow: 'Stay in the loop', description: 'Choose which account and Telegram alerts you receive.', icon: Bell },
  settings: { title: 'Settings', eyebrow: 'Your account, your controls', description: 'Manage your identity, connected wallets, and vault security.', icon: Settings },
};

const amountLabel = (amount: number, currency: string) => amount.toLocaleString(undefined, { maximumFractionDigits: 4 }) + ' ' + currency;
const transactionLabel = (tx: Transaction) => tx.type.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export const ProfileMenuPageView: React.FC<Props> = ({ page, onBack, onOpenDetail }) => {
  const {
    userProfile, updateUserProfile, artworks, collections, transactions, connectedWallets,
    createCollection, updateCollection, deleteCollection, setActiveTab,
    setConvertModalArtwork, setSellArtworkP2PModal, setSettingsModalOpen,
  } = useApp();
  const { user } = useAuth();
  const [activityFilter, setActivityFilter] = useState<'all' | Transaction['status']>('all');
  const [createdFilter, setCreatedFilter] = useState<'all' | 'published' | 'scheduled'>('all');
  const [savingPreference, setSavingPreference] = useState<'all' | 'telegram' | null>(null);
  const [preferenceMessage, setPreferenceMessage] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<NFTCollection | null>(null);
  const [savingCollection, setSavingCollection] = useState(false);
  const [collectionMessage, setCollectionMessage] = useState('');
  const [form, setForm] = useState({ name: '', slug: '', description: '', avatarUrl: '', bannerUrl: '' });

  const owned = artworks.filter((art) => art.isOwned);
  const created = artworks.filter((art) => art.creator?.id === user?.id);
  const myCollections = collections.filter((collection) => collection.creatorId === user?.id);
  const vaultValue = owned.reduce((sum, art) => sum + art.currentValue, 0);
  const purchaseValue = owned.reduce((sum, art) => sum + (art.purchasePrice || art.originalPrice), 0);
  const vaultChange = purchaseValue > 0 ? Math.round(((vaultValue - purchaseValue) / purchaseValue) * 100) : 0;
  const shownCreated = created.filter((art) => createdFilter === 'all' || (createdFilter === 'scheduled' ? art.published === false : art.published !== false));
  const shownTransactions = transactions.filter((tx) => activityFilter === 'all' || tx.status === activityFilter);
  const PageIcon = meta[page].icon;

  const openSettings = (tab: 'profile' | 'payments' | 'wallets' | 'security' | 'preferences') => {
    window.dispatchEvent(new CustomEvent('aura-settings-tab', { detail: { tab } }));
    setSettingsModalOpen(true);
  };
  const savePreference = async (kind: 'all' | 'telegram', value: boolean) => {
    setSavingPreference(kind);
    setPreferenceMessage('');
    const saved = await updateUserProfile(kind === 'all' ? { notificationsEnabled: value } : { telegramBotAlerts: value });
    setPreferenceMessage(saved ? 'Preference saved.' : 'Could not save this preference. Please try again.');
    setSavingPreference(null);
  };
  const openNewCollection = () => {
    setEditing(null);
    setForm({ name: '', slug: '', description: '', avatarUrl: '', bannerUrl: '' });
    setCollectionMessage('');
    setEditorOpen(true);
  };
  const openEditCollection = (collection: NFTCollection) => {
    setEditing(collection);
    setForm({ name: collection.name, slug: collection.slug, description: collection.description || '', avatarUrl: collection.avatar || '', bannerUrl: collection.banner || '' });
    setCollectionMessage('');
    setEditorOpen(true);
  };
  const saveCollection = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = form.name.trim();
    const slug = form.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    if (!name || !slug) { setCollectionMessage('Add a collection name and URL slug.'); return; }
    setSavingCollection(true);
    const payload = { name, slug, description: form.description.trim(), avatarUrl: form.avatarUrl.trim(), bannerUrl: form.bannerUrl.trim(), category: editing?.category || ('generative' as ArtworkCategory) };
    const ok = editing ? await updateCollection(editing.id, payload) : await createCollection(payload);
    setSavingCollection(false);
    if (ok) { setEditorOpen(false); setCollectionMessage(editing ? 'Collection updated.' : 'Collection created.'); }
    else setCollectionMessage('Could not save this collection. Check its name and slug.');
  };

  const artworkCard = (art: Artwork, isOwned: boolean) => (
    <article key={art.id} className="overflow-hidden rounded-3xl border border-white/10 bg-[#111118]">
      <button type="button" onClick={() => onOpenDetail(art)} className="relative block aspect-[4/3] w-full overflow-hidden bg-black text-left">
        <ArtworkCanvas artwork={art} showOverlayGrain={false} />
        <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/60 px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider text-stone-200">{isOwned ? 'Collected' : art.published === false ? 'Scheduled' : 'Created'}</span>
      </button>
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="truncate font-serif text-base text-stone-100">{art.title}</h3><p className="mt-1 truncate text-[10px] text-stone-500">{isOwned ? 'Edition ' + art.edition : 'Created ' + art.createdDate}</p></div><div className="shrink-0 text-right"><div className="font-mono text-xs text-amber-300">{'$' + art.currentValue.toLocaleString()}</div><div className="mt-0.5 text-[9px] text-stone-600">USDT</div></div></div>
        {isOwned ? <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setConvertModalArtwork(art)} className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-2 py-2 text-[10px] font-semibold text-emerald-300">Convert value</button><button type="button" onClick={() => setSellArtworkP2PModal(art)} className="rounded-xl border border-cyan-400/15 bg-cyan-400/[0.06] px-2 py-2 text-[10px] font-semibold text-cyan-300">{art.isListedOnP2P ? 'Manage P2P' : 'Sell on P2P'}</button></div>
          : <button type="button" onClick={() => onOpenDetail(art)} className="mt-3 flex w-full items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2.5 text-[10px] font-semibold text-stone-300">Open artwork <ChevronRight className="h-3.5 w-3.5" /></button>}
      </div>
    </article>
  );
  const empty = (icon: React.ReactNode, title: string, body: string, action?: React.ReactNode) => (
    <div className="rounded-3xl border border-white/10 bg-white/[0.025] px-5 py-10 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05] text-stone-400">{icon}</div><h3 className="mt-4 font-serif text-xl text-stone-100">{title}</h3><p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-stone-500">{body}</p>{action && <div className="mt-5">{action}</div>}</div>
  );

  return (
    <div className="min-h-[calc(100dvh-120px)] space-y-5 pb-28">
      <header className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#111118] p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-amber-400/[0.08] blur-3xl" />
        <div className="relative flex items-start gap-3">
          <button type="button" onClick={onBack} aria-label="Back to profile" className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-stone-300"><ArrowLeft className="h-4 w-4" /></button>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.22em] text-amber-300"><PageIcon className="h-3.5 w-3.5" /> {meta[page].eyebrow}</div><h1 className="mt-2 font-serif text-3xl leading-tight text-stone-50">{meta[page].title}</h1><p className="mt-2 max-w-xl text-xs leading-5 text-stone-400">{meta[page].description}</p></div>
        </div>
        <div className="relative mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4 text-[10px] text-stone-500"><span>AURA / Profile</span><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Your space</span></div>
      </header>

      {page === 'collection' && <section className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3"><span className="text-[9px] uppercase tracking-widest text-stone-500">Pieces</span><div className="mt-2 font-serif text-xl text-stone-100">{owned.length}</div></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3"><span className="text-[9px] uppercase tracking-widest text-stone-500">Vault value</span><div className="mt-2 truncate font-serif text-lg text-stone-100">{'$' + Math.round(vaultValue).toLocaleString()}</div></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3"><span className="text-[9px] uppercase tracking-widest text-stone-500">Change</span><div className={'mt-2 font-serif text-xl ' + (vaultChange >= 0 ? 'text-emerald-300' : 'text-rose-300')}>{vaultChange >= 0 ? '+' : ''}{vaultChange}%</div></div>
        </div>
        {owned.length ? <div className="grid grid-cols-2 gap-3">{owned.map((art) => artworkCard(art, true))}</div> : empty(<Layers3 className="h-5 w-5" />, 'Your vault starts here', 'Collect a work you love and it will appear here with its value and ownership actions.', <button type="button" onClick={() => setActiveTab('discover')} className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-xs font-bold text-stone-950">Explore art <Compass className="h-4 w-4" /></button>)}
      </section>}

      {page === 'created' && <section className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3"><span className="text-[9px] uppercase text-stone-500">All works</span><div className="mt-2 font-serif text-xl text-stone-100">{created.length}</div></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3"><span className="text-[9px] uppercase text-stone-500">Published</span><div className="mt-2 font-serif text-xl text-emerald-300">{created.filter((art) => art.published !== false).length}</div></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3"><span className="text-[9px] uppercase text-stone-500">Scheduled</span><div className="mt-2 font-serif text-xl text-cyan-300">{created.filter((art) => art.published === false).length}</div></div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto rounded-2xl border border-white/5 bg-white/[0.02] p-1">{([{ value: 'all', label: 'All works' }, { value: 'published', label: 'Published' }, { value: 'scheduled', label: 'Scheduled' }] as const).map((option) => <button key={option.value} type="button" onClick={() => setCreatedFilter(option.value)} className={'shrink-0 rounded-xl px-3 py-2 text-[10px] font-semibold ' + (createdFilter === option.value ? 'bg-amber-400 text-stone-950' : 'text-stone-400')}>{option.label}</button>)}</div>
        {shownCreated.length ? <div className="grid grid-cols-2 gap-3">{shownCreated.map((art) => artworkCard(art, false))}</div> : empty(<Palette className="h-5 w-5" />, createdFilter === 'scheduled' ? 'Nothing scheduled yet' : 'Your studio is waiting', 'Create or publish a work and it will be available here.', <button type="button" onClick={() => setActiveTab('create')} className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-xs font-bold text-stone-950">Create artwork <Plus className="h-4 w-4" /></button>)}
      </section>}

      {page === 'collections' && <section className="space-y-4">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-serif text-xl text-stone-100">Your collection hubs</h2><p className="mt-1 text-[10px] text-stone-500">Organize works around a style, series, or idea.</p></div><button type="button" onClick={openNewCollection} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2.5 text-[10px] font-bold text-stone-950"><Plus className="h-3.5 w-3.5" /> New</button></div>
        {collectionMessage && !editorOpen && <p className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-3 py-2 text-xs text-emerald-300">{collectionMessage}</p>}
        {myCollections.length ? <div className="space-y-3">{myCollections.map((collection) => <article key={collection.id} className="overflow-hidden rounded-3xl border border-white/10 bg-[#111118]">
          <div className="relative h-32 bg-[#191923]">{collection.banner ? <img src={collection.banner} alt="" className="h-full w-full object-cover opacity-80" /> : <div className="h-full w-full bg-[radial-gradient(circle_at_20%_15%,rgba(245,158,11,.22),transparent_38%),radial-gradient(circle_at_80%_70%,rgba(34,211,238,.14),transparent_38%),linear-gradient(135deg,#181620,#09090d)]" />}<div className="absolute inset-0 bg-gradient-to-t from-[#111118] via-transparent to-black/10" /><div className="absolute bottom-3 left-4 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border-2 border-[#111118] bg-white/[0.07]">{collection.avatar ? <img src={collection.avatar} alt="" className="h-full w-full object-cover" /> : <Layers3 className="h-5 w-5 text-amber-300" />}</div><div><h3 className="font-serif text-xl text-stone-100">{collection.name}</h3><p className="text-[9px] font-mono uppercase tracking-wider text-stone-400">/{collection.slug}</p></div></div></div>
          <div className="p-4"><p className="text-xs leading-5 text-stone-400">{collection.description || 'A curated collection of digital works.'}</p><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-white/[0.035] p-3"><span className="text-[9px] uppercase text-stone-500">Items</span><div className="mt-1 text-sm text-stone-100">{collection.itemsCount}</div></div><div className="rounded-xl bg-white/[0.035] p-3"><span className="text-[9px] uppercase text-stone-500">Holders</span><div className="mt-1 text-sm text-stone-100">{collection.ownersCount}</div></div></div><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => openEditCollection(collection)} className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 text-xs font-semibold text-stone-200">Edit collection</button><button type="button" onClick={async () => { if (window.confirm('Delete “' + collection.name + '”? This does not delete your artwork.')) await deleteCollection(collection.id); }} className="rounded-xl border border-rose-400/15 bg-rose-400/[0.04] px-3 py-2.5 text-xs font-semibold text-rose-300">Delete</button></div></div>
        </article>)}</div> : empty(<Layers3 className="h-5 w-5" />, 'Curate your first collection', 'Create a recognizable home for a series or visual theme.', <button type="button" onClick={openNewCollection} className="rounded-xl bg-amber-400 px-4 py-3 text-xs font-bold text-stone-950">Create a collection</button>)}
      </section>}

      {page === 'activity' && <section className="space-y-4">
        <div className="grid grid-cols-3 gap-2"><div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3"><span className="text-[9px] uppercase text-stone-500">Events</span><div className="mt-2 font-serif text-xl text-stone-100">{transactions.length}</div></div><div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3"><span className="text-[9px] uppercase text-stone-500">Confirmed</span><div className="mt-2 font-serif text-xl text-emerald-300">{transactions.filter((tx) => tx.status === 'confirmed').length}</div></div><div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3"><span className="text-[9px] uppercase text-stone-500">Pending</span><div className="mt-2 font-serif text-xl text-amber-300">{transactions.filter((tx) => tx.status === 'pending' || tx.status === 'processing').length}</div></div></div>
        <div className="flex gap-1 overflow-x-auto rounded-2xl border border-white/5 bg-white/[0.02] p-1">{(['all', 'confirmed', 'pending', 'processing', 'failed'] as const).map((filter) => <button key={filter} type="button" onClick={() => setActivityFilter(filter)} className={'shrink-0 rounded-xl px-3 py-2 text-[10px] font-semibold capitalize ' + (activityFilter === filter ? 'bg-amber-400 text-stone-950' : 'text-stone-400')}>{filter === 'all' ? 'All activity' : filter}</button>)}</div>
        {shownTransactions.length ? <div className="space-y-2">{shownTransactions.map((tx) => { const pending = tx.status === 'pending' || tx.status === 'processing'; const failed = tx.status === 'failed'; return <article key={tx.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#111118] p-3.5"><div className={'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ' + (failed ? 'bg-rose-400/10 text-rose-300' : pending ? 'bg-amber-400/10 text-amber-300' : 'bg-emerald-400/10 text-emerald-300')}>{tx.type === 'receive' || tx.type === 'collect' ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><h3 className="truncate text-xs font-semibold text-stone-100">{tx.artworkTitle || transactionLabel(tx)}</h3><p className="mt-1 truncate text-[10px] text-stone-500">{tx.date}{tx.recipientOrSender ? ' · ' + tx.recipientOrSender : ''}</p><span className={'mt-1 inline-flex rounded-full px-2 py-0.5 text-[9px] capitalize ' + (failed ? 'bg-rose-400/10 text-rose-300' : pending ? 'bg-amber-400/10 text-amber-300' : 'bg-emerald-400/10 text-emerald-300')}>{tx.status}</span></div><div className="shrink-0 text-right"><div className="font-mono text-xs text-stone-200">{amountLabel(tx.amount, tx.currency)}</div><div className="mt-1 text-[9px] text-stone-600">{tx.isExternal ? 'External' : 'AURA'}</div></div></article>; })}</div> : empty(<Clock3 className="h-5 w-5" />, 'Your timeline is clear', 'Collects, conversions, transfers, and supported trades will be listed here.')}
      </section>}

      {page === 'public' && <section className="space-y-4">
        <article className="overflow-hidden rounded-[28px] border border-white/10 bg-[#111118]"><div className="relative h-32 overflow-hidden">{userProfile.coverImage ? <img src={userProfile.coverImage} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,rgba(245,158,11,.28),transparent_36%),radial-gradient(circle_at_80%_15%,rgba(34,211,238,.2),transparent_35%),linear-gradient(135deg,#1a1820,#09090d)]" />}<div className="absolute inset-0 bg-gradient-to-t from-[#111118] to-transparent" /></div><div className="px-5 pb-5"><div className="-mt-10 flex items-end justify-between"><img src={userProfile.avatar || createNeutralAvatar(user?.id || 'aura-public-profile')} alt={userProfile.name} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = createNeutralAvatar(user?.id || 'aura-public-profile'); }} className="h-20 w-20 rounded-full border-4 border-[#111118] object-cover" /><button type="button" onClick={() => openSettings('profile')} className="mb-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold text-stone-200">Edit profile</button></div><div className="mt-3 flex flex-wrap items-center gap-2"><h2 className="font-serif text-2xl text-stone-50">{userProfile.name || 'AURA Collector'}</h2><span className="rounded-full border border-amber-400/20 bg-amber-400/[0.07] px-2 py-1 text-[9px] uppercase tracking-wider text-amber-300">Creator</span></div><p className="mt-1 text-xs text-stone-500">{userProfile.telegramHandle || '@collector'}</p><p className="mt-3 text-xs leading-5 text-stone-300">{userProfile.bio || 'Collecting and creating digital art on AURA.'}</p><div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/[0.07] pt-4 text-center"><div><div className="font-serif text-xl text-stone-100">{created.length}</div><div className="mt-1 text-[9px] uppercase text-stone-500">Works</div></div><div><div className="font-serif text-xl text-stone-100">{myCollections.length}</div><div className="mt-1 text-[9px] uppercase text-stone-500">Collections</div></div><div><div className="font-serif text-xl text-stone-100">{created.reduce((sum, art) => sum + art.collectorsCount, 0)}</div><div className="mt-1 text-[9px] uppercase text-stone-500">Collectors</div></div></div></div></article>
        <div className="flex items-center justify-between"><div><h2 className="font-serif text-xl text-stone-100">Public works</h2><p className="mt-1 text-[10px] text-stone-500">Private vault and account details are hidden from this preview.</p></div><Globe2 className="h-5 w-5 text-cyan-300" /></div>
        {created.filter((art) => art.published !== false).length ? <div className="grid grid-cols-2 gap-3">{created.filter((art) => art.published !== false).map((art) => artworkCard(art, false))}</div> : empty(<ImageIcon className="h-5 w-5" />, 'Your public gallery is ready', 'Published works will appear here for other collectors to discover.')}
      </section>}

      {page === 'notifications' && <section className="space-y-3">
        <div className="rounded-3xl border border-cyan-400/15 bg-cyan-400/[0.045] p-4"><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300"><Zap className="h-4 w-4" /></div><div><h2 className="text-sm font-semibold text-stone-100">Only the alerts you choose</h2><p className="mt-1 text-[11px] leading-5 text-stone-400">Your switches save preferences to your AURA profile.</p></div></div></div>
        {[{ kind: 'all' as const, title: 'AURA notifications', desc: 'Account activity, collection updates, and important status alerts.', value: userProfile.notificationsEnabled, icon: Bell }, { kind: 'telegram' as const, title: 'Telegram bot alerts', desc: 'Receive supported AURA updates through the connected Telegram bot.', value: userProfile.telegramBotAlerts, icon: Zap }].map((item) => { const Icon = item.icon; return <article key={item.kind} className="rounded-3xl border border-white/10 bg-[#111118] p-4"><div className="flex items-start justify-between gap-4"><div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300"><Icon className="h-4 w-4" /></div><div><h3 className="text-xs font-semibold text-stone-100">{item.title}</h3><p className="mt-1 text-[10px] leading-5 text-stone-500">{item.desc}</p></div></div><button type="button" disabled={savingPreference !== null} aria-pressed={item.value} onClick={() => void savePreference(item.kind, !item.value)} className={'relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ' + (item.value ? 'bg-amber-400' : 'bg-white/15')}><span className={'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ' + (item.value ? 'left-6' : 'left-1')} /></button></div><div className="mt-4 border-t border-white/[0.07] pt-3 text-[10px] text-stone-500">{item.value ? 'Enabled' : 'Paused'}</div></article>; })}
        {savingPreference && <p className="text-xs text-stone-400">Saving your preference…</p>}
        {preferenceMessage && <p className={'rounded-xl border px-3 py-2 text-xs ' + (preferenceMessage.startsWith('Could not') ? 'border-rose-400/15 bg-rose-400/[0.04] text-rose-300' : 'border-emerald-400/15 bg-emerald-400/[0.04] text-emerald-300')}>{preferenceMessage}</p>}
        <p className="px-1 text-[10px] leading-5 text-stone-600">Turning off alerts does not turn off account security or required trade status information.</p>
      </section>}

      {page === 'settings' && <section className="space-y-3">
        <article className="rounded-3xl border border-white/10 bg-[#111118] p-4"><div className="flex items-center gap-3"><img src={userProfile.avatar || createNeutralAvatar(user?.id || 'aura-settings')} alt="" className="h-12 w-12 rounded-2xl border border-white/10 object-cover" /><div className="min-w-0 flex-1"><h2 className="truncate font-serif text-lg text-stone-100">{userProfile.name || 'AURA Collector'}</h2><p className="mt-1 truncate text-[10px] text-stone-500">{user?.email || userProfile.telegramHandle || 'AURA member'}</p></div><ShieldCheck className="h-5 w-5 text-emerald-300" /></div></article>
        <div className="space-y-2">{[
          { title: 'Profile details', description: 'Name, avatar, cover, bio, preferred currency', icon: FileImage, tab: 'profile' as const },
          { title: 'Payment methods', description: 'Saved methods used for supported P2P trades', icon: CreditCard, tab: 'payments' as const },
          { title: 'Connected wallets', description: connectedWallets.length + ' linked wallet' + (connectedWallets.length === 1 ? '' : 's'), icon: Wallet, tab: 'wallets' as const },
          { title: 'Vault security', description: 'Security factors and key-related account controls', icon: Fingerprint, tab: 'security' as const },
          { title: 'Notification preferences', description: 'Choose app and Telegram alerts', icon: Bell, tab: 'preferences' as const },
        ].map((item) => { const Icon = item.icon; return <button key={item.tab} type="button" onClick={() => openSettings(item.tab)} className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-left hover:bg-white/[0.05]"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] text-stone-300"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-stone-100">{item.title}</span><span className="mt-1 block text-[10px] leading-4 text-stone-500">{item.description}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-stone-600" /></button>; })}</div>
        <div className="rounded-3xl border border-amber-400/15 bg-amber-400/[0.035] p-4"><div className="flex items-center gap-2 text-xs font-semibold text-amber-200"><LockKeyhole className="h-4 w-4" /> A small security reminder</div><p className="mt-2 text-[10px] leading-5 text-stone-500">Never share your seed phrase, one-time codes, or private keys with anyone claiming to be AURA support.</p></div>
      </section>}

      {page === 'collections' && editorOpen && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/85 p-3 backdrop-blur-md sm:items-center"><form onSubmit={saveCollection} className="max-h-[92dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-3xl border border-white/10 bg-[#14141d] p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-serif text-xl text-stone-100">{editing ? 'Edit collection' : 'New collection'}</h2><p className="mt-1 text-[10px] text-stone-500">Give your series a recognizable home.</p></div><button type="button" onClick={() => setEditorOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.05] text-stone-400" aria-label="Close collection editor"><X className="h-4 w-4" /></button></div>
        <label className="block"><span className="mb-1.5 block text-[10px] text-stone-400">Collection name</span><input value={form.name} onChange={(event) => setForm((v) => ({ ...v, name: event.target.value, slug: editing ? v.slug : (v.slug || event.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')) }))} required maxLength={70} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-xs text-stone-100 outline-none focus:border-amber-400/50" placeholder="Ethiopian Dreamscapes" /></label>
        <label className="block"><span className="mb-1.5 block text-[10px] text-stone-400">Collection URL slug</span><input value={form.slug} onChange={(event) => setForm((v) => ({ ...v, slug: event.target.value }))} required maxLength={80} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-xs text-stone-100 outline-none focus:border-amber-400/50" placeholder="ethiopian-dreamscapes" /></label>
        <label className="block"><span className="mb-1.5 block text-[10px] text-stone-400">Description</span><textarea value={form.description} onChange={(event) => setForm((v) => ({ ...v, description: event.target.value }))} rows={3} maxLength={500} className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-xs text-stone-100 outline-none focus:border-amber-400/50" placeholder="What connects these works?" /></label>
        <label className="block"><span className="mb-1.5 block text-[10px] text-stone-400">Avatar image URL (optional)</span><input value={form.avatarUrl} onChange={(event) => setForm((v) => ({ ...v, avatarUrl: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-xs text-stone-100 outline-none focus:border-amber-400/50" placeholder="https://…" /></label>
        <label className="block"><span className="mb-1.5 block text-[10px] text-stone-400">Banner image URL (optional)</span><input value={form.bannerUrl} onChange={(event) => setForm((v) => ({ ...v, bannerUrl: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-xs text-stone-100 outline-none focus:border-amber-400/50" placeholder="https://…" /></label>
        {collectionMessage && <p className="text-xs text-rose-300">{collectionMessage}</p>}
        <button type="submit" disabled={savingCollection} className="w-full rounded-xl bg-amber-400 px-4 py-3.5 text-xs font-bold text-stone-950 disabled:opacity-50">{savingCollection ? 'Saving…' : editing ? 'Save changes' : 'Create collection'}</button>
      </form></div>}
    </div>
  );
};
