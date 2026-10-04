import React from 'react';
import { useApp } from '../context/AppContext';
import { Home, Compass, Plus, Wallet, User } from 'lucide-react';

interface NavItem {
  id: 'home' | 'discover' | 'create' | 'wallet' | 'profile';
  label: string;
  icon: any;
  isCreate?: boolean;
  badge?: number;
}

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, artworks } = useApp();

  const ownedCount = artworks.filter((a) => a.isOwned).length;

  const navItems: NavItem[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'discover', label: 'Discover', icon: Compass },
    { id: 'create', label: 'Create', icon: Plus, isCreate: true },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'profile', label: 'Profile', icon: User, badge: ownedCount },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#09090d]/90 backdrop-blur-xl border-t border-white/10 pb-safe">
      <div className="max-w-md mx-auto grid grid-cols-5 h-16 items-center px-1">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          if (item.isCreate) {
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="flex flex-col items-center justify-center min-h-[48px] min-w-[48px] py-1 transition-transform active:scale-95 group"
                aria-label="Create Artwork"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg ${
                    isActive
                      ? 'bg-amber-400 text-stone-950 ring-2 ring-amber-400/40'
                      : 'bg-white/10 text-stone-200 group-hover:bg-amber-400/20 group-hover:text-amber-300'
                  }`}
                >
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </div>
                <span
                  className={`text-[10px] tracking-tight mt-0.5 transition-colors ${
                    isActive ? 'text-amber-300 font-semibold' : 'text-stone-400 font-medium'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="relative flex flex-col items-center justify-center min-h-[48px] min-w-[48px] py-1 transition-transform active:scale-95 text-stone-400 hover:text-stone-200"
              aria-label={item.label}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-all ${
                    isActive ? 'text-stone-100 stroke-[2.2] scale-110' : 'text-stone-400 stroke-[1.8]'
                  }`}
                />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[15px] h-[15px] px-1 bg-amber-400 text-stone-950 text-[9px] font-bold rounded-full flex items-center justify-center tabular-nums">
                    {item.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] tracking-tight mt-1 transition-colors ${
                  isActive ? 'text-stone-100 font-semibold' : 'text-stone-400 font-medium'
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <div className="w-1 h-1 bg-amber-400 rounded-full mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
