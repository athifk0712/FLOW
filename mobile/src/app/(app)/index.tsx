import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BudgetCard } from '@/components/dashboard/budget-card';
import { RegretInsight } from '@/components/dashboard/regret-insight';
import { SpendingMix } from '@/components/dashboard/spending-mix';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { NECESSITY } from '@/constants/necessity';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Tables } from '@/lib/database.types';
import { currentMonthKey, formatRupiah } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { weeklyReviewWindow } from '@/lib/weekly-review';

type Balance = Tables<'v_account_balances'>;
type Budget = Tables<'v_budget_remaining'>;
type MixRow = Tables<'v_spending_mix_monthly'>;
type RegretRow = Tables<'v_regret_by_necessity'>;
type Unreviewed = Pick<Tables<'transactions'>, 'id' | 'amount' | 'occurred_at'> & {
  categories: { name: string } | null;
};

const timeFormat = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' });

export default function HomeScreen() {
  const theme = useTheme();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [mix, setMix] = useState<MixRow[]>([]);
  const [heldBack, setHeldBack] = useState(0);
  const [unreviewed, setUnreviewed] = useState<Unreviewed[]>([]);
  const [weeklyDue, setWeeklyDue] = useState(0);
  const [regret, setRegret] = useState<RegretRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Refetch every time the screen regains focus, e.g. after closing Quick Log or Review.
  useFocusEffect(
    useCallback(() => {
      const month = currentMonthKey();
      const week = weeklyReviewWindow();
      Promise.all([
        supabase.from('v_account_balances').select('*').is('archived_at', null).order('name'),
        supabase.from('v_budget_remaining').select('*'),
        supabase.from('v_spending_mix_monthly').select('*').eq('month', month),
        supabase.from('v_saved_money_monthly').select('total_held_back').eq('month', month).maybeSingle(),
        supabase
          .from('transactions')
          .select('id, amount, occurred_at, categories(name)')
          .eq('needs_review', true)
          .order('occurred_at', { ascending: false }),
        supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('type', 'EXPENSE')
          .not('necessity', 'is', null)
          .is('regret', null)
          .gte('occurred_at', week.from)
          .lte('occurred_at', week.to),
        supabase.from('v_regret_by_necessity').select('*'),
      ]).then(([bal, bud, mixRes, held, rev, due, reg]) => {
        const failed = bal.error ?? bud.error ?? mixRes.error ?? held.error ?? rev.error ?? due.error ?? reg.error;
        if (failed) return setError(failed.message);
        setError(null);
        setBalances(bal.data ?? []);
        setBudgets(bud.data ?? []);
        setMix(mixRes.data ?? []);
        setHeldBack(held.data?.total_held_back ?? 0);
        setUnreviewed(rev.data ?? []);
        setWeeklyDue(due.count ?? 0);
        setRegret(reg.data ?? []);
      });
    }, []),
  );

  const total = balances.reduce((sum, b) => sum + (b.current_balance ?? 0), 0);
  const unreviewedTotal = unreviewed.reduce((sum, t) => sum + t.amount, 0);

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

          {heldBack > 0 && (
            <Link href="/intents" asChild>
              <Pressable>
                <ThemedView style={[styles.card, styles.celebration]}>
                  <ThemedText type="small" style={styles.celebrationText}>
                    Bulan ini kamu berhasil menahan
                  </ThemedText>
                  <ThemedText type="subtitle" style={[styles.celebrationText, styles.celebrationAmount]}>
                    {formatRupiah(heldBack)}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </Link>
          )}

          {unreviewed.length > 0 && (
            <Pressable onPress={() => router.push('/review')}>
              <ThemedView type="backgroundElement" style={[styles.card, styles.reviewCard]}>
                <View style={styles.flex}>
                  <ThemedText type="smallBold">
                    {unreviewed.length} transaksi belum dinilai
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatRupiah(unreviewedTotal)} · terakhir {timeFormat.format(new Date(unreviewed[0].occurred_at))}{' '}
                    {unreviewed[0].categories?.name ?? ''}
                  </ThemedText>
                </View>
                <ThemedText type="smallBold">Review →</ThemedText>
              </ThemedView>
            </Pressable>
          )}

          {weeklyDue > 0 && (
            <Pressable onPress={() => router.push('/weekly-review')}>
              <ThemedView type="backgroundElement" style={[styles.card, styles.reviewCard]}>
                <View style={styles.flex}>
                  <ThemedText type="smallBold">Refleksi mingguan</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {weeklyDue} pengeluaran: masih puas, atau menyesal?
                  </ThemedText>
                </View>
                <ThemedText type="smallBold">Mulai →</ThemedText>
              </ThemedView>
            </Pressable>
          )}

          <Section title="BUDGET MINGGU INI">
            <BudgetCard budgets={budgets} />
          </Section>

          <Section title="PENGELUARAN BULAN INI">
            <SpendingMix rows={mix} />
          </Section>

          {regret.some((r) => (r.reviewed ?? 0) > 0) && (
            <Section title="REFLEKSI">
              <RegretInsight rows={regret} />
            </Section>
          )}

          <Section title="AKUN">
            <Pressable onPress={() => router.push('/accounts')}>
              <ThemedView type="backgroundElement" style={styles.card}>
                {balances.map((b) => (
                  <View key={b.account_id} style={styles.row}>
                    <ThemedText>{b.name}</ThemedText>
                    <ThemedText>{formatRupiah(b.current_balance ?? 0)}</ThemedText>
                  </View>
                ))}
                <ThemedText type="small" themeColor="textSecondary">
                  {balances.length === 0 ? 'Belum ada akun. Ketuk untuk menambahkan →' : 'Kelola akun →'}
                </ThemedText>
              </ThemedView>
            </Pressable>
          </Section>
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
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.six + Spacing.four,
    gap: Spacing.four,
  },
  total: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: 700,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  celebration: {
    backgroundColor: NECESSITY.NEED.color,
  },
  celebrationText: {
    color: '#ffffff',
  },
  celebrationAmount: {
    fontSize: 28,
    lineHeight: 34,
  },
  reviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex: {
    flex: 1,
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
