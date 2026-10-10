import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Clock,
  ShieldCheck,
  MessageCircle,
  ExternalLink,
  CheckCircle2,
  CreditCard,
  RefreshCw,
  History,
  CircleAlert,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { P2POrder } from '../../types';

interface Props {
  onResume: (order: P2POrder) => void;
}

const TRACKABLE_STATUSES: P2POrder['status'][] = ['escrow_locked', 'payment_marked', 'in_dispute'];

const orderToUi = (row: any): P2POrder => {
  const offer = row.offer || {};
  const merchant = offer.merchant || {};
  const completedCount = Number(merchant.p2p_stats?.completed_orders || 0);
  const cancelledCount = Number(merchant.p2p_stats?.cancelled_orders || 0);
  const total = completedCount + cancelledCount;
  return {
    id: row.id,
    offerId: row.offer_id,
    type: row.type,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    merchant: {
      id: merchant.id || '',
      name: merchant.display_name || 'AURA Member',
      legalName: merchant.display_name || 'AURA Member',
      avatar: merchant.avatar_url || '',
      ordersCompleted: completedCount,
      completionRate: total > 0 ? (completedCount / total) * 100 : 0,
      avgReleaseTimeMinutes: 0,
      verifiedMerchant: false,
      kycVerified: false,
      depositBondUSDT: 0,
      telegramHandle: merchant.handle || '',
      positiveFeedbackPercent: 0,
    },
    cryptoAmount: Number(row.crypto_amount || 0),
    fiatAmount: Number(row.fiat_amount || 0),
    fiatCurrency: row.fiat_currency || 'USD',
    paymentMethod: row.payment_method,
    status: row.status,
    escrowTxHash: row.escrow_reference || row.reference_code || '',
    createdAt: row.created_at ? new Date(row.created_at).toLocaleString() : 'Just now',
    acceptedAt: row.accepted_at ? new Date(row.accepted_at).toISOString() : undefined,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : undefined,
    protectionFundActive: row.status === 'escrow_locked' || row.status === 'payment_marked',
    artwork: row.artwork_id ? {
      id: row.artwork_id,
      title: offer.artwork?.title || 'AURA Artwork',
      image: offer.artwork?.media_url || '',
    } : undefined,
    paymentDetails: {
      accountName: row.payment_details?.accountName || merchant.display_name || 'AURA Counterparty',
      accountNumberOrId: row.payment_details?.accountNumberOrId || 'Use the payment instructions shown in the order.',
      referenceCode: row.payment_details?.referenceCode || row.reference_code || '',
    },
    chatMessages: [],
  };
};

const statusCopy = (order: P2POrder) => {
  if (order.status === 'cancelled') return 'Cancelled';
  if (order.status === 'completed') return 'Completed';
  if (order.status === 'in_dispute') return 'Under review';
  if (order.status === 'payment_marked') return 'Payment proof submitted';
  if (!order.acceptedAt) return 'Waiting for acceptance';
  return 'Accepted — payment stage';
};

const statusClasses = (order: P2POrder) => {
  if (order.status === 'completed') return 'border-emerald-400/20 bg-emerald-400/5 text-emerald-200';
  if (order.status === 'cancelled') return 'border-rose-400/20 bg-rose-400/5 text-rose-200';
  if (order.status === 'in_dispute') return 'border-amber-400/25 bg-amber-400/10 text-amber-200';
  if (order.status === 'payment_marked') return 'border-cyan-400/20 bg-cyan-400/5 text-cyan-200';
  return 'border-emerald-400/20 bg-emerald-400/5 text-emerald-200';
};

export function P2PTradeCenterView({ onResume }: Props) {
  const { activeP2POrder, setActiveTab } = useApp();
  const { user } = useAuth();
  const [orders, setOrders] = useState<P2POrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const refreshOrders = useCallback(async () => {
    if (!user?.id) {
      setOrders([]);
      setLoadError('');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');

    const { data, error } = await supabase
      .from('p2p_orders')
      .select('*,offer:offer_id(*,merchant:merchant_id(id,handle,display_name,avatar_url,p2p_stats:p2p_trader_stats(*)),artwork:artwork_id(id,title,media_url))')
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      setLoadError('AURA could not load trade history. Pull to refresh or try again.');
      setLoading(false);
      return;
    }

    setOrders(((data || []) as any[]).map(orderToUi));
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void refreshOrders();
    if (!user?.id) return;

    const channel = supabase
      .channel(`aura-p2p-center-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'p2p_orders',
        filter: `buyer_id=eq.${user.id}`,
      }, () => { void refreshOrders(); })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'p2p_orders',
        filter: `seller_id=eq.${user.id}`,
      }, () => { void refreshOrders(); })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [refreshOrders, user?.id]);

  const trackedOrders = activeP2POrder && !orders.some(order => order.id === activeP2POrder.id)
    ? [activeP2POrder, ...orders]
    : orders;

  const activeOrders = trackedOrders.filter(order => TRACKABLE_STATUSES.includes(order.status));
  const historyOrders = trackedOrders.filter(order => !TRACKABLE_STATUSES.includes(order.status));

  return (
    <div className="min-h-full px-4 py-5 pb-28">
      <div className="max-w-md mx-auto space-y-5">
        <button onClick={() => setActiveTab('home')} className="inline-flex items-center gap-2 text-xs text-stone-400 hover:text-stone-100">
          <ArrowLeft className="w-4 h-4" /> Back to AURA
        </button>

        <div className="rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-400/10 via-white/[0.03] to-transparent p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-amber-300 font-bold">AURA P2P • Trade Center</div>
              <h1 className="text-xl font-black text-stone-100 mt-1">My Trades</h1>
              <p className="mt-2 text-xs leading-5 text-stone-400">Track acceptance, payment proof, escrow status, release, and previous orders here. Leaving this page does not cancel a trade.</p>
            </div>
            <button
              onClick={() => { void refreshOrders(); }}
              disabled={loading}
              aria-label="Refresh trade history"
              className="shrink-0 w-10 h-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-stone-300 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {!user && (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs text-stone-300">
            Sign in to view your private AURA trade history.
          </div>
        )}

        {loadError && (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-4 text-xs text-rose-200">
            {loadError}
            <button onClick={() => { void refreshOrders(); }} className="ml-2 underline">Retry</button>
          </div>
        )}

        {loading && trackedOrders.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center text-xs text-stone-400">
            Loading your trade history…
          </div>
        )}

        {!loading && !loadError && trackedOrders.length === 0 && user && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center">
            <History className="mx-auto w-8 h-8 text-amber-300" />
            <h2 className="mt-3 text-base font-bold text-stone-100">No trades yet</h2>
            <p className="mt-2 text-xs leading-5 text-stone-400">Once you request or accept a P2P trade, it will appear here. Completed and cancelled orders remain available in your history.</p>
          </div>
        )}

        {activeOrders.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-stone-100">Active & In Progress</h2>
              <span className="text-[10px] text-stone-500">{activeOrders.length} order{activeOrders.length === 1 ? '' : 's'}</span>
            </div>
            {activeOrders.map(order => {
              const waiting = order.status === 'escrow_locked' && !order.acceptedAt;
              return (
                <article key={order.id} className="rounded-3xl border border-emerald-400/15 bg-white/[0.03] p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-stone-500">{order.type === 'buy' ? 'Buy order' : 'Sell order'} · {order.sellerId === user?.id ? 'You are seller' : 'You are buyer'}</div>
                      <div className="mt-1 font-mono text-xs text-stone-100">Ref: {order.paymentDetails.referenceCode || order.id.slice(0, 8).toUpperCase()}</div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold ${statusClasses(order)}`}>{statusCopy(order)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-black/20 p-3">
                      <div className="text-[10px] text-stone-500">Crypto amount</div>
                      <div className="mt-1 text-sm font-bold text-stone-100">{order.cryptoAmount.toLocaleString()} USDT</div>
                    </div>
                    <div className="rounded-xl bg-black/20 p-3">
                      <div className="text-[10px] text-stone-500">Fiat amount</div>
                      <div className="mt-1 text-sm font-bold text-stone-100">{order.fiatAmount.toLocaleString()} {order.fiatCurrency}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-[10px] text-stone-400">
                    {waiting ? <Clock className="w-4 h-4 text-amber-300 shrink-0" /> : <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />}
                    <span>{waiting ? 'Waiting for the counterparty. The server-managed acceptance deadline continues while you are away.' : order.status === 'payment_marked' ? 'Payment proof was submitted. The counterparty must review it before release.' : order.status === 'in_dispute' ? 'This order is under dispute review. Check the trade conversation for updates.' : 'The current order state is stored on the server and can be resumed from here.'}</span>
                  </div>
                  <button onClick={() => onResume(order)} className="w-full rounded-xl bg-emerald-400 py-3 text-xs font-black text-stone-950 flex items-center justify-center gap-2">
                    <ExternalLink className="w-4 h-4" /> Resume secure trade
                  </button>
                </article>
              );
            })}
          </section>
        )}

        {historyOrders.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-stone-100">Recent history</h2>
            {historyOrders.map(order => (
              <article key={order.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-stone-100">Ref: {order.paymentDetails.referenceCode || order.id.slice(0, 8).toUpperCase()}</div>
                    <div className="mt-1 text-[10px] text-stone-500">{order.createdAt} · {order.type === 'buy' ? 'Buy order' : 'Sell order'} · {order.sellerId === user?.id ? 'Seller' : 'Buyer'}</div>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold ${statusClasses(order)}`}>{statusCopy(order)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-stone-400">Amount</span>
                  <span className="font-semibold text-stone-100">{order.cryptoAmount.toLocaleString()} USDT · {order.fiatAmount.toLocaleString()} {order.fiatCurrency}</span>
                </div>
                {order.status === 'completed' && <div className="mt-2 flex items-center gap-2 text-[10px] text-emerald-200"><CheckCircle2 className="w-3.5 h-3.5" /> Final status: completed</div>}
                {order.status === 'cancelled' && <div className="mt-2 flex items-center gap-2 text-[10px] text-stone-400"><CircleAlert className="w-3.5 h-3.5" /> Final status: cancelled</div>}
              </article>
            ))}
          </section>
        )}

        <div className="flex items-center justify-center gap-2 text-[10px] text-stone-500">
          <MessageCircle className="w-3.5 h-3.5" /> Your order history is loaded from AURA’s database, not device-only storage.
        </div>
      </div>
    </div>
  );
}
