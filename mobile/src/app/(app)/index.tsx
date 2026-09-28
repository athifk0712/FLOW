import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Tables } from '@/lib/database.types';
import { formatRupiah } from '@/lib/money';
import { supabase } from '@/lib/supabase';

type Balance = Tables<'v_account_balances'>;
type Unreviewed = Pick<Tables<'transactions'>, 'id' | 'amount' | 'occurred_at'> & {
  categories: { name: string } | null;
};

const timeFormat = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' });

// v0.1 dashboard: real cash, balances per account, and what still needs the nightly review.
export default function HomeScreen() {
  const theme = useTheme();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [unreviewed, setUnreviewed] = useState<Unreviewed[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Refetch every time the screen regains focus, e.g. after closing Quick Log.
  useFocusEffect(
    useCallback(() => {
      Promise.all([
        supabase.from('v_account_balances').select('*').is('archived_at', null).order('name'),
        supabase
          .from('transactions')
          .select('id, amount, occurred_at, categories(name)')
          .eq('needs_review', true)
          .order('occurred_at', { ascending: false }),
      ]).then(([bal, rev]) => {
        const failed = bal.error ?? rev.error;
        if (failed) return setError(failed.message);
        setError(null);
        setBalances(bal.data ?? []);
        setUnreviewed(rev.data ?? []);
      });
    }, []),
  );

  const total = balances.reduce((sum, b) => sum + (b.current_balance ?? 0), 0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            FLOW
          </ThemedText>

          <View>
            <ThemedText type="small" themeColor="textSecondary">
              Total uang
            </ThemedText>
            <ThemedText style={styles.total}>{formatRupiah(total)}</ThemedText>
          </View>

          {error && <ThemedText style={styles.error}>{error}</ThemedText>}

          <ThemedView type="backgroundElement" style={styles.card}>
            {balances.map((b) => (
              <View key={b.account_id} style={styles.row}>
                <ThemedText>{b.name}</ThemedText>
                <ThemedText>{formatRupiah(b.current_balance ?? 0)}</ThemedText>
              </View>
            ))}
          </ThemedView>

          <View style={styles.row}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              BELUM DIREVIEW ({unreviewed.length})
            </ThemedText>
            {unreviewed.length > 0 && (
              <Pressable onPress={() => router.push('/review')} hitSlop={8}>
                <ThemedText type="smallBold">Mulai review →</ThemedText>
              </Pressable>
            )}
          </View>
          <ThemedView type="backgroundElement" style={styles.card}>
            {unreviewed.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Semua transaksi sudah dinilai.
              </ThemedText>
            ) : (
              unreviewed.map((t) => (
                <View key={t.id} style={styles.row}>
                  <ThemedText>
                    {timeFormat.format(new Date(t.occurred_at))} · {t.categories?.name ?? 'Tanpa kategori'}
                  </ThemedText>
                  <ThemedText>{formatRupiah(t.amount)}</ThemedText>
                </View>
              ))
            )}
          </ThemedView>
        </ScrollView>

        <Pressable
          onPress={() => router.push('/quick-log')}
          style={({ pressed }) => [styles.fab, { backgroundColor: theme.text }, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            + Catat
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
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
    paddingBottom: BottomTabInset + Spacing.six + Spacing.four,
    gap: Spacing.three,
  },
  total: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: 700,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: BottomTabInset + Spacing.three,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
  },
  pressed: {
    opacity: 0.7,
  },
  error: {
    color: '#e5484d',
  },
});
