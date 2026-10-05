import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useAppearance } from '@/lib/appearance';

/** The scheme to render: the user's choice in Pengaturan, else the phone's. */
export function useColorScheme() {
  const system = useSystemColorScheme();
  const pref = useAppearance();
  return pref === 'system' ? system : pref;
}
