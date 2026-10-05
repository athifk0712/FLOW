import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/app-symbol';
import { MonthCalendar } from '@/components/month-calendar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TransactionItem } from '@/components/transaction-item';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type DayTotals, monthKey, type MoneyRow, sameDay, shortAmount, sumTotals, totalsByDay, totalsByMonth } from '@/lib/calendar';
import { formatMoney, getCurrency } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { TRANSACTION_SELECT, type TransactionRow } from '@/lib/transactions';

type CalendarView = 'month' | 'year';

const dayTitle = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
const monthShort = new Intl.DateTimeFormat('id-ID', { month: 'short' });

// Kalender: money in and out per day (or per month in the year view), tinted green when more came in than went
// out and red the other way round. Tap a day to see its transactions.
export default function CalendarScreen() {
  const theme = useTheme();
  const [view, setView] = useState<CalendarView>('month');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [rows, setRows] = useState<MoneyRow[] | null>(null);
  const [selected, setSelected] = useState<Date | null>(null);
  const [dayRows, setDayRows] = useState<TransactionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const range =
    view === 'month'
      ? { from: month, to: new Date(month.getFullYear(), month.getMonth() + 1, 1) }
      : { from: new Date(year, 0, 1), to: new Date(year + 1, 0, 1) };

  const fromMs = range.from.getTime();
  const toMs = range.to.getTime();
  useFocusEffect(
    useCallback(() => {
      let live = true;
      supabase
        .from('transactions')
        .select('type, amount, occurred_at')
        .gte('occurred_at', new Date(fromMs).toISOString())
        .lt('occurred_at', new Date(toMs).toISOString())
        .neq('type', 'TRANSFER')
        .then(({ data, error }) => {
          if (!live) return;
          setError(error?.message ?? null);
          setRows(data ?? []);
        });
      return () => {
        live = false;
      };
    }, [fromMs, toMs]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!selected) return setDayRows(null);
      let live = true;
      const start = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate());
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
      setDayRows(null);
      supabase
        .from('transactions')
        .select(TRANSACTION_SELECT)
        .gte('occurred_at', start.toISOString())
        .lt('occurred_at', end.toISOString())
        .order('occurred_at', { ascending: false })
        .then(({ data }) => live && setDayRows((data as TransactionRow[] | null) ?? []));
      return () => {
        live = false;
      };
    }, [selected]),
  );

  const byDay = rows ? totalsByDay(rows) : new Map<string, DayTotals>();
  const byMonth = rows ? totalsByMonth(rows) : new Map<string, DayTotals>();
  const totals = sumTotals(view === 'month' ? byDay : byMonth);
  const net = totals.in - totals.out;

  function changeView(next: CalendarView) {
    setView(next);
    setSelected(null);
    if (next === 'year') setYear(month.getFullYear());
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="subtitle">Kalender</ThemedText>

          <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
            {(
              [
                { value: 'month', label: 'Bulan' },
                { value: 'year', label: 'Tahun' },
              ] as const
            ).map((o) => {
              const on = view === o.value;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => changeView(o.value)}
                  style={[styles.segmentItem, on && { backgroundColor: theme.primary }]}>
                  <ThemedText type="smallBold" style={{ color: on ? theme.onPrimary : theme.textSecondary }}>
                    {o.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.cards}>
            <ThemedView type="backgroundElement" style={styles.stat}>
              <ThemedText type="small" themeColor="textSecondary">
                Selisih
              </ThemedText>
              <ThemedText style={[styles.statValue, { color: net >= 0 ? theme.positive : theme.danger }]} numberOfLines={1} adjustsFontSizeToFit>
                {net < 0 ? '−' : '+'}
                {formatMoney(Math.abs(net))}
              </ThemedText>
            </ThemedView>
            <ThemedView type="backgroundElement" style={styles.stat}>
              <ThemedText type="small" themeColor="textSecondary">
                Masuk · Keluar
              </ThemedText>
              <ThemedText type="smallBold" style={{ color: theme.positive }} numberOfLines={1}>
                +{formatMoney(totals.in)}
              </ThemedText>
              <ThemedText type="smallBold" style={{ color: theme.danger }} numberOfLines={1}>
                −{formatMoney(totals.out)}
              </ThemedText>
            </ThemedView>
          </View>

          {error && <ThemedText themeColor="danger">{error}</ThemedText>}

          <ThemedView type="backgroundElement" style={styles.panel}>
            {rows === null ? (
              <ActivityIndicator style={styles.loading} />
            ) : view === 'month' ? (
              <MonthCalendar
                month={month}
                onMonthChange={(m) => {
                  setMonth(m);
                  setSelected(null);
                }}
                totals={byDay}
                selected={selected}
                onSelect={(d) => setSelected(selected && sameDay(selected, d) ? null : d)}
              />
            ) : (
              <YearGrid
                year={year}
                onYearChange={setYear}
                totals={byMonth}
                onPick={(m) => {
                  setMonth(m);
                  setView('month');
                }}
              />
            )}
          </ThemedView>

          {selected && (
            <View style={styles.day}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {dayTitle.format(selected).toUpperCase()}
              </ThemedText>
              {dayRows === null ? (
                <ActivityIndicator />
              ) : dayRows.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Tidak ada transaksi di hari ini.
                </ThemedText>
              ) : (
                dayRows.map((t) => <TransactionItem key={t.id} item={t} />)
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** Twelve month tiles with the month's net; tap one to open it in the month view. */
function YearGrid({
  year,
  onYearChange,
  totals,
  onPick,
}: {
  year: number;
  onYearChange: (year: number) => void;
  totals: Map<string, DayTotals>;
  onPick: (month: Date) => void;
}) {
  const theme = useTheme();
  const decimals = getCurrency().decimals;
  const thisYear = new Date().getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));
  return (
    <View style={styles.year}>
      <View style={styles.yearHeader}>
        <Pressable onPress={() => onYearChange(year - 1)} hitSlop={12} accessibilityLabel="Tahun sebelumnya">
          <AppSymbol material="chevron_left" sf="chevron.left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold" style={styles.yearTitle}>
          {year}
        </ThemedText>
        <Pressable
          onPress={() => onYearChange(year + 1)}
          disabled={year >= thisYear}
          hitSlop={12}
          style={year >= thisYear && styles.disabled}
          accessibilityLabel="Tahun berikutnya">
          <AppSymbol material="chevron_right" sf="chevron.right" size={24} color={theme.text} />
        </Pressable>
      </View>
      <View style={styles.monthGrid}>
        {months.map((m) => {
          const t = totals.get(monthKey(m));
          const net = t ? t.in - t.out : 0;
          return (
            <Pressable
              key={m.getMonth()}
              onPress={() => onPick(m)}
              style={({ pressed }) => [
                styles.monthTile,
                { backgroundColor: !t ? theme.background : net >= 0 ? theme.positiveSoft : theme.negativeSoft },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="small">{monthShort.format(m)}</ThemedText>
              <ThemedText type="smallBold" style={{ color: !t ? theme.textSecondary : net >= 0 ? theme.positive : theme.danger }}>
                {t ? shortAmount(net / 10 ** decimals) : '—'}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
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
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  segment: {
    flexDirection: 'row',
    padding: Spacing.one,
    borderRadius: Spacing.three,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two + Spacing.one,
  },
  cards: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    gap: Spacing.half,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  statValue: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: 700,
  },
  panel: {
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  loading: {
    paddingVertical: Spacing.six,
  },
  day: {
    gap: Spacing.two,
  },
  year: {
    gap: Spacing.three,
  },
  yearHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  yearTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  monthTile: {
    width: '31%',
    flexGrow: 1,
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  disabled: {
    opacity: 0.3,
  },
  pressed: {
    opacity: 0.7,
  },
});
