import type { User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

// The name Flowku greets the user with. Kept in auth user_metadata, so it needs no table and works for guests too:
// the user's own pick first, then the name Google gave us, then the email's local part.

export const NAME_MAX = 30;

export function displayName(user: User | null | undefined): string {
  const meta = user?.user_metadata ?? {};
  const picked = [meta.display_name, meta.full_name, meta.name].find(
    (v): v is string => typeof v === 'string' && v.trim().length > 0,
  );
  if (picked) return picked.trim();
  if (!user || user.is_anonymous) return 'Tamu Flowku';
  return user.email?.split('@')[0] ?? 'Pengguna Flowku';
}

/** "Athif Khairullah" -> "AK", "athif" -> "AT". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

/** Saves the name; the session provider picks up the change (USER_UPDATED). Empty clears it back to the default. */
export async function saveDisplayName(name: string) {
  const value = name.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX);
  const { error } = await supabase.auth.updateUser({ data: { display_name: value || null } });
  if (error) throw new Error(error.message);
}
