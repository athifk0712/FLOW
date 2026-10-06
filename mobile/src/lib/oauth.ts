import type { AuthError } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

// Closes the auth popup on web if this page was opened as one.
WebBrowser.maybeCompleteAuthSession();

/**
 * - `link`: attach Google to the current guest account (same user id, data stays).
 * - `signin`: sign in to (or create) the account that belongs to that Google login.
 */
export type OAuthMode = 'link' | 'signin';

function describeError(code: string | undefined, message: string) {
  const text = message.toLowerCase();
  if (code === 'identity_already_exists' || text.includes('already linked') || text.includes('already exists')) {
    return 'Akun Google ini sudah dipakai akun Flowku lain. Pakai "Masuk" untuk membukanya.';
  }
  if (code === 'manual_linking_disabled' || text.includes('manual linking')) {
    return 'Menautkan Google belum diaktifkan di Supabase (Allow manual linking).';
  }
  if (code === 'validation_failed' || text.includes('provider is not enabled') || text.includes('unsupported provider')) {
    return 'Login Google belum diaktifkan di Supabase.';
  }
  return message;
}

// The redirect carries its result in the query (?code=) or, for errors, sometimes in the fragment (#error=).
function readParams(url: string) {
  const params: Record<string, string> = {};
  for (const part of url.split(/[?#]/).slice(1)) {
    for (const pair of part.split('&')) {
      const [key, value = ''] = pair.split('=');
      if (key) params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
    }
  }
  return params;
}

/**
 * Runs the Google login. Resolves to an error message, or null when it worked or the user cancelled.
 * On web the page leaves for Google and supabase-js finishes the login when it comes back (detectSessionInUrl).
 */
export async function continueWithGoogle(mode: OAuthMode): Promise<string | null> {
  const isWeb = Platform.OS === 'web';
  // The trailing slash matters: Supabase's allow list has "https://flowku.expo.app/**", which the bare origin
  // doesn't match, and an unlisted redirect silently falls back to the Site URL.
  const redirectTo = isWeb ? `${window.location.origin}/` : Linking.createURL('/');
  const options = { redirectTo, skipBrowserRedirect: !isWeb };

  const { data, error } =
    mode === 'link'
      ? await supabase.auth.linkIdentity({ provider: 'google', options })
      : await supabase.auth.signInWithOAuth({ provider: 'google', options });
  if (error) return describeError((error as AuthError).code, error.message);
  if (isWeb || !data.url) return null;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return null;

  const params = readParams(result.url);
  if (params.error || params.error_description) {
    return describeError(params.error_code, params.error_description || params.error);
  }
  if (!params.code) return 'Login Google tidak selesai. Coba lagi.';

  const exchange = await supabase.auth.exchangeCodeForSession(params.code);
  return exchange.error ? describeError(exchange.error.code, exchange.error.message) : null;
}
