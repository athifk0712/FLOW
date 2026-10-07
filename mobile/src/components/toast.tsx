import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/app-symbol';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const VISIBLE_MS = 6000;

/** A short message floating at the top of the screen; hides itself after a few seconds, or on tap. */
export function Toast({ message, onHide }: { message: string | null; onHide: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onHide, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [message, onHide]);

  if (!message) return null;
  return (
    <Animated.View
      entering={FadeInUp}
      exiting={FadeOutUp}
      style={[styles.wrap, { top: insets.top + Spacing.two }]}
      pointerEvents="box-none">
      <Pressable
        onPress={onHide}
        accessibilityRole="alert"
        style={[styles.toast, { backgroundColor: theme.text }]}>
        <AppSymbol material="account_balance" sf="building.columns" size={20} color={theme.background} />
        <ThemedText type="small" style={[styles.text, { color: theme.background }]}>
          {message}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    alignItems: 'center',
    zIndex: 10,
  },
  toast: {
    width: '100%',
    maxWidth: MaxContentWidth - Spacing.six,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    borderRadius: Spacing.three,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: {
    flex: 1,
  },
});
