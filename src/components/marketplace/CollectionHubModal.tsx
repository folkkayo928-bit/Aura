import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { NFTCollection, Artwork } from '../../types';
import { ArtworkCanvas } from '../ArtworkCanvas';
import {
  ChevronLeft,
  Star,
  Share2,
  MoreVertical,
  Search,
  SlidersHorizontal,
  Grid,
  Columns,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Tag,
  Clock,
  Activity,
  BarChart3,
  Layers,
  ShoppingBag,
} from 'lucide-react';

interface CollectionHubModalProps {
  collection: NFTCollection;
  onClose: () => void;
  onOpenArtworkDetail: (artwork: Artwork) => void;
}

export const CollectionHubModal: React.FC<CollectionHubModalProps> = ({
  collection,
  onClose,
  onOpenArtworkDetail,
}) => {
  const {
    artworks,
    toggleCollectionWatchlist,
    toggleWatchlist,
    quickBuyArtwork,
    setMakeOfferArtwork,
    setSelectedArtwork,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'items' | 'explore' | 'owned' | 'activity' | 'analytics'>('items');
  const [searchQuery, setSearchQuery] = useState('');
  const [isTwoCol, setIsTwoCol] = useState(true);
  const [selectedItemForAction, setSelectedItemForAction] = useState<Artwork | null>(null);

  // Filter collection items
  const collectionArtworks = artworks.filter(
    (a) => a.collectionId === collection.id || a.collectionName?.toLowerCase().includes(collection.name.toLowerCase())
  );

  const displayedArtworks = collectionArtworks.filter((a) =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.tokenId && a.tokenId.includes(searchQuery))
  );

  // First item selected by default for bottom sticky bar (like in screenshot)
  const activeFocusItem = selectedItemForAction || (displayedArtworks.length > 0 ? displayedArtworks[0] : null);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#09090d] flex flex-col no-scrollbar">
      {/* Top Header Bar (Like in photo: Back arrow, logo, title, floor, star, share) */}
      <div className="sticky top-0 z-40 bg-[#0d0d14]/90 backdrop-blur-xl border-b border-white/5 px-4 h-14 flex items-center justify-between">
        <button
          onClick={onClose}
          className="p-2 -ml-2 rounded-full text-stone-300 hover:text-white transition-colors"
          aria-label="Back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Collection Identity in center */}
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={collection.avatar}
            alt={collection.name}
            className="w-8 h-8 rounded-lg object-cover border border-white/10 shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h2 className="text-sm font-bold text-stone-100 truncate">{collection.name}</h2>
              {collection.verified && (
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 fill-blue-400/20 shrink-0" />
              )}
            </div>
            <span className="text-[11px] font-mono text-stone-400 block tabular-nums">
              ${(collection.floorPriceUSDT ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Action icons: Star / Watchlist & Options */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleCollectionWatchlist(collection.id)}
            className={`p-2 rounded-full transition-colors ${
              collection.isWatched ? 'text-amber-400' : 'text-stone-400 hover:text-stone-200'
            }`}
            title="Watchlist Collection"
          >
            <Star className={`w-5 h-5 ${collection.isWatched ? 'fill-amber-400' : ''}`} />
          </button>
          <button
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
              }
            }}
            className="p-2 rounded-full text-stone-400 hover:text-stone-200"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Scroll Content */}
      <div className="max-w-xl mx-auto w-full px-3 pt-3 pb-32 space-y-4">
        {/* Navigation Tabs (Like in photo: Explore, Items, Owned, Activity, Analytics) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {[
            { id: 'items', label: `Items (${collectionArtworks.length})`, icon: Layers },
            { id: 'explore', label: 'Explore', icon: Sparkles },
            { id: 'owned', label: `Owned (${collectionArtworks.filter(a => a.isOwned).length})`, icon: Tag },
            { id: 'activity', label: 'Activity', icon: Activity },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-stone-200 text-stone-950 shadow-md'
                    : 'bg-white/5 text-stone-400 hover:text-stone-200 hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search & Layout Toggle Bar (Like in photo: Filter button, Search input, Grid icon) */}
        <div className="flex items-center gap-2 pt-1">
          <button
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-stone-400 hover:text-stone-200"
            title="Filter traits"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#12121a] border border-white/5 rounded-xl pl-9 pr-3 py-2 text-xs text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <button
            onClick={() => setIsTwoCol(!isTwoCol)}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-stone-400 hover:text-stone-200"
            title="Toggle Grid View"
          >
            {isTwoCol ? <Columns className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
          </button>
        </div>

        {/* TAB 1: ITEMS (Photo layout: 2-column cards with title, rarity, price) */}
        {activeTab === 'items' && (
          <div className={`grid gap-3 pt-1 ${isTwoCol ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {displayedArtworks.length === 0 ? (
              <div className="col-span-2 py-16 text-center text-stone-500 text-xs">
                No items found matching "{searchQuery}".
              </div>
            ) : (
              displayedArtworks.map((item) => {
                const isSelected = activeFocusItem?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedItemForAction(item);
                      onOpenArtworkDetail(item);
                    }}
                    className={`group cursor-pointer rounded-2xl bg-[#111119] border overflow-hidden transition-all duration-200 ${
                      isSelected
                        ? 'border-blue-500/80 ring-1 ring-blue-500/50'
                        : 'border-white/5 hover:border-white/20'
                    }`}
                  >
                    {/* Item Image */}
                    <div className="relative aspect-square w-full overflow-hidden bg-black">
                      <ArtworkCanvas artwork={item} showOverlayGrain={false} />

                      {/* Watchlist Star Icon (Top Right) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWatchlist(item.id);
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-stone-400 hover:text-amber-400 transition-colors"
                      >
                        <Star className={`w-3.5 h-3.5 ${item.isWatched ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>

                      {/* Format Badge (if GIF or brand streetwear) */}
                      {item.mediaType && item.mediaType !== 'image' && (
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md text-[9px] font-mono font-bold text-cyan-300 uppercase">
                          {item.mediaType.replace('_', ' ')}
                        </div>
                      )}
                    </div>

                    {/* Card Body (Matching photo: Item title + Rarity badge + Price) */}
                    <div className="p-3 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-stone-100 truncate">
                          {item.title}
                        </span>
                        {item.rarityRank && (
                          <span className="text-[10px] font-mono text-stone-400 flex items-center gap-0.5 shrink-0">
                            <span>◆</span>
                            <span>#{item.rarityRank}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-baseline justify-between pt-0.5">
                        <span className="font-serif text-sm font-semibold text-stone-200 tabular-nums">
                          ${(item.currentValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        {item.isOwned && (
                          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-500/30">
                            In Vault
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: EXPLORE / ABOUT */}
        {activeTab === 'explore' && (
          <div className="space-y-4 p-4 rounded-3xl bg-[#12121a] border border-white/5 text-xs text-stone-300 leading-relaxed">
            <h3 className="font-serif text-lg text-stone-100">About {collection.name}</h3>
            <p>{collection.description}</p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                <span className="text-stone-500 text-[10px] block">Items in Circulation</span>
                <span className="font-serif text-base text-stone-100 font-bold">{(collection.itemsCount ?? 0).toLocaleString()}</span>
              </div>
              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                <span className="text-stone-500 text-[10px] block">Patron Holders</span>
                <span className="font-serif text-base text-stone-100 font-bold">{(collection.ownersCount ?? 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: OWNED */}
        {activeTab === 'owned' && (
          <div className="space-y-3">
            {collectionArtworks.filter(a => a.isOwned).length === 0 ? (
              <div className="py-16 text-center text-stone-500 text-xs">
                You don't own any items from {collection.name} yet. Use Quick Buy below to acquire one!
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {collectionArtworks.filter(a => a.isOwned).map(item => (
                  <div
                    key={item.id}
                    onClick={() => onOpenArtworkDetail(item)}
                    className="cursor-pointer rounded-2xl bg-[#111119] border border-emerald-500/30 overflow-hidden"
                  >
                    <div className="relative aspect-square w-full">
                      <ArtworkCanvas artwork={item} showOverlayGrain={false} />
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-emerald-950/80 text-[9px] font-mono text-emerald-300 border border-emerald-500/30">
                        In Vault
                      </div>
                    </div>
                    <div className="p-3">
                      <h4 className="font-bold text-xs text-stone-100 truncate">{item.title}</h4>
                      <span className="font-serif text-xs text-stone-300">${item.currentValue} USDT</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ACTIVITY */}
        {activeTab === 'activity' && (
          <div className="space-y-2 p-2">
            {[
              { type: 'Sale', item: `${collection.name} #8781`, price: '$1,752.03', from: '0x8b3...1a', to: 'Julian Vance', time: '12m ago' },
              { type: 'Transfer', item: `${collection.name} #6145`, price: '$1,764.59', from: 'Azuki Vault', to: 'WhaleVault', time: '45m ago' },
              { type: 'Bid', item: `${collection.name} #9257`, price: '$1,700.00', from: 'Kenji_X', to: '-', time: '2h ago' },
            ].map((act, i) => (
              <div key={i} className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-stone-200 block">{act.item}</span>
                  <span className="text-[10px] text-stone-500 font-mono">{act.type} · {act.from} → {act.to}</span>
                </div>
                <div className="text-right">
                  <span className="font-serif text-sm font-bold text-emerald-400">{act.price}</span>
                  <span className="text-[10px] text-stone-500 block font-mono">{act.time}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 5: ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="space-y-3 p-4 rounded-3xl bg-[#12121a] border border-white/5 text-xs">
            <span className="font-mono text-stone-400 uppercase tracking-widest text-[10px] block">Marketplace Liquidity</span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-stone-500 block text-[10px]">Floor Price</span>
                <span className="font-serif text-2xl text-stone-100 font-bold">${(collection.floorPriceUSDT ?? 0).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[10px]">24h Volume</span>
                <span className="font-serif text-2xl text-emerald-400 font-bold">${(collection.totalVolumeUSDT ?? 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* STICKY BOTTOM ACTION BAR (EXACTLY like on the uploaded screenshot!) */}
      {activeFocusItem && (
        <div className="fixed bottom-0 inset-x-0 z-50 bg-[#09090d]/95 backdrop-blur-xl border-t border-white/10 p-3 pb-safe">
          <div className="max-w-md mx-auto flex items-center gap-3">
            {/* Make Offer Button (Dark Pill) */}
            <button
              onClick={() => setMakeOfferArtwork(activeFocusItem)}
              className="flex-1 py-3.5 px-4 rounded-2xl bg-[#1e1e28] hover:bg-[#252535] text-stone-200 font-bold text-xs transition-all border border-white/5 active:scale-[0.98]"
            >
              Make Offer
            </button>

            {/* Quick Buy Button (Vibrant Blue Primary, like in photo!) */}
            <button
              onClick={() => quickBuyArtwork(activeFocusItem)}
              className="flex-1 py-3.5 px-4 rounded-2xl bg-[#0088ff] hover:bg-[#0077ee] text-white font-bold text-xs transition-all shadow-lg shadow-blue-500/25 active:scale-[0.98] flex items-center justify-center gap-1.5"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Quick Buy · ${(activeFocusItem.currentValue ?? 0).toLocaleString()}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
