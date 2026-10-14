import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/app-symbol';
import { Avatar } from '@/components/avatar';
import { BudgetCard } from '@/components/dashboard/budget-card';
import { HabitCard } from '@/components/dashboard/habit-card';
import { MenuGrid, type MenuItem, QuickActions } from '@/components/dashboard/menu-grid';
import { RegretInsight } from '@/components/dashboard/regret-insight';
import { SafeToSpendCard } from '@/components/dashboard/safe-to-spend-card';
import { TimeInsightCard } from '@/components/dashboard/time-insight-card';
import { SpendingMix } from '@/components/dashboard/spending-mix';
import { GoalProgress } from '@/components/goal-progress';
import { StreakBadge } from '@/components/streak-badge';
import { StreakCelebration } from '@/components/streak-celebration';
import { GroupSpace } from '@/components/together/group-space';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Toast } from '@/components/toast';
import { BottomTabInset, MaxContentWidth, Spacing, WideContentWidth } from '@/constants/theme';
import { useCycleDay } from '@/hooks/use-cycle-day';
import { useTheme } from '@/hooks/use-theme';
import { useWide } from '@/hooks/use-wide';
import { adminFeeMessages } from '@/lib/admin-fee';
import { cycleKey, cycleRange, untilLabel } from '@/lib/cycle';
import type { Tables } from '@/lib/database.types';
import { type Debt, dueStatus } from '@/lib/debts';
import type { Goal } from '@/lib/goals';
import { fetchHabits, type Habits } from '@/lib/habits';
import { displayName } from '@/lib/display-name';
import { formatMoney } from '@/lib/money';
import { isOnboarded } from '@/lib/onboarding';
import { syncDueReminders } from '@/lib/reminders';
import { computeSafeToSpend, type SafeRule } from '@/lib/safe-to-spend';
import { celebratedOn, markCelebrated, shouldCelebrate, streakView, type StreakView } from '@/lib/streak';
import { netWorth } from '@/lib/assets';
import { supabase } from '@/lib/supabase';
import { computeTimeInsight, type TimeInsight } from '@/lib/time-insight';
import { weeklyReviewWindow } from '@/lib/weekly-review';
import { useSession } from '@/providers/session-provider';

type Balance = Tables<'v_account_balances'>;
type Budget = Tables<'v_budget_remaining'>;
type MixRow = Tables<'v_spending_mix_monthly'>;
type RegretRow = Tables<'v_regret_by_necessity'>;
type Unreviewed = Pick<Tables<'transactions'>, 'id' | 'amount' | 'occurred_at'> & {
  categories: { name: string } | null;
};

const QUICK_ACTIONS: MenuItem[] = [
  { label: 'Catat', href: '/quick-log', material: 'add', sf: 'plus' },
  { label: 'Riwayat', href: '/history', material: 'receipt_long', sf: 'list.bullet.rectangle' },
  { label: 'Diagram', href: '/charts', material: 'pie_chart', sf: 'chart.pie' },
  { label: 'Laporan', href: '/report', material: 'bar_chart', sf: 'chart.bar' },
];

// How far the first card reaches up into the band.
const BAND_OVERLAP = 64;
// Header row (avatar, greeting, streak, settings) and the Pribadi/Grup switch under it.
const HEADER_HEIGHT = 56;
const SWITCH_HEIGHT = 40;
const HIDDEN_KEY = 'flowku.hideBalance';
const SPACE_KEY = 'flowku.space';

type Space = 'personal' | 'group';

// Beranda, laid out like a banking app: a teal band with a greeting, the safe-to-spend card with quick actions,
// a menu grid with everything that used to live under Pengaturan, small to-do rows, then the overview cards.
// On a laptop-wide window the overview moves into a second column.
export default function HomeScreen() {
  const theme = useTheme();
  const wide = useWide();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const [hidden, toggleHidden] = useHiddenBalance();
  const [space, setSpace] = useSpace();
  const [streak, setStreak] = useState<StreakView>({ days: 0, activeToday: false });
  const [celebrate, setCelebrate] = useState<number | null>(null);
  // Estimated value of the assets still held (game accounts, gold, stocks, ...); null until loaded.
  const [assetsValue, setAssetsValue] = useState<number | null>(null);
  const [assetCount, setAssetCount] = useState(0);
  // Bottom edge of the hero card (with its own Catat button), measured on layout.
  const [heroBottom, setHeroBottom] = useState<number | null>(null);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const { day: cycleDay, loaded: cycleLoaded } = useCycleDay();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [mix, setMix] = useState<MixRow[]>([]);
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
  // Admin fees charged on this open, shown one after another.
  const [toasts, setToasts] = useState<string[]>([]);
  const hideToast = useCallback(() => setToasts((list) => list.slice(1)), []);

  // Refetch every time the screen regains focus, e.g. after closing Quick Log or Review.
  useFocusEffect(
    useCallback(() => {
      if (!cycleLoaded) return; // month keys depend on the payday cycle
      const now = new Date();
      const month = cycleKey(now, cycleDay);
      const week = weeklyReviewWindow();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const insightSince = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90).toISOString();
      const load = () =>
        Promise.all([
          supabase.from('v_account_balances').select('*').is('archived_at', null).order('name'),
          supabase.from('v_budget_remaining').select('*'),
          supabase.from('v_spending_mix_monthly').select('*').eq('month', month),
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
          supabase.from('profiles').select('streak_count, last_active_date').maybeSingle(),
          supabase.from('v_assets').select('current_value').eq('status', 'ACTIVE'),
        ]);
      // Post due recurring transactions first so balances and budgets include them.
      // A failure there should not block the dashboard; the next focus retries.
      // Habits are a nice-to-have: failures just leave the card hidden.
      const loadHabits = () => fetchHabits().then(setHabits, () => {});
      supabase
        .rpc('post_due_recurring_details')
        .then(({ data }) => {
          const messages = adminFeeMessages(data ?? []);
          if (messages.length > 0) setToasts((list) => [...list, ...messages]);
          loadHabits();
          syncDueReminders(); // next_due may have moved on
          return load();
        })
        .then(([bal, bud, mixRes, rev, due, reg, cats, goalRows, debtRows, ruleRows, todayRows, judgedRows, profileRow, assetRows]) => {
          const failed =
            bal.error ??
            bud.error ??
            mixRes.error ??
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
          setUnreviewed(rev.data ?? []);
          setWeeklyDue(due.count ?? 0);
          setRegret(reg.data ?? []);
          setCategoryNames(new Map((cats.data ?? []).map((c) => [c.id, c.name])));
          setGoals(goalRows.data ?? []);
          setOpenDebts(debtRows.data ?? []);
          setRules(ruleRows.data ?? []);
          setSpentToday((todayRows.data ?? []).reduce((sum, t) => sum + t.amount, 0));
          setTimeInsight(computeTimeInsight(judgedRows.data ?? []));
          // Assets are optional: a failure only hides them from the net worth card.
          setAssetsValue(assetRows.error ? null : (assetRows.data ?? []).reduce((s, a) => s + (a.current_value ?? 0), 0));
          setAssetCount(assetRows.data?.length ?? 0);
          // The streak is kept by the server; the day's first counted save is celebrated once, here.
          if (profileRow.data) {
            const view = streakView(profileRow.data.streak_count, profileRow.data.last_active_date);
            setStreak(view);
            if (shouldCelebrate(view, celebratedOn())) {
              markCelebrated();
              setCelebrate(view.days);
            }
          }
        });
    }, [cycleDay, cycleLoaded]),
  );

  const user = session?.user;
  const name = displayName(user);
  // Group Space wears honey instead of teal, so it is always clear which money you are looking at.
  const group = space === 'group';
  const bandColor = group ? theme.accent : theme.primary;
  const onBand = group ? theme.onAccent : theme.onPrimary;
  // Grows with the status bar instead of a fixed height, so the greeting never sits under it on any phone.
  const bandHeight = insets.top + Spacing.three + HEADER_HEIGHT + Spacing.two + SWITCH_HEIGHT + Spacing.three + BAND_OVERLAP;
  const total = balances.reduce((sum, b) => sum + (b.current_balance ?? 0), 0);
  const unreviewedTotal = unreviewed.reduce((sum, t) => sum + t.amount, 0);
  const cycleEnd = cycleRange(new Date(), cycleDay).end;
  const essential = budgets.find((b) => b.scope === 'ESSENTIAL' && b.period === 'WEEKLY');
  const safe = computeSafeToSpend({
    cash: total,
    rules,
    debts: openDebts,
    goalsSaved: goals.reduce((sum, g) => sum + (g.saved ?? 0), 0),
    essential: essential ? { limit_amount: essential.limit_amount ?? 0, remaining: essential.remaining ?? 0 } : null,
    spentToday,
    cycleEnd,
  });
  const overdueDebts = openDebts.filter((d) => dueStatus(d)?.overdue).length;

  const menu: MenuItem[] = [
    { label: 'Akun & dompet', href: '/accounts', material: 'account_balance_wallet', sf: 'wallet.bifold' },
    { label: 'Budget', href: '/budgets', material: 'donut_large', sf: 'chart.pie' },
    { label: 'Target tabungan', href: '/goals', material: 'flag', sf: 'flag' },
    {
      label: 'Utang & piutang',
      href: '/debts',
      material: 'handshake',
      sf: 'person.2',
      badge: overdueDebts > 0 ? String(overdueDebts) : undefined,
    },
    { label: 'Transaksi rutin', href: '/recurring', material: 'event_repeat', sf: 'repeat' },
    { label: 'Kategori', href: '/categories', material: 'category', sf: 'square.grid.2x2' },
    // Kebiasaan is one tap away on the streak badge in the header.
    { label: 'Aset', href: '/portfolio', material: 'savings', sf: 'dollarsign.circle' },
    { label: 'Lainnya', href: '/settings', material: 'more_horiz', sf: 'ellipsis' },
  ];

  const hero =
    balances.length > 0 ? (
      <SafeToSpendCard
        data={safe}
        cash={total}
        until={untilLabel(cycleEnd, cycleDay)}
        hidden={hidden}
        onToggleHidden={toggleHidden}>
        <QuickActions items={QUICK_ACTIONS} />
      </SafeToSpendCard>
    ) : (
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="small" themeColor="textSecondary">
          Total uang
        </ThemedText>
        <ThemedText style={styles.total}>{formatMoney(total)}</ThemedText>
        <QuickActions items={QUICK_ACTIONS} />
      </ThemedView>
    );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={wide ? styles.scrollWide : styles.scroll}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const past = heroBottom !== null && e.nativeEvent.contentOffset.y > heroBottom;
          if (past !== scrolledPastHero) setScrolledPastHero(past);
        }}>
        <View style={[styles.band, { backgroundColor: bandColor, height: bandHeight, paddingTop: insets.top }]}>
          <View style={[styles.bubble, styles.bubbleOne, { backgroundColor: group ? theme.backgroundElement : theme.accent }]} />
          <View style={[styles.bubble, styles.bubbleTwo, { backgroundColor: onBand }]} />
          <View style={[styles.bandInner, { maxWidth: wide ? WideContentWidth : MaxContentWidth }]}>
            <View style={styles.headerRow}>
              <Pressable
                onPress={() => router.push('/profile')}
                accessibilityLabel="Profil: ubah nama dan foto"
                style={({ pressed }) => [styles.who, pressed && styles.pressed]}>
                <Avatar name={name} size={44} ringColor={onBand} />
                <View style={styles.flex}>
                  <ThemedText type="small" style={[styles.greetingSmall, { color: onBand }]} numberOfLines={1}>
                    {greeting()}
                  </ThemedText>
                  <ThemedText type="subtitle" style={[styles.greeting, { color: onBand }]} numberOfLines={1}>
                    {name}
                  </ThemedText>
                </View>
              </Pressable>
              <StreakBadge streak={streak} color={onBand} onPress={() => router.push('/habits')} />
              {!wide && (
                <Pressable
                  onPress={() => router.push('/settings')}
                  hitSlop={8}
                  accessibilityLabel="Pengaturan"
                  style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
                  <AppSymbol material="settings" sf="gearshape" size={24} color={onBand} />
                </Pressable>
              )}
            </View>
            <View style={styles.switch} accessibilityRole="tablist">
              {(['personal', 'group'] as const).map((value) => {
                const on = space === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setSpace(value)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    style={[styles.switchItem, on && { backgroundColor: onBand }]}>
                    <AppSymbol
                      material={value === 'personal' ? 'person' : 'groups'}
                      sf={value === 'personal' ? 'person.crop.circle' : 'person.3.fill'}
                      size={16}
                      color={on ? bandColor : onBand}
                    />
                    <ThemedText type="smallBold" style={{ color: on ? bandColor : onBand }}>
                      {value === 'personal' ? 'Pribadi' : 'Grup'}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {group ? (
          <View style={[styles.body, { maxWidth: MaxContentWidth }]}>
            {session && <GroupSpace userId={session.user.id} displayName={name} />}
          </View>
        ) : (
        <View style={[styles.body, wide ? styles.bodyWide : { maxWidth: MaxContentWidth }]}>
          <View style={[styles.column, wide && styles.leftColumn]}>
            <View onLayout={(e) => setHeroBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height + bandHeight - BAND_OVERLAP)}>
              {hero}
            </View>

            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                MENU
              </ThemedText>
              <MenuGrid items={menu} />
            </ThemedView>

            {/* Small to-do rows, not banners: the daily check is a quick labelling step, not the centre of the app. */}
            {unreviewed.length > 0 && (
              <TodoRow
                material="checklist"
                sf="checklist"
                title="Cek harian"
                detail={`${unreviewed.length} pengeluaran (${formatMoney(unreviewedTotal)}) belum dilabeli`}
                onPress={() => router.push('/coach')}
              />
            )}
            {weeklyDue > 0 && (
              <TodoRow
                material="rate_review"
                sf="text.bubble"
                title="Refleksi mingguan"
                detail={`${weeklyDue} pengeluaran: masih puas, atau menyesal?`}
                onPress={() => router.push('/weekly-review')}
              />
            )}
          </View>

          <View style={[styles.column, wide && styles.rightColumn]}>
            {error && <ThemedText themeColor="danger">{error}</ThemedText>}

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

            <Section title="KEKAYAAN BERSIH">
              <NetWorthCard
                cash={total}
                assets={assetsValue ?? 0}
                assetCount={assetCount}
                receivables={openDebts.filter((d) => d.direction === 'OWED_TO_ME').reduce((s, d) => s + (d.remaining ?? 0), 0)}
                debts={openDebts.filter((d) => d.direction === 'I_OWE').reduce((s, d) => s + (d.remaining ?? 0), 0)}
                hidden={hidden}
              />
            </Section>

            <Section title="AKUN">
              <Pressable onPress={() => router.push('/accounts')}>
                <ThemedView type="backgroundElement" style={styles.card}>
                  {balances.map((b) => (
                    <View key={b.account_id} style={styles.row}>
                      <ThemedText>{b.name}</ThemedText>
                      <ThemedText>{hidden ? '•••••' : formatMoney(b.current_balance ?? 0)}</ThemedText>
                    </View>
                  ))}
                  <ThemedText type="small" themeColor="textSecondary">
                    {balances.length === 0 ? 'Belum ada akun. Ketuk untuk menambahkan →' : 'Kelola akun →'}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </Section>
          </View>
        </View>
        )}
      </ScrollView>

      {/* On a laptop the sidebar has the Catat button; Group Space has no personal logging. On a phone it shows up only
          after the card's own Catat button has scrolled out of view, so at rest it never covers the menu. */}
      {!wide && !group && (scrolledPastHero || balances.length === 0) && (
        <Pressable
          onPress={() => router.push('/quick-log')}
          style={({ pressed }) => [styles.fab, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
            + Catat
          </ThemedText>
        </Pressable>
      )}
      <Toast message={toasts[0] ?? null} onHide={hideToast} />
      <StreakCelebration days={celebrate} onClose={() => setCelebrate(null)} />
    </ThemedView>
  );
}

function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

/** Personal or Group Space; remembered on this device. Personal is the default. */
function useSpace() {
  const [space, setSpace] = useState<Space>(() => {
    try {
      return localStorage.getItem(SPACE_KEY) === 'group' ? 'group' : 'personal';
    } catch {
      return 'personal';
    }
  });
  const choose = (next: Space) => {
    setSpace(next);
    try {
      localStorage.setItem(SPACE_KEY, next);
    } catch {
      // Not remembered; it still switches for now.
    }
  };
  return [space, choose] as const;
}

/** Whether amounts on Beranda are masked; remembered on this device. */
function useHiddenBalance() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HIDDEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setHidden((h) => {
      try {
        localStorage.setItem(HIDDEN_KEY, h ? '0' : '1');
      } catch {
        // Not remembered; it still toggles for now.
      }
      return !h;
    });
  return [hidden, toggle] as const;
}

function TodoRow({
  material,
  sf,
  title,
  detail,
  onPress,
}: {
  material: string;
  sf: string;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={[styles.card, styles.todo]}>
        <AppSymbol material={material} sf={sf} size={22} color={theme.primary} />
        <View style={styles.flex}>
          <ThemedText type="smallBold">{title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {detail}
          </ThemedText>
        </View>
        <AppSymbol material="chevron_right" sf="chevron.right" size={20} color={theme.textSecondary} />
      </ThemedView>
    </Pressable>
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
            <ThemedText type="smallBold">{formatMoney(owedToMe)}</ThemedText>
          </View>
        )}
        {iOwe > 0 && (
          <View style={styles.row}>
            <ThemedText>Utang (kamu pinjam)</ThemedText>
            <ThemedText type="smallBold">{formatMoney(iOwe)}</ThemedText>
          </View>
        )}
        <ThemedText type="small" themeColor={overdue > 0 ? 'danger' : 'textSecondary'}>
          {overdue > 0 ? `${overdue} lewat jatuh tempo · lihat →` : 'Kelola →'}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

/**
 * Cash + estimated assets + receivables - debts. Kept apart from "Aman dibelanjakan", which only ever counts cash:
 * an asset's value is an estimate until it is sold.
 */
function NetWorthCard(props: { cash: number; assets: number; assetCount: number; receivables: number; debts: number; hidden: boolean }) {
  const worth = netWorth(props);
  const show = (n: number) => (props.hidden ? '•••••' : formatMoney(n));
  return (
    <Pressable onPress={() => router.push('/portfolio')}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText style={styles.worth}>{show(worth.total)}</ThemedText>
        <View style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary">Saldo di akun</ThemedText>
          <ThemedText type="small">{show(worth.cash)}</ThemedText>
        </View>
        <View style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary">
            Aset (estimasi){props.assetCount > 0 ? ` · ${props.assetCount}` : ''}
          </ThemedText>
          <ThemedText type="small">{show(worth.assets)}</ThemedText>
        </View>
        {worth.receivables > 0 && (
          <View style={styles.row}>
            <ThemedText type="small" themeColor="textSecondary">Piutang</ThemedText>
            <ThemedText type="small">{show(worth.receivables)}</ThemedText>
          </View>
        )}
        {worth.debts > 0 && (
          <View style={styles.row}>
            <ThemedText type="small" themeColor="textSecondary">Utang</ThemedText>
            <ThemedText type="small" themeColor="danger">−{show(worth.debts)}</ThemedText>
          </View>
        )}
        <ThemedText type="small" themeColor="textSecondary">
          {props.assetCount > 0
            ? 'Nilai aset hanya perkiraan dan tidak dihitung di "Aman dibelanjakan". Kelola aset →'
            : 'Punya emas, saham, kripto, atau akun game? Catat di Aset →'}
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
  },
  scroll: {
    paddingBottom: BottomTabInset + Spacing.six + Spacing.four,
  },
  scrollWide: {
    paddingBottom: Spacing.five,
  },
  band: {
    overflow: 'hidden',
  },
  bandInner: {
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  headerRow: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  who: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
  },
  switch: {
    height: SWITCH_HEIGHT,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    padding: 3,
    gap: 2,
    borderRadius: SWITCH_HEIGHT / 2,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  switchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: SWITCH_HEIGHT / 2,
  },
  // Soft shapes in the band, echoing the sun-over-waves mark. The sun sits low on the right, behind the first card,
  // so it never collides with the settings button or the streak badge.
  bubble: {
    position: 'absolute',
    borderRadius: 999,
  },
  bubbleOne: {
    width: 110,
    height: 110,
    right: -36,
    bottom: BAND_OVERLAP - 40,
    opacity: 0.55,
  },
  bubbleTwo: {
    width: 260,
    height: 260,
    right: -60,
    top: 70,
    opacity: 0.08,
  },
  greetingSmall: {
    opacity: 0.85,
  },
  greeting: {
    fontSize: 22,
    lineHeight: 28,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  body: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    marginTop: -BAND_OVERLAP,
    gap: Spacing.four,
  },
  bodyWide: {
    maxWidth: WideContentWidth,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.four,
  },
  column: {
    gap: Spacing.four,
  },
  leftColumn: {
    width: 420,
  },
  rightColumn: {
    flex: 1,
    // Starts below the band, on the page background.
    paddingTop: BAND_OVERLAP + Spacing.two,
  },
  total: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: 700,
  },
  section: {
    gap: Spacing.two,
  },
  worth: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: 700,
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  goals: {
    gap: Spacing.three,
  },
  todo: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.three,
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
    // Just above the tab bar. Only iOS draws its native tab bar over the screen; on Android and web the screen
    // already ends above it, so adding the bar's height there lifted the button into the content.
    bottom: (Platform.OS === 'ios' ? BottomTabInset : 0) + Spacing.three,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
  },
  pressed: {
    opacity: 0.7,
  },
});
