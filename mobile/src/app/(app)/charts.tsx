import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/app-symbol';
import { CategoryRows } from '@/components/charts/category-rows';
import { Donut } from '@/components/charts/donut';
import { FlowBars } from '@/components/charts/flow-bars';
import { ReflectionSection } from '@/components/dashboard/reflection-section';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useChartColors } from '@/constants/chart-colors';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useCycleDay } from '@/hooks/use-cycle-day';
import { useTheme } from '@/hooks/use-theme';
import { CHART_WINDOW, useChartRows } from '@/lib/chart-data';
import { assignSlots, type Kind, monthInsights, monthlyFlow, monthSlices } from '@/lib/charts';
import { cycleLabel, cycleRange } from '@/lib/cycle';
import { formatMoney } from '@/lib/money';

// Bars shown at once: the selected month and the five before it.
const BARS = 6;
// How far the first card reaches up into the band.
const BAND_OVERLAP = 28;

const shortMonth = new Intl.DateTimeFormat('id-ID', { month: 'short' });
const shortDay = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });

const KINDS: { value: Kind; label: string }[] = [
  { value: 'EXPENSE', label: 'Pengeluaran' },
  { value: 'INCOME', label: 'Pemasukan' },
];

// A month at a glance, like a bank's money summary: what is left with money in and out on the band, a few plain lines
// about it, where the money went, and six months side by side. Tapping a bar picks that month for everything above.
export default function ChartsScreen() {
  const theme = useTheme();
  const colors = useChartColors();
  const insets = useSafeAreaInsets();
  const { day } = useCycleDay();
  const now = useMemo(() => new Date(), []);
  const [offset, setOffset] = useState(0); // 0 = this cycle, -1 = the one before, ...
  const [kind, setKind] = useState<Kind>('EXPENSE');
  const [selected, setSelected] = useState<string | null>(null);
  const { rows, error } = useChartRows(now, day);

  const range = cycleRange(now, day, offset);
  const slots = useMemo(() => assignSlots(rows ?? [], kind), [rows, kind]);
  const month = useMemo(() => {
    const { start, end } = cycleRange(now, day, offset);
    return monthSlices(rows ?? [], kind, start, end, slots);
  }, [rows, kind, slots, now, day, offset]);
  const topExpense = useMemo(() => {
    const { start, end } = cycleRange(now, day, offset);
    return monthSlices(rows ?? [], 'EXPENSE', start, end, assignSlots(rows ?? [], 'EXPENSE')).slices[0] ?? null;
  }, [rows, now, day, offset]);

  // Bars: the selected month and the ones before it, keeping it near the right edge.
  const lastBar = Math.min(0, offset + 2);
  const firstBar = Math.max(lastBar - (BARS - 1), -(CHART_WINDOW - 1));
  const barOffsets = Array.from({ length: lastBar - firstBar + 1 }, (_, i) => firstBar + i);
  const flows = useMemo(() => {
    const starts = Array.from({ length: lastBar - firstBar + 1 }, (_, i) => cycleRange(now, day, firstBar + i).start);
    return monthlyFlow(rows ?? [], starts, cycleRange(now, day, lastBar).end);
  }, [rows, now, day, firstBar, lastBar]);
  const barLabels = flows.map((f) => (day === 1 ? shortMonth : shortDay).format(f.start));
  const index = barOffsets.indexOf(offset);
  const current = flows[index];
  const previous = flows[index - 1];

  function goTo(next: number) {
    setSelected(null);
    setOffset(Math.min(0, Math.max(-(CHART_WINDOW - 1), next)));
  }

  const income = current?.income ?? 0;
  const expense = current?.expense ?? 0;
  const net = income - expense;
  const insights = monthInsights({ income, expense, previousExpense: previous?.expense ?? null, top: topExpense });
  const onBand = { color: theme.onPrimary };
  const atOldest = offset <= -(CHART_WINDOW - 1);
  const atNewest = offset >= 0;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.band, { backgroundColor: theme.primary, paddingTop: insets.top + Spacing.three }]}>
          <View style={[styles.bubble, styles.bubbleOne, { backgroundColor: theme.accent }]} />
          <View style={[styles.bubble, styles.bubbleTwo, { backgroundColor: theme.onPrimary }]} />
          <View style={styles.bandInner}>
            <View style={styles.bandHead}>
              <ThemedText type="subtitle" style={[onBand, styles.bandTitle]}>
                Diagram
              </ThemedText>
              <Pressable
                onPress={() => router.push({ pathname: '/share-summary', params: { offset: String(offset) } })}
                accessibilityRole="button"
                accessibilityLabel="Bagikan rekap ke status"
                style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}>
                <AppSymbol material="ios_share" sf="square.and.arrow.up" size={16} color={theme.onPrimary} />
                <ThemedText type="smallBold" style={onBand}>
                  Bagikan
                </ThemedText>
              </Pressable>
            </View>

            <View style={styles.monthRow}>
              <Pressable
                onPress={() => goTo(offset - 1)}
                disabled={atOldest}
                hitSlop={12}
                accessibilityLabel="Periode sebelumnya"
                style={atOldest && styles.faded}>
                <AppSymbol material="chevron_left" sf="chevron.left" size={24} color={theme.onPrimary} />
              </Pressable>
              <ThemedText type="smallBold" style={onBand}>
                {cycleLabel(range.start, day)}
              </ThemedText>
              <Pressable
                onPress={() => goTo(offset + 1)}
                disabled={atNewest}
                hitSlop={12}
                accessibilityLabel="Periode berikutnya"
                style={atNewest && styles.faded}>
                <AppSymbol material="chevron_right" sf="chevron.right" size={24} color={theme.onPrimary} />
              </Pressable>
            </View>

            <View style={styles.hero}>
              <ThemedText type="small" style={onBand}>
                {net >= 0 ? 'Sisa periode ini' : 'Lebih dari pemasukan'}
              </ThemedText>
              <ThemedText numberOfLines={1} adjustsFontSizeToFit style={[onBand, styles.heroValue]}>
                {formatMoney(net)}
              </ThemedText>
            </View>

            <View style={styles.stats}>
              <Stat label="Masuk" value={formatMoney(income)} material="south_west" sf="arrow.down.left" />
              <View style={[styles.statDivider, { backgroundColor: theme.onPrimary }]} />
              <Stat label="Keluar" value={formatMoney(expense)} material="north_east" sf="arrow.up.right" />
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {error && <ThemedText themeColor="danger">{error}</ThemedText>}
          {rows === null && !error && <ActivityIndicator style={styles.loading} />}

          {rows !== null && (
            <>
              {insights.length > 0 && (
                <ThemedView type="backgroundElement" style={styles.card}>
                  {insights.map((line) => (
                    <View key={line} style={styles.insight}>
                      <View style={[styles.insightDot, { backgroundColor: theme.accent }]} />
                      <ThemedText type="small" style={styles.flex}>
                        {line}
                      </ThemedText>
                    </View>
                  ))}
                </ThemedView>
              )}

              <ThemedView type="backgroundElement" style={styles.card}>
                <View style={[styles.segment, { backgroundColor: theme.backgroundSelected }]}>
                  {KINDS.map((k) => (
                    <Pressable
                      key={k.value}
                      onPress={() => {
                        setKind(k.value);
                        setSelected(null);
                      }}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: k.value === kind }}
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
                    size={210}
                  />
                </View>

                {month.total === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                    Belum ada {kind === 'EXPENSE' ? 'pengeluaran' : 'pemasukan'} di periode ini.
                  </ThemedText>
                ) : (
                  <CategoryRows slices={month.slices} selected={selected} onSelect={setSelected} />
                )}
              </ThemedView>

              <ThemedView type="backgroundElement" style={styles.card}>
                <View style={styles.cardHead}>
                  <ThemedText type="smallBold">Arus kas 6 bulan</ThemedText>
                  <View style={styles.legend}>
                    <LegendKey color={colors.income} label="Masuk" />
                    <LegendKey color={colors.expense} label="Keluar" />
                  </View>
                </View>
                <FlowBars flows={flows} labels={barLabels} selected={index} onSelect={(i) => goTo(barOffsets[i])} />
              </ThemedView>

              <ReflectionSection cycleDay={day} />

              <Pressable
                onPress={() => router.push('/report')}
                style={({ pressed }) => [styles.link, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
                <ThemedText type="smallBold">Laporan bulanan lengkap</ThemedText>
                <AppSymbol material="chevron_right" sf="chevron.right" size={20} color={theme.primary} />
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function Stat({ label, value, material, sf }: { label: string; value: string; material: string; sf: string }) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <View style={styles.statLabel}>
        <AppSymbol material={material} sf={sf} size={14} color={theme.onPrimary} />
        <ThemedText type="small" style={{ color: theme.onPrimary }}>
          {label}
        </ThemedText>
      </View>
      <ThemedText type="smallBold" numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, { color: theme.onPrimary }]}>
        {value}
      </ThemedText>
    </View>
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
  },
  scroll: {
    paddingBottom: BottomTabInset + Spacing.four,
  },
  band: {
    overflow: 'hidden',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: BAND_OVERLAP + Spacing.three,
  },
  bandInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
  },
  bubble: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.14,
  },
  bubbleOne: {
    width: 220,
    height: 220,
    top: -70,
    right: -60,
  },
  bubbleTwo: {
    width: 150,
    height: 150,
    bottom: -60,
    left: -50,
  },
  bandHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bandTitle: {
    fontSize: 24,
    lineHeight: 30,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faded: {
    opacity: 0.3,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  heroValue: {
    fontSize: 42,
    lineHeight: 52,
    fontWeight: 700,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
  },
  statLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  statValue: {
    fontSize: 17,
    lineHeight: 24,
  },
  statDivider: {
    width: 1,
    height: 32,
    opacity: 0.3,
  },
  body: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    marginTop: -BAND_OVERLAP,
  },
  loading: {
    marginTop: BAND_OVERLAP + Spacing.four,
  },
  flex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  insight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  insightDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
  link: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
