import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Habits } from '@/lib/habits';

/** Seven dots for the last seven days (today last); filled when something was logged that day. */
export function WeekDots({ days, size = 12 }: { days: boolean[]; size?: number }) {
  const theme = useTheme();
  return (
    <View style={styles.dots}>
      {days.map((logged, i) => (
        <View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: logged ? theme.primary : theme.backgroundSelected,
            // Today is outlined so an empty "today" reads as "not yet", not as a miss.
            borderWidth: i === days.length - 1 ? 2 : 0,
            borderColor: theme.primary,
          }}
        />
      ))}
    </View>
  );
}

export function streakText(habits: Habits) {
  if (habits.streak === 0) return 'Mulai lagi hari ini, pelan-pelan saja.';
  const days = `${habits.streak} hari berturut-turut mencatat`;
  return habits.loggedToday ? days : `${days} · catat hari ini supaya berlanjut`;
}

/** Dashboard summary: logging streak, the week at a glance, and how much of it is judged. */
export function HabitCard({ habits }: { habits: Habits }) {
  const done = habits.milestones.filter((m) => m.done).length;
  return (
    <Pressable onPress={() => router.push('/habits')}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.row}>
          <ThemedText type="smallBold" style={styles.flex}>
            {streakText(habits)}
          </ThemedText>
          <WeekDots days={habits.lastSeven} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {habits.reviewedShare === null
            ? 'Belum ada pengeluaran minggu ini'
            : `${Math.round(habits.reviewedShare * 100)}% pengeluaran minggu ini sudah dinilai`}
          {` · ${done}/${habits.milestones.length} pencapaian →`}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
});
