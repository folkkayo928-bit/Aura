import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { MfaChallengeGate } from './MfaChallengeGate';

export const MfaSessionGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [error, setError] = useState('');

  const check = useCallback(async () => {
    if (authLoading) return;
    if (!session) {
      setRequiresMfa(false);
      setChecking(false);
      return;
    }

    setChecking(true);
    setError('');

    const { data, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) {
      setError(aalError.message);
      setChecking(false);
      return;
    }

    setRequiresMfa(data.nextLevel === 'aal2' && data.currentLevel !== 'aal2');
    setChecking(false);
  }, [authLoading, session]);

  useEffect(() => {
    void check();
  }, [check]);

  if (authLoading || checking) {
    return (
      <div className="fixed inset-0 bg-[#09090d] flex items-center justify-center">
        <div className="text-center">
          <ShieldCheck className="w-7 h-7 text-amber-300 mx-auto animate-pulse" />
          <p className="mt-3 text-xs text-stone-500">Securing your AURA session…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-[#09090d] flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-3xl bg-[#12121a] border border-rose-500/20 p-6 text-center">
          <ShieldCheck className="w-7 h-7 text-rose-300 mx-auto" />
          <h2 className="mt-3 text-lg font-serif text-stone-100">Security check failed</h2>
          <p className="mt-2 text-xs text-stone-400">{error}</p>
          <button onClick={() => void check()} className="mt-4 w-full rounded-xl bg-amber-400 text-stone-950 py-3 font-bold text-xs">
            Retry security check
          </button>
        </div>
      </div>
    );
  }

  if (requiresMfa) {
    return <MfaChallengeGate onVerified={() => { setRequiresMfa(false); void check(); }} />;
  }

  return <>{children}</>;
};
