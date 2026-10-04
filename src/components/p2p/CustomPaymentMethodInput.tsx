import React, { useState } from 'react';
import { PaymentMethodType } from '../../types';
import {
  Plus,
  X,
  CreditCard,
  Building2,
  Smartphone,
  Globe,
  Zap,
  DollarSign,
  Wallet,
  Check,
  Sparkles,
} from 'lucide-react';

interface CustomPaymentMethodInputProps {
  selectedMethods: PaymentMethodType[];
  onChange: (methods: PaymentMethodType[]) => void;
  accentColor?: 'amber' | 'emerald' | 'blue';
  label?: string;
  sublabel?: string;
}

export const PRESET_PAYMENT_METHODS: { id: PaymentMethodType; label: string; icon: any }[] = [
  { id: 'telegram_pay', label: 'Telegram Wallet', icon: Smartphone },
  { id: 'revolut', label: 'Revolut', icon: CreditCard },
  { id: 'bank_transfer', label: 'Bank Wire / SEPA', icon: Building2 },
  { id: 'wise', label: 'Wise', icon: Globe },
  { id: 'zelle', label: 'Zelle', icon: DollarSign },
  { id: 'paypal', label: 'PayPal', icon: Wallet },
  { id: 'apple_pay', label: 'Apple Pay', icon: Smartphone },
  { id: 'cashapp', label: 'Cash App', icon: DollarSign },
  { id: 'venmo', label: 'Venmo', icon: Wallet },
  { id: 'crypto_ton', label: 'TON USDT', icon: Zap },
];

export const formatPaymentMethodLabel = (method: string): string => {
  const match = PRESET_PAYMENT_METHODS.find((p) => p.id === method);
  if (match) return match.label;

  // Clean custom method
  if (method.includes('_')) {
    return method
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  return method;
};

export const CustomPaymentMethodInput: React.FC<CustomPaymentMethodInputProps> = ({
  selectedMethods,
  onChange,
  accentColor = 'amber',
  label = 'Accepted Payment Methods',
  sublabel = 'Select popular methods or type any custom payment method (e.g. Alex’s Bank, Monzo, Zelle, Swish)',
}) => {
  const [customInput, setCustomInput] = useState('');
  const [showPresets, setShowPresets] = useState(true);

  const togglePreset = (id: PaymentMethodType) => {
    if (selectedMethods.includes(id)) {
      if (selectedMethods.length > 1) {
        onChange(selectedMethods.filter((m) => m !== id));
      }
    } else {
      onChange([...selectedMethods, id]);
    }
  };

  const handleAddCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed) return;

    // Check if already in list (case insensitive)
    const exists = selectedMethods.some(
      (m) => m.toLowerCase() === trimmed.toLowerCase()
    );
    if (!exists) {
      onChange([...selectedMethods, trimmed]);
    }
    setCustomInput('');
  };

  const handleRemoveMethod = (methodToRemove: PaymentMethodType) => {
    if (selectedMethods.length <= 1) return; // keep at least 1
    onChange(selectedMethods.filter((m) => m !== methodToRemove));
  };

  // Color theme helpers
  const activeBorder =
    accentColor === 'emerald'
      ? 'border-emerald-500/80 bg-emerald-500/10 text-emerald-300'
      : accentColor === 'blue'
      ? 'border-blue-500/80 bg-blue-500/10 text-blue-300'
      : 'border-amber-400/80 bg-amber-400/10 text-amber-200';

  const buttonBg =
    accentColor === 'emerald'
      ? 'bg-emerald-500 hover:bg-emerald-400 text-stone-950'
      : accentColor === 'blue'
      ? 'bg-blue-500 hover:bg-blue-400 text-white'
      : 'bg-amber-400 hover:bg-amber-300 text-stone-950';

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs text-stone-300 font-semibold block">
            {label}
          </label>
          <span className="text-[11px] font-mono text-stone-400">
            {selectedMethods.length} selected
          </span>
        </div>
        {sublabel && (
          <p className="text-[11px] text-stone-400 mt-0.5 leading-snug">
            {sublabel}
          </p>
        )}
      </div>

      {/* Selected Methods Chips (Both Presets & User Custom) */}
      <div className="flex flex-wrap gap-1.5 p-2 rounded-2xl bg-black/40 border border-white/5 min-h-[44px] items-center">
        {selectedMethods.map((m) => {
          const isPreset = PRESET_PAYMENT_METHODS.some((p) => p.id === m);
          return (
            <span
              key={m}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border transition-all ${
                isPreset
                  ? activeBorder
                  : 'border-cyan-500/50 bg-cyan-950/40 text-cyan-200'
              }`}
            >
              <span>{formatPaymentMethodLabel(m)}</span>
              {!isPreset && (
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 uppercase">
                  Custom
                </span>
              )}
              {selectedMethods.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveMethod(m)}
                  className="hover:text-rose-400 p-0.5 transition-colors"
                  title={`Remove ${m}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          );
        })}
      </div>

      {/* Custom Payment Method Input Field */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-mono text-stone-400 uppercase tracking-wider block">
          Write Any Payment Method You Want
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustom();
                }
              }}
              placeholder="e.g. Alex's Bank Wire, Monzo, Zelle, Cash in Person, Swish, UPI, Pix..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-400/60"
            />
          </div>
          <button
            type="button"
            onClick={() => handleAddCustom()}
            disabled={!customInput.trim()}
            className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${buttonBg}`}
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add</span>
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 text-[10px] text-stone-400">
          <span className="text-stone-500 shrink-0 font-mono">Suggestions:</span>
          {["Alex's Bank Wire", 'Zelle', 'PayPal', 'Monzo', 'Apple Pay', 'Venmo', 'Swish', 'Cash App'].map(
            (suggestion) => (
              <button
                type="button"
                key={suggestion}
                onClick={() => {
                  if (
                    !selectedMethods.some(
                      (m) => m.toLowerCase() === suggestion.toLowerCase()
                    )
                  ) {
                    onChange([...selectedMethods, suggestion]);
                  }
                }}
                className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 border border-white/5 shrink-0 transition-colors"
              >
                + {suggestion}
              </button>
            )
          )}
        </div>
      </div>

      {/* Preset Payment Methods Toggle & Grid */}
      <div className="space-y-2 pt-1 border-t border-white/5">
        <button
          type="button"
          onClick={() => setShowPresets(!showPresets)}
          className="text-xs text-stone-400 hover:text-stone-200 flex items-center justify-between w-full font-medium"
        >
          <span>Popular Fast Payment Rails</span>
          <span className="text-[11px] text-stone-500 font-mono">
            {showPresets ? 'Hide presets' : 'Show presets'}
          </span>
        </button>

        {showPresets && (
          <div className="grid grid-cols-2 gap-2">
            {PRESET_PAYMENT_METHODS.map((method) => {
              const isSelected = selectedMethods.includes(method.id);
              const Icon = method.icon;
              return (
                <button
                  type="button"
                  key={method.id}
                  onClick={() => togglePreset(method.id)}
                  className={`p-2.5 rounded-xl text-xs border text-left flex items-center justify-between transition-all ${
                    isSelected
                      ? activeBorder
                      : 'border-white/5 bg-white/[0.02] text-stone-400 hover:bg-white/5 hover:text-stone-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{method.label}</span>
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
