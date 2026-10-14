import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { celebrationMessage } from '@/lib/streak';

type Props = {
  days: number | null; // null = hidden
  onClose: () => void;
};

// Shown on Beranda once a day, after the day's first counted activity was saved (so never before a save
// succeeded, and never twice). One tap closes it; it never blocks logging.
export function StreakCelebration({ days, onClose }: Props) {
  const theme = useTheme();
  const [scale] = useState(() => new Animated.Value(0.6));

  useEffect(() => {
    if (days === null) return;
    scale.setValue(0.6);
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (reduce) scale.setValue(1);
        else Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
      })
      .catch(() => scale.setValue(1));
  }, [days, scale]);

  return (
    <Modal visible={days !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Tutup">
        <ThemedView type="backgroundElement" style={styles.card}>
          <Animated.Text style={[styles.flame, { transform: [{ scale }] }]}>🔥</Animated.Text>
          <ThemedText style={styles.count}>{days ?? 0} hari beruntun</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.center}>
            {celebrationMessage(days ?? 0)}
          </ThemedText>
          <View style={styles.full}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.button, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
              <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                Lanjutkan
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  flame: {
    fontSize: 64,
    lineHeight: 76,
  },
  count: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: 700,
  },
  center: {
    textAlign: 'center',
  },
  full: {
    alignSelf: 'stretch',
  },
  button: {
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
