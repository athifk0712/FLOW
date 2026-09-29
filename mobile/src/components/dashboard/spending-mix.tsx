import { StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { NECESSITY, NECESSITY_ORDER, UNREVIEWED_COLOR } from '@/constants/necessity';
import { Spacing } from '@/constants/theme';
import type { Tables } from '@/lib/database.types';
import { formatRupiah } from '@/lib/money';

type MixRow = Pick<Tables<'v_spending_mix_monthly'>, 'necessity' | 'total'>;

const percent = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0);

/** A month's expenses split by necessity. Unreviewed spending is its own slice so the parts add up to 100%. */
export function SpendingMix({ rows }: { rows: MixRow[] }) {
  const byKey = new Map(rows.map((r) => [r.necessity ?? 'UNREVIEWED', r.total ?? 0]));
  const slices = [
    ...NECESSITY_ORDER.map((n) => ({ key: n, ...NECESSITY[n], value: byKey.get(n) ?? 0 })),
    { key: 'UNREVIEWED', label: 'Belum dinilai', color: UNREVIEWED_COLOR, value: byKey.get('UNREVIEWED') ?? 0 },
  ];
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const essential = (byKey.get('NEED') ?? 0) + (byKey.get('IMPORTANT') ?? 0);
  const discretionary = (byKey.get('WANT') ?? 0) + (byKey.get('IMPULSE') ?? 0);

  if (total === 0) {
    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="small" themeColor="textSecondary">
          Belum ada pengeluaran bulan ini.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.row}>
        <View>
          <ThemedText type="small" themeColor="textSecondary">
            Kebutuhan
          </ThemedText>
          <ThemedText type="smallBold">{percent(essential, total)}%</ThemedText>
        </View>
        <View style={styles.right}>
          <ThemedText type="small" themeColor="textSecondary">
            Keinginan
          </ThemedText>
          <ThemedText type="smallBold">{percent(discretionary, total)}%</ThemedText>
        </View>
      </View>

      <ProgressBar total={total} height={14} segments={slices} />

      <View style={styles.legend}>
        {slices
          .filter((s) => s.value > 0)
          .map((s) => (
            <View key={s.key} style={styles.row}>
              <View style={styles.label}>
                <View style={[styles.dot, { backgroundColor: s.color }]} />
                <ThemedText type="small">{s.label}</ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {formatRupiah(s.value)} · {percent(s.value, total)}%
              </ThemedText>
            </View>
          ))}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  right: {
    alignItems: 'flex-end',
  },
  legend: {
    gap: Spacing.one,
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
