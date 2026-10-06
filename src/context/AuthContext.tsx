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
  signUp: (params: { name: string; email: string; password: string }) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
}

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

    signUp: async ({ name, email, password }) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: name.trim() },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) return { error: humanizeAuthError(error.message) };
      return { needsConfirmation: !data.session };
    },

    resetPassword: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      return error ? { error: humanizeAuthError(error.message) } : {};
    },

    signOut: async () => {
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
