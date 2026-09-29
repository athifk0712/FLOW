import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SpendingMix } from '@/components/dashboard/spending-mix';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DANGER_COLOR } from '@/constants/necessity';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatRupiah } from '@/lib/money';
import { closeModal } from '@/lib/navigation';
import { buildReport, monthRange, percentChange, type ReportTransaction } from '@/lib/report';
import { supabase } from '@/lib/supabase';

const monthFormat = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' });
const shortMonthFormat = new Intl.DateTimeFormat('id-ID', { month: 'short' });
const dayFormat = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });

// One month at a glance: income vs expense, where the money went by category, and the biggest purchases.
// Each number is compared with the month before.
export default function ReportScreen() {
  const theme = useTheme();
  const [offset, setOffset] = useState(0); // 0 = this month, -1 = last month, ...
  const [rows, setRows] = useState<ReportTransaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const now = useMemo(() => new Date(), []);
  const { start } = useMemo(() => monthRange(now, offset), [now, offset]);
  const previousLabel = shortMonthFormat.format(monthRange(now, offset - 1).start);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const range = monthRange(now, offset);
      supabase
        .from('transactions')
        .select('id, type, amount, necessity, merchant, occurred_at, category_id, categories(name)')
        .gte('occurred_at', monthRange(now, offset - 1).start.toISOString())
        .lt('occurred_at', range.end.toISOString())
        .then(({ data, error }) => {
          if (!active) return;
          if (error) return setError(error.message);
          setError(null);
          setRows(data ?? []);
        });
      return () => {
        active = false;
      };
    }, [now, offset]),
  );

  const report = useMemo(() => (rows ? buildReport(rows, start) : null), [rows, start]);

  function changeMonth(step: number) {
    setRows(null);
    setOffset((o) => o + step);
  }

  const net = report ? report.income - report.expense : 0;
  const maxCategory = report?.categories[0]?.total ?? 0;
  const empty = report !== null && report.income === 0 && report.expense === 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.header}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            LAPORAN BULANAN
          </ThemedText>
          <Pressable onPress={closeModal} hitSlop={12}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Tutup
            </ThemedText>
          </Pressable>
        </View>

        <ThemedView type="backgroundElement" style={styles.stepper}>
          <Pressable onPress={() => changeMonth(-1)} hitSlop={8} style={styles.arrow}>
            <ThemedText type="smallBold">‹</ThemedText>
          </Pressable>
          <ThemedText type="smallBold" style={styles.month}>
            {monthFormat.format(start)}
          </ThemedText>
          <Pressable
            disabled={offset >= 0}
            onPress={() => changeMonth(1)}
            hitSlop={8}
            style={[styles.arrow, offset >= 0 && styles.disabled]}>
            <ThemedText type="smallBold">›</ThemedText>
          </Pressable>
        </ThemedView>

        {error && <ThemedText style={styles.error}>{error}</ThemedText>}

        {!report ? (
          !error && <ActivityIndicator style={styles.flex} />
        ) : empty ? (
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            Belum ada transaksi di {monthFormat.format(start)}.
          </ThemedText>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.tiles}>
              <StatTile
                label="Pemasukan"
                value={report.income}
                change={percentChange(report.income, report.previousIncome)}
                previousLabel={previousLabel}
              />
              <StatTile
                label="Pengeluaran"
                value={report.expense}
                change={percentChange(report.expense, report.previousExpense)}
                previousLabel={previousLabel}
              />
            </View>
            <ThemedView type="backgroundElement" style={styles.netRow}>
              <ThemedText type="small" themeColor="textSecondary">
                {net >= 0 ? 'Sisa (pemasukan − pengeluaran)' : 'Minus (pengeluaran > pemasukan)'}
              </ThemedText>
              <ThemedText type="smallBold" style={net < 0 && styles.error}>
                {formatRupiah(net)}
              </ThemedText>
            </ThemedView>

            {report.categories.length > 0 && (
              <Section title="PER KATEGORI">
                <ThemedView type="backgroundElement" style={styles.card}>
                  {report.categories.map((c) => {
                    const change = percentChange(c.total, c.previous);
                    const share = Math.round((c.total / report.expense) * 100);
                    return (
                      <View key={c.key} style={styles.category}>
                        <View style={styles.row}>
                          <ThemedText type="smallBold">{c.name}</ThemedText>
                          <ThemedText type="smallBold">{formatRupiah(c.total)}</ThemedText>
                        </View>
                        <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
                          <View
                            style={[
                              styles.bar,
                              { width: `${(c.total / maxCategory) * 100}%`, backgroundColor: theme.text },
                            ]}
                          />
                        </View>
                        <ThemedText type="small" themeColor="textSecondary">
                          {share}% dari pengeluaran{change ? ` · ${change} vs ${previousLabel}` : ''}
                        </ThemedText>
                      </View>
                    );
                  })}
                </ThemedView>
              </Section>
            )}

            {report.expense > 0 && (
              <Section title="BUTUH VS INGIN">
                <SpendingMix rows={report.mix} />
              </Section>
            )}

            {report.biggest.length > 0 && (
              <Section title="PENGELUARAN TERBESAR">
                <ThemedView type="backgroundElement" style={styles.card}>
                  {report.biggest.map((t) => (
                    <Pressable
                      key={t.id}
                      onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: t.id } })}
                      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                      <View style={styles.flex}>
                        <ThemedText numberOfLines={1}>
                          {t.merchant ?? t.categories?.name ?? 'Tanpa kategori'}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {dayFormat.format(new Date(t.occurred_at))}
                        </ThemedText>
                      </View>
                      <ThemedText type="smallBold">{formatRupiah(t.amount)}</ThemedText>
                    </Pressable>
                  ))}
                </ThemedView>
              </Section>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function StatTile({
  label,
  value,
  change,
  previousLabel,
}: {
  label: string;
  value: number;
  change: string | null;
  previousLabel: string;
}) {
  return (
    <ThemedView type="backgroundElement" style={styles.tile}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {formatRupiah(value)}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {change ? `${change} vs ${previousLabel}` : `Tidak ada data ${previousLabel}`}
      </ThemedText>
    </ThemedView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {title}
      </ThemedText>
      {children}
    </View>
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
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.three,
  },
  arrow: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  month: {
    flex: 1,
    textAlign: 'center',
  },
  content: {
    gap: Spacing.four,
    paddingBottom: Spacing.four,
  },
  tiles: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tile: {
    flex: 1,
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  tileValue: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: 700,
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  category: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 4,
  },
  empty: {
    textAlign: 'center',
    paddingTop: Spacing.five,
  },
  disabled: {
    opacity: 0.3,
  },
  pressed: {
    opacity: 0.7,
  },
  error: {
    color: DANGER_COLOR,
  },
});
