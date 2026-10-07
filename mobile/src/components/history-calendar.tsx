import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { AppSymbol } from '@/components/app-symbol';
import { MonthCalendar } from '@/components/month-calendar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TransactionItem } from '@/components/transaction-item';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addMonths, dateKey, type DayTotals, type MoneyRow, sameDay, sumTotals, totalsByDay } from '@/lib/calendar';
import { formatMoney } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { TRANSACTION_SELECT, type TransactionRow } from '@/lib/transactions';

const dayTitle = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const monthShort = new Intl.DateTimeFormat('id-ID', { month: 'short' });

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Riwayat's calendar mode: a month with each day's spending (and a green dot for income), the picked day's totals,
 * and that day's transactions. Tap a transaction to edit or delete it.
 */
export function HistoryCalendar({ header }: { header: React.ReactElement }) {
  const theme = useTheme();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [pickingMonth, setPickingMonth] = useState(false);
  const [rows, setRows] = useState<MoneyRow[] | null>(null);
  const [dayRows, setDayRows] = useState<TransactionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const monthMs = month.getTime();
  useFocusEffect(
    useCallback(() => {
      let live = true;
      const from = new Date(monthMs);
      supabase
        .from('transactions')
        .select('type, amount, occurred_at')
        .gte('occurred_at', from.toISOString())
        .lt('occurred_at', addMonths(from, 1).toISOString())
        .neq('type', 'TRANSFER')
        .then(({ data, error }) => {
          if (!live) return;
          setError(error?.message ?? null);
          setRows(data ?? []);
        });
      return () => {
        live = false;
      };
    }, [monthMs]),
  );

  const dayMs = selected.getTime();
  useFocusEffect(
    useCallback(() => {
      let live = true;
      const start = new Date(dayMs);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
      setDayRows(null);
      supabase
        .from('transactions')
        .select(TRANSACTION_SELECT)
        .gte('occurred_at', start.toISOString())
        .lt('occurred_at', end.toISOString())
        .order('occurred_at', { ascending: false })
        .overrideTypes<TransactionRow[], { merge: false }>()
        .then(({ data, error }) => {
          if (!live) return;
          if (error) setError(error.message);
          setDayRows(data ?? []);
        });
      return () => {
        live = false;
      };
    }, [dayMs]),
  );

  // Opening another month picks its first day, or today when it is this month.
  function openMonth(next: Date) {
    const today = new Date();
    const m = startOfMonth(next);
    setMonth(m);
    setSelected(m.getFullYear() === today.getFullYear() && m.getMonth() === today.getMonth() ? startOfDay(today) : m);
    setPickingMonth(false);
  }

  const byDay = rows ? totalsByDay(rows) : new Map<string, DayTotals>();
  const day = byDay.get(dateKey(selected)) ?? { in: 0, out: 0 };
  const monthTotals = sumTotals(byDay);
  const isToday = sameDay(selected, new Date());
  const canGoNext = addMonths(month, 1) <= new Date();

  const listHeader = (
    <View style={styles.header}>
      {header}

      <View style={styles.toolbar}>
        <Pressable
          onPress={() => openMonth(addMonths(month, -1))}
          hitSlop={8}
          style={styles.arrow}
          accessibilityLabel="Bulan sebelumnya"
        >
          <AppSymbol material="chevron_left" sf="chevron.left" size={24} color={theme.text} />
        </Pressable>
        <Pressable
          onPress={() => setPickingMonth((p) => !p)}
          style={[styles.monthButton, { backgroundColor: theme.backgroundElement }]}
          accessibilityLabel="Pilih bulan dan tahun"
        >
          <ThemedText type="smallBold">
            {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(month)}
          </ThemedText>
          <AppSymbol
            material={pickingMonth ? 'expand_less' : 'expand_more'}
            sf={pickingMonth ? 'chevron.up' : 'chevron.down'}
            size={18}
            color={theme.textSecondary}
          />
        </Pressable>
        <Pressable
          onPress={() => openMonth(addMonths(month, 1))}
          disabled={!canGoNext}
          hitSlop={8}
          style={[styles.arrow, !canGoNext && styles.disabled]}
          accessibilityLabel="Bulan berikutnya"
        >
          <AppSymbol material="chevron_right" sf="chevron.right" size={24} color={theme.text} />
        </Pressable>
        <Pressable
          onPress={() => openMonth(new Date())}
          disabled={isToday}
          style={[styles.todayButton, { borderColor: theme.primary }, isToday && styles.disabled]}
        >
          <ThemedText type="smallBold" style={{ color: theme.primary }}>
            Hari ini
          </ThemedText>
        </Pressable>
      </View>

      {error && <ThemedText themeColor="danger">{error}</ThemedText>}

      <ThemedView type="backgroundElement" style={styles.panel}>
        {pickingMonth ? (
          <MonthPicker month={month} onPick={openMonth} />
        ) : rows === null ? (
          <ActivityIndicator style={styles.loading} />
        ) : (
          <MonthCalendar
            month={month}
            onMonthChange={openMonth}
            showHeader={false}
            totals={byDay}
            selected={selected}
            onSelect={(d) => setSelected(startOfDay(d))}
          />
        )}
        {!pickingMonth && rows !== null && (monthTotals.in > 0 || monthTotals.out > 0) && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.monthLine}>
            Bulan ini:{' '}
            <ThemedText type="small" style={{ color: theme.positive }}>
              +{formatMoney(monthTotals.in)}
            </ThemedText>
            {'  ·  '}
            <ThemedText type="small" style={{ color: theme.danger }}>
              −{formatMoney(monthTotals.out)}
            </ThemedText>
          </ThemedText>
        )}
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.summary}>
        <ThemedText type="smallBold">{dayTitle.format(selected)}</ThemedText>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCell, { backgroundColor: theme.positiveSoft }]}>
            <ThemedText type="small" themeColor="textSecondary">
              Pemasukan
            </ThemedText>
            <ThemedText type="smallBold" style={{ color: theme.positive }} numberOfLines={1}>
              {formatMoney(day.in)}
            </ThemedText>
          </View>
          <View style={[styles.summaryCell, { backgroundColor: theme.negativeSoft }]}>
            <ThemedText type="small" themeColor="textSecondary">
              Pengeluaran
            </ThemedText>
            <ThemedText type="smallBold" style={{ color: theme.danger }} numberOfLines={1}>
              {formatMoney(day.out)}
            </ThemedText>
          </View>
        </View>
      </ThemedView>
    </View>
  );

  return (
    <FlatList
      data={dayRows ?? []}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <TransactionItem item={item} />}
      ListHeaderComponent={listHeader}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        dayRows === null ? (
          <ActivityIndicator style={styles.loading} />
        ) : (
          <View style={styles.empty}>
            <AppSymbol material="event_available" sf="calendar.badge.checkmark" size={36} color={theme.textSecondary} />
            <ThemedText type="smallBold">Tidak ada transaksi di hari ini</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
              {isToday
                ? 'Belum ada yang dicatat hari ini. Tekan "+ Catat" kalau ada uang keluar atau masuk.'
                : 'Hari yang tenang untuk dompetmu.'}
            </ThemedText>
          </View>
        )
      }
    />
  );
}

/** Year arrows and twelve months; picking one opens it. */
function MonthPicker({ month, onPick }: { month: Date; onPick: (month: Date) => void }) {
  const theme = useTheme();
  const [year, setYear] = useState(month.getFullYear());
  const thisYear = new Date().getFullYear();
  return (
    <View style={styles.picker}>
      <View style={styles.yearHeader}>
        <Pressable onPress={() => setYear(year - 1)} hitSlop={12} accessibilityLabel="Tahun sebelumnya">
          <AppSymbol material="chevron_left" sf="chevron.left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold" style={styles.yearTitle}>
          {year}
        </ThemedText>
        <Pressable
          onPress={() => setYear(year + 1)}
          disabled={year >= thisYear}
          hitSlop={12}
          style={year >= thisYear && styles.disabled}
          accessibilityLabel="Tahun berikutnya"
        >
          <AppSymbol material="chevron_right" sf="chevron.right" size={24} color={theme.text} />
        </Pressable>
      </View>
      <View style={styles.monthGrid}>
        {Array.from({ length: 12 }, (_, i) => new Date(year, i, 1)).map((m) => {
          const on = m.getTime() === month.getTime();
          const future = m > new Date();
          return (
            <Pressable
              key={m.getMonth()}
              onPress={() => onPick(m)}
              disabled={future}
              style={({ pressed }) => [
                styles.monthTile,
                { backgroundColor: on ? theme.primary : theme.background },
                future && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText type="smallBold" style={{ color: on ? theme.onPrimary : theme.text }}>
                {monthShort.format(m)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  header: {
    gap: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  monthButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  arrow: {
    padding: Spacing.one,
  },
  todayButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
  },
  panel: {
    padding: Spacing.three,
    borderRadius: Spacing.four,
    gap: Spacing.two,
  },
  monthLine: {
    textAlign: 'center',
  },
  loading: {
    paddingVertical: Spacing.five,
  },
  summary: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  summaryCell: {
    flex: 1,
    gap: Spacing.half,
    padding: Spacing.two + Spacing.one,
    borderRadius: Spacing.two + Spacing.one,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
  emptyText: {
    textAlign: 'center',
  },
  picker: {
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
    width: '22%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.7,
  },
});
