import React, { useEffect, useState } from 'react';
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
  createdAt: string;
};

const explorerUrl = (chain: string | null | undefined, hash: string | null | undefined) => {
  if (!hash || !chain) return null;
  const explorers: Record<string, string> = {
    ethereum: 'https://etherscan.io/tx/',
    polygon: 'https://polygonscan.com/tx/',
    arbitrum: 'https://arbiscan.io/tx/',
  };
  return explorers[chain] ? explorers[chain] + hash : null;
};

export const TransactionHistoryModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError('');

    const [ledgerRes, depositsRes, withdrawalsRes] = await Promise.all([
      supabase.from('wallet_ledger').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('wallet_deposits').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('wallet_withdrawals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
    ]);

    const firstError = ledgerRes.error || depositsRes.error || withdrawalsRes.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const ledgerRows: Row[] = (ledgerRes.data || []).map((row: any) => {
      const credit = Number(row.credit || 0);
      const debit = Number(row.debit || 0);
      const isIn = credit > 0;
      return {
        id: `ledger-${row.id}`,
        kind: 'ledger',
        title: String(row.description || row.kind || 'Wallet activity'),
        amount: isIn ? credit : debit,
        direction: isIn ? 'in' : 'out',
        status: String(row.status || 'posted'),
        chain: row.chain || null,
        txHash: row.tx_hash || null,
        destination: row.recipient || null,
        createdAt: String(row.created_at),
      };
    });

    const depositRows: Row[] = (depositsRes.data || []).map((row: any) => ({
      id: `deposit-${row.id}`,
      kind: 'deposit',
      title: 'USDT deposit',
      amount: Number(row.amount || 0),
      direction: 'in',
      status: String(row.status || 'detected'),
      chain: row.chain || null,
      txHash: row.tx_hash || null,
      destination: row.destination_address || null,
      createdAt: String(row.created_at),
    }));

    const withdrawalRows: Row[] = (withdrawalsRes.data || []).map((row: any) => ({
      id: `withdrawal-${row.id}`,
      kind: 'withdrawal',
      title: 'USDT withdrawal',
      amount: Number(row.amount || 0),
      direction: 'out',
      status: String(row.status || 'pending'),
      chain: row.chain || null,
      txHash: row.tx_hash || null,
      destination: row.destination_address || null,
      createdAt: String(row.created_at),
    }));

    const merged = [...ledgerRows, ...depositRows, ...withdrawalRows]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setRows(merged);
    setLoading(false);
  };

  useEffect(() => {
    if (open) void load();
  }, [open, user?.id]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto no-scrollbar rounded-3xl bg-[#111118] border border-white/10 p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-serif text-stone-100">Transaction History</h3>
            <p className="text-[11px] text-stone-500 mt-1">AURA ledger, on-chain deposits, and withdrawals.</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => void load()} disabled={loading} className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400 disabled:opacity-40" title="Refresh">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400">
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
              <div key={row.id} className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${row.direction === 'in' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>
                      {row.direction === 'in' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-stone-200 truncate">{row.title}</div>
                      <div className="text-[10px] text-stone-500 font-mono mt-0.5">{new Date(row.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-mono text-sm ${row.direction === 'in' ? 'text-emerald-300' : 'text-stone-200'}`}>
                      {row.direction === 'in' ? '+' : '-'}{row.amount.toFixed(6)} USDT
                    </div>
                    <div className="text-[10px] text-stone-500 uppercase font-mono mt-0.5">{row.status.replaceAll('_', ' ')}</div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-white/5 grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-stone-600 block uppercase font-mono">Network</span>
                    <span className="text-cyan-300 uppercase font-mono">{row.chain || 'AURA'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-stone-600 block uppercase font-mono">{row.destination ? 'Destination' : 'Reference'}</span>
                    <span className="text-stone-400 font-mono break-all">{row.destination ? `${row.destination.slice(0, 8)}…${row.destination.slice(-6)}` : row.id.slice(0, 18)}</span>
                  </div>
                </div>

                {row.txHash && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] text-stone-600 font-mono truncate">{row.txHash}</span>
                    {explorer && (
                      <a href={explorer} target="_blank" rel="noreferrer" className="shrink-0 text-[10px] text-amber-300 flex items-center gap-1">
                        Explorer <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
