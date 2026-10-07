import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowDownToLine, ArrowUpFromLine, BarChart3, ChevronLeft,
  CircleDollarSign, Lock, Plus, X, RefreshCw, ShieldCheck,
  Sparkles, Users, WalletCards, XCircle
} from 'lucide-react';

type Dashboard = {
  totalUsers?: number; activeWallets?: number; totalWalletBalanceUSDT?: number;
  pendingWithdrawals?: number; queuedWithdrawals?: number; detectedDeposits?: number;
  creditedDeposits?: number; openP2POrders?: number; scheduledDrops?: number;
  liveArtworks?: number; generatedAt?: string;
};

type FinancialPoint = {
  metric_date: string;
  ledger_credits: number;
  ledger_debits: number;
  onchain_deposits: number;
  withdrawals: number;
  p2p_completed_volume: number;
};

const money = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const AdminView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { user } = useAuth();
  const [role, setRole] = useState<'operator' | 'finance' | 'owner'>('operator');
  const [tab, setTab] = useState<'overview' | 'wallets' | 'withdrawals' | 'drops' | 'p2p' | 'health'>('overview');
  const [dashboard, setDashboard] = useState<Dashboard>({});
  const [wallets, setWallets] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [drops, setDrops] = useState<any[]>([]);
  const [p2pDisputes, setP2pDisputes] = useState<any[]>([]);
  const [disputeAction, setDisputeAction] = useState<{ orderId: string; resolution: 'release_to_buyer' | 'refund_seller' } | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [health, setHealth] = useState<any>({});
  const [foundation, setFoundation] = useState<any>({});
  const [audit, setAudit] = useState<any[]>([]);
  const [financial, setFinancial] = useState<FinancialPoint[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [newDrop, setNewDrop] = useState({ title: '', description: '', banner: '', price: '0', supply: '100', category: 'digital', scheduled: '', whitelist: false, perks: '' });
  const [adjust, setAdjust] = useState<{ userId: string; direction: 'credit' | 'debit'; amount: string; reason: string } | null>(null);

  const load = async () => {
    if (!user) return;
    setBusy(true);
    const [r0, r1, r2, r3, r4, r5, r6, r7, r8, r9] = await Promise.all([
      supabase.rpc('aura_can', { p_min_role: 'operator' }),
      supabase.rpc('admin_dashboard_snapshot'),
      supabase.rpc('admin_list_wallets', { p_limit: 100 }),
      supabase.rpc('admin_list_withdrawals', { p_limit: 100 }),
      supabase.rpc('admin_list_deposits', { p_limit: 100 }),
      supabase.rpc('admin_list_drops_v2', { p_limit: 100 }),
      supabase.rpc('admin_system_health'),
      supabase.rpc('admin_financial_timeseries', { p_days: 14 }),
      supabase.rpc('admin_list_p2p_disputes', { p_limit: 100 }),
      supabase.rpc('admin_foundation_readiness'),
    ]);

    if (!r0.error && r0.data === true) {
      const [ra, rf, ro] = await Promise.all([
        supabase.rpc('admin_list_recent_audit', { p_limit: 50 }),
        supabase.rpc('aura_can', { p_min_role: 'finance' }),
        supabase.rpc('aura_can', { p_min_role: 'owner' }),
      ]);
      if (!ra.error) setAudit(ra.data || []);
      setDashboard((r1.data || {}) as Dashboard);
      setWallets(r2.data || []);
      setWithdrawals(r3.data || []);
      setDeposits(r4.data || []);
      setDrops(r5.data || []);
      setHealth((r6.data || [])[0] || r6.data || {});
      if (!r7.error) setFinancial((r7.data || []) as FinancialPoint[]);
      if (!r8.error) setP2pDisputes(r8.data || []);
      if (!r9.error) setFoundation((r9.data || {}) as Record<string, unknown>);
      if (!rf.error && rf.data) setRole('finance');
      if (!ro.error && ro.data) setRole('owner');
    }
    setBusy(false);
  };

  useEffect(() => { void load(); }, [user]);

  const run = async (fn: string, args: any, success: string) => {
    setBusy(true);
    setNotice('');
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) {
      setNotice(error.message);
      return;
    }
    setNotice(success);
    await load();
  };

  const canFinance = role === 'finance' || role === 'owner';
  const canOperate = role === 'operator' || role === 'finance' || role === 'owner';

  const stats = useMemo(() => [
    ['Users', dashboard.totalUsers || 0, Users],
    ['Wallets', dashboard.activeWallets || 0, WalletCards],
    ['Treasury', money(dashboard.totalWalletBalanceUSDT) + ' USDT', CircleDollarSign],
    ['Withdrawals', dashboard.pendingWithdrawals || 0, ArrowUpFromLine],
    ['Deposits', dashboard.creditedDeposits || 0, ArrowDownToLine],
    ['Live art', dashboard.liveArtworks || 0, Sparkles],
  ] as const, [dashboard]);

  const chartMax = Math.max(
    1,
    ...financial.flatMap((p) => [
      Number(p.ledger_credits || 0),
      Number(p.ledger_debits || 0),
      Number(p.onchain_deposits || 0),
      Number(p.withdrawals || 0),
      Number(p.p2p_completed_volume || 0),
    ]),
  );

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#07070b] text-stone-100">
      <div className="sticky top-0 z-20 border-b border-white/10 bg-[#09090d]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="rounded-full border border-white/10 p-2"><ChevronLeft className="h-4 w-4" /></button>
            <div><div className="font-serif text-xl">AURA Operations</div><div className="text-[9px] uppercase tracking-[.25em] text-amber-300">{role} console</div></div>
          </div>
          <button onClick={() => void load()} className="rounded-full border border-white/10 p-2 text-stone-400" title="Refresh">
            <RefreshCw className={busy ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 pb-12">
        {notice && <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs text-amber-200">{notice}</div>}

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {(['overview', 'wallets', 'withdrawals', 'drops', 'p2p', 'health'] as const).map((x) => (
            <button key={x} onClick={() => setTab(x)} className={tab === x
              ? 'rounded-full bg-stone-100 px-4 py-2 text-[10px] font-bold uppercase text-stone-950'
              : 'rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-semibold uppercase text-stone-400'}>
              {x}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {stats.map(([label, value, Icon]) => (
                <div key={label} className="rounded-3xl border border-white/10 bg-white/[.03] p-4">
                  <Icon className="h-4 w-4 text-amber-300" />
                  <div className="mt-4 font-serif text-2xl">{value}</div>
                  <div className="mt-1 text-[9px] uppercase tracking-widest text-stone-500">{label}</div>
                </div>
              ))}
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#111118] p-5">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-cyan-300" />
                <div><div className="font-semibold">14-day financial pulse</div><div className="text-xs text-stone-500">Real ledger, on-chain and completed P2P activity.</div></div>
              </div>
              <div className="mt-5 space-y-3">
                {financial.length === 0 ? (
                  <div className="rounded-2xl bg-white/[.03] p-5 text-xs text-stone-500">No financial activity has been recorded yet.</div>
                ) : financial.slice(-14).map((p) => {
                  const totalIn = Number(p.ledger_credits || 0) + Number(p.onchain_deposits || 0);
                  const totalOut = Number(p.ledger_debits || 0) + Number(p.withdrawals || 0);
                  return (
                    <div key={p.metric_date} className="grid grid-cols-[72px_1fr] items-center gap-3">
                      <div className="text-[10px] text-stone-500">{new Date(p.metric_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                      <div className="space-y-1">
                        <div className="h-2 overflow-hidden rounded-full bg-white/5">
                          <div className="h-full rounded-full bg-emerald-400/80" style={{ width: `${Math.max(1, Math.min(100, (totalIn / chartMax) * 100))}%` }} />
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/5">
                          <div className="h-full rounded-full bg-rose-400/70" style={{ width: `${Math.max(0, Math.min(100, (totalOut / chartMax) * 100))}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {financial.length > 0 && <div className="mt-4 flex justify-between text-[9px] uppercase tracking-widest text-stone-600"><span>inflow</span><span>outflow</span></div>}
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#111118] p-5">
              <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-cyan-300" /><div><div className="font-semibold">Foundation readiness</div><div className="text-xs text-stone-500">Operational building blocks are live; custody secrets stay server-side.</div></div></div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  ['Owner access', foundation.ownerClaimed],
                  ['Worker secret', foundation.workerSecretConfigured],
                  ['Vault wiring', foundation.projectVaultConfigured],
                  ['Deposit cron', foundation.depositIndexerScheduleReady],
                  ['Sweep cron', foundation.depositSweepScheduleReady],
                  ['Drop alerts', foundation.dropNotificationQueueReady],
                ].map(([label, ready]) => (
                  <div key={String(label)} className="rounded-2xl bg-white/[.03] p-3">
                    <div className={ready ? 'text-[9px] uppercase tracking-widest text-emerald-300' : 'text-[9px] uppercase tracking-widest text-amber-300'}>{ready ? 'READY' : 'WAITING'}</div>
                    <div className="mt-1 text-[11px] text-stone-300">{String(label)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded-xl bg-white/[.02] p-2">Custodial addresses <b className="float-right text-stone-200">{Number(foundation.depositCustodyAddresses || 0)}</b></div>
                <div className="rounded-xl bg-white/[.02] p-2">Sweep pending <b className="float-right text-stone-200">{Number(foundation.depositSweepPending || 0)}</b></div>
                <div className="rounded-xl bg-white/[.02] p-2">Sweep failed <b className="float-right text-rose-300">{Number(foundation.depositSweepFailed || 0)}</b></div>
                <div className="rounded-xl bg-white/[.02] p-2">Drop reminders <b className="float-right text-stone-200">{Number(foundation.dropReminders || 0)}</b></div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#111118] p-5">
              <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-400" /><div><div className="font-semibold">Controlled operations</div><div className="text-xs text-stone-500">Every privileged action is role-gated and audited.</div></div></div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-2xl bg-white/[.03] p-3">P2P open <b className="float-right">{dashboard.openP2POrders || 0}</b></div>
                <div className="rounded-2xl bg-white/[.03] p-3">Scheduled drops <b className="float-right">{dashboard.scheduledDrops || 0}</b></div>
                <div className="rounded-2xl bg-white/[.03] p-3">Queued withdrawals <b className="float-right">{dashboard.queuedWithdrawals || 0}</b></div>
                <div className="rounded-2xl bg-white/[.03] p-3">Detected deposits <b className="float-right">{dashboard.detectedDeposits || 0}</b></div>
              </div>
            </div>
          </>
        )}

        {tab === 'wallets' && (
          <div className="space-y-2">
            {wallets.length === 0 && <div className="rounded-2xl border border-white/10 bg-[#111118] p-5 text-xs text-stone-500">No wallets to operate on.</div>}
            {wallets.map((w) => (
              <div key={w.user_id} className="rounded-2xl border border-white/10 bg-[#111118] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0"><div className="truncate text-sm font-semibold">{w.display_name || w.handle || 'AURA Member'}</div><div className="truncate text-[10px] text-stone-500">{w.user_id} · {w.wallet_id || 'wallet'}</div></div>
                  <div className="text-right"><div className="font-mono text-sm">{money(w.balance_usdt)} USDT</div><div className="text-[9px] uppercase text-stone-500">{w.wallet_status}</div></div>
                </div>
                {canFinance && <div className="mt-3 flex gap-2">
                  <button onClick={() => run('admin_set_wallet_status', { p_user_id: w.user_id, p_status: w.wallet_status === 'active' ? 'locked' : 'active', p_reason: w.wallet_status === 'active' ? 'Operations lock' : 'Operations unlock' }, 'Wallet status updated.')} className="rounded-xl border border-white/10 px-3 py-2 text-[10px]"><Lock className="mr-1 inline h-3 w-3" />{w.wallet_status === 'active' ? 'Lock' : 'Unlock'}</button>
                  <button onClick={() => setAdjust({ userId: w.user_id, direction: 'credit', amount: '', reason: '' })} className="rounded-xl bg-emerald-400/10 px-3 py-2 text-[10px] text-emerald-300">Adjust</button>
                </div>}
              </div>
            ))}
          </div>
        )}

        {tab === 'withdrawals' && (
          <div className="space-y-2">
            {withdrawals.length === 0 && <div className="rounded-2xl border border-white/10 bg-[#111118] p-5 text-xs text-stone-500">No withdrawal requests.</div>}
            {withdrawals.map((w) => (
              <div key={w.id} className="rounded-2xl border border-white/10 bg-[#111118] p-4">
                <div className="flex justify-between gap-3"><div><div className="font-semibold text-sm">{money(w.amount)} {w.token_symbol || 'USDT'}</div><div className="text-[10px] text-stone-500">{w.chain} · {w.status}</div></div><div className="text-right text-[10px] text-stone-500">{w.created_at ? new Date(w.created_at).toLocaleString() : ''}</div></div>
                {canFinance && w.status === 'pending_email_confirmation' && <button onClick={() => run('admin_reject_pending_withdrawal', { p_withdrawal_id: w.id, p_reason: 'Rejected by AURA finance operations' }, 'Withdrawal rejected and funds refunded.')} className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[10px] text-rose-300"><XCircle className="mr-1 inline h-3 w-3" />Reject & refund</button>}
              </div>
            ))}
          </div>
        )}

        {tab === 'drops' && (
          <>
            <div className="rounded-3xl border border-white/10 bg-[#111118] p-5">
              <div className="mb-4 flex items-center gap-2"><Plus className="h-4 w-4 text-amber-300" /><div><div className="font-semibold">Create launch</div><div className="text-xs text-stone-500">Backend-backed drop, not a mock.</div></div></div>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ['title', 'Title'], ['description', 'Description'], ['banner', 'Banner URL'], ['price', 'Price USDT'],
                  ['supply', 'Supply'], ['category', 'Category'], ['scheduled', 'Scheduled ISO'], ['perks', 'Perks, comma separated'],
                ].map(([k, l]) => <input key={k} value={(newDrop as any)[k]} onChange={(e) => setNewDrop((v) => ({ ...v, [k]: e.target.value }))} placeholder={l} className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-3 text-xs outline-none" />)}
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs text-stone-400"><input type="checkbox" checked={newDrop.whitelist} onChange={(e) => setNewDrop((v) => ({ ...v, whitelist: e.target.checked }))} /> Whitelist open</label>
              <button onClick={async () => {
                const { error } = await supabase.rpc('admin_create_drop_v2', {
                  p_title: newDrop.title.trim(),
                  p_description: newDrop.description.trim(),
                  p_banner_url: newDrop.banner.trim() || null,
                  p_mint_price_usdt: Number(newDrop.price) || 0,
                  p_supply: Number(newDrop.supply) || 1,
                  p_category: newDrop.category.trim() || 'digital',
                  p_scheduled_at: newDrop.scheduled || null,
                  p_whitelist_open: newDrop.whitelist,
                  p_perks: newDrop.perks.split(',').map(x => x.trim()).filter(Boolean),
                  p_creator_id: null,
                  p_collection_id: null,
                });
                if (error) setNotice(error.message);
                else {
                  setNotice('Drop created.');
                  setNewDrop({ title: '', description: '', banner: '', price: '0', supply: '100', category: 'digital', scheduled: '', whitelist: false, perks: '' });
                  await load();
                }
              }} className="mt-3 rounded-xl bg-amber-400 px-4 py-3 text-xs font-bold text-stone-950">Create drop</button>
            </div>
            <div className="space-y-2">
              {drops.length === 0 && <div className="rounded-2xl border border-white/10 bg-[#111118] p-5 text-xs text-stone-500">No drops created.</div>}
              {drops.map((d) => <div key={d.id} className="rounded-2xl border border-white/10 bg-[#111118] p-4"><div className="flex justify-between"><div><div className="font-serif text-lg">{d.title}</div><div className="text-[10px] text-stone-500">{d.status} · {d.supply} supply · {money(d.mint_price_usdt)} USDT</div></div><select value={d.status} onChange={(e) => run('admin_set_drop_status', { p_drop_id: d.id, p_status: e.target.value }, 'Drop status updated.')} className="rounded-xl border border-white/10 bg-black px-2 text-[10px]"><option>draft</option><option>scheduled</option><option>live</option><option>completed</option><option>cancelled</option></select></div></div>)}
            </div>
          </>
        )}

        {tab === 'p2p' && (
          <div className="space-y-3">
            <div className="rounded-3xl border border-white/10 bg-[#111118] p-5">
              <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-cyan-300" /><div><div className="font-semibold">P2P dispute desk</div><div className="text-xs text-stone-500">Resolve only verified dispute states; every decision is audited.</div></div></div>
            </div>
            {p2pDisputes.length === 0 && <div className="rounded-2xl border border-white/10 bg-[#111118] p-5 text-xs text-stone-500">No P2P disputes are currently open.</div>}
            {p2pDisputes.map((o) => (
              <div key={o.id} className="rounded-2xl border border-white/10 bg-[#111118] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><div className="font-mono text-sm text-stone-100">{o.reference_code || o.id}</div><div className="mt-1 text-[10px] text-stone-500">{Number(o.crypto_amount || 0).toFixed(2)} USDT · {o.fiat_currency} · {o.payment_method}</div><div className="mt-1 text-[10px] text-stone-600">Buyer {o.buyer_id} · Seller {o.seller_id}</div></div>
                  <span className="rounded-full bg-rose-400/10 px-2 py-1 text-[9px] uppercase tracking-wider text-rose-300">In dispute</span>
                </div>
                {canOperate && <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => { setDisputeReason(''); setDisputeAction({ orderId: o.id, resolution: 'refund_seller' }); }} className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[10px] text-amber-200">Refund seller</button><button onClick={() => { setDisputeReason(''); setDisputeAction({ orderId: o.id, resolution: 'release_to_buyer' }); }} className="rounded-xl bg-emerald-400/10 px-3 py-2 text-[10px] text-emerald-300">Release to buyer</button></div>}
              </div>
            ))}
          </div>
        )}

        {tab === 'health' && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(health).filter(([k]) => k !== 'generatedAt').map(([k, v]) => <div key={k} className="rounded-2xl border border-white/10 bg-[#111118] p-4"><div className="text-[9px] uppercase tracking-widest text-stone-500">{k}</div><div className={Number(v) > 0 && /failed|errors|disputes/i.test(k) ? 'mt-2 text-xl text-rose-300' : 'mt-2 text-xl'}>{String(v)}</div></div>)}
            </div>
            <div className="rounded-3xl border border-white/10 bg-[#111118] p-4">
              <div className="mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-cyan-300" /> Recent audit</div>
              {audit.length === 0 && <div className="py-5 text-xs text-stone-500">No privileged actions recorded yet.</div>}
              {audit.map((a) => <div key={a.id} className="flex gap-3 border-t border-white/5 py-3 text-[10px]"><span className="text-amber-300">{a.action}</span><span className="flex-1 truncate text-stone-500">{a.entity_type} · {a.entity_id}</span><span className="text-stone-600">{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</span></div>)}
            </div>
          </>
        )}

        {disputeAction && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#15151d] p-5">
              <div className="flex items-start justify-between gap-3"><div><div className="font-serif text-xl">Confirm dispute decision</div><div className="mt-1 text-xs text-stone-500">{disputeAction.resolution === 'release_to_buyer' ? 'Release the escrowed asset/value to the buyer.' : 'Refund the escrowed value to the seller.'}</div></div><button onClick={() => setDisputeAction(null)}><X /></button></div>
              <textarea value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder="Decision reason (required)" rows={4} className="mt-4 w-full rounded-2xl border border-white/10 bg-black p-3 text-xs text-stone-100 outline-none" />
              <button disabled={!disputeReason.trim() || busy} onClick={async () => { if (!disputeAction) return; await run('admin_resolve_p2p_dispute',{p_order_id:disputeAction.orderId,p_resolution:disputeAction.resolution,p_reason:disputeReason.trim()},'P2P dispute resolved and audited.'); setDisputeAction(null); setDisputeReason(''); }} className="mt-3 w-full rounded-2xl bg-amber-400 p-3 text-xs font-bold text-stone-950 disabled:opacity-40">Confirm resolution</button>
            </div>
          </div>
        )}

        {adjust && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#15151d] p-5">
              <div className="flex justify-between"><div className="font-serif text-xl">Wallet adjustment</div><button onClick={() => setAdjust(null)}><X /></button></div>
              <div className="mt-4 space-y-2">
                <select value={adjust.direction} onChange={(e) => setAdjust({ ...adjust, direction: e.target.value as 'credit' | 'debit' })} className="w-full rounded-xl border border-white/10 bg-black p-3 text-xs"><option value="credit">Credit</option><option value="debit">Debit</option></select>
                <input value={adjust.amount} onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })} placeholder="USDT amount" className="w-full rounded-xl border border-white/10 bg-black p-3 text-xs" />
                <input value={adjust.reason} onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })} placeholder="Reason (required)" className="w-full rounded-xl border border-white/10 bg-black p-3 text-xs" />
                <button disabled={!adjust.reason || Number(adjust.amount) <= 0} onClick={async () => { await run('admin_wallet_adjustment', { p_user_id: adjust.userId, p_direction: adjust.direction, p_amount_usdt: Number(adjust.amount), p_reason: adjust.reason }, 'Wallet ledger adjustment posted.'); setAdjust(null); }} className="w-full rounded-xl bg-amber-400 p-3 text-xs font-bold text-stone-950 disabled:opacity-40">Post audited adjustment</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
