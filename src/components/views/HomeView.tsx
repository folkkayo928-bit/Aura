import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { ArtworkCard } from '../ArtworkCard';
import { FeedSection, Creator } from '../../types';
import { WatchlistView } from '../watchlist/WatchlistView';
import { UpcomingDropsView } from '../drops/UpcomingDropsView';
import {
  Sparkles,
  TrendingUp,
  Clock,
  Heart,
  Award,
  Star,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ShoppingBag,
} from 'lucide-react';

interface HomeViewProps {
  onOpenDetail: (artwork: any) => void;
  onOpenProfile?: (creator: Creator) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onOpenDetail, onOpenProfile }) => {
  const { artworks, collections, feedFilter, setFeedFilter, setSelectedCollection } = useApp();

  const watchedCount = useMemo(() => {
    return artworks.filter((a) => a.isWatched).length + collections.filter((c) => c.isWatched).length;
  }, [artworks, collections]);

  const filterTabs: { id: FeedSection; label: string; icon: any; badge?: number }[] = [
    { id: 'trending', label: 'Trending', icon: TrendingUp },
    { id: 'watchlist', label: 'Watchlist', icon: Star, badge: watchedCount },
    { id: 'drops', label: 'What Is Coming', icon: Calendar },
    { id: 'rising', label: 'Rising', icon: Sparkles },
    { id: 'new', label: 'New', icon: Clock },
    { id: 'loved', label: 'Loved', icon: Heart },
    { id: 'recommended', label: 'Recommended', icon: Award },
  ];

  // Filter artworks based on selected section
  const filteredArtworks = useMemo(() => {
    switch (feedFilter) {
      case 'rising':
        return [...artworks].filter((a) => a.interestLevel === 'Rising' || a.interestLevel === 'Surging');
      case 'new':
        return [...artworks].sort((a, b) => b.id.localeCompare(a.id));
      case 'loved':
        return [...artworks].sort((a, b) => b.loves - a.loves);
      case 'recommended':
        return [...artworks].filter((a) => a.eligibleInteractions > 800);
      case 'trending':
      default:
        return [...artworks].sort((a, b) => b.eligibleInteractions - a.eligibleInteractions);
    }
  }, [artworks, feedFilter]);

  return (
    <div className="space-y-6 pb-24">
      {/* TRENDING ENTRY — keep the homepage focused on what collectors want */}
      <div className="px-1 pt-2">
        <div className="flex items-end justify-between gap-3 rounded-3xl border border-white/10 bg-gradient-to-r from-[#151522] via-[#101019] to-[#0b0b10] px-4 py-4 shadow-xl">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.24em] text-amber-300">
              <TrendingUp className="w-3.5 h-3.5" />
              Trending now
            </div>
            <h2 className="mt-1 font-serif text-2xl font-light tracking-tight text-stone-100">
              What collectors are watching
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
              Rising pieces, active collections, and new drops — all in one feed.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setFeedFilter('watchlist')}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-semibold text-stone-300 hover:bg-white/10"
            >
              <span className="inline-flex items-center gap-1.5">
                <Star className="h-3 w-3 text-amber-400" />
                Watchlist {watchedCount > 0 ? `· ${watchedCount}` : ''}
              </span>
            </button>
            <button
              onClick={() => setFeedFilter('drops')}
              className="hidden sm:inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-[10px] font-semibold text-cyan-300"
            >
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                Drops
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* FEATURED BRANDS & TOP COLLECTIONS CAROUSEL */}
      {feedFilter !== 'drops' && feedFilter !== 'watchlist' && (
        <div className="space-y-2 px-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-blue-400" />
              Top Brands & Collections
            </span>
            <span className="text-stone-500 font-mono text-[10px]">Tap to explore hub</span>
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1">
            {collections.map((col) => (
              <div
                key={col.id}
                onClick={() => setSelectedCollection(col)}
                className="flex items-center gap-2.5 p-2 pr-3.5 rounded-2xl bg-[#111119] border border-white/5 hover:border-blue-400/40 cursor-pointer transition-all shrink-0 group"
              >
                <img
                  src={col.avatar}
                  alt={col.name}
                  className="w-9 h-9 rounded-xl object-cover border border-white/10 shrink-0 group-hover:scale-105 transition-transform"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-stone-100 truncate max-w-[110px]">
                      {col.name}
                    </span>
                    {col.verified && (
                      <CheckCircle2 className="w-3 h-3 text-blue-400 shrink-0" />
                    )}
                  </div>
                  <div className="text-[10px] text-stone-400 font-mono">
                    Floor: <span className="text-stone-200 font-bold">{col.floorPriceUSDT > 0 ? `${col.floorPriceUSDT.toLocaleString()}` : 'Not reported'}</span>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-stone-500 group-hover:text-stone-300 ml-1" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FILTER TABS */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-1 py-1">
        {filterTabs.map((tab) => {
          const isActive = feedFilter === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setFeedFilter(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                isActive
                  ? 'bg-stone-100 text-stone-950 font-semibold shadow-sm'
                  : 'bg-white/5 text-stone-400 hover:text-stone-200 hover:bg-white/10'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                    isActive ? 'bg-amber-500 text-black' : 'bg-white/20 text-stone-100'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* VIEW CONTENT BASED ON SELECTED TAB */}
      {feedFilter === 'watchlist' ? (
        <WatchlistView
          onOpenArtworkDetail={onOpenDetail}
          onOpenCollection={(col) => setSelectedCollection(col)}
        />
      ) : feedFilter === 'drops' ? (
        <UpcomingDropsView />
      ) : (
        /* IMMERSIVE ARTWORK FEED */
        <div className="space-y-6">
          {filteredArtworks.map((artwork) => (
            <ArtworkCard
              key={artwork.id}
              artwork={artwork}
              onOpenDetail={onOpenDetail}
              onOpenProfile={onOpenProfile}
            />
          ))}
        </div>
      )}
    </div>
  );
};
