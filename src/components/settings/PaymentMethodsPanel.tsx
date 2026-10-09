import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PRESET_PAYMENT_METHODS, formatPaymentMethodLabel } from '../p2p/CustomPaymentMethodInput';
import { CreditCard, Plus, Trash2, Pencil, Check, X, ShieldCheck } from 'lucide-react';

type PaymentMethodRow = {
  id: string;
  method_type: string;
  label: string;
  account_holder_name: string;
  account_identifier: string;
  instructions: string | null;
  is_active: boolean;
};

export const PaymentMethodsPanel: React.FC = () => {
  const [methods, setMethods] = useState<PaymentMethodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<PaymentMethodRow | null>(null);
  const [methodType, setMethodType] = useState('bank_transfer');
  const [customMethod, setCustomMethod] = useState('');
  const [name, setName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState('');
  const loadRunRef = useRef(0);

  const selectedLabel = useMemo(() => {
    const preset = PRESET_PAYMENT_METHODS.find((p) => p.id === methodType);
    return preset?.label || customMethod.trim() || formatPaymentMethodLabel(methodType);
  }, [methodType, customMethod]);

  const resetForm = () => {
    setEditing(null);
    setMethodType('bank_transfer');
    setCustomMethod('');
    setName('');
    setAccountNumber('');
    setInstructions('');
    setError('');
  };

  const load = async () => {
    const loadRun = ++loadRunRef.current;
    setLoading(true);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (loadRun !== loadRunRef.current) return;
    const userId = authData.user?.id;
    if (authError || !userId) {
      setMethods([]);
      setLoading(false);
      if (authError) setError('Could not verify your AURA session. Sign in again to manage payment methods.');
      return;
    }

    const { data, error: loadError } = await supabase
      .from('p2p_payment_methods')
      .select('id,method_type,label,account_holder_name,account_identifier,instructions,is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });
    if (loadRun !== loadRunRef.current) return;
    if (loadError) setError(loadError.message);
    setMethods((data || []) as PaymentMethodRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // Clear private payment details immediately whenever the signed-in account changes.
    // Defer the reload outside Supabase's auth callback to avoid auth-lock deadlocks.
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      // Invalidate outstanding reads before clearing the previous account's data.
      loadRunRef.current += 1;
      setMethods([]);
      setError('');
      resetForm();
      if (!session?.user) {
        setLoading(false);
        return;
      }
      window.setTimeout(() => { void load(); }, 0);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  const startEdit = (row: PaymentMethodRow) => {
    const isPreset = PRESET_PAYMENT_METHODS.some((p) => p.id === row.method_type);
    setEditing(row);
    setMethodType(isPreset ? row.method_type : '__custom__');
    setCustomMethod(isPreset ? '' : (row.label || row.method_type));
    setName(row.account_holder_name);
    setAccountNumber(row.account_identifier);
    setInstructions(row.instructions || '');
    setError('');
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const holder = name.trim();
    const account = accountNumber.trim();
    const method = methodType === '__custom__' ? customMethod.trim() : methodType;
    const label = methodType === '__custom__' ? customMethod.trim() : selectedLabel;

    if (holder.length < 2) { setError('Enter the account holder name.'); return; }
    if (account.length < 2) { setError('Enter the account number or account ID.'); return; }
    if (method.length < 2) { setError('Choose or enter a payment method.'); return; }

    setSaving(true);
    // Resolve the authenticated Supabase user explicitly: user_id is required
    // by p2p_payment_methods and must never be sent as the string "undefined".
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (authError || !userId) {
      setSaving(false);
      setError('Your AURA session is missing or expired. Sign in again, then save your payment method.');
      return;
    }

    const payload = {
      user_id: userId,
      method_type: method,
      label,
      account_holder_name: holder,
      account_identifier: account,
      instructions: instructions.trim() || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    // The add form uses an empty object as its editing sentinel. Treat it as
    // a create unless it contains a real row UUID; otherwise .eq('id', undefined)
    // becomes the database error: invalid input syntax for type uuid: "undefined".
    const result = editing?.id
      ? await supabase.from('p2p_payment_methods').update({
          method_type: payload.method_type,
          label: payload.label,
          account_holder_name: payload.account_holder_name,
          account_identifier: payload.account_identifier,
          instructions: payload.instructions,
          is_active: payload.is_active,
          updated_at: payload.updated_at,
        }).eq('id', editing.id).eq('user_id', userId)
      : await supabase.from('p2p_payment_methods').insert(payload);

    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await load();
    resetForm();
  };

  const remove = async (id: string) => {
    setError('');
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (authError || !userId) {
      setError('Your AURA session is missing or expired. Sign in again, then remove the payment method.');
      return;
    }
    const { error: removeError } = await supabase
      .from('p2p_payment_methods')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);
    if (removeError) { setError(removeError.message); return; }
    setMethods((current) => current.filter((m) => m.id !== id));
    if (editing?.id === id) resetForm();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] p-4">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div>
            <span className="block text-xs font-semibold text-stone-100">Your P2P payment methods</span>
            <p className="mt-1 text-[11px] leading-5 text-stone-400">
              Save your real payment details once. When you post a Buy or Sell ad, AURA requires one saved method and shows its name, account number, and payment rail to the trade counterparty.
            </p>
          </div>
        </div>
      </div>

      {methods.map((method) => (
        <div key={method.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                <CreditCard className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-stone-100">{method.label || formatPaymentMethodLabel(method.method_type)}</span>
                  <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-mono uppercase text-emerald-300">Active</span>
                </div>
                <div className="mt-2 space-y-1 text-[11px]">
                  <div><span className="text-stone-500">Name:</span> <span className="text-stone-200">{method.account_holder_name}</span></div>
                  <div><span className="text-stone-500">Account:</span> <span className="font-mono text-stone-200 break-all">{method.account_identifier}</span></div>
                  {method.instructions && <div><span className="text-stone-500">Note:</span> <span className="text-stone-300">{method.instructions}</span></div>}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button type="button" onClick={() => startEdit(method)} className="rounded-xl border border-white/10 bg-white/5 p-2 text-stone-400 hover:text-stone-100" title="Edit payment method"><Pencil className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => void remove(method.id)} className="rounded-xl border border-rose-500/15 bg-rose-500/5 p-2 text-rose-300 hover:bg-rose-500/10" title="Remove payment method"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </div>
      ))}

      {!loading && methods.length === 0 && !editing && (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
          <CreditCard className="mx-auto h-5 w-5 text-stone-600" />
          <p className="mt-2 text-xs text-stone-400">No payment method saved yet.</p>
          <p className="mt-1 text-[10px] text-stone-600">Add one before posting a P2P Buy or Sell ad.</p>
        </div>
      )}

      {!editing && (
        <button type="button" onClick={() => { resetForm(); setEditing({} as PaymentMethodRow); }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-3 text-xs font-bold text-stone-950">
          <Plus className="h-4 w-4" /> Add payment method
        </button>
      )}

      {editing && (
        <form onSubmit={save} className="space-y-3 rounded-2xl border border-amber-400/20 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-100">{editing.id ? 'Edit payment method' : 'Add payment method'}</span>
            <button type="button" onClick={resetForm} className="rounded-full bg-white/5 p-1.5 text-stone-500 hover:text-stone-100"><X className="h-3.5 w-3.5" /></button>
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-stone-400">Payment method</label>
            <select value={methodType} onChange={(e) => setMethodType(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-stone-100 outline-none">
              {PRESET_PAYMENT_METHODS.map((p) => <option key={p.id} value={p.id} className="bg-[#12121a]">{p.label}</option>)}
              <option value="__custom__" className="bg-[#12121a]">Custom payment method</option>
            </select>
          </div>

          {methodType === '__custom__' && (
            <input value={customMethod} onChange={(e) => setCustomMethod(e.target.value)} placeholder="e.g. Telebirr, CBE Birr, Chapa, Monzo" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-stone-100 outline-none focus:border-amber-400/60" />
          )}

          <div>
            <label className="mb-1 block text-[11px] text-stone-400">Account holder name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name on the account" required className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-stone-100 outline-none focus:border-amber-400/60" />
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-stone-400">Account number / account ID</label>
            <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Enter the account number or payment ID" required className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-mono text-stone-100 outline-none focus:border-amber-400/60" />
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-stone-400">Payment instructions (optional)</label>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} placeholder="Optional note for the counterparty" className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-stone-100 outline-none focus:border-amber-400/60" />
          </div>

          {error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">{error}</div>}

          <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-3 text-xs font-bold text-stone-950 disabled:opacity-50">
            {saving ? 'Saving…' : <><Check className="h-4 w-4" /> Save payment method</>}
          </button>
        </form>
      )}
    </div>
  );
};
