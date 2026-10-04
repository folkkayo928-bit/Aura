import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { P2POffer, PaymentMethodType } from '../../types';
import { formatPaymentMethodLabel } from './CustomPaymentMethodInput';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Plus,
  ArrowUpDown,
  Smartphone,
  CreditCard,
  Building2,
  Globe,
  Zap,
  Lock,
  BadgeCheck,
  Wallet,
  Search,
  SlidersHorizontal,
  X,
  Sparkles,
  ArrowDownUp,
  Check,
  Star,
  RotateCcw,
} from 'lucide-react';

interface P2PViewProps {
  onSelectOffer: (offer: P2POffer) => void;
  onOpenCreateOffer: () => void;
}

export type P2PSortOption = 'method_match' | 'price_best' | 'completion' | 'trades' | 'speed';

export const P2PView: React.FC<P2PViewProps> = ({ onSelectOffer, onOpenCreateOffer }) => {
  const { p2pOffers, walletBalance } = useApp();
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType | 'all'>('all');
  const [searchMethodQuery, setSearchMethodQuery] = useState('');
  const [sortBy, setSortBy] = useState<P2PSortOption>('method_match');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterMode, setFilterMode] = useState<'prioritize' | 'strict'>('prioritize');

  // Collect all distinct payment methods available in the current activeTab
  const availableMethods = useMemo(() => {
    const set = new Set<string>();
    p2pOffers.forEach((offer) => {
      if (offer.type === activeTab) {
        offer.paymentMethods?.forEach((m) => {
          if (m && m.trim()) set.add(m.trim());
        });
      }
    });
    return Array.from(set);
  }, [p2pOffers, activeTab]);

  // Method offer counts for the current tab
  const methodOfferCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    p2pOffers.forEach((offer) => {
      if (offer.type === activeTab) {
        offer.paymentMethods?.forEach((m) => {
          const key = m.toLowerCase();
          counts[key] = (counts[key] || 0) + 1;
        });
      }
    });
    return counts;
  }, [p2pOffers, activeTab]);

  // Check if an offer accepts a specific payment method
  const offerAcceptsMethod = (offer: P2POffer, method: string): boolean => {
    if (!method || method === 'all') return true;
    const lowerTarget = method.toLowerCase();
    return offer.paymentMethods.some(
      (m) => m.toLowerCase() === lowerTarget || m.toLowerCase().includes(lowerTarget)
    );
  };

  // Filter & sort offers based on payment method and chosen sort option
  const processedOffers = useMemo(() => {
    // 1. Filter by buy/sell tab
    let result = p2pOffers.filter((offer) => offer.type === activeTab);

    // 2. Filter by search query if typed
    if (searchMethodQuery.trim()) {
      const q = searchMethodQuery.trim().toLowerCase();
      result = result.filter(
        (offer) =>
          offer.paymentMethods.some((m) => m.toLowerCase().includes(q)) ||
          offer.merchant.name.toLowerCase().includes(q) ||
          (offer.merchant.legalName && offer.merchant.legalName.toLowerCase().includes(q))
      );
    }

    // 3. Filter mode: If strict and a specific method is chosen
    if (selectedMethod !== 'all' && filterMode === 'strict') {
      result = result.filter((offer) => offerAcceptsMethod(offer, selectedMethod));
    }

    // 4. Sort the trade offers
    result.sort((a, b) => {
      // If sorting by chosen payment method match (or prioritize mode is active)
      if (sortBy === 'method_match' && selectedMethod !== 'all') {
        const aMatches = offerAcceptsMethod(a, selectedMethod);
        const bMatches = offerAcceptsMethod(b, selectedMethod);

        if (aMatches && !bMatches) return -1;
        if (!aMatches && bMatches) return 1;

        // Secondary sort: best price for active tab
        if (activeTab === 'buy') {
          return a.pricePerUnit - b.pricePerUnit;
        } else {
          return b.pricePerUnit - a.pricePerUnit;
        }
      }

      // Best Price sort
      if (sortBy === 'price_best') {
        const diff = activeTab === 'buy'
          ? a.pricePerUnit - b.pricePerUnit // lower price first when buying
          : b.pricePerUnit - a.pricePerUnit; // higher price first when selling
        return sortDirection === 'asc' ? diff : -diff;
      }

      // Merchant Completion rate sort
      if (sortBy === 'completion') {
        const diff = (b.merchant.completionRate ?? 0) - (a.merchant.completionRate ?? 0);
        return sortDirection === 'asc' ? diff : -diff;
      }

      // Most Orders Completed sort
      if (sortBy === 'trades') {
        const diff = (b.merchant.ordersCompleted ?? 0) - (a.merchant.ordersCompleted ?? 0);
        return sortDirection === 'asc' ? diff : -diff;
      }

      // Speed (fastest release first)
      if (sortBy === 'speed') {
        const diff = (a.merchant.avgReleaseTimeMinutes ?? 2) - (b.merchant.avgReleaseTimeMinutes ?? 2);
        return sortDirection === 'asc' ? diff : -diff;
      }

      // Default fallback
      return 0;
    });

    return result;
  }, [
    p2pOffers,
    activeTab,
    selectedMethod,
    searchMethodQuery,
    sortBy,
    sortDirection,
    filterMode,
  ]);

  const getMethodBadge = (m: PaymentMethodType, isHighlighted: boolean = false) => {
    const lower = m.toLowerCase();
    const highlightClasses = isHighlighted
      ? 'ring-2 ring-amber-400 bg-amber-400/20 text-amber-200 border-amber-400/50 shadow-sm'
      : '';

    if (lower === 'telegram_pay' || lower.includes('telegram')) {
      return (
        <span
          key={m}
          className={`flex items-center gap-1 text-[10px] text-cyan-300 bg-cyan-950/50 border border-cyan-500/20 px-2 py-0.5 rounded-md transition-all ${highlightClasses}`}
        >
          <Smartphone className="w-2.5 h-2.5" /> Telegram Wallet
        </span>
      );
    }
    if (lower === 'revolut') {
      return (
        <span
          key={m}
          className={`flex items-center gap-1 text-[10px] text-blue-300 bg-blue-950/50 border border-blue-500/20 px-2 py-0.5 rounded-md transition-all ${highlightClasses}`}
        >
          <CreditCard className="w-2.5 h-2.5" /> Revolut
        </span>
      );
    }
    if (lower === 'bank_transfer' || lower.includes('bank') || lower.includes('sepa') || lower.includes('wire')) {
      return (
        <span
          key={m}
          className={`flex items-center gap-1 text-[10px] text-amber-300 bg-amber-950/50 border border-amber-500/20 px-2 py-0.5 rounded-md transition-all ${highlightClasses}`}
        >
          <Building2 className="w-2.5 h-2.5" /> {formatPaymentMethodLabel(m)}
        </span>
      );
    }
    if (lower === 'wise') {
      return (
        <span
          key={m}
          className={`flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-950/50 border border-emerald-500/20 px-2 py-0.5 rounded-md transition-all ${highlightClasses}`}
        >
          <Globe className="w-2.5 h-2.5" /> Wise
        </span>
      );
    }
    if (lower === 'crypto_ton' || lower.includes('ton')) {
      return (
        <span
          key={m}
          className={`flex items-center gap-1 text-[10px] text-purple-300 bg-purple-950/50 border border-purple-500/20 px-2 py-0.5 rounded-md transition-all ${highlightClasses}`}
        >
          <Zap className="w-2.5 h-2.5" /> TON USDT
        </span>
      );
    }
    if (lower === 'zelle') {
      return (
        <span
          key={m}
          className={`flex items-center gap-1 text-[10px] text-purple-300 bg-purple-950/50 border border-purple-500/20 px-2 py-0.5 rounded-md transition-all ${highlightClasses}`}
        >
          <CreditCard className="w-2.5 h-2.5" /> Zelle
        </span>
      );
    }
    if (lower === 'paypal') {
      return (
        <span
          key={m}
          className={`flex items-center gap-1 text-[10px] text-blue-300 bg-blue-950/50 border border-blue-500/20 px-2 py-0.5 rounded-md transition-all ${highlightClasses}`}
        >
          <Wallet className="w-2.5 h-2.5" /> PayPal
        </span>
      );
    }
    if (lower === 'apple_pay' || lower.includes('apple')) {
      return (
        <span
          key={m}
          className={`flex items-center gap-1 text-[10px] text-stone-200 bg-white/10 border border-white/20 px-2 py-0.5 rounded-md transition-all ${highlightClasses}`}
        >
          <Smartphone className="w-2.5 h-2.5" /> Apple Pay
        </span>
      );
    }
    if (lower === 'cashapp' || lower.includes('cash app')) {
      return (
        <span
          key={m}
          className={`flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-950/50 border border-emerald-500/20 px-2 py-0.5 rounded-md transition-all ${highlightClasses}`}
        >
          <CreditCard className="w-2.5 h-2.5" /> Cash App
        </span>
      );
    }
    if (lower === 'venmo') {
      return (
        <span
          key={m}
          className={`flex items-center gap-1 text-[10px] text-cyan-300 bg-cyan-950/50 border border-cyan-500/20 px-2 py-0.5 rounded-md transition-all ${highlightClasses}`}
        >
          <Wallet className="w-2.5 h-2.5" /> Venmo
        </span>
      );
    }

    // Any Custom Payment Method (e.g. Alex's Bank Wire, Monzo, Swish, Pix)
    return (
      <span
        key={m}
        className={`flex items-center gap-1 text-[10px] text-teal-300 bg-teal-950/50 border border-teal-500/30 px-2 py-0.5 rounded-md font-medium transition-all ${highlightClasses}`}
        title={`Custom Rail: ${m}`}
      >
        <CreditCard className="w-2.5 h-2.5 text-teal-400" />
        <span>{formatPaymentMethodLabel(m)}</span>
      </span>
    );
  };

  const clearAllFilters = () => {
    setSelectedMethod('all');
    setSearchMethodQuery('');
    setSortBy('method_match');
    setFilterMode('prioritize');
  };

  const hasActiveFilters =
    selectedMethod !== 'all' || searchMethodQuery.trim().length > 0 || sortBy !== 'method_match';

  return (
    <div className="space-y-5 pb-24">
      {/* Header & Escrow Protection Guarantee */}
      <div className="pt-2 px-1">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono tracking-widest uppercase">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>AURA Protected Peer Escrow</span>
            </div>
            <h2 className="font-serif text-2xl text-stone-100 font-light mt-0.5">
              Certified P2P Exchange
            </h2>
          </div>
          <button
            onClick={onOpenCreateOffer}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Post Ad</span>
          </button>
        </div>

        {/* 100% Protection & Safety Fund Guarantee Callout */}
        <div className="p-4 rounded-3xl bg-gradient-to-r from-[#0d1d17] via-[#101918] to-[#0c1218] border border-emerald-500/30 text-xs text-stone-300 space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
              <BadgeCheck className="w-4 h-4 shrink-0" />
              <span>AURA P2P Protection</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Internal ledger protection
            </span>
          </div>
          <p className="text-[11px] text-stone-300 leading-relaxed">
            USDT trades use an AURA internal ledger hold until the trade is completed or cancelled. Fiat payments are handled directly through the selected payment rail, with dispute controls available when needed.
          </p>
        </div>
      </div>

      {/* Buy / Sell Toggle Tabs */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1 p-1 bg-white/5 rounded-2xl border border-white/5">
          <button
            onClick={() => setActiveTab('buy')}
            className={`px-6 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'buy'
                ? 'bg-emerald-500 text-stone-950 shadow-md shadow-emerald-500/20'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Buy USDT
          </button>
          <button
            onClick={() => setActiveTab('sell')}
            className={`px-6 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'sell'
                ? 'bg-rose-500 text-stone-100 shadow-md shadow-rose-500/20'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Sell USDT
          </button>
        </div>

        <div className="text-right text-[11px] font-mono text-stone-400">
          <span>Vault Balance: </span>
          <span className="text-emerald-400 font-medium">${walletBalance.toFixed(2)} USDT</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* COMPREHENSIVE FILTERING & SORTING BAR FOR PAYMENT METHODS & TRADE OFFERS  */}
      {/* ========================================================================= */}
      <div className="p-3.5 rounded-3xl bg-[#111118] border border-white/10 space-y-3 shadow-xl">
        {/* Top Controls: Search Payment Methods & Sort Selector */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search Payment Methods Input */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchMethodQuery}
              onChange={(e) => setSearchMethodQuery(e.target.value)}
              placeholder="Search payment method (e.g. Alex's Bank, Revolut, Zelle)..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-400/60 font-sans"
            />
            {searchMethodQuery && (
              <button
                onClick={() => setSearchMethodQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-xl">
              <SlidersHorizontal className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="text-[11px] text-stone-400 font-medium">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as P2PSortOption)}
                className="bg-transparent text-xs text-stone-200 font-medium focus:outline-none cursor-pointer pr-1"
              >
                <option value="method_match" className="bg-[#12121a] text-stone-200">
                  Chosen Payment Method
                </option>
                <option value="price_best" className="bg-[#12121a] text-stone-200">
                  Best Unit Price ({activeTab === 'buy' ? 'Lowest' : 'Highest'})
                </option>
                <option value="completion" className="bg-[#12121a] text-stone-200">
                  Highest Completion Rate
                </option>
                <option value="trades" className="bg-[#12121a] text-stone-200">
                  Most Orders Completed
                </option>
                <option value="speed" className="bg-[#12121a] text-stone-200">
                  Fastest Release Time
                </option>
              </select>
            </div>

            {/* Invert Sort Order Direction */}
            {sortBy !== 'method_match' && (
              <button
                onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-stone-300 transition-colors"
              >
                <ArrowDownUp className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Payment Method Quick Filter Pills Bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400 flex items-center gap-1">
              <span>Filter by Payment Rail</span>
              <span className="text-stone-500">·</span>
              <span className="text-stone-400">{availableMethods.length} options</span>
            </span>

            {/* Toggle Sort Priority vs Strict Filter when a method is chosen */}
            {selectedMethod !== 'all' && (
              <div className="flex items-center gap-1 text-[10px]">
                <button
                  onClick={() => setFilterMode('prioritize')}
                  className={`px-2 py-0.5 rounded-md transition-colors ${
                    filterMode === 'prioritize'
                      ? 'bg-amber-400/20 text-amber-300 font-semibold border border-amber-400/40'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                  title="Show all offers with matching payment methods sorted first"
                >
                  Prioritize First
                </button>
                <button
                  onClick={() => setFilterMode('strict')}
                  className={`px-2 py-0.5 rounded-md transition-colors ${
                    filterMode === 'strict'
                      ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                  title="Show only offers that accept the chosen method"
                >
                  Strict Match Only
                </button>
              </div>
            )}
          </div>

          {/* Horizontal scroll of Payment Methods */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {/* "All Rails" pill */}
            <button
              onClick={() => setSelectedMethod('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                selectedMethod === 'all'
                  ? 'bg-stone-200 text-stone-950 font-bold shadow-sm'
                  : 'bg-white/5 text-stone-400 hover:text-stone-200 hover:bg-white/10'
              }`}
            >
              <span>All Payment Rails</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  selectedMethod === 'all'
                    ? 'bg-stone-900/20 text-stone-950'
                    : 'bg-white/10 text-stone-400'
                }`}
              >
                {p2pOffers.filter((o) => o.type === activeTab).length}
              </span>
            </button>

            {/* Individual Available Payment Methods (Presets & Custom like Alex's Bank Wire) */}
            {availableMethods.map((method) => {
              const isSelected = selectedMethod.toLowerCase() === method.toLowerCase();
              const count = methodOfferCounts[method.toLowerCase()] || 0;
              const formatted = formatPaymentMethodLabel(method);

              return (
                <button
                  key={method}
                  onClick={() => setSelectedMethod(isSelected ? 'all' : method)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-stone-950 font-bold shadow-md shadow-amber-500/20'
                      : 'bg-white/5 text-stone-300 hover:text-stone-100 hover:bg-white/10 border border-transparent hover:border-white/10'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  <span>{formatted}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected
                        ? 'bg-stone-950/20 text-stone-950 font-bold'
                        : 'bg-white/10 text-stone-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Filter Summary Bar */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
            <div className="flex items-center gap-1.5 text-stone-300 flex-wrap">
              <span className="text-amber-400 font-medium">Active:</span>
              {selectedMethod !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-amber-400/10 border border-amber-400/30 text-amber-300 px-2 py-0.5 rounded-md font-medium">
                  {formatPaymentMethodLabel(selectedMethod)} ({filterMode === 'strict' ? 'Strict' : 'Sorted First'})
                  <button
                    onClick={() => setSelectedMethod('all')}
                    className="hover:text-amber-100 ml-0.5"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}
              {searchMethodQuery.trim() && (
                <span className="inline-flex items-center gap-1 bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 px-2 py-0.5 rounded-md font-mono">
                  "{searchMethodQuery.trim()}"
                  <button
                    onClick={() => setSearchMethodQuery('')}
                    className="hover:text-cyan-100 ml-0.5"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}
              <span className="text-stone-500">·</span>
              <span className="text-stone-400">
                {processedOffers.length} {processedOffers.length === 1 ? 'offer' : 'offers'} available
              </span>
            </div>

            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 text-[10px] text-stone-400 hover:text-stone-200 transition-colors shrink-0 ml-2"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        )}
      </div>

      {/* P2P Order Book Listing */}
      <div className="space-y-3 px-1">
        {processedOffers.length === 0 ? (
          <div className="py-12 text-center p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-3">
            <ArrowUpDown className="w-8 h-8 text-stone-600 mx-auto" />
            <div>
              <p className="text-xs font-medium text-stone-300">
                No active trade offers found matching {selectedMethod !== 'all' ? `"${formatPaymentMethodLabel(selectedMethod)}"` : 'this filter'}.
              </p>
              <p className="text-[11px] text-stone-500 mt-1">
                You can post your own ad with any payment method you want.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={clearAllFilters}
                className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-stone-300 text-xs transition-colors"
              >
                Clear Filters
              </button>
              <button
                onClick={onOpenCreateOffer}
                className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs transition-colors shadow-md shadow-amber-500/10 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Post Ad with this Method</span>
              </button>
            </div>
          </div>
        ) : (
          processedOffers.map((offer) => {
            const matchesChosen =
              selectedMethod !== 'all' && offerAcceptsMethod(offer, selectedMethod);

            return (
              <div
                key={offer.id}
                className={`p-4 rounded-3xl bg-[#111118] border transition-all space-y-3 shadow-lg ${
                  matchesChosen
                    ? 'border-amber-400/40 bg-gradient-to-b from-[#151520] to-[#111118] shadow-amber-500/5'
                    : 'border-white/5 hover:border-emerald-500/20'
                }`}
              >
                {/* Method Match Badge Callout if sorting by user's chosen payment method */}
                {matchesChosen && (
                  <div className="flex items-center justify-between pb-2 border-b border-white/5">
                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-md">
                      <Star className="w-3 h-3 fill-amber-300" />
                      <span>Accepts your chosen payment method: {formatPaymentMethodLabel(selectedMethod)}</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      <span>AURA Ledger Hold</span>
                    </span>
                  </div>
                )}

                {/* Merchant Details Row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={offer.merchant.avatar}
                      alt={offer.merchant.name}
                      className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500/40 shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-stone-100">
                          {offer.merchant.name}
                        </span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <span className="text-[10px] text-stone-400 block font-mono">
                        {offer.merchant?.legalName || offer.merchant?.name || 'AURA Member'}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] text-stone-400 font-mono mt-0.5">
                        <span>{offer.merchant?.ordersCompleted ?? 0} trades</span>
                        <span>·</span>
                        <span className="text-emerald-400 font-medium">
                          {offer.merchant?.completionRate ?? 99}% completion
                        </span>
                        <span>·</span>
                        <span className="text-cyan-300">
                          ${(offer.merchant?.depositBondUSDT ?? 5000).toLocaleString()} bond
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-1 text-[11px] text-stone-400 font-mono">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    <span>{offer.merchant?.avgReleaseTimeMinutes ?? 2}m avg</span>
                  </div>
                </div>

                {/* Price & Limits Row */}
                <div className="flex items-baseline justify-between pt-1 border-t border-white/5">
                  <div>
                    <span className="text-[10px] text-stone-400 block font-mono">Exchange Rate</span>
                    <div className="flex items-baseline gap-1">
                      <span className="font-serif text-2xl font-semibold text-stone-100 tabular-nums">
                        ${(offer.pricePerUnit ?? 1.0).toFixed(2)}
                      </span>
                      <span className="text-xs font-mono text-stone-400">{offer.fiatCurrency || 'USD'} / USDT</span>
                    </div>
                  </div>

                  <div className="text-right text-xs">
                    <div className="text-stone-300 font-mono">
                      <span className="text-stone-500">Available: </span>
                      <span className="text-emerald-400 font-medium">
                        {(offer.availableCrypto ?? 0).toLocaleString()} USDT
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-400 font-mono mt-0.5">
                      Limits: ${offer.minLimitFiat ?? 10} - ${(offer.maxLimitFiat ?? 500).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Payment Methods & Action Button */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-1.5 flex-wrap max-w-[65%]">
                    {offer.paymentMethods.map((m) => {
                      const isHighlighted =
                        selectedMethod !== 'all' &&
                        (m.toLowerCase() === selectedMethod.toLowerCase() ||
                          m.toLowerCase().includes(selectedMethod.toLowerCase()));
                      return getMethodBadge(m, isHighlighted);
                    })}
                  </div>

                  <button
                    onClick={() => onSelectOffer(offer)}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 shadow-md ${
                      offer.type === 'buy'
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-stone-950 shadow-emerald-500/20'
                        : 'bg-rose-500 hover:bg-rose-400 text-stone-100 shadow-rose-500/20'
                    }`}
                  >
                    {offer.type === 'buy' ? 'Buy USDT' : 'Sell USDT'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
