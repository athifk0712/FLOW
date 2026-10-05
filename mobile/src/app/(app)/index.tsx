import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BudgetCard } from '@/components/dashboard/budget-card';
import { HabitCard } from '@/components/dashboard/habit-card';
import { RegretInsight } from '@/components/dashboard/regret-insight';
import { SafeToSpendCard } from '@/components/dashboard/safe-to-spend-card';
import { TimeInsightCard } from '@/components/dashboard/time-insight-card';
import { SpendingMix } from '@/components/dashboard/spending-mix';
import { GoalProgress } from '@/components/goal-progress';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Wordmark } from '@/components/wordmark';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Tables } from '@/lib/database.types';
import { type Debt, dueStatus } from '@/lib/debts';
import type { Goal } from '@/lib/goals';
import { fetchHabits, type Habits } from '@/lib/habits';
import { currentMonthKey, formatRupiah } from '@/lib/money';
import { isOnboarded } from '@/lib/onboarding';
import { syncDueReminders } from '@/lib/reminders';
import { computeSafeToSpend, monthCycleEnd, type SafeRule } from '@/lib/safe-to-spend';
import { supabase } from '@/lib/supabase';
import { computeTimeInsight, type TimeInsight } from '@/lib/time-insight';
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
  const [categoryNames, setCategoryNames] = useState(new Map<string, string>());
  const [goals, setGoals] = useState<Goal[]>([]);
  const [openDebts, setOpenDebts] = useState<Debt[]>([]);
  const [habits, setHabits] = useState<Habits | null>(null);
  const [rules, setRules] = useState<SafeRule[]>([]);
  const [spentToday, setSpentToday] = useState(0);
  const [timeInsight, setTimeInsight] = useState<TimeInsight | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refetch every time the screen regains focus, e.g. after closing Quick Log or Review.
  useFocusEffect(
    useCallback(() => {
      const month = currentMonthKey();
      const week = weeklyReviewWindow();
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const insightSince = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90).toISOString();
      const load = () =>
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
          supabase.from('categories').select('id, name'),
          supabase.from('v_goal_progress').select('*').order('created_at'),
          supabase.from('v_debts').select('*').eq('settled', false),
          supabase
            .from('recurring_transactions')
            .select('name, amount, type, active, next_due, day_of_month')
            .eq('active', true),
          supabase.from('transactions').select('amount').eq('type', 'EXPENSE').gte('occurred_at', todayStart),
          supabase
            .from('transactions')
            .select('occurred_at, amount, necessity')
            .eq('type', 'EXPENSE')
            .not('necessity', 'is', null)
            .gte('occurred_at', insightSince),
        ]);
      // Post due recurring transactions first so balances and budgets include them.
      // A failure there should not block the dashboard; the next focus retries.
      // Habits are a nice-to-have: failures just leave the card hidden.
      const loadHabits = () => fetchHabits().then(setHabits, () => {});
      supabase
        .rpc('post_due_recurring')
        .then(() => {
          loadHabits();
          syncDueReminders(); // next_due may have moved on
          return load();
        })
        .then(([bal, bud, mixRes, held, rev, due, reg, cats, goalRows, debtRows, ruleRows, todayRows, judgedRows]) => {
          const failed =
            bal.error ??
            bud.error ??
            mixRes.error ??
            held.error ??
            rev.error ??
            due.error ??
            reg.error ??
            cats.error ??
            goalRows.error ??
            debtRows.error ??
            ruleRows.error ??
            todayRows.error ??
            judgedRows.error;
          if (failed) return setError(failed.message);
          setError(null);
          // A brand-new guest (no accounts, never onboarded) gets the first-run setup.
          if ((bal.data ?? []).length === 0 && !isOnboarded()) router.push('/onboarding');
          setBalances(bal.data ?? []);
          setBudgets(bud.data ?? []);
          setMix(mixRes.data ?? []);
          setHeldBack(held.data?.total_held_back ?? 0);
          setUnreviewed(rev.data ?? []);
          setWeeklyDue(due.count ?? 0);
          setRegret(reg.data ?? []);
          setCategoryNames(new Map((cats.data ?? []).map((c) => [c.id, c.name])));
          setGoals(goalRows.data ?? []);
          setOpenDebts(debtRows.data ?? []);
          setRules(ruleRows.data ?? []);
          setSpentToday((todayRows.data ?? []).reduce((sum, t) => sum + t.amount, 0));
          setTimeInsight(computeTimeInsight(judgedRows.data ?? []));
        });
    }, []),
  );

  const total = balances.reduce((sum, b) => sum + (b.current_balance ?? 0), 0);
  const unreviewedTotal = unreviewed.reduce((sum, t) => sum + t.amount, 0);
  const essential = budgets.find((b) => b.scope === 'ESSENTIAL' && b.period === 'WEEKLY');
  const safe = computeSafeToSpend({
    cash: total,
    rules,
    debts: openDebts,
    goalsSaved: goals.reduce((sum, g) => sum + (g.saved ?? 0), 0),
    essential: essential ? { limit_amount: essential.limit_amount ?? 0, remaining: essential.remaining ?? 0 } : null,
    spentToday,
    cycleEnd: monthCycleEnd(),
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Wordmark />

          {balances.length > 0 ? (
            <SafeToSpendCard data={safe} cash={total} until="akhir bulan" />
          ) : (
            <View>
              <ThemedText type="small" themeColor="textSecondary">
                Total uang
              </ThemedText>
              <ThemedText style={styles.total}>{formatRupiah(total)}</ThemedText>
            </View>
          )}

          {error && <ThemedText themeColor="danger">{error}</ThemedText>}

          {heldBack > 0 && (
            <Link href="/intents" asChild>
              <Pressable>
                <ThemedView style={[styles.card, { backgroundColor: theme.accent }]}>
                  <ThemedText type="small" style={{ color: theme.onAccent }}>
                    Bulan ini kamu berhasil menahan
                  </ThemedText>
                  <ThemedText type="subtitle" style={[{ color: theme.onAccent }, styles.celebrationAmount]}>
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

          {habits && habits.milestones[0].done && (
            <Section title="KEBIASAAN">
              <HabitCard habits={habits} />
            </Section>
          )}

          <Section title="BUDGET">
            <BudgetCard budgets={budgets} categoryNames={categoryNames} />
          </Section>

          <Section title="PENGELUARAN BULAN INI">
            <SpendingMix rows={mix} />
            <Pressable onPress={() => router.push('/report')} hitSlop={8}>
              <ThemedText type="smallBold">Lihat laporan bulanan →</ThemedText>
            </Pressable>
          </Section>

          {(timeInsight || regret.some((r) => (r.reviewed ?? 0) > 0)) && (
            <Section title="REFLEKSI">
              {timeInsight && <TimeInsightCard insight={timeInsight} />}
              <RegretInsight rows={regret} />
            </Section>
          )}

          <Section title="TARGET TABUNGAN">
            <Pressable onPress={() => router.push('/goals')}>
              <ThemedView type="backgroundElement" style={[styles.card, styles.goals]}>
                {goals.slice(0, 3).map((g) => (
                  <GoalProgress key={g.id} goal={g} />
                ))}
                <ThemedText type="small" themeColor="textSecondary">
                  {goals.length === 0
                    ? 'Mau menabung untuk sesuatu? Buat target tabungan →'
                    : goals.length > 3
                      ? `Lihat semua ${goals.length} target →`
                      : 'Kelola target →'}
                </ThemedText>
              </ThemedView>
            </Pressable>
          </Section>

          {openDebts.length > 0 && (
            <Section title="UTANG & PIUTANG">
              <DebtsCard debts={openDebts} />
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
          style={({ pressed }) => [styles.fab, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
            + Catat
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

/** Open receivables and debts at a glance; red when something is overdue. */
function DebtsCard({ debts }: { debts: Debt[] }) {
  const sum = (direction: Debt['direction']) =>
    debts.filter((d) => d.direction === direction).reduce((s, d) => s + (d.remaining ?? 0), 0);
  const overdue = debts.filter((d) => dueStatus(d)?.overdue).length;
  const owedToMe = sum('OWED_TO_ME');
  const iOwe = sum('I_OWE');
  return (
    <Pressable onPress={() => router.push('/debts')}>
      <ThemedView type="backgroundElement" style={styles.card}>
        {owedToMe > 0 && (
          <View style={styles.row}>
            <ThemedText>Piutang (orang pinjam ke kamu)</ThemedText>
            <ThemedText type="smallBold">{formatRupiah(owedToMe)}</ThemedText>
          </View>
        )}
        {iOwe > 0 && (
          <View style={styles.row}>
            <ThemedText>Utang (kamu pinjam)</ThemedText>
            <ThemedText type="smallBold">{formatRupiah(iOwe)}</ThemedText>
          </View>
        )}
        <ThemedText type="small" themeColor={overdue > 0 ? 'danger' : 'textSecondary'}>
          {overdue > 0 ? `${overdue} lewat jatuh tempo · lihat →` : 'Kelola →'}
        </ThemedText>
      </ThemedView>
    </Pressable>
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
  goals: {
    gap: Spacing.three,
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
});
