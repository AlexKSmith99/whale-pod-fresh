import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Fail loudly if the env vars weren't inlined into the bundle. Expo replaces
// EXPO_PUBLIC_* at bundle time, so a missing value almost always means Metro
// started before .env existed or with a stale cache — restart with
// `npx expo start -c` to re-inline them. Silently falling back to '' turns
// every request into an opaque "TypeError: Network request failed".
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase env vars missing from the bundle (EXPO_PUBLIC_SUPABASE_URL / ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY are undefined). Check .env, then restart ' +
      'Metro with `npx expo start -c` to re-inline them.'
  );
}

/** Single source of truth for the project URL (also used for raw Storage fetches). */
export const SUPABASE_URL = supabaseUrl;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
