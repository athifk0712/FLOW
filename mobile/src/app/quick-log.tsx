import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Tables, TablesInsert } from '@/lib/database.types';
import { formatRupiah } from '@/lib/money';
import { closeModal } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';

type Category = Pick<Tables<'categories'>, 'id' | 'name' | 'kind'>;
type Account = Pick<Tables<'accounts'>, 'id' | 'name'>;
type Mode = 'EXPENSE' | 'INCOME' | 'TRANSFER';
type CategoryBudget = Pick<Tables<'v_budget_remaining'>, 'category_id' | 'period' | 'limit_amount' | 'remaining'>;

const PERIOD_LABEL = { WEEKLY: 'minggu ini', MONTHLY: 'bulan ini' } as const;
// Below this share of the limit left, the note turns into a gentle warning.
const LOW_BUDGET_SHARE = 0.2;

const MODES: { value: Mode; label: string }[] = [
  { value: 'EXPENSE', label: 'Keluar' },
  { value: 'INCOME', label: 'Masuk' },
  { value: 'TRANSFER', label: 'Transfer' },
];

const SAVE_LABEL: Record<Mode, string> = {
  EXPENSE: 'SIMPAN (review nanti malam)',
  INCOME: 'SIMPAN PEMASUKAN',
  TRANSFER: 'SIMPAN TRANSFER',
};

const FROM_LABEL: Record<Mode, string> = {
  EXPENSE: 'Akun bayar',
  INCOME: 'Masuk ke akun',
  TRANSFER: 'Dari akun',
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'] as const;
const MAX_DIGITS = 12;

// Two-tap quick log: amount -> category -> save. Necessity is left NULL for the nightly review.
// Income and transfers use the same screen; only expenses go to the nightly review.
export default function QuickLogScreen() {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('EXPENSE');
  const [digits, setDigits] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [guess, setGuess] = useState<string | null>(null);
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('categories').select('id, name, kind').order('created_at'),
      supabase.from('accounts').select('id, name').is('archived_at', null).order('created_at'),
      supabase
        .from('transactions')
        .select('category_id, from_account_id, occurred_at')
        .eq('type', 'EXPENSE')
        .order('occurred_at', { ascending: false })
        .limit(100),
      supabase
        .from('v_budget_remaining')
        .select('category_id, period, limit_amount, remaining')
        .eq('scope', 'CATEGORY'),
    ]).then(([cats, accs, recent, buds]) => {
      const failed = cats.error ?? accs.error ?? recent.error ?? buds.error;
      if (failed) return setError(failed.message);

      const accountRows = accs.data ?? [];
      const recentRows = recent.data ?? [];
      setCategories(cats.data ?? []);
      setAccounts(accountRows);
      setBudgets(buds.data ?? []);
      setLoaded(true);

      // Default account: the one used last, else the first one.
      const defaultAccount = recentRows[0]?.from_account_id ?? accountRows[0]?.id ?? null;
      setAccountId(defaultAccount);
      setToAccountId(accountRows.find((a) => a.id !== defaultAccount)?.id ?? null);

      // Smart guess: the category logged most often around this hour.
      const hour = new Date().getHours();
      const counts = new Map<string, number>();
      for (const t of recentRows) {
        if (!t.category_id) continue;
        const diff = Math.abs(new Date(t.occurred_at).getHours() - hour);
        if (Math.min(diff, 24 - diff) <= 1) counts.set(t.category_id, (counts.get(t.category_id) ?? 0) + 1);
      }
      const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (best) {
        setGuess(best[0]);
        setCategoryId(best[0]);
      }
    });
  }, []);

  const amount = Number(digits || '0');
  const isTransfer = mode === 'TRANSFER';
  const accountsValid = isTransfer ? !!accountId && !!toAccountId && accountId !== toAccountId : !!accountId;
  const canSave = amount > 0 && accountsValid && !saving;
  const visibleCategories = categories.filter((c) => c.kind === (mode === 'INCOME' ? 'INCOME' : 'EXPENSE'));
  const guessed = mode === 'EXPENSE' && !!guess && categoryId === guess;
  const budgetNote = mode === 'EXPENSE' ? describeBudget(budgets, categories, categoryId, amount) : null;

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    // The time-of-day guess only applies to expenses.
    setCategoryId(next === 'EXPENSE' ? guess : null);
  }

  function pickFrom(id: string) {
    setAccountId(id);
    // Keep a transfer valid: move the destination off the account just picked as source.
    if (id === toAccountId) setToAccountId(accounts.find((a) => a.id !== id)?.id ?? null);
  }

  function press(key: (typeof KEYS)[number]) {
    if (key === 'del') return setDigits((d) => d.slice(0, -1));
    setDigits((d) => {
      const next = (d + key).replace(/^0+/, '');
      return next.length > MAX_DIGITS ? d : next;
    });
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const row: TablesInsert<'transactions'> =
      mode === 'EXPENSE'
        ? { type: mode, amount, from_account_id: accountId, category_id: categoryId }
        : mode === 'INCOME'
          ? { type: mode, amount, to_account_id: accountId, category_id: categoryId }
          : { type: mode, amount, from_account_id: accountId, to_account_id: toAccountId };
    const { error } = await supabase.from('transactions').insert(row);
    setSaving(false);
    if (error) return setError(error.message);
    closeModal();
  }

  const chip = (selected: boolean) => [
    styles.chip,
    { backgroundColor: selected ? theme.primary : theme.backgroundElement },
  ];
  const chipText = (selected: boolean) => ({ color: selected ? theme.onPrimary : theme.text });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.header}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            QUICK LOG
          </ThemedText>
          <Pressable onPress={closeModal} hitSlop={12}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Batal
            </ThemedText>
          </Pressable>
        </View>

        <View style={[styles.modes, { backgroundColor: theme.backgroundElement }]}>
          {MODES.map((m) => (
            <Pressable
              key={m.value}
              onPress={() => switchMode(m.value)}
              style={[styles.mode, m.value === mode && { backgroundColor: theme.primary }]}>
              <ThemedText type="smallBold" style={chipText(m.value === mode)}>
                {m.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <ThemedText style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
          {formatRupiah(amount)}
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary">
          {FROM_LABEL[mode]}
          {mode === 'EXPENSE' && accounts.length > 1 ? ' (otomatis: terakhir dipakai)' : ''}
        </ThemedText>
        {loaded && accounts.length === 0 && (
          <Pressable onPress={() => router.replace('/accounts')} style={chip(false)}>
            <ThemedText type="small">Belum ada akun. Tambahkan dulu →</ThemedText>
          </Pressable>
        )}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}
          contentContainerStyle={styles.chips}>
          {accounts.map((a) => (
            <Pressable key={a.id} onPress={() => pickFrom(a.id)} style={chip(a.id === accountId)}>
              <ThemedText type="small" style={chipText(a.id === accountId)}>
                {a.name}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        {isTransfer ? (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Ke akun
            </ThemedText>
            {accounts.length < 2 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Butuh minimal dua akun untuk transfer.
              </ThemedText>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipRow}
                contentContainerStyle={styles.chips}>
                {accounts
                  .filter((a) => a.id !== accountId)
                  .map((a) => (
                    <Pressable key={a.id} onPress={() => setToAccountId(a.id)} style={chip(a.id === toAccountId)}>
                      <ThemedText type="small" style={chipText(a.id === toAccountId)}>
                        {a.name}
                      </ThemedText>
                    </Pressable>
                  ))}
              </ScrollView>
            )}
          </>
        ) : (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Kategori{guessed ? ' (tebakan dari jam ini)' : ''}
            </ThemedText>
            <View style={styles.chipsWrap}>
              {visibleCategories.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setCategoryId(c.id === categoryId ? null : c.id)}
                  style={chip(c.id === categoryId)}>
                  <ThemedText type="small" style={chipText(c.id === categoryId)}>
                    {c.name}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {budgetNote && (
          <ThemedText
            type="small"
            themeColor={budgetNote.level === 'ok' ? 'textSecondary' : budgetNote.level === 'over' ? 'danger' : 'warning'}>
            {budgetNote.text}
          </ThemedText>
        )}

        {error && <ThemedText themeColor="danger">{error}</ThemedText>}

        <View style={styles.keypad}>
          {KEYS.map((key) => (
            <Pressable
              key={key}
              onPress={() => press(key)}
              onLongPress={key === 'del' ? () => setDigits('') : undefined}
              style={({ pressed }) => [
                styles.key,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}>
              <ThemedText style={styles.keyText}>{key === 'del' ? '⌫' : key}</ThemedText>
            </Pressable>
          ))}
        </View>

        <Pressable
          disabled={!canSave}
          onPress={save}
          style={({ pressed }) => [
            styles.save,
            { backgroundColor: theme.primary },
            !canSave && !saving && styles.disabled,
            (pressed || saving) && styles.pressed,
          ]}>
          {saving ? (
            <ActivityIndicator color={theme.onPrimary} />
          ) : (
            <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
              {SAVE_LABEL[mode]}
            </ThemedText>
          )}
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

/** What logging `amount` in this category does to its budget, or null when it has none. Never blocks saving. */
function describeBudget(budgets: CategoryBudget[], categories: Category[], categoryId: string | null, amount: number) {
  const budget = budgets.find((b) => b.category_id === categoryId);
  if (!budget || amount <= 0) return null;
  const name = categories.find((c) => c.id === categoryId)?.name ?? 'kategori ini';
  const period = PERIOD_LABEL[budget.period ?? 'MONTHLY'];
  const after = (budget.remaining ?? 0) - amount;
  if (after < 0) return { level: 'over' as const, text: `Ini melewati budget ${name} ${period} ${formatRupiah(-after)}.` };
  if (after < (budget.limit_amount ?? 0) * LOW_BUDGET_SHARE)
    return { level: 'low' as const, text: `Hati-hati, sisa budget ${name} ${period} tinggal ${formatRupiah(after)}.` };
  return { level: 'ok' as const, text: `Sisa budget ${name} ${period} setelah ini: ${formatRupiah(after)}` };
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
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modes: {
    flexDirection: 'row',
    padding: Spacing.one,
    borderRadius: Spacing.three,
  },
  mode: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  amount: {
    fontSize: 44,
    lineHeight: 56,
    fontWeight: 700,
    paddingVertical: Spacing.two,
  },
  // Without this, a horizontal ScrollView on web grows to fill free height and stretches the chips.
  chipRow: {
    flexGrow: 0,
  },
  chips: {
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: 'auto',
  },
  key: {
    width: '31.5%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  keyText: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 600,
  },
  save: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    marginBottom: Spacing.two,
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.7,
  },
});
