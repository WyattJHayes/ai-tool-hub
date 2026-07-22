import { createClient } from '@supabase/supabase-js';
import {
  createPasswordRecoveryIntentStore,
  registerPasswordRecoveryIntentListener,
} from '@/features/auth/recovery';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = supabaseUrl && supabaseAnonKey;

export const passwordRecoveryIntent = typeof window === 'undefined'
  ? null
  : createPasswordRecoveryIntentStore(window.sessionStorage);

// Capture intent before createClient can consume or clear the implicit-flow hash.
passwordRecoveryIntent?.captureUrlHash(window.location.hash);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (supabase && passwordRecoveryIntent) {
  registerPasswordRecoveryIntentListener(supabase.auth, passwordRecoveryIntent);
}

export function getSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  return supabase;
}
