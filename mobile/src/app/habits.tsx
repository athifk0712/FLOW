import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { streakText, WeekDots } from '@/components/dashboard/habit-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchHabits, type Habits } from '@/lib/habits';
import { closeModal } from '@/lib/navigation';

const weekdayFormat = new Intl.DateTimeFormat('id-ID', { weekday: 'narrow' });

// Habits, not scores: how consistently the user logs and judges, and a few quiet milestones.
export default function HabitsScreen() {
  const theme = useTheme();
  const [habits, setHabits] = useState<Habits | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchHabits()
        .then((h) => {
          setError(null);
          setHabits(h);
        })
        .catch((e: { message?: string }) => setError(e.message ?? 'Gagal memuat kebiasaan.'));
    }, []),
  );

  const now = new Date();
  const dayLetters = Array.from({ length: 7 }, (_, i) =>
    weekdayFormat.format(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + i)),
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.header}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            KEBIASAAN
          </ThemedText>
          <Pressable onPress={closeModal} hitSlop={12}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Tutup
            </ThemedText>
          </Pressable>
        </View>

        {error && <ThemedText themeColor="danger">{error}</ThemedText>}

        {!habits ? (
          !error && <ActivityIndicator style={styles.flex} />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.hero}>
              <ThemedText style={[styles.streak, { color: theme.primary }]}>{habits.streak}</ThemedText>
              <ThemedText type="smallBold">hari berturut-turut</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                {habits.streak === 0
                  ? streakText(habits)
                  : habits.loggedToday
                    ? 'Hari ini sudah tercatat. Sampai besok.'
                    : 'Belum ada catatan hari ini. Catat supaya berlanjut.'}
              </ThemedText>
            </View>

            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                7 hari terakhir
              </ThemedText>
              <View style={styles.week}>
                <WeekDots days={habits.lastSeven} size={28} />
              </View>
              <View style={styles.weekLabels}>
                {dayLetters.map((d, i) => (
                  <ThemedText key={i} type="small" themeColor="textSecondary" style={styles.dayLetter}>
                    {d}
                  </ThemedText>
                ))}
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {habits.reviewedShare === null
                  ? 'Belum ada pengeluaran minggu ini.'
                  : `${Math.round(habits.reviewedShare * 100)}% pengeluaran minggu ini sudah dinilai. Yang belum, menunggu di review malam.`}
              </ThemedText>
            </ThemedView>

            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                PENCAPAIAN
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.card}>
                {habits.milestones.map((m) => (
                  <View key={m.key} style={[styles.milestone, !m.done && styles.pending]}>
                    <View
                      style={[
                        styles.badge,
                        m.done ? { backgroundColor: theme.accent } : { borderColor: theme.textSecondary, borderWidth: 1.5 },
                      ]}>
                      {m.done && (
                        <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                          ✓
                        </ThemedText>
                      )}
                    </View>
                    <View style={styles.flex}>
                      <ThemedText type="smallBold">{m.title}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {m.hint}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </ThemedView>
            </View>

            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              Tidak ada hukuman kalau terlewat. Yang penting kembali lagi.
            </ThemedText>
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  content: {
    gap: Spacing.four,
    paddingBottom: Spacing.four,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.three,
  },
  streak: {
    fontSize: 72,
    lineHeight: 80,
    fontWeight: 800,
  },
  center: {
    textAlign: 'center',
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  week: {
    alignItems: 'center',
  },
  weekLabels: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
    marginTop: -Spacing.two,
  },
  dayLetter: {
    width: 28,
    textAlign: 'center',
  },
  section: {
    gap: Spacing.two,
  },
  milestone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  pending: {
    opacity: 0.6,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
