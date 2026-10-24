import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/app-symbol';
import { Avatar } from '@/components/avatar';
import { BudgetCard } from '@/components/dashboard/budget-card';
import { FEATURES } from '@/components/dashboard/features';
import { FeatureIcon } from '@/components/feature-icon';
import { MenuGrid } from '@/components/dashboard/menu-grid';
import { SafeToSpendCard } from '@/components/dashboard/safe-to-spend-card';
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
import { cycleRange, untilLabel } from '@/lib/cycle';
import type { Tables } from '@/lib/database.types';
import { type Debt, dueStatus } from '@/lib/debts';
import { type Goal, goalStatus } from '@/lib/goals';
import { displayName } from '@/lib/display-name';
import { takeSaved } from '@/lib/last-saved';
import { formatMoney, formatMoneyShort } from '@/lib/money';
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
// Riwayat and Diagram are already in the tab bar; these are the next most used places. Everything else is under
// "Semua menu", so nothing is lost by keeping Beranda short.
const BUDGETS_ON_HOME = 3;

// How far the first card reaches up into the band.
const BAND_OVERLAP = 56;
// Header row (avatar, greeting, streak, settings) and the Pribadi/Grup switch under it.
const HEADER_HEIGHT = 48;
const SWITCH_HEIGHT = 34;
const HIDDEN_KEY = 'flowku.hideBalance';
const SPACE_KEY = 'flowku.space';

type Space = 'personal' | 'group';

// Beranda answers "how am I doing, and log this" with as little reading as possible: one number to check before
// spending (with a single Catat button and four shortcuts), at most two small to-dos, then short summaries (money
// overall, the top budgets, the nearest goal, one insight). Each summary opens its full page; the evaluation parts
// (needs vs wants, reflections) live on the Diagram tab. On a laptop-wide window the summaries move into a second
// column.
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
  const [unreviewed, setUnreviewed] = useState(0);
  const [weeklyDue, setWeeklyDue] = useState(0);
  const [categoryNames, setCategoryNames] = useState(new Map<string, string>());
  const [goals, setGoals] = useState<Goal[]>([]);
  const [openDebts, setOpenDebts] = useState<Debt[]>([]);
  const [rules, setRules] = useState<SafeRule[]>([]);
  const [spentToday, setSpentToday] = useState(0);
  const [timeInsight, setTimeInsight] = useState<TimeInsight | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Admin fees charged on this open and "it's saved" after Catat, shown one after another.
  const [toasts, setToasts] = useState<{ text: string; icon: 'bank' | 'done' }[]>([]);
  // False until the first load, so Beranda never flashes "Rp0" before the real numbers arrive.
  const [loaded, setLoaded] = useState(false);
  const hideToast = useCallback(() => setToasts((list) => list.slice(1)), []);

  // Refetch every time the screen regains focus, e.g. after closing Quick Log or Review.
  useFocusEffect(
    useCallback(() => {
      if (!cycleLoaded) return; // Safe to Spend needs the payday cycle
      const now = new Date();
      const week = weeklyReviewWindow();
      // A small win after logging: Catat just saved something.
      const saved = takeSaved();
      if (saved) setToasts((list) => [...list, { text: saved, icon: 'done' }]);
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const insightSince = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90).toISOString();
      const load = () =>
        Promise.all([
          supabase.from('v_account_balances').select('*').is('archived_at', null).order('name'),
          supabase.from('v_budget_remaining').select('*'),
          supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('needs_review', true),
          supabase
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .eq('type', 'EXPENSE')
            .not('necessity', 'is', null)
            .is('regret', null)
            .gte('occurred_at', week.from)
            .lte('occurred_at', week.to),
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
      supabase
        .rpc('post_due_recurring_details')
        .then(({ data }) => {
          const messages = adminFeeMessages(data ?? []);
          if (messages.length > 0) setToasts((list) => [...list, ...messages.map((text) => ({ text, icon: 'bank' as const }))]);
          syncDueReminders(); // next_due may have moved on
          return load();
        })
        .then(([bal, bud, rev, due, cats, goalRows, debtRows, ruleRows, todayRows, judgedRows, profileRow, assetRows]) => {
          const failed =
            bal.error ??
            bud.error ??
            rev.error ??
            due.error ??
            cats.error ??
            goalRows.error ??
            debtRows.error ??
            ruleRows.error ??
            todayRows.error ??
            judgedRows.error;
          if (failed) return setError(failed.message);
          setError(null);
          setLoaded(true);
          // A brand-new guest (no accounts, never onboarded) gets the first-run setup.
          if ((bal.data ?? []).length === 0 && !isOnboarded()) router.push('/onboarding');
          setBalances(bal.data ?? []);
          setBudgets(bud.data ?? []);
          setUnreviewed(rev.count ?? 0);
          setWeeklyDue(due.count ?? 0);
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
    }, [cycleLoaded]),
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
  const sumDebts = (direction: Debt['direction']) =>
    openDebts.filter((d) => d.direction === direction).reduce((s, d) => s + (d.remaining ?? 0), 0);
  const worth = netWorth({
    cash: total,
    assets: assetsValue ?? 0,
    receivables: sumDebts('OWED_TO_ME'),
    debts: sumDebts('I_OWE'),
  });
  // The goal to show: still open, nearest deadline first (no deadline last), else the furthest along.
  const nearestGoal = [...goals]
    .filter((g) => !goalStatus(g).done)
    .sort(
      (a, b) =>
        (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') ||
        (b.saved ?? 0) / (b.target_amount || 1) - (a.saved ?? 0) / (a.target_amount || 1),
    )[0];


  const hero = !loaded ? (
    <ThemedView type="backgroundElement" style={[styles.card, styles.loading]}>
      <ActivityIndicator color={theme.primary} />
    </ThemedView>
  ) : balances.length > 0 ? (
      <SafeToSpendCard
        data={safe}
        cash={total}
        until={untilLabel(cycleEnd, cycleDay)}
        hidden={hidden}
        onToggleHidden={toggleHidden}>
        <LogButton />
      </SafeToSpendCard>
    ) : (
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="small" themeColor="textSecondary">
          Total uang
        </ThemedText>
        <ThemedText style={styles.total}>{formatMoney(total)}</ThemedText>
        <LogButton />
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
                <Avatar name={name} size={38} ringColor={onBand} />
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
                  onPress={() => router.push('/coach?mode=chat')}
                  hitSlop={8}
                  accessibilityLabel="Ngobrol dengan Flowku AI"
                  style={({ pressed }) => [styles.aiButton, pressed && styles.pressed]}>
                  <FeatureIcon name="ai" size={30} />
                  <ThemedText type="smallBold" style={{ color: onBand }}>
                    AI
                  </ThemedText>
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

            {/* At most two small to-do rows, worded as an invitation, not a backlog. */}
            {unreviewed > 0 && (
              <TodoRow
                material="checklist"
                sf="checklist"
                title={`${unreviewed} transaksi perlu ditinjau`}
                detail="Cek harian, cukup 1–2 menit"
                onPress={() => router.push('/coach')}
              />
            )}
            {weeklyDue > 0 && (
              <TodoRow
                material="rate_review"
                sf="text.bubble"
                title="Refleksi mingguan"
                detail={`${weeklyDue} pengeluaran: masih puas?`}
                onPress={() => router.push('/weekly-review')}
              />
            )}

            <ThemedView type="backgroundElement" style={styles.features}>
              <ThemedText type="smallBold" style={styles.featuresTitle}>
                Semua fitur
              </ThemedText>
              <MenuGrid items={FEATURES} />
            </ThemedView>
          </View>

          <View style={[styles.column, wide && styles.rightColumn]}>
            {error && <ThemedText themeColor="danger">{error}</ThemedText>}

            {loaded && (
            <Section title="KONDISI UANGMU">
              <View style={styles.tiles}>
                <Tile
                  label="Saldo"
                  value={hidden ? '•••••' : formatMoneyShort(total)}
                  hint={`${balances.length} akun`}
                  onPress={() => router.push('/accounts')}
                />
                <Tile
                  label="Kekayaan bersih"
                  value={hidden ? '•••••' : formatMoneyShort(worth.total)}
                  hint={assetCount > 0 ? `termasuk ${assetCount} aset` : 'saldo + aset − utang'}
                  onPress={() => router.push('/portfolio')}
                />
              </View>
              {(worth.debts > 0 || worth.receivables > 0) && <DebtsLine debts={openDebts} hidden={hidden} />}
            </Section>
            )}

            <Section title="ANGGARAN">
              <BudgetCard budgets={budgets} categoryNames={categoryNames} limit={BUDGETS_ON_HOME} />
            </Section>

            <Section title="TARGET TABUNGAN">
              <Pressable onPress={() => router.push('/goals')} style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundElement" style={styles.card}>
                  {nearestGoal ? (
                    <GoalProgress goal={nearestGoal} />
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      {goals.length > 0 ? 'Semua target sudah tercapai. Buat target baru?' : 'Mau menabung untuk sesuatu? Buat target →'}
                    </ThemedText>
                  )}
                  {goals.length > 1 && (
                    <ThemedText type="small" themeColor="primary">
                      Lihat semua {goals.length} target →
                    </ThemedText>
                  )}
                </ThemedView>
              </Pressable>
            </Section>

            {timeInsight && (
              <Section title="INSIGHT">
                <Pressable onPress={() => router.push('/charts')} style={({ pressed }) => pressed && styles.pressed}>
                  <ThemedView type="backgroundElement" style={styles.card}>
                    <ThemedText>{timeInsight.headline}</ThemedText>
                    <ThemedText type="small" themeColor="primary">
                      Lihat analisis lengkap →
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              </Section>
            )}
          </View>
        </View>
        )}
      </ScrollView>

      {/* On a laptop the sidebar has the Catat button; Group Space has no personal logging. On a phone it shows up only
          after the card's own Catat button has scrolled out of view, so at rest it never covers the menu. */}
      {!wide && !group && loaded && (scrolledPastHero || balances.length === 0) && (
        <Pressable
          onPress={() => router.push('/quick-log')}
          style={({ pressed }) => [styles.fab, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
            + Catat
          </ThemedText>
        </Pressable>
      )}
      <Toast message={toasts[0]?.text ?? null} icon={toasts[0]?.icon} onHide={hideToast} />
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

/** The main action of Beranda. */
function LogButton() {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => router.push('/quick-log')}
      accessibilityRole="button"
      style={({ pressed }) => [styles.logButton, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
      <AppSymbol material="add" sf="plus" size={22} color={theme.onPrimary} />
      <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
        Catat transaksi
      </ThemedText>
    </Pressable>
  );
}

/** One number with a label; the whole tile opens its page. */
function Tile({ label, value, hint, onPress }: { label: string; value: string; hint: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.flex, pressed && styles.pressed]}>
      <ThemedView type="backgroundElement" style={styles.tile}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {hint}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

/** Debts and receivables in one line; an overdue one is mentioned, calmly. */
function DebtsLine({ debts, hidden }: { debts: Debt[]; hidden: boolean }) {
  const theme = useTheme();
  const sum = (direction: Debt['direction']) =>
    debts.filter((d) => d.direction === direction).reduce((s, d) => s + (d.remaining ?? 0), 0);
  const overdue = debts.filter((d) => dueStatus(d)?.overdue).length;
  const show = (n: number) => (hidden ? '•••••' : formatMoneyShort(n));
  const parts = [sum('I_OWE') > 0 && `Utang ${show(sum('I_OWE'))}`, sum('OWED_TO_ME') > 0 && `Piutang ${show(sum('OWED_TO_ME'))}`].filter(Boolean);
  return (
    <Pressable onPress={() => router.push('/debts')} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={[styles.card, styles.todo]}>
        <AppSymbol material="handshake" sf="person.2" size={20} color={theme.primary} />
        <View style={styles.flex}>
          <ThemedText type="small">{parts.join(' · ')}</ThemedText>
          {overdue > 0 && (
            <ThemedText type="small" themeColor="warning">
              {overdue} sudah lewat jatuh tempo
            </ThemedText>
          )}
        </View>
        <AppSymbol material="chevron_right" sf="chevron.right" size={20} color={theme.textSecondary} />
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
    fontSize: 20,
    lineHeight: 26,
  },
  aiButton: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingLeft: Spacing.one,
    paddingRight: Spacing.two + 2,
    borderRadius: 19,
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
    fontSize: 32,
    lineHeight: 38,
    fontWeight: 700,
  },
  section: {
    gap: Spacing.two,
  },
  loading: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 46,
    borderRadius: Spacing.three,
  },
  tiles: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tile: {
    gap: Spacing.half,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  tileValue: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  features: {
    gap: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.four,
  },
  featuresTitle: {
    paddingHorizontal: Spacing.two,
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
