import React, { useEffect, useState } from 'react';
import { Check, Copy, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Props = {
  open: boolean;
  onClose: () => void;
  onEnabled: () => void;
};

export const MfaEnrollmentModal: React.FC<Props> = ({ open, onClose, onEnabled }) => {
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    setFactorId('');
    setQrCode('');
    setSecret('');
    setCode('');
    setError('');

    void (async () => {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'AURA Authenticator',
      });

      if (cancelled) return;
      if (enrollError || !data) {
        setError(enrollError?.message || 'Could not start two-step protection.');
        return;
      }

      setFactorId(data.id);
      setSecret(data.totp?.secret || '');
      const rawQr = data.totp?.qr_code || '';
      setQrCode(
        rawQr.startsWith('data:image/')
          ? rawQr
          : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(rawQr)}`,
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const verify = async () => {
    if (!factorId || !/^\d{6,8}$/.test(code)) {
      setError('Enter the current code from your authenticator app.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError || !challenge?.id) {
        throw new Error(challengeError?.message || 'Could not create the verification challenge.');
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;

      onEnabled();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The authenticator code was not accepted.');
    } finally {
      setBusy(false);
    }
  };

  const copySecret = () => {
    if (secret) void navigator.clipboard?.writeText(secret);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-3">
      <div className="w-full max-w-md rounded-3xl bg-[#12121a] border border-white/10 p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 text-amber-300">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Enable Two-Step Protection</span>
            </div>
            <p className="text-[11px] text-stone-400 mt-1">Use Google Authenticator, 1Password, Authy, or another TOTP app.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {qrCode ? (
            <div className="flex justify-center rounded-2xl bg-white p-4">
              <img src={qrCode} alt="AURA authenticator QR code" className="w-52 h-52" />
            </div>
          ) : (
            <div className="h-52 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" />
          )}

          <div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-stone-500 mb-1">Manual setup key</div>
            <div className="flex gap-2">
              <div className="flex-1 rounded-xl bg-white/5 border border-white/10 p-3 text-[11px] text-cyan-200 font-mono break-all">
                {secret || 'Preparing secure key…'}
              </div>
              <button onClick={copySecret} disabled={!secret} className="px-3 rounded-xl bg-white/5 border border-white/10 text-stone-300 disabled:opacity-40" title="Copy setup key">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-stone-400 block mb-1">Authenticator code</label>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="123456"
              className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-sm text-stone-100 font-mono tracking-[0.35em] text-center focus:outline-none focus:border-amber-400/60"
            />
          </div>

          {error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-300">{error}</div>}

          <button
            onClick={() => void verify()}
            disabled={busy || !factorId}
            className="w-full rounded-xl bg-amber-400 text-stone-950 py-3.5 font-bold text-xs disabled:opacity-40"
          >
            {busy ? 'Verifying…' : 'Enable Two-Step Protection'}
          </button>

          <div className="flex items-center gap-2 text-[10px] text-stone-500">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            Verification is handled by Supabase Auth; AURA never stores your TOTP secret.
          </div>
        </div>
      </div>
    </div>
  );
};
