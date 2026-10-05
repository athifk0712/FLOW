import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { setCycleDay, useCycleDay } from '@/hooks/use-cycle-day';
import { useTheme } from '@/hooks/use-theme';
import { CYCLE_DAYS, cycleLabel, cycleStart } from '@/lib/cycle';

// Four rows of seven, like the weeks of a calendar.
const WEEKS = [0, 1, 2, 3].map((w) => CYCLE_DAYS.slice(w * 7, w * 7 + 7));

/** Payday cycle: pick the day the month starts, like tapping a date on a calendar. Saved on tap. */
export function CycleSection() {
  const theme = useTheme();
  const { day, loaded } = useCycleDay();
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(next: number) {
    if (next === day || saving) return;
    setSaving(next);
    setError(null);
    try {
      await setCycleDay(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
    }
    setSaving(null);
  }

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        SIKLUS BULANAN
      </ThemedText>
      <ThemedView type="backgroundElement" style={styles.card}>
        <View>
          <ThemedText type="smallBold">Bulan dimulai tanggal {day}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {day === 1
              ? 'Ikut kalender. Gajian tanggal lain? Pilih tanggalnya supaya budget bulanan, laporan, dan Aman dibelanjakan ikut menyesuaikan.'
              : `Periode sekarang: ${cycleLabel(cycleStart(new Date(), day), day)}. Budget bulanan, laporan, dan Aman dibelanjakan mengikuti tanggal ini.`}
          </ThemedText>
        </View>

        <View style={[styles.grid, !loaded && styles.dim]} accessibilityRole="radiogroup">
          {WEEKS.map((week, w) => (
            <View key={w} style={styles.week}>
              {week.map((d) => {
                const selected = d === (saving ?? day);
                return (
                  <Pressable
                    key={d}
                    onPress={() => pick(d)}
                    disabled={!loaded}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Tanggal ${d}`}
                    style={({ pressed }) => [
                      styles.cell,
                      {
                        backgroundColor: selected ? theme.primary : theme.backgroundSelected,
                      },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText type="smallBold" style={{ color: selected ? theme.onPrimary : theme.text }}>
                      {d}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Maksimal tanggal 28 supaya setiap bulan punya tanggal itu.
        </ThemedText>
        {error && (
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        )}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  grid: {
    gap: Spacing.one,
  },
  week: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
});
