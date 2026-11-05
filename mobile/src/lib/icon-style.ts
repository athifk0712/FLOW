import 'expo-sqlite/localStorage/install';

import { useSyncExternalStore } from 'react';

// How the feature icons look: plain line symbols (the default for everyone) or the celengan ayam illustrations.
// Device-only, like Tampilan (light/dark).
export type IconStyle = 'normal' | 'ayam';

export const ICON_STYLE_OPTIONS: { value: IconStyle; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'ayam', label: 'Celengan Ayam' },
];

const STORAGE_KEY = 'flowku.iconStyle';
const listeners = new Set<() => void>();

function read(): IconStyle {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'ayam' ? 'ayam' : 'normal';
  } catch {
    return 'normal';
  }
}

let current = read();

export function setIconStyle(style: IconStyle) {
  if (style === current) return;
  current = style;
  try {
    localStorage.setItem(STORAGE_KEY, style);
  } catch {
    // Still applies for this session.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The chosen icon style. Only the components that draw icons subscribe, so a switch re-renders just those. */
export function useIconStyle() {
  return useSyncExternalStore(subscribe, () => current, () => 'normal' as const);
}
