import type { AuthError } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { safeStorage, storagePersists } from '@/lib/safe-storage';
import { supabase } from '@/lib/supabase';

// Closes the auth popup on web if this page was opened as one.
WebBrowser.maybeCompleteAuthSession();

/**
 * - `link`: attach Google to the current guest account (same user id, data stays).
 * - `signin`: sign in to (or create) the account that belongs to that Google login.
 */
export type OAuthMode = 'link' | 'signin';

export type GoogleResult =
  | { kind: 'ok' }
  | { kind: 'cancelled' }
  /** Linking failed because this Google login already belongs to another Flowku account: sign in to it instead. */
  | { kind: 'taken' }
  | { kind: 'error'; message: string };

function isTaken(code: string | undefined, message: string) {
  const text = message.toLowerCase();
  return code === 'identity_already_exists' || text.includes('already linked') || text.includes('already exists');
}

function describeError(code: string | undefined, message: string): GoogleResult {
  if (isTaken(code, message)) return { kind: 'taken' };
  const text = message.toLowerCase();
  if (code === 'no_authorization' || text.includes('bearer token')) {
    return {
      kind: 'error',
      message: storagePersists()
        ? 'Sesi tamu hilang. Muat ulang halaman, lalu coba lagi.'
        : 'Browser ini tidak menyimpan data login (mode privat atau cookie diblokir). Buka Flowku di Safari/Chrome biasa, lalu coba lagi.',
    };
  }
  if (code === 'manual_linking_disabled' || text.includes('manual linking')) {
    return { kind: 'error', message: 'Menautkan Google belum diaktifkan di Supabase (Allow manual linking).' };
  }
  if (code === 'validation_failed' || text.includes('provider is not enabled') || text.includes('unsupported provider')) {
    return { kind: 'error', message: 'Login Google belum diaktifkan di Supabase.' };
  }
  return { kind: 'error', message };
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

// On web the page leaves for Google; this marks that the trip was a "link", so the result can be read on return.
const WEB_LINK_KEY = 'flowku.google-link';
const WEB_LINK_TTL_MS = 10 * 60_000;

/**
 * Runs the Google login. On web the page leaves for Google and supabase-js finishes the login when it comes back
 * (detectSessionInUrl); a failed link is read back afterwards with takeWebLinkResult().
 */
export async function continueWithGoogle(mode: OAuthMode): Promise<GoogleResult> {
  const isWeb = Platform.OS === 'web';
  // The trailing slash matters: Supabase's allow list has "https://flowku.expo.app/**", which the bare origin
  // doesn't match, and an unlisted redirect silently falls back to the Site URL. A web link comes back to
  // Pengaturan, where the button was, so its result can be shown there.
  const redirectTo = isWeb
    ? `${window.location.origin}/${mode === 'link' ? 'settings' : ''}`
    : Linking.createURL('/');
  const options = { redirectTo, skipBrowserRedirect: !isWeb };

  if (isWeb && mode === 'link') safeStorage.setItem(WEB_LINK_KEY, String(Date.now()));
  const { data, error } =
    mode === 'link'
      ? await supabase.auth.linkIdentity({ provider: 'google', options })
      : await supabase.auth.signInWithOAuth({ provider: 'google', options });
  if (error) {
    if (isWeb) safeStorage.removeItem(WEB_LINK_KEY);
    return describeError((error as AuthError).code, error.message);
  }
  if (isWeb) return { kind: 'ok' }; // the page is leaving for Google
  if (!data.url) return { kind: 'cancelled' };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return { kind: 'cancelled' };

  const params = readParams(result.url);
  if (params.error || params.error_description) {
    return describeError(params.error_code, params.error_description || params.error);
  }
  if (!params.code) return { kind: 'error', message: 'Login Google tidak selesai. Coba lagi.' };

  const exchange = await supabase.auth.exchangeCodeForSession(params.code);
  return exchange.error ? describeError(exchange.error.code, exchange.error.message) : { kind: 'ok' };
}

/**
 * Web only: the outcome of a "link" trip to Google that just came back to this page, once (or null). Waits for
 * supabase-js to read the URL first, then removes the leftover error from the address bar.
 */
export async function takeWebLinkResult(): Promise<GoogleResult | null> {
  if (Platform.OS !== 'web') return null;
  const startedAt = Number(safeStorage.getItem(WEB_LINK_KEY));
  if (!startedAt) return null;
  safeStorage.removeItem(WEB_LINK_KEY);
  if (Date.now() - startedAt > WEB_LINK_TTL_MS) return null;

  await supabase.auth.getSession();
  const params = readParams(window.location.href);
  if (!params.error && !params.error_description) return { kind: 'ok' };
  window.history.replaceState(null, '', window.location.pathname);
  return describeError(params.error_code, params.error_description || params.error);
}

/** True when the guest on this device has logged anything, so switching accounts would leave it behind. */
export async function guestHasData() {
  const { count } = await supabase.from('transactions').select('id', { count: 'exact', head: true });
  return (count ?? 0) > 0;
}
