import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DANGER_COLOR, NECESSITY, UNREVIEWED_COLOR } from '@/constants/necessity';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Enums } from '@/lib/database.types';
import { formatRupiah } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { TRANSACTION_SELECT, transactionTitle, type TransactionRow } from '@/lib/transactions';

type Filter = 'ALL' | Enums<'transaction_type'>;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'Semua' },
  { value: 'EXPENSE', label: 'Keluar' },
  { value: 'INCOME', label: 'Masuk' },
  { value: 'TRANSFER', label: 'Transfer' },
];

const PAGE_SIZE = 50;

const dayFormat = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' });

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Every transaction, newest first, grouped by local day. Tap one to edit or delete it.
export default function HistoryScreen() {
  const theme = useTheme();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [rows, setRows] = useState<TransactionRow[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ignores responses from a filter the user has already switched away from.
  const requestId = useRef(0);

  const fetchPage = useCallback(async (activeFilter: Filter, offset: number) => {
    let query = supabase
      .from('transactions')
      .select(TRANSACTION_SELECT)
      .order('occurred_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (activeFilter !== 'ALL') query = query.eq('type', activeFilter);
    return query;
  }, []);

  const reload = useCallback(
    (activeFilter: Filter) => {
      const id = ++requestId.current;
      fetchPage(activeFilter, 0).then(({ data, error }) => {
        if (id !== requestId.current) return;
        if (error) return setError(error.message);
        setError(null);
        setRows(data ?? []);
        setHasMore((data?.length ?? 0) === PAGE_SIZE);
      });
    },
    [fetchPage],
  );

  // Refetch on focus so edits and new Quick Log entries show up.
  useFocusEffect(
    useCallback(() => {
      reload(filter);
    }, [reload, filter]),
  );

  async function loadMore() {
    if (!hasMore || loadingMore || !rows) return;
    setLoadingMore(true);
    const id = requestId.current;
    const { data, error } = await fetchPage(filter, rows.length);
    setLoadingMore(false);
    if (id !== requestId.current) return;
    if (error) return setError(error.message);
    setRows([...rows, ...(data ?? [])]);
    setHasMore((data?.length ?? 0) === PAGE_SIZE);
  }

  function changeFilter(next: Filter) {
    if (next === filter) return;
    setFilter(next);
    setRows(null);
  }

  const sections = useMemo(() => {
    const groups: { key: string; title: string; total: number; data: TransactionRow[] }[] = [];
    for (const row of rows ?? []) {
      const key = dayKey(row.occurred_at);
      let group = groups[groups.length - 1];
      if (group?.key !== key) {
        group = { key, title: dayFormat.format(new Date(row.occurred_at)), total: 0, data: [] };
        groups.push(group);
      }
      group.data.push(row);
      if (row.type === 'EXPENSE') group.total += row.amount;
    }
    return groups;
  }, [rows]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.top}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            RIWAYAT
          </ThemedText>
          <View style={styles.filters}>
            {FILTERS.map((f) => {
              const selected = f.value === filter;
              return (
                <Pressable
                  key={f.value}
                  onPress={() => changeFilter(f.value)}
                  style={[styles.chip, { backgroundColor: selected ? theme.primary : theme.backgroundElement }]}>
                  <ThemedText type="small" style={{ color: selected ? theme.onPrimary : theme.text }}>
                    {f.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          {error && <ThemedText style={styles.error}>{error}</ThemedText>}
        </View>

        {rows === null && !error ? (
          <ActivityIndicator style={styles.center} />
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            stickySectionHeadersEnabled={false}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {section.title}
                </ThemedText>
                {section.total > 0 && (
                  <ThemedText type="small" themeColor="textSecondary">
                    -{formatRupiah(section.total)}
                  </ThemedText>
                )}
              </View>
            )}
            renderItem={({ item }) => <HistoryItem item={item} />}
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                Belum ada transaksi.
              </ThemedText>
            }
            ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} /> : null}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function HistoryItem({ item }: { item: TransactionRow }) {
  const theme = useTheme();
  const sign = item.type === 'EXPENSE' ? '-' : item.type === 'INCOME' ? '+' : '';
  const dotColor =
    item.type === 'EXPENSE' ? (item.necessity ? NECESSITY[item.necessity].color : UNREVIEWED_COLOR) : null;
  const account =
    item.type === 'TRANSFER'
      ? `${item.from_account?.name ?? '-'} → ${item.to_account?.name ?? '-'}`
      : ((item.type === 'INCOME' ? item.to_account : item.from_account)?.name ?? '-');

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id } })}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={styles.row}>
        {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : <View style={styles.dot} />}
        <View style={styles.rowText}>
          <ThemedText numberOfLines={1}>{transactionTitle(item)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {timeFormat.format(new Date(item.occurred_at))} · {account}
            {item.receipt_id ? ' · ada struk' : ''}
          </ThemedText>
        </View>
        <ThemedText type="smallBold" style={item.type === 'INCOME' && { color: theme.primary }}>
          {sign}
          {formatRupiah(item.amount)}
        </ThemedText>
      </ThemedView>
    </Pressable>
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
  top: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  list: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  rowText: {
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  empty: {
    textAlign: 'center',
    paddingTop: Spacing.five,
  },
  footer: {
    padding: Spacing.three,
  },
  center: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  error: {
    color: DANGER_COLOR,
  },
});
