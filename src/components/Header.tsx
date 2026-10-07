import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import React from 'react';
import { Wallet, Settings, ArrowLeftRight, Send, ShieldCheck, KeyRound, X } from 'lucide-react';

export const Header: React.FC = () => {
  const { walletBalance, setActiveTab, activeTab, setSettingsModalOpen, setP2pModalOpen, activeP2POrder } = useApp();
  const { user, openAuth } = useAuth();
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [bootstrapAvailable, setBootstrapAvailable] = React.useState(false);
  const [bootstrapOpen, setBootstrapOpen] = React.useState(false);
  const [bootstrapToken, setBootstrapToken] = React.useState('');
  const [bootstrapBusy, setBootstrapBusy] = React.useState(false);
  const [bootstrapError, setBootstrapError] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    if (!user) { setIsAdmin(false); return; }
    void Promise.all([
      supabase.rpc('aura_can', { p_min_role: 'operator' }),
      supabase.rpc('aura_owner_bootstrap_available'),
    ]).then(([adminRes, bootstrapRes]) => {
      if (cancelled) return;
      setIsAdmin(adminRes.data === true);
      setBootstrapAvailable(!adminRes.error && adminRes.data !== true && bootstrapRes.data === true && !bootstrapRes.error);
    });
    return () => { cancelled = true; };
  }, [user]);

  return (
    <header className="sticky top-0 z-30 bg-[#09090d]/88 backdrop-blur-xl border-b border-white/5 px-4 h-14 flex items-center justify-between">
      <button onClick={() => setActiveTab('home')} className="flex items-center gap-2 group text-left">
        <span className="font-serif text-2xl tracking-[0.2em] font-light text-stone-100 group-hover:text-amber-200 transition-colors uppercase">Aura</span>
        <span className="hidden sm:inline text-[10px] uppercase tracking-widest text-stone-500 font-mono">· Vault</span>
      </button>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setP2pModalOpen(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-full border transition-all ${
            activeP2POrder
              ? 'border-amber-400/60 bg-amber-400/20 text-amber-300 font-bold'
              : 'border-white/10 bg-white/5 text-stone-300 hover:bg-white/10'
          }`}
          title="P2P Desk"
        >
          <ArrowLeftRight className="w-3 h-3 text-emerald-400" />
          <span>{activeP2POrder ? 'P2P Hold' : 'P2P'}</span>
        </button>

        <button
          onClick={() => setActiveTab('wallet')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-all ${
            activeTab === 'wallet'
              ? 'bg-amber-400/10 border-amber-400/40 text-amber-300'
              : 'bg-white/5 border-white/10 text-stone-300 hover:bg-white/10'
          }`}
        >
          <Wallet className="w-3.5 h-3.5 text-stone-400" />
          <span className="text-[11px] font-mono tabular-nums">
            {user ? `$${walletBalance.toFixed(2)}` : 'Sign in'} <span className="text-[9px] text-stone-500">{user ? 'USDT' : ''}</span>
          </span>
        </button>

        {user ? (<React.Fragment>
          {bootstrapAvailable && !isAdmin && <button onClick={() => { setBootstrapError(''); setBootstrapToken(''); setBootstrapOpen(true); }} className="p-2 rounded-full bg-cyan-400/10 hover:bg-cyan-400/20 border border-cyan-400/20 text-cyan-300" title="Activate AURA Operations"><KeyRound className="w-4 h-4" /></button>}
          {isAdmin && <button onClick={() => window.dispatchEvent(new Event('aura-admin-open'))} className="p-2 rounded-full bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/20 text-amber-300" title="AURA Operations"><ShieldCheck className="w-4 h-4" /></button>}
          <button onClick={() => setSettingsModalOpen(true)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-stone-400 hover:text-stone-100" title="Account settings">
            <Settings className="w-4 h-4" />
          </button>
          </React.Fragment>
        ) : (
          <button
            onClick={() => openAuth('signin')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-sky-400 text-slate-950 hover:bg-sky-300 transition-colors"
            title="Connect with Telegram"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="text-[10px] sm:text-[11px] font-bold">Connect with Telegram</span>
          </button>
        )}
      </div>
      {bootstrapOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl border border-cyan-400/20 bg-[#14141c] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3"><div><div className="font-serif text-xl text-stone-100">Activate AURA Operations</div><div className="mt-1 text-[10px] text-stone-500">One-time owner bootstrap. Use the private token provided for your account.</div></div><button onClick={() => setBootstrapOpen(false)}><X className="text-stone-400" /></button></div>
            <input value={bootstrapToken} onChange={e => setBootstrapToken(e.target.value)} placeholder="AURA bootstrap token" className="mt-5 w-full rounded-2xl border border-white/10 bg-black p-3 text-xs text-stone-100 outline-none" autoComplete="off" />
            {bootstrapError && <div className="mt-3 rounded-xl bg-rose-500/10 p-3 text-[10px] text-rose-300">{bootstrapError}</div>}
            <button disabled={!bootstrapToken.trim() || bootstrapBusy} onClick={async () => { setBootstrapBusy(true); setBootstrapError(''); const { data, error } = await supabase.rpc('claim_aura_owner', { p_token: bootstrapToken.trim() }); setBootstrapBusy(false); if (error || data !== true) { setBootstrapError(error?.message || 'Owner activation failed.'); return; } setIsAdmin(true); setBootstrapAvailable(false); setBootstrapOpen(false); window.dispatchEvent(new Event('aura-admin-open')); }} className="mt-3 w-full rounded-2xl bg-cyan-300 p-3 text-xs font-bold text-slate-950 disabled:opacity-40">{bootstrapBusy ? 'Activating…' : 'Activate owner access'}</button>
          </div>
        </div>
      )}
    </header>
  );
};