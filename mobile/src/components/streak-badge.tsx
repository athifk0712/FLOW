import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { StreakView } from '@/lib/streak';

type Props = {
  streak: StreakView;
  /** Text color on the band behind it. */
  color: string;
  onPress?: () => void;
};

// 🔥 and the number of days in a row (🛟 when one day was missed and logging today saves it). Dimmed while today hasn't
// counted yet; a small pop when it just did (skipped when the phone asks for reduced motion).
export function StreakBadge({ streak, color, onPress }: Props) {
  const [scale] = useState(() => new Animated.Value(1));
  const wasActive = useRef(streak.activeToday);

  useEffect(() => {
    if (streak.activeToday && !wasActive.current) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((reduce) => {
          if (reduce) return;
          Animated.sequence([
            Animated.spring(scale, { toValue: 1.25, useNativeDriver: true, speed: 30 }),
            Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }),
          ]).start();
        })
        .catch(() => {});
    }
    wasActive.current = streak.activeToday;
  }, [streak.activeToday, scale]);

  const label = streak.days === 0
    ? 'Belum ada hari beruntun. Catat transaksi untuk memulai.'
    : streak.atRisk
      ? `${streak.days} hari beruntun, terancam karena kemarin terlewat. Catat hari ini untuk menyelamatkannya.`
      : `${streak.days} hari beruntun${streak.activeToday ? '' : ', catat hari ini supaya tidak putus'}`;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.badge, !streak.activeToday && styles.dim, pressed && styles.pressed]}>
      <Animated.Text style={[styles.flame, { transform: [{ scale }] }]}>{streak.atRisk ? '🛟' : '🔥'}</Animated.Text>
      <ThemedText type="smallBold" style={{ color }}>
        {streak.days}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 40,
    paddingHorizontal: Spacing.two + 2,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  flame: {
    fontSize: 16,
    lineHeight: 20,
  },
  dim: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.7,
  },
});
