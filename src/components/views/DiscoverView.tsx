import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Artwork, ArtworkCategory } from '../../types';
import { ArtworkCanvas } from '../ArtworkCanvas';
import {
  Search,
  Sparkles,
  CheckCircle2,
  Compass,
  Star,
  ShoppingBag,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

interface DiscoverViewProps {
  onOpenDetail: (artwork: Artwork) => void;
}

export const DiscoverView: React.FC<DiscoverViewProps> = ({ onOpenDetail }) => {
  const { artworks, collections, setSelectedCollection, toggleWatchlist } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ArtworkCategory | 'all'>('all');

  const categories: { id: ArtworkCategory | 'all'; label: string }[] = [
    { id: 'all', label: 'All Curations' },
    { id: 'brand_streetwear', label: 'Nike & Streetwear' },
    { id: 'gif_animation', label: 'Animated GIFs' },
    { id: 'ui_design', label: 'UI Design Kits' },
    { id: 'anime_pfp', label: 'Anime Avatars' },
    { id: 'sculpture', label: '3D Sculptures' },
    { id: 'generative', label: 'Generative Code' },
    { id: 'botanical', label: 'Bio-Generative' },
  ];

  const filteredArtworks = artworks.filter((art) => {
    const matchesCategory = selectedCategory === 'all' || art.category === selectedCategory;
    const matchesSearch =
      art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.creator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (art.collectionName && art.collectionName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Featured Curators list
  const featuredCurators = [
    {
      name: 'Elena Rostova',
      handle: '@erostova',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      focus: 'Obsidian & Glass Dynamics',
      works: 28,
    },
    {
      name: 'Kai Takahashi',
      handle: '@takahashikai',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80',
      focus: 'Cellular Automata & Flora',
      works: 19,
    },
    {
      name: 'Vesper Hale',
      handle: '@vesperhale',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
      focus: 'Volumetric Brutalism',
      works: 14,
    },
  ];

  return (
    <div className="space-y-6 pb-24">
      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search by title, Nike, Azuki, GIF, UI design, artist..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#12121a] border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-xs text-stone-200 placeholder:text-stone-400 focus:outline-none focus:border-amber-400/50 transition-colors shadow-sm"
        />
      </div>

      {/* Category Horizontal Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-amber-400 text-stone-950 font-semibold shadow-sm'
                  : 'bg-white/5 text-stone-400 hover:text-stone-200 hover:bg-white/10'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* TOP BRANDS & VERIFIED HUBS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="font-mono text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5 text-blue-400" />
            Verified Collections & Hubs
          </span>
          <span className="text-stone-400 font-mono text-[11px]">Photo Hub</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {collections.map((col) => (
            <div
              key={col.id}
              onClick={() => setSelectedCollection(col)}
              className="p-3.5 rounded-2xl bg-[#111119] border border-white/5 hover:border-blue-400/40 cursor-pointer transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={col.avatar}
                  alt={col.name}
                  className="w-11 h-11 rounded-xl object-cover border border-white/10 shrink-0 group-hover:scale-105 transition-transform"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-stone-100 truncate">{col.name}</span>
                    {col.verified && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    )}
                  </div>
                  <span className="text-[11px] text-stone-400 font-mono block">
                    {(col.itemsCount ?? 0).toLocaleString()} items · {(col.ownersCount ?? 0).toLocaleString()} owners
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <span className="text-[10px] text-stone-500 font-mono block">Floor</span>
                  <span className="font-serif font-bold text-xs text-stone-200 tabular-nums">
                    ${(col.floorPriceUSDT ?? 0).toLocaleString()}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-500 group-hover:text-blue-400 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURED SPOTLIGHT MASTERS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="font-mono text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Spotlight Creators
          </span>
          <span className="text-stone-400 font-mono text-[11px]">Curated</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {featuredCurators.map((c, i) => (
            <div
              key={i}
              className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/15 transition-all text-center flex flex-col items-center group cursor-pointer"
            >
              <img
                src={c.avatar}
                alt={c.name}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-full object-cover border border-white/10 mb-2 group-hover:scale-105 transition-transform"
              />
              <span className="text-xs font-semibold text-stone-200 truncate w-full">
                {c.name}
              </span>
              <span className="text-[10px] text-stone-400 font-mono truncate w-full mt-0.5">
                {c.handle}
              </span>
              <span className="text-[10px] text-amber-400/80 font-mono mt-1">
                {c.works} Works
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* PINTEREST-STYLE 2-COLUMN DISCOVERY GRID */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="font-mono text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            Gallery Discovery Wall
          </span>
          <span className="text-stone-400 font-mono text-[11px]">
            {filteredArtworks.length} Works
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {filteredArtworks.map((artwork) => (
            <div
              key={artwork.id}
              onClick={() => onOpenDetail(artwork)}
              className="group cursor-pointer rounded-2xl bg-[#0f0f16] border border-white/5 overflow-hidden hover:border-white/20 transition-all duration-300"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-black">
                <ArtworkCanvas artwork={artwork} showOverlayGrain={false} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />
                
                {/* Watchlist Star Button (Top Left) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleWatchlist(artwork.id);
                  }}
                  className="absolute top-2 left-2 p-1.5 rounded-full bg-black/60 backdrop-blur-md text-stone-400 hover:text-amber-400 transition-colors"
                  title="Watchlist Item"
                >
                  <Star className={`w-3.5 h-3.5 ${artwork.isWatched ? 'fill-amber-400 text-amber-400' : ''}`} />
                </button>

                {/* Floating Price Pill */}
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono text-amber-300">
                  ${(artwork.currentValue ?? 0).toLocaleString()}
                </div>

                {/* Bottom title info */}
                <div className="absolute bottom-2 inset-x-2 pointer-events-none">
                  {artwork.collectionName && (
                    <span className="text-[9px] font-mono text-blue-300 block truncate">
                      {artwork.collectionName}
                    </span>
                  )}
                  <h4 className="font-serif text-sm text-stone-100 font-normal leading-tight truncate">
                    {artwork.title}
                  </h4>
                  <p className="text-[10px] text-stone-400 font-mono truncate mt-0.5">
                    {artwork.creator.name}
                  </p>
                </div>
              </div>

              {/* Bottom interactions count */}
              <div className="p-2.5 flex items-center justify-between text-[10px] font-mono text-stone-400 bg-white/[0.01]">
                <span>{(artwork.eligibleInteractions ?? 0).toLocaleString()} int.</span>
                <span className="text-emerald-400 font-medium">
                  {artwork.interestLevel}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
