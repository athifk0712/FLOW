import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryIcon } from '@/components/category-icon';
import { Donut } from '@/components/charts/donut';
import { FlowBars } from '@/components/charts/flow-bars';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useChartColors } from '@/constants/chart-colors';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useCycleDay } from '@/hooks/use-cycle-day';
import { useTheme } from '@/hooks/use-theme';
import { assignSlots, type ChartTransaction, type Kind, monthlyFlow, monthSlices } from '@/lib/charts';
import { cycleLabel, cycleRange } from '@/lib/cycle';
import { formatMoney } from '@/lib/money';
import { supabase } from '@/lib/supabase';

// How far back the tab can go. Colors are assigned over this whole window, so they hold between months.
const WINDOW = 12;
// Bars shown at once: the selected month and the five before it.
const BARS = 6;

const shortMonth = new Intl.DateTimeFormat('id-ID', { month: 'short' });
const shortDay = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });

const KINDS: { value: Kind; label: string }[] = [
  { value: 'EXPENSE', label: 'Pengeluaran' },
  { value: 'INCOME', label: 'Pemasukan' },
];

// "Catatan keuangan": one month as a donut by category with the list beneath it, and six months of
// money in vs out as bars. Tapping a bar picks that month for the donut too.
export default function ChartsScreen() {
  const theme = useTheme();
  const colors = useChartColors();
  const { day } = useCycleDay();
  const now = useMemo(() => new Date(), []);
  const [offset, setOffset] = useState(0); // 0 = this cycle, -1 = the one before, ...
  const [kind, setKind] = useState<Kind>('EXPENSE');
  const [selected, setSelected] = useState<string | null>(null);
  const [rows, setRows] = useState<ChartTransaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      supabase
        .from('transactions')
        .select('type, amount, occurred_at, category_id, categories(name, icon)')
        .in('type', ['INCOME', 'EXPENSE'])
        .gte('occurred_at', cycleRange(now, day, -(WINDOW - 1)).start.toISOString())
        .lt('occurred_at', cycleRange(now, day, 0).end.toISOString())
        .then(({ data, error }) => {
          if (!active) return;
          if (error) return setError(error.message);
          setError(null);
          setRows(data ?? []);
        });
      return () => {
        active = false;
      };
    }, [now, day]),
  );

  const range = cycleRange(now, day, offset);
  const slots = useMemo(() => assignSlots(rows ?? [], kind), [rows, kind]);
  const month = useMemo(() => {
    const { start, end } = cycleRange(now, day, offset);
    return monthSlices(rows ?? [], kind, start, end, slots);
  }, [rows, kind, slots, now, day, offset]);

  // Bars: the selected month and the ones before it, keeping it near the right edge.
  const lastBar = Math.min(0, offset + 2);
  const firstBar = Math.max(lastBar - (BARS - 1), -(WINDOW - 1));
  const barOffsets = Array.from({ length: lastBar - firstBar + 1 }, (_, i) => firstBar + i);
  const flows = useMemo(() => {
    const starts = Array.from({ length: lastBar - firstBar + 1 }, (_, i) => cycleRange(now, day, firstBar + i).start);
    return monthlyFlow(rows ?? [], starts, cycleRange(now, day, lastBar).end);
  }, [rows, now, day, firstBar, lastBar]);
  const barLabels = flows.map((f) => (day === 1 ? shortMonth : shortDay).format(f.start));
  const current = flows[barOffsets.indexOf(offset)];

  function goTo(next: number) {
    setSelected(null);
    setOffset(Math.min(0, Math.max(-(WINDOW - 1), next)));
  }

  const net = current ? current.income - current.expense : 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            DIAGRAM
          </ThemedText>

          <View style={styles.monthRow}>
            <Pressable onPress={() => goTo(offset - 1)} disabled={offset <= -(WINDOW - 1)} hitSlop={12}>
              <ThemedText type="subtitle" themeColor={offset <= -(WINDOW - 1) ? 'backgroundSelected' : 'text'}>
                ‹
              </ThemedText>
            </Pressable>
            <ThemedText type="smallBold">{cycleLabel(range.start, day)}</ThemedText>
            <Pressable onPress={() => goTo(offset + 1)} disabled={offset >= 0} hitSlop={12}>
              <ThemedText type="subtitle" themeColor={offset >= 0 ? 'backgroundSelected' : 'text'}>
                ›
              </ThemedText>
            </Pressable>
          </View>

          {error && <ThemedText themeColor="danger">{error}</ThemedText>}
          {rows === null && !error && <ActivityIndicator />}

          {rows !== null && (
            <>
              <View style={styles.tiles}>
                <Tile label="Masuk" value={formatMoney(current?.income ?? 0)} color={colors.income} />
                <Tile label="Keluar" value={formatMoney(current?.expense ?? 0)} color={colors.expense} />
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                {net >= 0 ? 'Sisa bulan ini ' : 'Lebih besar pasak daripada tiang: '}
                <ThemedText type="smallBold" themeColor={net >= 0 ? 'text' : 'danger'}>
                  {formatMoney(net)}
                </ThemedText>
              </ThemedText>

              <ThemedView type="backgroundElement" style={styles.card}>
                <View style={[styles.segment, { backgroundColor: theme.backgroundSelected }]}>
                  {KINDS.map((k) => (
                    <Pressable
                      key={k.value}
                      onPress={() => {
                        setKind(k.value);
                        setSelected(null);
                      }}
                      style={[styles.segmentItem, k.value === kind && { backgroundColor: theme.primary }]}>
                      <ThemedText type="smallBold" style={{ color: k.value === kind ? theme.onPrimary : theme.text }}>
                        {k.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.donut}>
                  <Donut
                    slices={month.slices}
                    total={month.total}
                    label={kind === 'EXPENSE' ? 'Total keluar' : 'Total masuk'}
                    selected={selected}
                    onSelect={setSelected}
                  />
                </View>

                {month.total === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                    Belum ada {kind === 'EXPENSE' ? 'pengeluaran' : 'pemasukan'} di periode ini.
                  </ThemedText>
                ) : (
                  <View>
                    {month.slices.map((s) => {
                      const isSelected = s.key === selected;
                      return (
                        <Pressable
                          key={s.key}
                          onPress={() => setSelected(isSelected ? null : s.key)}
                          style={({ pressed }) => [
                            styles.legendRow,
                            isSelected && { backgroundColor: theme.backgroundSelected },
                            pressed && styles.pressed,
                          ]}>
                          <View style={[styles.swatch, { backgroundColor: colors.slot(s.slot) }]} />
                          <CategoryIcon icon={s.icon} size={32} />
                          <View style={styles.flex}>
                            <ThemedText type="smallBold" numberOfLines={1}>
                              {s.name}
                            </ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              {Math.round(s.share * 100)}%
                            </ThemedText>
                          </View>
                          <ThemedText type="smallBold">{formatMoney(s.total)}</ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </ThemedView>

              <ThemedView type="backgroundElement" style={styles.card}>
                <View style={styles.cardHead}>
                  <ThemedText type="smallBold">Arus kas</ThemedText>
                  <View style={styles.legend}>
                    <LegendKey color={colors.income} label="Masuk" />
                    <LegendKey color={colors.expense} label="Keluar" />
                  </View>
                </View>
                <FlowBars
                  flows={flows}
                  labels={barLabels}
                  selected={barOffsets.indexOf(offset)}
                  onSelect={(i) => goTo(barOffsets[i])}
                />
                <ThemedText type="small" themeColor="textSecondary">
                  Ketuk satu bulan untuk melihat rinciannya di atas.
                </ThemedText>
              </ThemedView>

              <Pressable
                onPress={() => router.push('/report')}
                style={({ pressed }) => [styles.link, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
                <ThemedText type="smallBold">Laporan bulanan lengkap</ThemedText>
                <ThemedText type="smallBold" style={{ color: theme.primary }}>
                  →
                </ThemedText>
              </Pressable>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Tile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.tile}>
      <LegendKey color={color} label={label} />
      <ThemedText type="smallBold" style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
    </ThemedView>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendKey}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  content: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
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
    fontSize: 18,
    lineHeight: 24,
  },
  center: {
    textAlign: 'center',
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  segment: {
    flexDirection: 'row',
    padding: Spacing.half,
    borderRadius: Spacing.three,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three - 2,
  },
  donut: {
    alignItems: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  legend: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  legendKey: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  flex: {
    flex: 1,
  },
  link: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
