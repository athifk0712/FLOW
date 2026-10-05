import { StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { NECESSITY, NECESSITY_ORDER, type Necessity } from '@/constants/necessity';
import { Spacing } from '@/constants/theme';
import type { Tables } from '@/lib/database.types';
import { formatMoney } from '@/lib/money';

type RegretRow = Tables<'v_regret_by_necessity'>;

const rate = (r: { regretted: number; reviewed: number }) => (r.reviewed > 0 ? r.regretted / r.reviewed : 0);

/** One-line takeaway: the gap between how a purchase was labelled and how it felt days later. */
function insight(rows: { necessity: Necessity; regretted: number; reviewed: number }[]) {
  const essential = rows.filter((r) => r.necessity === 'NEED' || r.necessity === 'IMPORTANT');
  const essentialRegret = essential.reduce((s, r) => s + r.regretted, 0);
  const essentialReviewed = essential.reduce((s, r) => s + r.reviewed, 0);
  if (essentialReviewed >= 3 && essentialRegret / essentialReviewed >= 0.2) {
    return 'Sebagian yang kamu anggap kebutuhan ternyata disesali. Mungkin label "Butuh" dan "Penting" terlalu longgar.';
  }
  const impulse = rows.find((r) => r.necessity === 'IMPULSE');
  if (impulse && impulse.reviewed >= 3 && rate(impulse) < 0.3) {
    return 'Belanja impulsifmu jarang disesali. Mungkin sebagian sebenarnya terencana, atau memang layak.';
  }
  const worst = [...rows].filter((r) => r.reviewed >= 2).sort((a, b) => rate(b) - rate(a))[0];
  if (worst && rate(worst) >= 0.5) {
    return `Setengah atau lebih pengeluaran "${NECESSITY[worst.necessity].label}" kamu sesali. Itu yang paling layak diberi jeda.`;
  }
  return null;
}

/** Regret rate per necessity tag, from weekly reflections. */
export function RegretInsight({ rows }: { rows: RegretRow[] }) {
  const byTag = new Map(rows.map((r) => [r.necessity, r]));
  const data = NECESSITY_ORDER.map((n) => ({
    necessity: n,
    regretted: byTag.get(n)?.regretted ?? 0,
    reviewed: byTag.get(n)?.reviewed ?? 0,
    amount: byTag.get(n)?.regretted_amount ?? 0,
  })).filter((r) => r.reviewed > 0);

  if (data.length === 0) return null;

  const totalRegretted = data.reduce((s, r) => s + r.amount, 0);
  const takeaway = insight(data);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {data.map((r) => (
        <View key={r.necessity} style={styles.item}>
          <View style={styles.row}>
            <ThemedText type="small">{NECESSITY[r.necessity].label}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {r.regretted} dari {r.reviewed} disesali ({Math.round(rate(r) * 100)}%)
            </ThemedText>
          </View>
          <ProgressBar total={r.reviewed} height={6} segments={[{ value: r.regretted, color: NECESSITY[r.necessity].color }]} />
        </View>
      ))}
      {totalRegretted > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Total yang disesali: {formatMoney(totalRegretted)}
        </ThemedText>
      )}
      {takeaway && <ThemedText type="small">{takeaway}</ThemedText>}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  item: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
