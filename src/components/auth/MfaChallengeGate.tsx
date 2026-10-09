import React, { useEffect, useState } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Props = {
  userId: string;
  onVerified: () => void;
};

export const MfaChallengeGate: React.FC<Props> = ({ userId, onVerified }) => {
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFactorId('');
    setCode('');
    setChallengeId('');
    setError('');

    void (async () => {
      // MFA factor enumeration must belong to the exact account the parent
      // gate has authorized. Supabase's browser client is shared across the
      // Mini App, so a Telegram account switch can replace its session.
      const { data: initial, error: initialError } = await supabase.auth.getSession();
      if (cancelled) return;
      if (initialError || initial.session?.user.id !== userId) {
        setError('The active AURA account changed. Reload and verify the current account.');
        setLoading(false);
        return;
      }

      const { data, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (factorsError) {
        setError(factorsError.message);
        setLoading(false);
        return;
      }

      const { data: active, error: activeError } = await supabase.auth.getSession();
      if (cancelled) return;
      if (activeError || active.session?.user.id !== userId) {
        setError('The active AURA account changed during MFA lookup. Reload and retry.');
        setLoading(false);
        return;
      }

      const verifiedTotp = data.totp.find((factor) => factor.status === 'verified');
      if (!verifiedTotp) {
        onVerified();
        return;
      }

      setFactorId(verifiedTotp.id);
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: verifiedTotp.id,
      });

      if (cancelled) return;
      const { data: afterChallenge, error: afterChallengeError } = await supabase.auth.getSession();
      if (cancelled) return;
      if (afterChallengeError || afterChallenge.session?.user.id !== userId) {
        setError('The active AURA account changed during MFA challenge creation. Reload and retry.');
      } else if (challengeError || !challenge?.id) {
        setError(challengeError?.message || 'Could not create the security challenge.');
      } else {
        setChallengeId(challenge.id);
      }
      setLoading(false);
    })().catch((cause) => {
      if (cancelled) return;
      setError(cause instanceof Error ? cause.message : 'Could not check account security.');
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [onVerified, userId]);

  const verify = async () => {
    if (!factorId || !challengeId || !/^\d{6,8}$/.test(code)) {
      setError('Enter the current code from your authenticator app.');
      return;
    }

    setBusy(true);
    setError('');
    const { data: before, error: beforeError } = await supabase.auth.getSession();
    if (beforeError || before.session?.user.id !== userId) {
      setError('The active AURA account changed. Your code was not applied; reload and retry.');
      setBusy(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code,
    });

    if (verifyError) {
      setError(verifyError.message);
      setBusy(false);
      return;
    }

    const { data: after, error: afterError } = await supabase.auth.getSession();
    if (afterError || after.session?.user.id !== userId) {
      setError('The active AURA account changed during verification. Reload and verify the current account.');
      setBusy(false);
      return;
    }

    setBusy(false);
    onVerified();
  };

  const retry = async () => {
    setError('');
    setCode('');
    if (!factorId) return;
    const { data: before, error: beforeError } = await supabase.auth.getSession();
    if (beforeError || before.session?.user.id !== userId) {
      setError('The active AURA account changed. Reload and retry.');
      return;
    }

    const { data, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !data?.id) {
      setError(challengeError?.message || 'Could not start a new security challenge.');
      return;
    }

    const { data: after, error: afterError } = await supabase.auth.getSession();
    if (afterError || after.session?.user.id !== userId) {
      setError('The active AURA account changed during challenge creation. Reload and retry.');
      return;
    }
    setChallengeId(data.id);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[95] bg-[#09090d] flex items-center justify-center p-6">
        <div className="text-center">
          <ShieldCheck className="w-7 h-7 text-amber-300 mx-auto animate-pulse" />
          <p className="mt-3 text-xs text-stone-400">Checking your account security…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[95] bg-[#09090d] flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl bg-[#12121a] border border-white/10 p-6 shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-300 flex items-center justify-center mx-auto">
          <LockKeyhole className="w-6 h-6" />
        </div>
        <h2 className="mt-4 text-center text-xl font-serif text-stone-100">Verify it’s you</h2>
        <p className="mt-2 text-center text-xs text-stone-400 leading-relaxed">
          Two-step protection is enabled. Enter the current code from your authenticator app to open your AURA account.
        </p>

        <input
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
          placeholder="123456"
          className="mt-5 w-full rounded-xl bg-white/5 border border-white/10 p-3.5 text-center text-lg font-mono tracking-[0.35em] text-stone-100 focus:outline-none focus:border-amber-400/60"
        />

        {error && <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-300">{error}</div>}

        <button onClick={() => void verify()} disabled={busy || loading || !challengeId} className="mt-4 w-full rounded-xl bg-amber-400 text-stone-950 py-3.5 font-bold text-xs disabled:opacity-40">
          {busy ? 'Verifying…' : 'Unlock AURA'}
        </button>
        <button onClick={() => void retry()} disabled={busy || loading || !factorId} className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 text-stone-300 py-3 text-xs disabled:opacity-40">
          Send a new challenge
        </button>
      </div>
    </div>
  );
};
