import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Clock3, ExternalLink, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

type Row = {
  id: string;
  kind: 'ledger' | 'deposit' | 'withdrawal';
  title: string;
  amount: number;
  direction: 'in' | 'out';
  status: string;
  chain?: string | null;
  txHash?: string | null;
  destination?: string | null;
  reference?: string | null;
  detail?: string | null;
  createdAt: string;
};

const explorerUrl = (chain: string | null | undefined, hash: string | null | undefined) => {
  if (!hash || !chain) return null;
  const explorers: Record<string, string> = {
    ethereum: 'https://etherscan.io/tx/',
    polygon: 'https://polygonscan.com/tx/',
    arbitrum: 'https://arbiscan.io/tx/',
  };
  return explorers[String(chain).toLowerCase()] ? explorers[String(chain).toLowerCase()] + hash : null;
};

export const TransactionHistoryModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) {
      setRows([]);
      setError('Sign in to view your wallet history.');
      return;
    }
    setLoading(true);
    setError('');
    const [ledgerRes, depositsRes, withdrawalsRes] = await Promise.all([
      supabase.from('wallet_ledger')
        .select('id,user_id,direction,amount_usdt,kind,reference_id,memo,created_at')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('wallet_deposits')
        .select('id,user_id,chain,token_symbol,destination_address,tx_hash,amount,confirmations,required_confirmations,status,created_at')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('wallet_withdrawals')
        .select('id,user_id,chain,token_symbol,destination_address,amount,network_fee,status,tx_hash,created_at,updated_at,broadcast_at,confirmed_onchain_at,reserved_ledger_id,rejection_reason,email_confirmed_at')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
    ]);

    const firstError = ledgerRes.error || depositsRes.error || withdrawalsRes.error;
    if (firstError) {
      setError('Could not load all wallet records. Please refresh and try again.');
      setLoading(false);
      return;
    }

    const deposits = depositsRes.data || [];
    const withdrawals = withdrawalsRes.data || [];
    const reservedLedgerIds = new Set(withdrawals.map((row: any) => row.reserved_ledger_id).filter(Boolean));
    const depositIds = new Set(deposits.map((row: any) => String(row.id)));

    const ledgerRows: Row[] = (ledgerRes.data || [])
      .filter((row: any) => {
        // The withdrawal request row is the canonical status/history item;
        // hide its linked reservation debit to avoid displaying the same event twice.
        if (row.kind === 'withdrawal_reserve' && reservedLedgerIds.has(row.id)) return false;
        // A confirmed deposit row contains the chain hash and confirmation count;
        // use it instead of its corresponding credit-ledger mirror.
        if (row.kind === 'onchain_deposit' && depositIds.has(String(row.reference_id))) return false;
        return true;
      })
      .map((row: any) => ({
        id: 'ledger-' + row.id,
        kind: 'ledger',
        title: String(row.memo || String(row.kind || 'Wallet activity').replaceAll('_', ' ')),
        amount: Number(row.amount_usdt || 0),
        direction: row.direction === 'credit' ? 'in' : 'out',
        status: 'posted',
        chain: 'AURA internal',
        txHash: null,
        destination: null,
        reference: row.reference_id ? String(row.reference_id) : String(row.id),
        detail: String(row.kind || '').replaceAll('_', ' '),
        createdAt: String(row.created_at),
      }));

    const depositRows: Row[] = deposits.map((row: any) => ({
      id: 'deposit-' + row.id,
      kind: 'deposit',
      title: (row.token_symbol || 'USDT') + ' deposit',
      amount: Number(row.amount || 0),
      direction: 'in',
      status: String(row.status || 'detected'),
      chain: row.chain || null,
      txHash: row.tx_hash || null,
      destination: row.destination_address || null,
      reference: row.id,
      detail: 'Confirmations: ' + Number(row.confirmations || 0) + ' / ' + Number(row.required_confirmations || 0),
      createdAt: String(row.created_at),
    }));

    const withdrawalRows: Row[] = withdrawals.map((row: any) => ({
      id: 'withdrawal-' + row.id,
      kind: 'withdrawal',
      title: (row.token_symbol || 'USDT') + ' withdrawal request',
      amount: Number(row.amount || 0) + Number(row.network_fee || 0),
      direction: 'out',
      status: String(row.status || 'pending'),
      chain: row.chain || null,
      txHash: row.tx_hash || null,
      destination: row.destination_address || null,
      reference: row.id,
      detail: 'Requested: ' + Number(row.amount || 0).toFixed(6) + ' USDT · Network fee: ' + Number(row.network_fee || 0).toFixed(6) + ' USDT · ' + (
        row.confirmed_onchain_at
          ? 'On-chain confirmed'
          : row.broadcast_at
            ? 'Broadcast; awaiting chain confirmation'
            : row.email_confirmed_at
              ? 'Email confirmed; waiting for broadcast'
              : row.rejection_reason
                ? 'Rejected: ' + String(row.rejection_reason)
                : 'Awaiting email confirmation'
      ),
      createdAt: String(row.created_at),
    }));

    setRows([...ledgerRows, ...depositRows, ...withdrawalRows]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl bg-[#111118] border border-white/10 p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div>
            <h3 className="text-lg font-serif text-stone-100">Full Transaction History</h3>
            <p className="text-[11px] text-stone-500 mt-1">AURA ledger, internal transfers, deposits, withdrawals, and on-chain hashes.</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => void load()} disabled={loading} className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400 disabled:opacity-40" title="Refresh history" aria-label="Refresh history">
              <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />
            </button>
            <button type="button" onClick={onClose} className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400" aria-label="Close history">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading && rows.length === 0 && <div className="py-12 text-center text-xs text-stone-500">Loading your activity…</div>}
        {error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-300">{error}</div>}
        {!loading && !error && rows.length === 0 && (
          <div className="py-12 text-center">
            <Clock3 className="w-6 h-6 text-stone-600 mx-auto" />
            <p className="mt-2 text-xs text-stone-500">No wallet transactions yet.</p>
          </div>
        )}

        <div className="space-y-2">
          {rows.map((row) => {
            const explorer = explorerUrl(row.chain, row.txHash);
            return (
              <article key={row.id} className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={'w-9 h-9 rounded-full flex items-center justify-center shrink-0 ' + (row.direction === 'in' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300')}>
                      {row.direction === 'in' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-stone-200 break-words">{row.title}</div>
                      <div className="text-[10px] text-stone-500 font-mono mt-1">{new Date(row.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={'font-mono text-sm ' + (row.direction === 'in' ? 'text-emerald-300' : 'text-stone-200')}>
                      {row.direction === 'in' ? '+' : '-'}{row.amount.toFixed(6)} USDT
                    </div>
                    <div className="text-[10px] text-stone-500 uppercase font-mono mt-1">{row.status.replaceAll('_', ' ')}</div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-white/5 grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-stone-600 block uppercase font-mono">Network / Ledger</span>
                    <span className="text-cyan-300 font-mono">{row.chain || 'AURA'}</span>
                  </div>
                  <div className="text-right min-w-0">
                    <span className="text-stone-600 block uppercase font-mono">{row.destination ? 'Destination' : 'Reference ID'}</span>
                    <span className="text-stone-400 font-mono break-all">{row.destination ? row.destination : row.reference || row.id}</span>
                  </div>
                </div>
                {row.detail && <p className="mt-2 text-[10px] leading-4 text-stone-500">{row.detail}</p>}
                {row.txHash && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] text-stone-400 font-mono break-all">{row.txHash}</span>
                    {explorer && <a href={explorer} target="_blank" rel="noreferrer" className="shrink-0 text-[10px] text-amber-300 flex items-center gap-1">Open explorer <ExternalLink className="w-3 h-3" /></a>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
};
