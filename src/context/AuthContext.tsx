import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  authModalOpen: boolean;
  authMode: AuthMode;
  openAuth: (mode?: AuthMode) => void;
  closeAuth: () => void;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signInWithTelegram: () => Promise<{ error?: string }>;
  signUp: (params: { name: string; email: string; password: string }) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
}

const AURA_PRODUCTION_URL = 'https://aura-8bom.onrender.com';

const getAuthRedirectUrl = () => AURA_PRODUCTION_URL;

const AuthContext = createContext<AuthContextValue | null>(null);

const humanizeAuthError = (message: string) => {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email or password is incorrect.';
  if (m.includes('email not confirmed')) return 'Please confirm your email address, then sign in again.';
  if (m.includes('user already registered')) return 'An account with this email already exists. Try Sign in.';
  if (m.includes('password should be at least')) return 'Use a password with at least 6 characters.';
  if (m.includes('rate limit')) return 'Too many attempts. Wait a moment and try again.';
  return message;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setLoading(false);

      const provider = nextSession?.user?.app_metadata?.provider;
      const telegramSub = nextSession?.user?.user_metadata?.sub;
      if (event === 'SIGNED_IN' && provider === 'custom:telegram' && telegramSub) {
        void supabase.rpc('set_my_telegram_identity', {
          p_telegram_id: String(telegramSub),
        });
      }

      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('reset');
        setAuthModalOpen(true);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    authModalOpen,
    authMode,
    openAuth: (mode = 'signin') => {
      setAuthMode(mode);
      setAuthModalOpen(true);
    },
    closeAuth: () => setAuthModalOpen(false),

    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      return error ? { error: humanizeAuthError(error.message) } : {};
    },

    signInWithTelegram: async () => {
      const telegramWebApp = (window as any).Telegram?.WebApp;
      const initData = String(telegramWebApp?.initData || '').trim();

      // Inside the Telegram Mini App, do not bounce the user to
      // oauth.telegram.org. The Mini App already gives us signed initData.
      // The Edge Function verifies it server-side and returns a one-time
      // Supabase token hash that this client exchanges for a real session.
      if (initData) {
        try {
          const { data, error } = await supabase.functions.invoke('telegram-miniapp-auth', {
            body: { initData },
          });

          if (error) {
            return { error: 'Telegram sign-in is temporarily unavailable. Please try again.' };
          }

          const tokenHash = String(data?.token_hash || '').trim();
          if (!tokenHash) {
            return { error: 'Telegram sign-in could not create a secure session.' };
          }

          try { sessionStorage.removeItem('aura_telegram_signed_out_id'); } catch {};

          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'email',
          });

          if (verifyError) {
            return { error: humanizeAuthError(verifyError.message) };
          }

          return {};
        } catch {
          return { error: 'Telegram sign-in is temporarily unavailable. Please try again.' };
        }
      }

      const redirectTo =
        window.location.origin.startsWith('http://localhost') ||
        window.location.origin.startsWith('http://127.0.0.1')
          ? AURA_PRODUCTION_URL
          : window.location.origin;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'custom:telegram',
        options: { redirectTo },
      });
      return error ? { error: humanizeAuthError(error.message) } : {};
    },

    signUp: async ({ name, email, password }) => {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { name: name.trim() },
            // Keep confirmation links on the real AURA production app. This
            // avoids preview/localhost redirect mismatches in Supabase Auth.
            emailRedirectTo: getAuthRedirectUrl(),
          },
        });
        if (error) return { error: humanizeAuthError(error.message) };
        return { needsConfirmation: !data.session };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || '');
        return { error: humanizeAuthError(message || 'Unable to reach AURA authentication. Please try again.') };
      }
    },

    resetPassword: async (email) => {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: getAuthRedirectUrl(),
        });
        return error ? { error: humanizeAuthError(error.message) } : {};
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || '');
        return { error: humanizeAuthError(message || 'Unable to reach AURA authentication. Please try again.') };
      }
    },

    signOut: async () => {
      const telegramId = String((window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id || '').trim();
      if (telegramId) {
        try { sessionStorage.setItem('aura_telegram_signed_out_id', telegramId); } catch {}
      }
      await supabase.auth.signOut();
      setAuthModalOpen(false);
    },

    updatePassword: async (password) => {
      const { error } = await supabase.auth.updateUser({ password });
      return error ? { error: humanizeAuthError(error.message) } : {};
    },
  }), [session, loading, authModalOpen, authMode]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
};
