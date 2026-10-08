import React from 'react';
import { ArrowLeft, Clock, ShieldCheck, MessageCircle, ExternalLink, CheckCircle2, CreditCard } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface Props {
  onResume: () => void;
}

export function P2PTradeCenterView({ onResume }: Props) {
  const { activeP2POrder, setActiveTab } = useApp();

  if (!activeP2POrder) {
    return (
      <div className="min-h-full px-4 py-8 flex items-center justify-center">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-amber-300" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-stone-100">No active P2P trade</h2>
          <p className="mt-2 text-xs leading-5 text-stone-400">When a P2P request, payment or release is running, AURA keeps it here so you can safely return and continue.</p>
          <button onClick={() => setActiveTab('home')} className="mt-5 w-full py-3 rounded-xl bg-white/10 text-stone-200 text-xs font-bold hover:bg-white/15">Back to AURA</button>
        </div>
      </div>
    );
  }

  const pendingAcceptance = !activeP2POrder.acceptedAt;
  const paymentStage = activeP2POrder.status === 'payment_marked';
  const acceptedStage = Boolean(activeP2POrder.acceptedAt) && !paymentStage;

  return (
    <div className="min-h-full px-4 py-5 pb-28">
      <div className="max-w-md mx-auto space-y-4">
        <button onClick={() => setActiveTab('home')} className="inline-flex items-center gap-2 text-xs text-stone-400 hover:text-stone-100">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-400/10 via-white/[0.03] to-transparent p-5 shadow-[0_0_40px_rgba(251,191,36,0.08)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-amber-300 font-bold">AURA P2P • Active Trade</div>
              <h1 className="text-xl font-black text-stone-100 mt-1">Continue your trade</h1>
            </div>
            <ShieldCheck className="w-6 h-6 text-emerald-300" />
          </div>

          <div className="mt-5 rounded-2xl bg-black/20 border border-white/5 p-4">
            <div className="text-[10px] text-stone-500">Order reference</div>
            <div className="font-mono text-xs text-stone-200 mt-1">{activeP2POrder.paymentDetails.referenceCode}</div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div><div className="text-[10px] text-stone-500">Amount</div><div className="text-sm font-bold text-stone-100 mt-1">{activeP2POrder.cryptoAmount} USDT</div></div>
              <div><div className="text-[10px] text-stone-500">Fiat</div><div className="text-sm font-bold text-stone-100 mt-1">{activeP2POrder.fiatAmount.toFixed(2)} {activeP2POrder.fiatCurrency}</div></div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className={`flex items-center gap-3 rounded-xl p-3 border ${pendingAcceptance ? 'border-amber-400/30 bg-amber-400/10' : 'border-emerald-400/20 bg-emerald-400/5'}`}>
              {pendingAcceptance ? <Clock className="w-4 h-4 text-amber-300" /> : <CheckCircle2 className="w-4 h-4 text-emerald-300" />}
              <div><div className="text-xs font-semibold text-stone-100">1. Counterparty acceptance</div><div className="text-[10px] text-stone-400">{pendingAcceptance ? 'Waiting for the 5-minute acceptance window.' : 'Accepted — protected trade is active.'}</div></div>
            </div>
            <div className={`flex items-center gap-3 rounded-xl p-3 border ${acceptedStage || paymentStage ? 'border-emerald-400/20 bg-emerald-400/5' : 'border-white/5 bg-white/[0.02]'}`}>
              <CreditCard className="w-4 h-4 text-cyan-300" />
              <div><div className="text-xs font-semibold text-stone-100">2. Payment & proof</div><div className="text-[10px] text-stone-400">{paymentStage ? 'Proof received — seller review is next.' : 'Complete payment after acceptance and upload proof.'}</div></div>
            </div>
            <div className={`flex items-center gap-3 rounded-xl p-3 border ${paymentStage ? 'border-amber-400/30 bg-amber-400/10' : 'border-white/5 bg-white/[0.02]'}`}>
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <div><div className="text-xs font-semibold text-stone-100">3. Confirm & release</div><div className="text-[10px] text-stone-400">The seller verifies the proof before releasing the value or artwork.</div></div>
            </div>
          </div>

          <button onClick={onResume} className="mt-5 w-full py-4 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 text-stone-950 font-black text-xs shadow-lg shadow-emerald-500/30 hover:shadow-emerald-400/50 transition-all active:scale-[0.98]">
            <span className="inline-flex items-center justify-center gap-2"><ExternalLink className="w-4 h-4" /> Resume Secure Trade</span>
          </button>

          <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-stone-500">
            <MessageCircle className="w-3.5 h-3.5" /> Your chat and progress stay attached to this order.
          </div>
        </div>
      </div>
    </div>
  );
}
