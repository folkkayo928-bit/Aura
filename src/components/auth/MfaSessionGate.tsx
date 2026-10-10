import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { MfaChallengeGate } from './MfaChallengeGate';

export const MfaSessionGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [error, setError] = useState('');

  const checkRunRef = useRef(0);

  const check = useCallback(async () => {
    const checkRun = ++checkRunRef.current;
    if (authLoading) {
      setChecking(true);
      return;
    }
    if (!session) {
      setRequiresMfa(false);
      setError('');
      setChecking(false);
      return;
    }

    const targetUserId = session.user.id;
    setChecking(true);
    setError('');

    try {
      const { data, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (checkRun !== checkRunRef.current) return;
      if (aalError) {
        setError(aalError.message);
        setChecking(false);
        return;
      }

      // MFA assurance is read from the global Supabase session. Confirm that it
      // still belongs to the user for whom this check began before gating UI.
      const { data: activeData, error: activeError } = await supabase.auth.getSession();
      if (checkRun !== checkRunRef.current) return;
      if (activeError) {
        setError(activeError.message);
        setChecking(false);
        return;
      }
      if (activeData.session?.user.id !== targetUserId) {
        setRequiresMfa(false);
        setError('The active AURA account changed during the security check. Please retry.');
        setChecking(false);
        return;
      }

      setRequiresMfa(data.nextLevel === 'aal2' && data.currentLevel !== 'aal2');
      setChecking(false);
    } catch {
      if (checkRun !== checkRunRef.current) return;
      // Never leave the Mini App trapped on a dark loading screen when the
      // WebView/network rejects a security-check request unexpectedly.
      setError('AURA could not complete the security check. Check your connection and retry.');
      setChecking(false);
    }
  }, [authLoading, session?.user?.id]);

  // Hooks must be called on every render, before any conditional return.
  // Keeping this callback above the loading/error branches prevents React #310
  // when checking transitions from true to false.
  const handleMfaVerified = useCallback(() => {
    setRequiresMfa(false);
    void check();
  }, [check]);

  useEffect(() => {
    void check();
  }, [check]);

  if (authLoading || checking) {
    return (
      <div className="fixed inset-0 z-[120] bg-[#09090d] flex items-center justify-center p-6">
        <div className="text-center">
          <ShieldCheck className="w-7 h-7 text-amber-300 mx-auto animate-pulse" />
          <p className="mt-3 text-xs text-stone-400">Securing your AURA session…</p>
          <p className="mt-2 text-[10px] text-stone-600">This usually takes only a moment.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-[120] bg-[#09090d] flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-3xl bg-[#12121a] border border-rose-500/20 p-6 text-center">
          <ShieldCheck className="w-7 h-7 text-rose-300 mx-auto" />
          <h2 className="mt-3 text-lg font-serif text-stone-100">Security check needs a retry</h2>
          <p className="mt-2 text-xs text-stone-400">{error}</p>
          <button onClick={() => void check()} className="mt-4 w-full rounded-xl bg-amber-400 text-stone-950 py-3 font-bold text-xs">
            Retry security check
          </button>
        </div>
      </div>
    );
  }

  if (requiresMfa) {
    return <MfaChallengeGate key={session?.user?.id ?? 'no-session'} userId={session?.user?.id ?? ''} onVerified={handleMfaVerified} />;
  }

  return <>{children}</>;
};
