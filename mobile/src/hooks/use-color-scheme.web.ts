import { useSyncExternalStore } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useAppearance } from '@/lib/appearance';

const subscribe = () => () => {};

/**
 * The scheme to render: the user's choice in Pengaturan, else the browser's.
 * To support static rendering, the server snapshot is `false`, so hydration renders 'light' first.
 */
export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const system = useSystemColorScheme();
  const pref = useAppearance();
  if (!hasHydrated) return 'light';
  return pref === 'system' ? system : pref;
}
