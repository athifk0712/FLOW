import 'expo-sqlite/localStorage/install';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from '@/lib/database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local');
}

// Right after sign-up the API can reject the brand-new token as "issued at future" (server clocks differ
// by a moment). Waiting briefly and retrying fixes it, so new users don't see an error on first launch.
const CLOCK_SKEW_RETRIES = 3;
const CLOCK_SKEW_DELAY_MS = 1500;

async function fetchWithSkewRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(input, init);
    if (response.status !== 401 || attempt >= CLOCK_SKEW_RETRIES) return response;
    const body = await response.clone().text();
    if (!body.includes('issued at future')) return response;
    await new Promise((resolve) => setTimeout(resolve, CLOCK_SKEW_DELAY_MS));
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  global: { fetch: fetchWithSkewRetry },
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    // PKCE so Google login returns a one-time ?code= (lib/oauth.ts). On web the page itself comes back from Google
    // with it, and supabase-js exchanges it on load, before the guest sign-in would kick in.
    flowType: 'pkce',
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Only refresh tokens while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
