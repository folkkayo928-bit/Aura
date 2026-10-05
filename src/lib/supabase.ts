import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  'https://rtqcistkoomzmzxzasxc.supabase.co';
const supabasePublishableKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() || '';

if (!supabasePublishableKey) {
  throw new Error(
    'AURA configuration error: VITE_SUPABASE_PUBLISHABLE_KEY is missing. Configure the public Supabase publishable key in the deployment environment.'
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
