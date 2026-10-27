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

export type Budget = Tables<'v_budget_remaining'>;
export type BudgetStatus = 'OVER' | 'NEAR' | 'OK';

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

/** Share of the limit already used; 80% and up counts as "hampir habis". */
export const usedShare = (b: Budget) => (b.spent ?? 0) / (b.limit_amount || 1);
export const NEAR_SHARE = 0.8;

export function budgetStatus(b: Budget): BudgetStatus {
  if ((b.remaining ?? 0) < 0) return 'OVER';
  return usedShare(b) >= NEAR_SHARE ? 'NEAR' : 'OK';
}

/** Discretionary first: it is the one the app is really about. Then the essential weekly budget, then category
 * budgets, the closest to their limit first. */
export function sortBudgets(budgets: Budget[]) {
  const weekly = budgets
    .filter((b) => b.period === 'WEEKLY' && b.scope !== 'CATEGORY')
    .sort((a, b) => Number(a.scope !== 'DISCRETIONARY') - Number(b.scope !== 'DISCRETIONARY'));
  const perCategory = budgets.filter((b) => b.scope === 'CATEGORY').sort((a, b) => usedShare(b) - usedShare(a));
  return [...weekly, ...perCategory];
}

export function budgetLabel(b: Budget, categoryNames: Map<string, string>) {
  const scope = b.scope ?? 'DISCRETIONARY';
  return scope === 'CATEGORY' ? (categoryNames.get(b.category_id ?? '') ?? SCOPE_LABEL.CATEGORY) : SCOPE_LABEL[scope];
}

/** "1 lewat batas · 2 hampir habis", or null when everything is fine. */
export function statusSummary(budgets: Budget[]) {
  const over = budgets.filter((b) => budgetStatus(b) === 'OVER').length;
  const near = budgets.filter((b) => budgetStatus(b) === 'NEAR').length;
  const parts = [over > 0 && `${over} lewat batas`, near > 0 && `${near} hampir habis`].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** One budget: name, spent / limit, bar and what is left. Going over is shown in honey, not red: information, not a
 * telling-off. */
export function BudgetRow({
  budget: b,
  categoryNames,
  detailed,
}: {
  budget: Budget;
  categoryNames: Map<string, string>;
  detailed?: boolean;
}) {
  const theme = useTheme();
  const cap = b.limit_amount ?? 0;
  const spent = b.spent ?? 0;
  const remaining = b.remaining ?? 0;
  const over = remaining < 0;
  const scope = b.scope ?? 'DISCRETIONARY';
  const period = PERIOD_LABEL[b.period ?? 'WEEKLY'];
  return (
    <View style={styles.budget}>
      <View style={styles.row}>
        <ThemedText type="smallBold" style={styles.flex} numberOfLines={1}>
          {budgetLabel(b, categoryNames)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatMoney(spent)} / {formatMoney(cap)}
        </ThemedText>
      </View>
      <ProgressBar total={cap} segments={[{ value: spent, color: over ? theme.accent : SCOPE_COLOR[scope] }]} />
      <View style={styles.row}>
        <ThemedText type="small" themeColor={over ? 'warning' : 'textSecondary'} style={styles.flex}>
          {over ? `Lewat ${formatMoney(-remaining)} dari batas ${period}` : `Sisa ${formatMoney(remaining)} ${period}`}
        </ThemedText>
        {detailed && (
          <ThemedText type="smallBold" themeColor={over ? 'warning' : 'textSecondary'}>
            {Math.round(usedShare(b) * 100)}%
          </ThemedText>
        )}
      </View>
      {detailed && (b.unreviewed_amount ?? 0) > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          + {formatMoney(b.unreviewed_amount ?? 0)} belum dinilai, belum dihitung di sini
        </ThemedText>
      )}
    </View>
  );
}

/** Beranda summary: the first `limit` budgets plus a status line; the full list is one tap away on /budgets. */
export function BudgetCard({
  budgets,
  categoryNames,
  limit,
}: {
  budgets: Budget[];
  categoryNames: Map<string, string>;
  limit: number;
}) {
  const sorted = sortBudgets(budgets);

  if (sorted.length === 0) {
    return (
      <Link href="/weekly-budget" asChild>
        <Pressable>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Belum ada budget</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Atur budget keinginan dan kebutuhan supaya kamu tahu kapan perlu mengerem. Atur →
            </ThemedText>
          </ThemedView>
        </Pressable>
      </Link>
    );
  }

  const summary = statusSummary(sorted);
  return (
    <Link href="/budgets" asChild>
      <Pressable>
        <ThemedView type="backgroundElement" style={styles.card}>
          {summary && (
            <ThemedText type="smallBold" themeColor="warning">
              {summary}
            </ThemedText>
          )}
          {sorted.slice(0, limit).map((b) => (
            <BudgetRow key={b.budget_id} budget={b} categoryNames={categoryNames} />
          ))}
          <ThemedText type="small" themeColor="primary">
            {sorted.length > limit ? `Lihat semua ${sorted.length} anggaran →` : 'Lihat detail anggaran →'}
          </ThemedText>
        </ThemedView>
      </Pressable>
    </Link>
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
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
