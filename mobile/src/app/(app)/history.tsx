import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DANGER_COLOR, NECESSITY, UNREVIEWED_COLOR } from '@/constants/necessity';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Tables } from '@/lib/database.types';
import {
  activeFilterCount,
  EMPTY_FILTERS,
  type HistoryFilters,
  logicFilter,
  periodRange,
  PERIODS,
  type TypeFilter,
} from '@/lib/history-filters';
import { formatRupiah } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { TRANSACTION_SELECT, transactionTitle, type TransactionRow } from '@/lib/transactions';

type Category = Pick<Tables<'categories'>, 'id' | 'name' | 'kind'>;
type Account = Pick<Tables<'accounts'>, 'id' | 'name'>;
type Summary = { count: number; out: number; in: number };

const TYPES: { value: TypeFilter; label: string }[] = [
  { value: 'ALL', label: 'Semua' },
  { value: 'EXPENSE', label: 'Keluar' },
  { value: 'INCOME', label: 'Masuk' },
  { value: 'TRANSFER', label: 'Transfer' },
];

const PAGE_SIZE = 50;
const SEARCH_DELAY_MS = 350;

const dayFormat = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' });

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Every transaction, newest first, grouped by local day. Search and filters narrow the list;
// tap a row to edit or delete it.
export default function HistoryScreen() {
  const theme = useTheme();
  const [filters, setFilters] = useState<HistoryFilters>(EMPTY_FILTERS);
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rows, setRows] = useState<TransactionRow[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ignores responses for filters the user has already changed.
  const requestId = useRef(0);

  // Apply the typed search after a short pause instead of on every key.
  useEffect(() => {
    const timer = setTimeout(
      () => setFilters((f) => (f.search === searchText ? f : { ...f, search: searchText })),
      SEARCH_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [searchText]);

  /** The filtered transactions query; `columns` decides whether it lists rows or just sums them. */
  const filteredQuery = useCallback(
    (active: HistoryFilters, columns: string, options?: { count: 'exact' }) => {
      let query = supabase.from('transactions').select(columns, options);
      if (active.type !== 'ALL') query = query.eq('type', active.type);
      if (active.categoryId) query = query.eq('category_id', active.categoryId);
      const range = periodRange(active.period);
      if (range) {
        query = query.gte('occurred_at', range.from.toISOString());
        if (range.to) query = query.lt('occurred_at', range.to.toISOString());
      }
      const search = active.search.trim().toLowerCase();
      const matching = search ? categories.filter((c) => c.name.toLowerCase().includes(search)).map((c) => c.id) : [];
      const logic = logicFilter(active, matching);
      if (logic) query = query.or(logic);
      return query;
    },
    [categories],
  );

  const fetchPage = useCallback(
    (active: HistoryFilters, offset: number) =>
      filteredQuery(active, TRANSACTION_SELECT)
        .order('occurred_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)
        .overrideTypes<TransactionRow[], { merge: false }>(),
    [filteredQuery],
  );

  const reload = useCallback(
    (active: HistoryFilters) => {
      const id = ++requestId.current;
      Promise.all([fetchPage(active, 0), filteredQuery(active, 'type, amount', { count: 'exact' })]).then(
        ([page, totals]) => {
          if (id !== requestId.current) return;
          const failed = page.error ?? totals.error;
          if (failed) return setError(failed.message);
          setError(null);
          setRows(page.data ?? []);
          setHasMore((page.data?.length ?? 0) === PAGE_SIZE);
          // Sums cover up to the API's row cap (1000); the count is always exact.
          const amounts = (totals.data ?? []) as unknown as Pick<TransactionRow, 'type' | 'amount'>[];
          setSummary({
            count: totals.count ?? amounts.length,
            out: amounts.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0),
            in: amounts.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0),
          });
        },
      );
    },
    [fetchPage, filteredQuery],
  );

  // Refetch on focus (edits, new Quick Log entries) and whenever the filters change.
  useFocusEffect(
    useCallback(() => {
      reload(filters);
    }, [reload, filters]),
  );

  // Filter choices; categories also feed the search.
  useFocusEffect(
    useCallback(() => {
      Promise.all([
        supabase.from('categories').select('id, name, kind').order('created_at'),
        supabase.from('accounts').select('id, name').is('archived_at', null).order('created_at'),
      ]).then(([cats, accs]) => {
        setCategories(cats.data ?? []);
        setAccounts(accs.data ?? []);
      });
    }, []),
  );

  async function loadMore() {
    if (!hasMore || loadingMore || !rows) return;
    setLoadingMore(true);
    const id = requestId.current;
    const { data, error } = await fetchPage(filters, rows.length);
    setLoadingMore(false);
    if (id !== requestId.current) return;
    if (error) return setError(error.message);
    setRows([...rows, ...(data ?? [])]);
    setHasMore((data?.length ?? 0) === PAGE_SIZE);
  }

  function update(change: Partial<HistoryFilters>) {
    setFilters((f) => ({ ...f, ...change }));
  }

  function reset() {
    setSearchText('');
    setFilters(EMPTY_FILTERS);
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

  const extraFilters = activeFilterCount(filters);
  const narrowed = extraFilters > 0 || filters.type !== 'ALL' || filters.search.trim() !== '';

  // Chips inside the filter panel sit on backgroundElement, so they use the next shade to stay visible.
  const chip = (selected: boolean, onPanel = false) => [
    styles.chip,
    { backgroundColor: selected ? theme.primary : onPanel ? theme.backgroundSelected : theme.backgroundElement },
  ];
  const chipText = (selected: boolean) => ({ color: selected ? theme.onPrimary : theme.text });
  const choice = (label: string, selected: boolean, onPress: () => void, onPanel = true) => (
    <Pressable key={label} onPress={onPress} style={chip(selected, onPanel)}>
      <ThemedText type="small" style={chipText(selected)}>
        {label}
      </ThemedText>
    </Pressable>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.top}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            RIWAYAT
          </ThemedText>

          <View style={styles.searchRow}>
            <TextInput
              style={[styles.search, { color: theme.text, backgroundColor: theme.backgroundElement }]}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Cari toko, catatan, atau kategori"
              placeholderTextColor={theme.textSecondary}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            <Pressable
              onPress={() => setShowFilters((s) => !s)}
              style={[
                styles.filterButton,
                { backgroundColor: showFilters || extraFilters ? theme.primary : theme.backgroundElement },
              ]}>
              <ThemedText type="smallBold" style={chipText(showFilters || extraFilters > 0)}>
                Filter{extraFilters ? ` (${extraFilters})` : ''}
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.chips}>
            {TYPES.map((t) => choice(t.label, t.value === filters.type, () => update({ type: t.value }), false))}
          </View>

          {showFilters && (
            <ThemedView type="backgroundElement" style={styles.panel}>
              <ThemedText type="small" themeColor="textSecondary">
                Periode
              </ThemedText>
              <View style={styles.chips}>
                {PERIODS.map((p) => choice(p.label, p.value === filters.period, () => update({ period: p.value })))}
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                Kategori
              </ThemedText>
              <View style={styles.chips}>
                {categories
                  .filter((c) => filters.type === 'ALL' || c.kind === filters.type)
                  .map((c) =>
                    choice(c.kind === 'INCOME' ? `${c.name} (masuk)` : c.name, c.id === filters.categoryId, () =>
                      update({ categoryId: c.id === filters.categoryId ? null : c.id }),
                    ),
                  )}
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                Akun
              </ThemedText>
              <View style={styles.chips}>
                {accounts.map((a) =>
                  choice(a.name, a.id === filters.accountId, () =>
                    update({ accountId: a.id === filters.accountId ? null : a.id }),
                  ),
                )}
              </View>
            </ThemedView>
          )}

          {narrowed && summary && (
            <View style={styles.summary}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                {summary.count} transaksi
                {summary.out > 0 ? ` · keluar ${formatRupiah(summary.out)}` : ''}
                {summary.in > 0 ? ` · masuk ${formatRupiah(summary.in)}` : ''}
              </ThemedText>
              <Pressable onPress={reset} hitSlop={8}>
                <ThemedText type="smallBold" style={{ color: theme.primary }}>
                  Reset
                </ThemedText>
              </Pressable>
            </View>
          )}
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
            keyboardShouldPersistTaps="handled"
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
                {narrowed ? 'Tidak ada transaksi yang cocok.' : 'Belum ada transaksi.'}
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  searchRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  search: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  filterButton: {
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  panel: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
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
