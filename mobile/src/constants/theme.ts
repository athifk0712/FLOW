/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Flowku "Tenang & sadar": deep teal, warm sand, a touch of honey. Dark mode is its own night-teal set,
// not an inversion. primary/onPrimary are for buttons and selected chips; accent is for highlights only.
export const Colors = {
  light: {
    text: '#1C2B2A',
    background: '#F6F1E7',
    backgroundElement: '#FFFCF6',
    backgroundSelected: '#ECE5D7',
    textSecondary: '#5E6B69',
    primary: '#0F5C55',
    onPrimary: '#FFFFFF',
    accent: '#E9A23B',
    onAccent: '#1C2B2A',
    warning: '#8A5A0B', // honey, dark enough for text on sand
  },
  dark: {
    text: '#F2EDE3',
    background: '#0E1716',
    backgroundElement: '#182624',
    backgroundSelected: '#243532',
    textSecondary: '#A3B3AF',
    primary: '#4FB3A5',
    onPrimary: '#0E1716',
    accent: '#F0B454',
    onAccent: '#0E1716',
    warning: '#F0B454',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
