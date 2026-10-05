import 'expo-sqlite/localStorage/install';

import { Appearance, Platform } from 'react-native';
import { useSyncExternalStore } from 'react';

// Light, dark, or follow the phone. Device-only, like the reminder settings.
export type AppearancePref = 'system' | 'light' | 'dark';

export const APPEARANCE_OPTIONS: { value: AppearancePref; label: string }[] = [
  { value: 'system', label: 'Ikuti HP' },
  { value: 'light', label: 'Terang' },
  { value: 'dark', label: 'Gelap' },
];

const STORAGE_KEY = 'flowku.appearance';
const listeners = new Set<() => void>();

function read(): AppearancePref {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

// Native views (tab bar, pickers, alerts) follow the override too. react-native-web has no setColorScheme.
function applyNative(pref: AppearancePref) {
  if (Platform.OS !== 'web') Appearance.setColorScheme(pref === 'system' ? 'unspecified' : pref);
}

let current = read();
applyNative(current);

export function setAppearance(pref: AppearancePref) {
  current = pref;
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Still applies for this session.
  }
  applyNative(pref);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppearance() {
  return useSyncExternalStore(subscribe, () => current, () => 'system' as const);
}
