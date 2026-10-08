import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { ArtworkCategory, MediaType, NFTTrait, PaymentMethodType } from '../../types';
import { ArtworkCanvas } from '../ArtworkCanvas';
import { CustomPaymentMethodInput } from '../p2p/CustomPaymentMethodInput';
import {
  Upload,
  Sparkles,
  Image as ImageIcon,
  Film,
  Layers,
  Tag,
  DollarSign,
  Plus,
  Trash2,
  ArrowUpDown,
  CalendarClock,
  Check,
  CheckCircle2,
  FileCode,
} from 'lucide-react';

export const CreateView: React.FC = () => {
  const { createArtwork, uploadArtworkFile } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('150');
  const [category, setCategory] = useState<ArtworkCategory>('generative');
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [collectionName, setCollectionName] = useState('');
  const [customMediaUrl, setCustomMediaUrl] = useState<string>('');
  const [traits, setTraits] = useState<NFTTrait[]>([]);
  const [newTraitKey, setNewTraitKey] = useState('');
  const [newTraitVal, setNewTraitVal] = useState('');
  const [listOnP2P, setListOnP2P] = useState(true);
  const [p2pPrice, setP2pPrice] = useState('150');
  const [p2pPaymentMethods, setP2pPaymentMethods] = useState<PaymentMethodType[]>([
    'revolut',
    'bank_transfer',
    'telegram_pay',
  ]);
  const [p2pPaymentInstructions, setP2pPaymentInstructions] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [releaseMode, setReleaseMode] = useState<'now' | 'scheduled'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [notifyWatchers, setNotifyWatchers] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [publishError, setPublishError] = useState('');

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPublishError('');

    // Detect format
    if (file.type === 'image/gif') {
      setMediaType('gif');
      setCategory('gif_animation');
    } else if (file.type.startsWith('video/')) {
      setMediaType('video');
    } else {
      setMediaType('image');
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCustomMediaUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddTrait = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTraitKey.trim() || !newTraitVal.trim()) return;
    setTraits([...traits, { trait_type: newTraitKey.trim(), value: newTraitVal.trim() }]);
    setNewTraitKey('');
    setNewTraitVal('');
  };

  const handleRemoveTrait = (index: number) => {
    setTraits(traits.filter((_, i) => i !== index));
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setPublishError('');
    if (!title.trim() || !price || parseFloat(price) <= 0) return;

    setIsPublishing(true);
    try {
      let mediaUrl = customMediaUrl;
      if (selectedFile) {
        const uploaded = await uploadArtworkFile(selectedFile);
        if (!uploaded) {
          setPublishError('The artwork file could not be uploaded.');
          return;
        }
        mediaUrl = uploaded;
      }

      await createArtwork({
        title: title.trim(),
        description: description.trim() || 'A verifiable digital creation inscribed on the AURA protocol.',
        price: parseFloat(price),
        visualTheme: 'custom_upload',
        category,
        mediaType,
        customMediaUrl: mediaUrl,
        collectionName,
        traits,
        listOnP2P,
        p2pPriceFiat: listOnP2P ? parseFloat(p2pPrice) || parseFloat(price) : undefined,
        p2pPaymentMethods: listOnP2P ? p2pPaymentMethods : undefined,
        p2pPaymentInstructions: listOnP2P ? p2pPaymentInstructions.trim() : undefined,
        scheduledAt: releaseMode === 'scheduled' ? scheduledAt : undefined,
        notifyWatchers,
      });
    } catch (error: any) {
      setPublishError(error?.message || 'Something went wrong while publishing the artwork.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-6 pb-28">
      {/* Studio Header */}
      <div className="pt-2 px-1">
        <div className="flex items-center gap-2 mb-1 text-xs font-mono uppercase tracking-widest text-amber-400">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Universal Digital Asset Studio</span>
        </div>
        <h2 className="font-serif text-3xl text-stone-100 font-light">
          Create & Sell Digital Items
        </h2>
        <p className="text-xs text-stone-400 mt-1">
          Create a digital item, publish its AURA ownership record, and optionally list it on the protected P2P desk.
        </p>
      </div>

      <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 text-[11px] text-stone-400">
        <span className="text-stone-200 font-semibold">Your creation, your ownership.</span> Upload an original digital item and build its AURA ownership record from your own media and metadata.
      </div>

      <form onSubmit={handlePublish} className="space-y-5 px-1">
        {/* MEDIA UPLOADER & PREVIEW */}
        <div className="space-y-2">
          <label className="text-xs font-mono uppercase tracking-wider text-stone-300 block">
            1. Upload Your Digital Item (Photo, GIF, UI Design, Video, Wearable)
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,image/gif,video/mp4"
            onChange={handleFileUpload}
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative aspect-square max-w-sm mx-auto rounded-3xl overflow-hidden border-2 border-dashed border-white/20 hover:border-amber-400/60 cursor-pointer bg-[#0e0e16] group transition-all"
          >
            {customMediaUrl ? (
              <div className="relative w-full h-full">
                <img
                  src={customMediaUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs gap-1">
                  <Upload className="w-6 h-6 text-amber-400" />
                  <span>Click to change file</span>
                </div>
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/80 backdrop-blur-md text-[10px] font-mono text-cyan-300 font-bold uppercase border border-white/10">
                  {mediaType.replace('_', ' ')}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-amber-400">
                  <Upload className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold text-stone-200">
                  Drag and drop file, or browse device
                </span>
                <span className="text-[10px] text-stone-500 font-mono">
                  PNG, JPG, GIF (60fps), MP4, SVG (Max 50MB)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* METADATA FORM */}
        <div className="space-y-4 p-4 rounded-3xl bg-[#12121a] border border-white/5">
          <div>
            <label className="text-xs text-stone-300 font-medium block mb-1.5">
              Item Title / Token Name
            </label>
            <input
              type="text"
              placeholder="e.g. Aurora Study #1044 or a looping visual"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-stone-100 focus:outline-none focus:border-amber-400/60"
              required
            />
          </div>

          <div>
            <label className="text-xs text-stone-300 font-medium block mb-1.5">
              Collection Hub
            </label>
            <input
              type="text"
              placeholder="e.g. Generative Visions, Motion Studies, Digital Worlds"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-400/60"
            />
          </div>

          <div>
            <label className="text-xs text-stone-300 font-medium block mb-1.5">
              Item Description & Utilities
            </label>
            <textarea
              rows={3}
              placeholder="Provide background, animation details, or digital fashion specs..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-stone-100 focus:outline-none focus:border-amber-400/60 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-300 font-medium block mb-1.5">
                Asset Category
              </label>
              <select
                value={category}
                onChange={(e) => {
                  const cat = e.target.value as ArtworkCategory;
                  setCategory(cat);
                  if (cat === 'gif_animation') setMediaType('gif');
                  if (cat === 'ui_design') setMediaType('ui_design');
                  if (cat === 'ui_design') setMediaType('ui_design');
                }}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-stone-200 focus:outline-none focus:border-amber-400/60"
              >
                <option value="generative" className="bg-[#12121a]">Generative Art</option>
                <option value="gif_animation" className="bg-[#12121a]">Animated Visual / GIF</option>
                <option value="ui_design" className="bg-[#12121a]">UI Design System</option>
                <option value="anime_pfp" className="bg-[#12121a]">Character / Avatar Art</option>
                <option value="sculpture" className="bg-[#12121a]">3D Digital Sculpture</option>
                <option value="generative" className="bg-[#12121a]">Generative Code Art</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-stone-300 font-medium block mb-1.5">
                Marketplace Price (USDT)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">$</span>
                <input
                  type="number"
                  step="any"
                  value={price}
                  onChange={(e) => {
                    setPrice(e.target.value);
                    setP2pPrice(e.target.value);
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-7 pr-3 py-2.5 text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-400/60"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* PROPERTIES BUILDER */}
        <div className="p-4 rounded-3xl bg-[#12121a] border border-white/5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-cyan-400" />
              Item Properties & Traits ({traits.length})
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {traits.map((t, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-xs relative group flex items-center justify-between"
              >
                <div>
                  <span className="text-[10px] text-cyan-300 font-mono block uppercase">{t.trait_type}</span>
                  <span className="font-bold text-stone-100">{t.value}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveTrait(idx)}
                  className="opacity-0 group-hover:opacity-100 text-stone-500 hover:text-rose-400 p-1 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Add Trait Inline Form */}
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              placeholder="Trait (e.g. Material, Style, Rarity)"
              value={newTraitKey}
              onChange={(e) => setNewTraitKey(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Value (e.g. Chrome, Cyan, Mythic)"
              value={newTraitVal}
              onChange={(e) => setNewTraitVal(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAddTrait}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-stone-200 font-bold text-xs"
            >
              Add
            </button>
          </div>
        </div>

        {/* SECURE UNLOCKABLE CONTENT — NOT YET BACKED BY ENTITLEMENT STORAGE */}
        <div className="p-4 rounded-3xl bg-white/[0.02] border border-white/5 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-stone-200">Commercial Unlocks</span>
            <span className="text-[9px] font-mono uppercase tracking-wider text-stone-500 border border-white/10 rounded-full px-2 py-0.5">
              Coming with secure entitlements
            </span>
          </div>
          <p className="text-[10px] leading-relaxed text-stone-500">
            Private buyer-only links and license codes are not collected here yet. AURA will add them only when a secure ownership entitlement system can enforce access after purchase.
          </p>
        </div>

        {/* RELEASE PLAN */}
        <div className="p-4 rounded-3xl bg-cyan-950/15 border border-cyan-500/20 space-y-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-cyan-300" />
            <div>
              <span className="text-xs font-bold text-stone-100 block">Release plan</span>
              <span className="text-[10px] text-stone-500 block">Choose when collectors can see this artwork.</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setReleaseMode('now')} className={releaseMode === 'now' ? 'rounded-xl border border-emerald-400/40 bg-emerald-400/15 p-3 text-left' : 'rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left'}>
              <span className="text-xs font-semibold text-stone-100 block">Publish now</span>
              <span className="text-[10px] text-stone-500">Visible immediately.</span>
            </button>
            <button type="button" onClick={() => setReleaseMode('scheduled')} className={releaseMode === 'scheduled' ? 'rounded-xl border border-cyan-400/40 bg-cyan-400/15 p-3 text-left' : 'rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left'}>
              <span className="text-xs font-semibold text-stone-100 block">Schedule release</span>
              <span className="text-[10px] text-stone-500">Go live at a specific time.</span>
            </button>
          </div>
          {releaseMode === 'scheduled' && (
            <div className="space-y-2">
              <label className="text-[11px] text-stone-300 font-medium block">Release date & time</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                min={new Date(Date.now() + 60_000).toISOString().slice(0,16)}
                className="w-full bg-black/30 border border-cyan-500/30 rounded-xl px-3 py-2.5 text-xs text-stone-100 focus:outline-none focus:border-cyan-400/60"
                required
              />
              <label className="flex items-center gap-2 text-[11px] text-stone-400">
                <input type="checkbox" checked={notifyWatchers} onChange={(e) => setNotifyWatchers(e.target.checked)} className="w-4 h-4 accent-cyan-400" />
                Notify people who watch this artwork when it goes live
              </label>
            </div>
          )}
        </div>

        {/* DUAL LISTING OPTION: DIRECT P2P CASH SALE */}
        <div className="p-4 rounded-3xl bg-emerald-950/20 border border-emerald-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-xs font-bold text-stone-100 block">List on Protected P2P Desk for Cash</span>
                <span className="text-[10px] text-stone-400 block">Accept Revolut, Bank SEPA Wire, or Telegram Pay directly</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={listOnP2P}
              onChange={(e) => setListOnP2P(e.target.checked)}
              className="w-4 h-4 accent-emerald-400"
            />
          </div>

          {listOnP2P && (
            <div className="space-y-4 pt-2 border-t border-emerald-500/10">
              <div className="flex items-center gap-3">
                <span className="text-xs text-stone-300">P2P Asking Price:</span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">$</span>
                  <input
                    type="number"
                    value={p2pPrice}
                    onChange={(e) => setP2pPrice(e.target.value)}
                    className="w-full bg-black/40 border border-emerald-500/30 rounded-xl pl-7 pr-3 py-2 text-xs text-stone-100 font-mono focus:outline-none"
                  />
                </div>
                <span className="text-xs font-mono text-emerald-400">USD</span>
              </div>

              {/* Payment account / instructions */}
              <div>
                <label className="text-xs text-stone-300 font-medium block mb-1.5">
                  Your P2P Payment Account / Instructions
                </label>
                <textarea
                  rows={2}
                  value={p2pPaymentInstructions}
                  onChange={(e) => setP2pPaymentInstructions(e.target.value)}
                  placeholder="Example: Revolut @yourhandle, bank IBAN, or Telegram Pay username"
                  className="w-full bg-black/40 border border-emerald-500/30 rounded-xl px-3 py-2 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none"
                />
                <p className="text-[10px] text-stone-500 mt-1">
                  Buyers see this only inside an active order after they choose the payment method.
                </p>
              </div>

              {/* Custom Payment Methods for Art P2P Sale */}
              <CustomPaymentMethodInput
                selectedMethods={p2pPaymentMethods}
                onChange={setP2pPaymentMethods}
                accentColor="emerald"
                label="Accepted Payment Methods"
                sublabel="Choose preset payment rails or write any payment method you want (e.g. Alex’s Bank Wire, Zelle, PayPal, Monzo)"
              />
            </div>
          )}
        </div>

        {/* SUBMIT BUTTON */}
        {publishError && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            {publishError}
          </div>
        )}

        <button
          type="submit"
          disabled={isPublishing || !title.trim()}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-bold text-sm transition-all shadow-xl shadow-amber-500/10 active:scale-[0.98] disabled:opacity-50"
        >
          {isPublishing ? 'Publishing to AURA...' : `Publish & List · ${parseFloat(price) || 0} USDT`}
        </button>
      </form>
    </div>
  );
};
