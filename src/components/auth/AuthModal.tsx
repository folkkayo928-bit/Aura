import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, KeyRound, Loader2, Mail, ShieldCheck, UserRound, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AuthModal: React.FC = () => {
  const { authModalOpen, authMode, closeAuth, openAuth, signIn, signUp, resetPassword, updatePassword } = useAuth();
  const [mode, setMode] = useState(authMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMode(authMode);
    setError('');
    setMessage('');
  }, [authMode, authModalOpen]);

  if (!authModalOpen) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      if (mode === 'signin') {
        const result = await signIn(email, password);
        if (result.error) { setError(result.error); return; }
        closeAuth();
        return;
      }
      if (mode === 'signup') {
        if (name.trim().length < 2) { setError('Add your display name.'); return; }
        if (password.length < 6) { setError('Use a password with at least 6 characters.'); return; }
        const result = await signUp({ name, email, password });
        if (result.error) { setError(result.error); return; }
        if (result.needsConfirmation) {
          setMessage('Account created. Check your email to confirm the account, then sign in.');
          setMode('signin');
        } else closeAuth();
        return;
      }
      if (mode === 'reset') {
        if (password.length < 6) { setError('Use a password with at least 6 characters.'); return; }
        if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
        const result = await updatePassword(password);
        if (result.error) { setError(result.error); return; }
        setPassword('');
        setConfirmPassword('');
        setMessage('Your password has been updated. You can now continue using AURA.');
        setMode('signin');
        return;
      }
      const result = await resetPassword(email);
      if (result.error) { setError(result.error); return; }
      setMessage('Password reset instructions were sent to your email.');
      setMode('signin');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-xl p-0 sm:p-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-t-[2rem] sm:rounded-[2rem] border border-white/10 bg-[#0f1018] shadow-[0_30px_100px_rgba(0,0,0,.65)]">
        <div className="absolute -top-24 -right-16 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative px-6 pt-6 pb-4 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-amber-300">AURA ACCOUNT</span>
              <h2 className="mt-2 font-serif text-3xl font-light text-stone-100">
                {mode === 'signup' ? 'Create your Vault' : mode === 'forgot' ? 'Reset access' : mode === 'reset' ? 'Choose a new password' : 'Welcome back'}
              </h2>
              <p className="mt-1 text-xs leading-5 text-stone-500">One account for collecting, creating, holding and P2P activity.</p>
            </div>
            <button onClick={closeAuth} className="h-9 w-9 rounded-full border border-white/10 bg-white/5 text-stone-400 hover:text-stone-100 flex items-center justify-center"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3"><ShieldCheck className="h-4 w-4 text-emerald-300" /><span className="mt-2 block text-[9px] uppercase tracking-wider text-stone-500">Secure auth</span></div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3"><KeyRound className="h-4 w-4 text-amber-300" /><span className="mt-2 block text-[9px] uppercase tracking-wider text-stone-500">Private vault</span></div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3"><ArrowRight className="h-4 w-4 text-cyan-300" /><span className="mt-2 block text-[9px] uppercase tracking-wider text-stone-500">P2P ready</span></div>
          </div>
        </div>

        <form onSubmit={submit} className="relative space-y-4 p-6">
          {mode === 'signup' && (
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium text-stone-400">Display name</span>
              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-600" />
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 pl-10 pr-3 text-sm text-stone-100 outline-none focus:border-amber-400/60" placeholder="Your name" />
              </div>
            </label>
          )}
          {mode !== 'reset' && (
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium text-stone-400">Email</span>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-600" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 pl-10 pr-3 text-sm text-stone-100 outline-none focus:border-amber-400/60" placeholder="you@example.com" />
              </div>
            </label>
          )}
          {mode !== 'forgot' && (
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium text-stone-400">Password</span>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-600" />
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete={mode === 'signup' || mode === 'reset' ? 'new-password' : 'current-password'} required className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 pl-10 pr-3 text-sm text-stone-100 outline-none focus:border-amber-400/60" placeholder="••••••••" />
              </div>
            </label>
          )}
          {mode === 'reset' && (
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium text-stone-400">Confirm new password</span>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-600" />
                <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" autoComplete="new-password" required className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 pl-10 pr-3 text-sm text-stone-100 outline-none focus:border-amber-400/60" placeholder="••••••••" />
              </div>
            </label>
          )}
          {error && <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-3 text-xs leading-5 text-rose-200">{error}</div>}
          {message && <div className="flex gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-3 text-xs leading-5 text-emerald-200"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span>{message}</span></div>}
          <button disabled={submitting} className="w-full rounded-2xl bg-amber-400 py-3.5 text-sm font-bold text-stone-950 shadow-lg shadow-amber-500/10 transition hover:bg-amber-300 disabled:opacity-50">
            {submitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : mode === 'signup' ? 'Create AURA Account' : mode === 'forgot' ? 'Send Reset Link' : mode === 'reset' ? 'Update Password' : 'Sign In'}
          </button>
          <div className="flex items-center justify-between text-[11px]">
            {mode !== 'forgot' && mode !== 'reset' ? (
              <>
                <button type="button" onClick={() => openAuth(mode === 'signup' ? 'signin' : 'signup')} className="text-amber-300 hover:text-amber-200">{mode === 'signup' ? 'Already have an account? Sign in' : 'New to AURA? Create account'}</button>
                {mode === 'signin' && <button type="button" onClick={() => { setMode('forgot'); setError(''); setMessage(''); }} className="text-stone-500 hover:text-stone-300">Forgot password?</button>}
              </>
            ) : (
              <button type="button" onClick={() => { setMode('signin'); setError(''); setMessage(''); }} className="text-amber-300">Back to sign in</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
