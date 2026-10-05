import { useEffect } from 'react';

import { setCurrency } from '@/lib/money';
import { supabase } from '@/lib/supabase';

/** Applies the signed-in user's saved currency (profiles.currency) on this device. */
export function useCurrencySync(userId: string | null) {
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('currency')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.currency) setCurrency(data.currency);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);
}

/**
 * Saves the currency to the profile, then applies it (which remounts every screen) unless `apply` is false.
 * Throws with the database message on failure.
 */
export async function saveCurrency(code: string, apply = true) {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (userId) {
    const { error } = await supabase.from('profiles').update({ currency: code }).eq('id', userId);
    if (error) throw new Error(error.message);
  }
  if (apply) setCurrency(code);
}
