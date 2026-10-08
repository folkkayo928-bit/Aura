import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PaymentMethodType } from '../../types';
import { X, Plus, ShieldCheck, FileText, CreditCard } from 'lucide-react';

interface CreateP2POfferModalProps {
  onClose: () => void;
}

export const CreateP2POfferModal: React.FC<CreateP2POfferModalProps> = ({ onClose }) => {
  const { createP2POffer, walletBalance } = useApp();
  const [type, setType] = useState<'buy' | 'sell'>('sell');
  const [price, setPrice] = useState('1.00');
  const [fiatCurrency, setFiatCurrency] = useState<'ETB' | 'USD' | 'EUR' | 'GBP' | 'AED'>('ETB');
  const [available, setAvailable] = useState('200');
  const [minLimit, setMinLimit] = useState('10');
  const [maxLimit, setMaxLimit] = useState('200');
  const [selectedMethods, setSelectedMethods] = useState<PaymentMethodType[]>([]);
  const [savedMethods, setSavedMethods] = useState<Array<{ id: string; method_type: string; label: string; account_holder_name: string; account_identifier: string; instructions: string | null }>>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  useEffect(() => {
    void (async () => {
      setLoadingMethods(true);
      const { supabase } = await import('../../lib/supabase');
      const { data } = await supabase.from('p2p_payment_methods')
        .select('id,method_type,label,account_holder_name,account_identifier,instructions')
        .eq('is_active', true)
        .order('updated_at', { ascending: false });
      const rows = (data || []) as any[];
      setSavedMethods(rows);
      if (rows.length > 0) setSelectedMethods([rows[0].method_type]);
      setLoadingMethods(false);
    })();
  }, []);

  const [instructions, setInstructions] = useState(
    'Tell the counterparty where and how to pay. AURA reserves the seller’s USDT in its internal ledger until the trade is completed or cancelled.'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMethods.length !== 1) { setErrorMessage('Add and select one saved payment method with your name and account number before posting.'); return; }

    setIsSubmitting(true);
    setErrorMessage('');
    const ok = await createP2POffer({
      type,
      pricePerUnit: parseFloat(price) || 1.0,
      fiatCurrency,
      availableCrypto: parseFloat(available) || 100,
      minLimitFiat: parseFloat(minLimit) || 10,
      maxLimitFiat: parseFloat(maxLimit) || 200,
      paymentMethods: selectedMethods,
      paymentInstructions:
        instructions.trim() ||
        'Tell the counterparty where and how to pay. AURA holds the USDT internally until the trade is completed.',
      isBuyerProtected: true,
    });
    setIsSubmitting(false);
    if (ok) onClose();
    else setErrorMessage('AURA could not publish this offer. Check your available USDT, price, limits, and payment details.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4">
      <div
        className="w-full max-w-md bg-[#12121a] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-6 max-h-[92vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-amber-400" />
            <span className="text-xs uppercase tracking-widest font-mono text-stone-300">
              Post P2P Trade Ad
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400 hover:text-stone-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Ad Type */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-2xl border border-white/5">
            <button
              type="button"
              onClick={() => setType('buy')}
              className={`py-2 text-xs font-semibold rounded-xl transition-all ${
                type === 'buy' ? 'bg-emerald-500 text-stone-950' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              I Want to Buy USDT
            </button>
            <button
              type="button"
              onClick={() => setType('sell')}
              className={`py-2 text-xs font-semibold rounded-xl transition-all ${
                type === 'sell' ? 'bg-rose-500 text-stone-100' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              I Want to Sell USDT
            </button>
          </div>

          {/* Unit Price */}
          <div>
            <label className="text-xs text-stone-400 block mb-1 font-medium">{type === 'buy' ? 'Your Buy Price' : 'Your Sell Price'} ({fiatCurrency} per USDT)</label>
            <input
              type="number"
              step="0.0001"
              min="0.0001"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-400/60"
              required
            />
          </div>

          <div>
            <label className="text-xs text-stone-400 block mb-1 font-medium">Fiat Currency</label>
            <select value={fiatCurrency} onChange={(e) => setFiatCurrency(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-400/60">
              <option value="ETB">🇪🇹 ETB — Ethiopian Birr</option>
              <option value="USD">🇺🇸 USD — US Dollar</option>
              <option value="EUR">🇪🇺 EUR — Euro</option>
              <option value="GBP">🇬🇧 GBP — British Pound</option>
              <option value="AED">🇦🇪 AED — UAE Dirham</option>
            </select>
          </div>

          {/* Crypto Quantity */}
          <div>
            {type === 'sell' && (
              <div className="mb-2 flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[10px]">
                <span className="text-stone-400">Available to reserve</span>
                <span className="font-mono font-bold text-emerald-300">{walletBalance.toFixed(2)} USDT</span>
              </div>
            )}
            <label className="text-xs text-stone-400 block mb-1 font-medium">{type === 'buy' ? 'USDT I Want to Buy' : 'USDT I Want to Sell'}</label>
            <input
              type="number"
              value={available}
              onChange={(e) => setAvailable(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-400/60"
              required
            />
          </div>

          {/* Limits */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-400 block mb-1 font-medium">{type === 'buy' ? 'Minimum I Will Pay' : 'Minimum I Will Receive'} ({fiatCurrency})</label>
              <input
                type="number"
                value={minLimit}
                onChange={(e) => setMinLimit(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-400/60"
                required
              />
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-1 font-medium">{type === 'buy' ? 'Maximum I Will Pay' : 'Maximum I Will Receive'} ({fiatCurrency})</label>
              <input
                type="number"
                value={maxLimit}
                onChange={(e) => setMaxLimit(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-400/60"
                required
              />
            </div>
          </div>

          {/* Saved Payment Method */}
          <div className="space-y-2">
            <div>
              <label className="text-xs text-stone-300 font-semibold flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                <span>Your Payment Method</span>
              </label>
              <p className="mt-0.5 text-[11px] text-stone-500">Buy and Sell ads require your name, account number, and payment method.</p>
            </div>
            {loadingMethods ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-4 text-center text-[11px] text-stone-500">Loading saved payment methods…</div>
            ) : savedMethods.length === 0 ? (
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-3 text-[11px] text-stone-300">
                Add a payment method first in <span className="text-amber-300 font-semibold">Settings → Payment Methods</span>.
              </div>
            ) : (
              <div className="space-y-2">
                {savedMethods.map((method) => {
                  const selected = selectedMethods[0] === method.method_type;
                  return (
                    <button type="button" key={method.id} onClick={() => setSelectedMethods([method.method_type])}
                      className={"w-full rounded-xl border p-3 text-left transition " + (selected ? 'border-amber-400/60 bg-amber-400/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/5')}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-stone-100">{method.label || method.method_type}</span>
                        {selected && <span className="text-[9px] uppercase tracking-wider text-amber-300">Selected</span>}
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

          {/* Payment Instructions */}
          <div>
            <label className="text-xs text-stone-300 font-semibold flex items-center gap-1.5 mb-1">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Extra Payment Instructions (Optional)</span>
            </label>
            <textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Optional instructions for the counterparty"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-amber-400/60 resize-none"
            />
          </div>

          <div className="flex items-center gap-2 text-[11px] text-stone-400 bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{type === 'sell' ? 'AURA reserves this entire Sell pool immediately. You cannot advertise more USDT than your available wallet balance.' : 'Buy ads do not reserve or check your USDT wallet. This quantity is simply how much USDT you want to buy; the matched seller supplies the USDT.'}</span>
          </div>

          {errorMessage && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">{errorMessage}</div>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-xl bg-amber-400 text-stone-950 font-bold text-xs hover:bg-amber-300 transition-colors shadow-lg shadow-amber-500/10"
          >
            {isSubmitting ? 'Publishing…' : 'Publish P2P Ad'}
          </button>
        </form>
      </div>
    </div>
  );
};
