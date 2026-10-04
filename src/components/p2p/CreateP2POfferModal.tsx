import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PaymentMethodType } from '../../types';
import { CustomPaymentMethodInput } from './CustomPaymentMethodInput';
import { X, Plus, ShieldCheck, FileText } from 'lucide-react';

interface CreateP2POfferModalProps {
  onClose: () => void;
}

export const CreateP2POfferModal: React.FC<CreateP2POfferModalProps> = ({ onClose }) => {
  const { createP2POffer } = useApp();
  const [type, setType] = useState<'buy' | 'sell'>('sell');
  const [price, setPrice] = useState('1.00');
  const [available, setAvailable] = useState('200');
  const [minLimit, setMinLimit] = useState('10');
  const [maxLimit, setMaxLimit] = useState('200');
  const [selectedMethods, setSelectedMethods] = useState<PaymentMethodType[]>([
    'telegram_pay',
    'revolut',
  ]);
  const [instructions, setInstructions] = useState(
    'Tell the counterparty where and how to pay. AURA holds the USDT internally until the trade is completed.'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMethods.length === 0) return;

    await createP2POffer({
      type,
      pricePerUnit: parseFloat(price) || 1.0,
      fiatCurrency: 'USD',
      availableCrypto: parseFloat(available) || 100,
      minLimitFiat: parseFloat(minLimit) || 10,
      maxLimitFiat: parseFloat(maxLimit) || 200,
      paymentMethods: selectedMethods,
      paymentInstructions:
        instructions.trim() ||
        'Tell the counterparty where and how to pay. AURA holds the USDT internally until the trade is completed.',
      isBuyerProtected: true,
    });
    onClose();
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
            <label className="text-xs text-stone-400 block mb-1 font-medium">Unit Price (USD)</label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-400/60"
              required
            />
          </div>

          {/* Total Crypto Available */}
          <div>
            <label className="text-xs text-stone-400 block mb-1 font-medium">Crypto Pool Size (USDT)</label>
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
              <label className="text-xs text-stone-400 block mb-1 font-medium">Min Limit ($)</label>
              <input
                type="number"
                value={minLimit}
                onChange={(e) => setMinLimit(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-400/60"
                required
              />
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-1 font-medium">Max Limit ($)</label>
              <input
                type="number"
                value={maxLimit}
                onChange={(e) => setMaxLimit(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-400/60"
                required
              />
            </div>
          </div>

          {/* Accepted Payment Methods (Presets & Any Custom Payment Method) */}
          <CustomPaymentMethodInput
            selectedMethods={selectedMethods}
            onChange={setSelectedMethods}
            accentColor="amber"
            label="Accepted Payment Methods"
            sublabel="Select presets or write any custom payment method you want (e.g. Alex’s Bank Wire, Zelle, PayPal, Monzo)"
          />

          {/* Payment Instructions / Account details */}
          <div>
            <label className="text-xs text-stone-300 font-semibold flex items-center gap-1.5 mb-1">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Payment Instructions & Account Info (Optional)</span>
            </label>
            <textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Pay to Alex on Revolut (@alex.patron) or send via Zelle to alex@art.xyz with order ref..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-amber-400/60 resize-none font-mono"
            />
          </div>

          <div className="flex items-center gap-2 text-[11px] text-stone-400 bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Escrow lock is enforced automatically by the smart contract upon order matching.</span>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-amber-400 text-stone-950 font-bold text-xs hover:bg-amber-300 transition-colors shadow-lg shadow-amber-500/10"
          >
            Publish P2P Ad
          </button>
        </form>
      </div>
    </div>
  );
};
