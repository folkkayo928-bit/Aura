import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Artwork, PaymentMethodType } from '../../types';
import { ArtworkCanvas } from '../ArtworkCanvas';
import { X, ArrowUpDown, ShieldCheck, Check, CreditCard } from 'lucide-react';

interface SellArtP2PModalProps {
  artwork: Artwork;
  onClose: () => void;
}

export const SellArtP2PModal: React.FC<SellArtP2PModalProps> = ({ artwork, onClose }) => {
  const { listArtworkOnP2P } = useApp();
  const [fiatPrice, setFiatPrice] = useState(artwork.currentValue.toString());
  const [currency, setCurrency] = useState<'ETB' | 'USD' | 'EUR' | 'GBP' | 'AED'>('ETB');
  const [selectedMethods, setSelectedMethods] = useState<PaymentMethodType[]>([]);
  const [savedMethods, setSavedMethods] = useState<Array<{ id: string; method_type: string; label: string; account_holder_name: string; account_identifier: string }>>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  useEffect(() => {
    void (async () => {
      const { supabase } = await import('../../lib/supabase');
      const { data } = await supabase.from('p2p_payment_methods')
        .select('id,method_type,label,account_holder_name,account_identifier')
        .eq('is_active', true)
        .order('updated_at', { ascending: false });
      const rows = (data || []) as any[];
      setSavedMethods(rows);
      if (rows.length > 0) setSelectedMethods([rows[0].method_type]);
      setLoadingMethods(false);
    })();
  }, []);

  const handleList = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const num = parseFloat(fiatPrice);
    if (isNaN(num) || num <= 0) {
      setErrorMessage('Enter a valid selling price.');
      return;
    }
    if (selectedMethods.length !== 1) {
      setErrorMessage('Add and select one saved payment method with your name and account number.');
      return;
    }
    if (!paymentInstructions.trim()) {
      setErrorMessage('Add the payment account or instructions buyers should use.');
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await listArtworkOnP2P({
        artworkId: artwork.id,
        fiatPrice: num,
        currency,
        paymentMethods: selectedMethods,
        paymentInstructions: paymentInstructions.trim(),
      });
      if (!ok) {
        setErrorMessage('AURA could not publish this artwork to P2P. The artwork was not marked as sold.');
        return;
      }
      setIsSuccess(true);
      window.setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1500);
    } catch (error: any) {
      setErrorMessage(error?.message || 'AURA could not publish this artwork to P2P.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4">
      <div
        className="w-full max-w-md bg-[#12121a] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-6 max-h-[92vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-emerald-400" />
            <span className="text-xs uppercase tracking-widest font-mono text-stone-300">
              Sell Artwork on AURA P2P Desk for Cash
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400 hover:text-stone-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30">
              <Check className="w-7 h-7" />
            </div>
            <h4 className="font-serif text-xl text-stone-100">Live on AURA P2P</h4>
            <p className="text-xs text-stone-400">
              "{artwork.title}" is now listed for direct cash purchase on the P2P Desk!
            </p>
          </div>
        ) : (
          <form onSubmit={handleList} className="space-y-4">
            {/* Artwork thumbnail */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/10">
              <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
                <ArtworkCanvas artwork={artwork} showOverlayGrain={false} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] text-amber-400 font-mono block">
                  Vault Piece · Provenance Verified
                </span>
                <h4 className="font-bold text-xs text-stone-100 truncate">{artwork.title}</h4>
                <div className="flex items-baseline gap-2 text-xs mt-0.5">
                  <span className="text-stone-500">Valuation:</span>
                  <span className="font-serif font-bold text-emerald-400">${artwork.currentValue} USDT</span>
                </div>
              </div>
            </div>

            {/* Price Input */}
            <div>
              <label className="text-xs text-stone-400 block mb-1.5 font-medium">
                Your Asking Price for Direct P2P Sale
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    step="any"
                    value={fiatPrice}
                    onChange={(e) => setFiatPrice(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-stone-100 font-mono focus:outline-none focus:border-emerald-400/60"
                    required
                  />
                </div>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as any)}
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-xs text-stone-100 focus:outline-none"
                >
                  <option value="ETB" className="bg-[#12121a]">ETB (Birr)</option>
                  <option value="USD" className="bg-[#12121a]">USD ($)</option>
                  <option value="AED" className="bg-[#12121a]">AED (Dirham)</option>
                  <option value="EUR" className="bg-[#12121a]">EUR (€)</option>
                  <option value="GBP" className="bg-[#12121a]">GBP (£)</option>
                </select>
              </div>
            </div>

            {/* Saved Seller Payment Method */}
            <div className="space-y-2">
              <label className="text-xs text-stone-300 font-semibold flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                Your Payment Method
              </label>
              <p className="text-[11px] text-stone-500">Artwork P2P sales also require your name, account number, and payment method.</p>
              {loadingMethods ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-4 text-center text-[11px] text-stone-500">Loading saved payment methods…</div>
              ) : savedMethods.length === 0 ? (
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-3 text-[11px] text-stone-300">
                  Add a payment method first in Settings → Payment Methods.
                </div>
              ) : (
                <div className="space-y-2">
                  {savedMethods.map((method) => {
                    const selected = selectedMethods[0] === method.method_type;
                    return (
                      <button type="button" key={method.id} onClick={() => setSelectedMethods([method.method_type])}
                        className={"w-full rounded-xl border p-3 text-left " + (selected ? 'border-emerald-400/60 bg-emerald-400/10' : 'border-white/10 bg-white/[0.03]')}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-stone-100">{method.label || method.method_type}</span>
                          {selected && <span className="text-[9px] uppercase tracking-wider text-emerald-300">Selected</span>}
                        </div>
                        <div className="mt-1.5 grid grid-cols-2 gap-2 text-[10px]">
                          <span><span className="text-stone-500">Name:</span> <span className="text-stone-300">{method.account_holder_name}</span></span>
                          <span><span className="text-stone-500">Account:</span> <span className="font-mono text-stone-300">{method.account_identifier}</span></span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Extra sale instructions */}
            <div>
              <label className="text-xs text-stone-300 block mb-1.5 font-medium">Extra Payment Instructions (Optional)</label>
              <textarea
                rows={2}
                value={paymentInstructions}
                onChange={(e) => setPaymentInstructions(e.target.value)}
                placeholder="Optional note for buyers"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-emerald-400/60 resize-none"
              />
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 text-[11px] text-stone-300 leading-relaxed space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>AURA P2P Ownership Protection</span>
              </div>
              <p className="text-stone-400">
                AURA records the order and holds the artwork listing while payment is pending. You confirm the fiat payment, then AURA transfers the artwork ownership to the buyer. Fiat is settled directly between the two parties.
              </p>
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2.5 text-[11px] text-rose-200">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-stone-950 font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
            >
              {isSubmitting ? 'Publishing securely…' : `Post on P2P for ${fiatPrice} ${currency}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
