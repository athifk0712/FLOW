import { useEffect, useSyncExternalStore } from 'react';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/session-provider';

// The signed-in user's cycle start day (profiles.cycle_start_day), shared by every screen that needs it.
// Cached per user so screens don't flash calendar months while it loads.

let state = { userId: null as string | null, day: 1, loaded: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

async function load(userId: string) {
  const { data } = await supabase.from('profiles').select('cycle_start_day').eq('id', userId).maybeSingle();
  if (state.userId !== userId) return; // switched accounts meanwhile
  state = { userId, day: data?.cycle_start_day ?? 1, loaded: true };
  emit();
}

/** { day, loaded } for the current user; day is 1 until loaded. */
export function useCycleDay() {
  const userId = useSession().session?.user.id ?? null;
  useEffect(() => {
    if (!userId || state.userId === userId) return;
    state = { userId, day: 1, loaded: false };
    emit();
    load(userId);
  }, [userId]);
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** Saves a new cycle start day (1–28). Throws with the database message on failure. */
export async function setCycleDay(day: number) {
  const userId = state.userId;
  if (!userId) return;
  const { error } = await supabase.from('profiles').update({ cycle_start_day: day }).eq('id', userId);
  if (error) throw new Error(error.message);
  state = { userId, day, loaded: true };
  emit();
}
