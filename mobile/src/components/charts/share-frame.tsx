import { forwardRef, type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const SHARE_BASE_WIDTH = 320;

type Props = {
  /** Width on screen; the height follows the 9:16 of a status. */
  width: number;
  footer: string;
  children: ReactNode;
};

// The look every status picture shares: the 9:16 teal card, the Flowku name on top and a line at the bottom.
export const ShareFrame = forwardRef<View, Props>(function ShareFrame({ width, footer, children }, ref) {
  const theme = useTheme();
  const s = width / SHARE_BASE_WIDTH;
  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.card, { width, height: (width * 16) / 9, padding: 20 * s, gap: 14 * s, backgroundColor: theme.primary }]}>
      <View style={[styles.bubble, { width: 220 * s, height: 220 * s, top: -70 * s, right: -60 * s, backgroundColor: theme.accent }]} />
      <View style={[styles.bubble, { width: 150 * s, height: 150 * s, top: 90 * s, left: -70 * s, backgroundColor: theme.onPrimary }]} />

      <View style={[styles.brand, { gap: 8 * s }]}>
        <Image
          source={require('@/assets/images/icon.png')}
          style={{ width: 32 * s, height: 32 * s, borderRadius: 9 * s }}
          accessibilityIgnoresInvertColors
        />
        <ThemedText type="smallBold" style={{ color: theme.onPrimary, fontSize: 16 * s, lineHeight: 22 * s }}>
          Flowku
        </ThemedText>
      </View>

      {children}

      <ThemedText type="small" style={[styles.footer, { color: theme.onPrimary, fontSize: 12 * s, lineHeight: 16 * s }]}>
        {footer}
      </ThemedText>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: Spacing.three,
  },
  bubble: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.16,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footer: {
    textAlign: 'center',
    opacity: 0.85,
  },
});
