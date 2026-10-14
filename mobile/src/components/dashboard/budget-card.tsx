import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { NECESSITY } from '@/constants/necessity';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Tables } from '@/lib/database.types';
import { formatMoney } from '@/lib/money';

type Budget = Tables<'v_budget_remaining'>;

const SCOPE_LABEL = {
  DISCRETIONARY: 'Ingin & Impulsif',
  ESSENTIAL: 'Butuh & Penting',
  CATEGORY: 'Kategori',
} as const;

const SCOPE_COLOR = {
  DISCRETIONARY: NECESSITY.WANT.color,
  ESSENTIAL: NECESSITY.NEED.color,
  CATEGORY: NECESSITY.IMPORTANT.color,
} as const;

const PERIOD_LABEL = { WEEKLY: 'minggu ini', MONTHLY: 'bulan ini' } as const;

/** Current budgets. Discretionary first: it is the one the app is really about.
 * Category budgets follow, the closest to their limit first. With `limit`, only that many are shown (Beranda) and
 * the full list is one tap away. Going over is shown in honey, not red: information, not a telling-off. */
export function BudgetCard({
  budgets,
  categoryNames,
  limit,
}: {
  budgets: Budget[];
  categoryNames: Map<string, string>;
  limit?: number;
}) {
  const theme = useTheme();
  const weekly = budgets
    .filter((b) => b.period === 'WEEKLY' && b.scope !== 'CATEGORY')
    .sort((a, b) => Number(a.scope !== 'DISCRETIONARY') - Number(b.scope !== 'DISCRETIONARY'));
  const usedShare = (b: Budget) => (b.spent ?? 0) / (b.limit_amount || 1);
  const perCategory = budgets.filter((b) => b.scope === 'CATEGORY').sort((a, b) => usedShare(b) - usedShare(a));

  if (weekly.length === 0 && perCategory.length === 0) {
    return (
      <Link href="/settings" asChild>
        <Pressable>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Belum ada budget mingguan</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Atur budget keinginan dan kebutuhan supaya kamu tahu kapan perlu mengerem. Atur →
            </ThemedText>
          </ThemedView>
        </Pressable>
      </Link>
    );
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {[...weekly, ...perCategory].slice(0, limit).map((b) => {
        const cap = b.limit_amount ?? 0;
        const spent = b.spent ?? 0;
        const remaining = b.remaining ?? 0;
        const over = remaining < 0;
        const scope = b.scope ?? 'DISCRETIONARY';
        const label =
          scope === 'CATEGORY' ? (categoryNames.get(b.category_id ?? '') ?? SCOPE_LABEL.CATEGORY) : SCOPE_LABEL[scope];
        const period = PERIOD_LABEL[b.period ?? 'WEEKLY'];
        return (
          <View key={b.budget_id} style={styles.budget}>
            <View style={styles.row}>
              <ThemedText type="smallBold">{label}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatMoney(spent)} / {formatMoney(cap)}
              </ThemedText>
            </View>
            <ProgressBar total={cap} segments={[{ value: spent, color: over ? theme.accent : SCOPE_COLOR[scope] }]} />
            <ThemedText type="small" themeColor="textSecondary">
              {over ? `Terpakai ${formatMoney(-remaining)} lebih dari batas ${period}` : `Sisa ${formatMoney(remaining)} ${period}`}
            </ThemedText>
            {!limit && (b.unreviewed_amount ?? 0) > 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                + {formatMoney(b.unreviewed_amount ?? 0)} belum dinilai, belum dihitung di sini
              </ThemedText>
            )}
          </View>
        );
      })}
      {limit !== undefined && (
        <Link href="/budgets" asChild>
          <Pressable hitSlop={8}>
            <ThemedText type="small" themeColor="primary">
              {weekly.length + perCategory.length > limit ? `Lihat semua ${weekly.length + perCategory.length} anggaran →` : 'Kelola anggaran →'}
            </ThemedText>
          </Pressable>
        </Link>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  budget: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
