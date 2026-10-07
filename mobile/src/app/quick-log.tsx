import { router } from 'expo-router';
import { useEffect, useEffectEvent, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/app-symbol';
import { CategoryIcon } from '@/components/category-icon';
import { DateTimeField } from '@/components/date-time-field';
import { IconPicker } from '@/components/icon-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { guessIcon } from '@/constants/category-icons';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Tables, TablesInsert } from '@/lib/database.types';
import { formatDigits, formatMoney, toDigits, useCurrency } from '@/lib/money';
import { closeModal } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';

type Category = Pick<Tables<'categories'>, 'id' | 'name' | 'kind' | 'icon'>;
type Account = Pick<Tables<'accounts'>, 'id' | 'name'>;
type Mode = 'EXPENSE' | 'INCOME' | 'TRANSFER';
type CategoryBudget = Pick<Tables<'v_budget_remaining'>, 'category_id' | 'period' | 'limit_amount' | 'remaining'>;

const PERIOD_LABEL = { WEEKLY: 'minggu ini', MONTHLY: 'bulan ini' } as const;
// Below this share of the limit left, the note turns into a gentle warning.
const LOW_BUDGET_SHARE = 0.2;

const MODES: { value: Mode; label: string }[] = [
  { value: 'EXPENSE', label: 'Pengeluaran' },
  { value: 'INCOME', label: 'Pemasukan' },
  { value: 'TRANSFER', label: 'Transfer' },
];

const SAVE_LABEL: Record<Mode, string> = {
  EXPENSE: 'SIMPAN PENGELUARAN',
  INCOME: 'SIMPAN PEMASUKAN',
  TRANSFER: 'SIMPAN TRANSFER',
};

const FROM_LABEL: Record<Mode, string> = {
  EXPENSE: 'Bayar pakai',
  INCOME: 'Masuk ke',
  TRANSFER: 'Dari akun',
};

const whenFormat = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const QUICK_LOG_WIDTH = 520;
const MAX_DIGITS = 12;

const isOtherName = (name: string) => name.trim().toLowerCase() === 'lainnya';

// Quick entry that fits one phone screen: type, amount (the keyboard opens straight away), category, account, and a
// save button that stays above the keyboard. Date and note are folded under "Opsi tambahan".
// Necessity is left NULL for the nightly check; only expenses go there.
// A category is required (nothing is saved "somewhere"); "Lainnya" also needs a note saying what it was,
// and a missing category can be created right here with its own icon.
export default function QuickLogScreen() {
  const theme = useTheme();
  const currency = useCurrency();
  const [mode, setMode] = useState<Mode>('EXPENSE');
  const [digits, setDigits] = useState('');
  const [amountFocused, setAmountFocused] = useState(false);
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
  const [showExtras, setShowExtras] = useState(false);
  // null = "now"; set when logging something from earlier (e.g. yesterday's lunch).
  const [occurredAt, setOccurredAt] = useState<Date | null>(null);
  const [pickingDate, setPickingDate] = useState(false);
  const [note, setNote] = useState('');
  // Inline "new category" form.
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('dots');
  const [iconTouched, setIconTouched] = useState(false);
  const [pickingIcon, setPickingIcon] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('categories').select('id, name, kind, icon').order('created_at'),
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

      // Default account: the one used last, else the first one. The last one may since have been archived,
      // and then it isn't in the list (and shouldn't get new transactions).
      const lastUsed = recentRows[0]?.from_account_id;
      const defaultAccount = accountRows.find((a) => a.id === lastUsed)?.id ?? accountRows[0]?.id ?? null;
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
  const kind = mode === 'INCOME' ? 'INCOME' : 'EXPENSE';
  const visibleCategories = categories.filter((c) => c.kind === kind);
  const selected = visibleCategories.find((c) => c.id === categoryId);
  const isOther = !!selected && isOtherName(selected.name);
  const missing =
    amount <= 0
      ? null
      : !isTransfer && !selected
        ? 'Pilih kategori dulu, supaya jelas uang ini untuk apa.'
        : !isTransfer && isOther && !note.trim()
          ? '"Lainnya" untuk apa? Tulis di catatan (Opsi tambahan), atau buat kategori baru.'
          : null;
  const canSave = amount > 0 && accountsValid && !missing && !saving;
  const guessed = mode === 'EXPENSE' && !!guess && categoryId === guess;
  const budgetNote = mode === 'EXPENSE' ? describeBudget(budgets, categories, categoryId, amount) : null;

  // Categories in columns of two, so the grid scrolls sideways in two compact rows.
  const columns: Category[][] = [];
  for (let i = 0; i < visibleCategories.length; i += 2) columns.push(visibleCategories.slice(i, i + 2));

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

  function pickCategory(c: Category) {
    const on = c.id === categoryId;
    setCategoryId(on ? null : c.id);
    setAdding(false);
    // "Lainnya" needs a note, so open the section where the note lives.
    if (!on && isOtherName(c.name)) setShowExtras(true);
  }

  function openNewCategory() {
    setAdding(true);
    setNewName('');
    setNewIcon('dots');
    setIconTouched(false);
    setPickingIcon(false);
  }

  async function createCategory() {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    setError(null);
    const { data, error } = await supabase
      .from('categories')
      .insert({ name, kind, icon: newIcon })
      .select('id, name, kind, icon')
      .single();
    setCreating(false);
    if (error) {
      // 23505 = unique (user, kind, name): it already exists, so just pick it.
      const existing = visibleCategories.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (error.code === '23505' && existing) {
        setCategoryId(existing.id);
        setAdding(false);
        return;
      }
      return setError(error.message);
    }
    setCategories((list) => [...list, data]);
    setCategoryId(data.id);
    setAdding(false);
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
    if (occurredAt) row.occurred_at = occurredAt.toISOString();
    if (note.trim()) row.description = note.trim();
    const { error } = await supabase.from('transactions').insert(row);
    setSaving(false);
    if (error) return setError(error.message);
    closeModal();
  }

  // On a laptop: Enter saves (also from the amount field) and Escape closes.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'Escape') closeModal();
    else if (e.key === 'Enter' && !adding) save();
    else return;
    e.preventDefault();
  });
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const listener = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const chip = (on: boolean) => [styles.chip, { backgroundColor: on ? theme.primary : theme.backgroundElement }];
  const chipText = (on: boolean) => ({ color: on ? theme.onPrimary : theme.text });
  const accountChips = (list: Account[], current: string | null, onPick: (id: string) => void) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.chipRow}
      contentContainerStyle={styles.chips}>
      {list.map((a) => (
        <Pressable key={a.id} onPress={() => onPick(a.id)} style={chip(a.id === current)}>
          <ThemedText type="small" style={chipText(a.id === current)}>
            {a.name}
          </ThemedText>
        </Pressable>
      ))}
    </ScrollView>
  );

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
          <View style={styles.header}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              CATAT
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

          {/* The main fields fit a phone screen; opened extras or a new category scroll, the save button stays. */}
          <ScrollView style={styles.flex} contentContainerStyle={styles.middle} keyboardShouldPersistTaps="handled">
            <View style={[styles.amountRow, { borderColor: amountFocused ? theme.primary : theme.backgroundSelected }]}>
              <ThemedText style={[styles.symbol, { color: theme.textSecondary }]}>{currency.symbol.trim()}</ThemedText>
              <TextInput
                value={formatDigits(digits)}
                onChangeText={(t) => setDigits(toDigits(t, MAX_DIGITS))}
                onFocus={() => setAmountFocused(true)}
                onBlur={() => setAmountFocused(false)}
                onSubmitEditing={save}
                placeholder="0"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                returnKeyType="done"
                autoFocus
                accessibilityLabel="Nominal"
                style={[styles.amount, { color: theme.text }]}
              />
            </View>

            {!isTransfer && (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  Kategori{guessed ? ' (tebakan dari jam ini)' : ''}
                </ThemedText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  style={styles.chipRow}
                  contentContainerStyle={styles.grid}>
                  {columns.map((column) => (
                    <View key={column[0].id} style={styles.column}>
                      {column.map((c) => {
                        const on = c.id === categoryId;
                        return (
                          <Pressable
                            key={c.id}
                            onPress={() => pickCategory(c)}
                            accessibilityState={{ selected: on }}
                            style={({ pressed }) => [
                              styles.tile,
                              { backgroundColor: on ? theme.primary : theme.backgroundElement },
                              pressed && styles.pressed,
                            ]}>
                            <CategoryIcon icon={c.icon} size={30} />
                            <ThemedText type="small" numberOfLines={1} style={[styles.tileText, chipText(on)]}>
                              {c.name}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                  <Pressable
                    onPress={openNewCategory}
                    style={({ pressed }) => [
                      styles.tile,
                      styles.newTile,
                      { borderColor: theme.primary },
                      pressed && styles.pressed,
                    ]}>
                    <AppSymbol material="add" sf="plus" size={26} color={theme.primary} />
                    <ThemedText type="small" themeColor="primary" numberOfLines={1} style={styles.tileText}>
                      Baru
                    </ThemedText>
                  </Pressable>
                </ScrollView>
                {adding && (
                  <ThemedView type="backgroundElement" style={styles.panel}>
                    <View style={styles.row}>
                      <Pressable
                        onPress={() => setPickingIcon((p) => !p)}
                        accessibilityLabel="Pilih ikon"
                        style={({ pressed }) => pressed && styles.pressed}>
                        <CategoryIcon icon={newIcon} size={40} />
                      </Pressable>
                      <TextInput
                        value={newName}
                        onChangeText={(text) => {
                          setNewName(text);
                          if (!iconTouched) setNewIcon(guessIcon(text));
                        }}
                        onSubmitEditing={createCategory}
                        placeholder="Nama kategori, mis. Skincare"
                        placeholderTextColor={theme.textSecondary}
                        maxLength={30}
                        autoFocus
                        style={[styles.input, styles.flex, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                      />
                    </View>
                    {pickingIcon && (
                      <IconPicker
                        value={newIcon}
                        onChange={(key) => {
                          setNewIcon(key);
                          setIconTouched(true);
                          setPickingIcon(false);
                        }}
                      />
                    )}
                    <View style={styles.row}>
                      <Pressable onPress={() => setPickingIcon((p) => !p)} hitSlop={8} style={styles.flex}>
                        <ThemedText type="small" themeColor="primary">
                          {pickingIcon ? 'Tutup ikon' : 'Ganti ikon'}
                        </ThemedText>
                      </Pressable>
                      <Pressable onPress={() => setAdding(false)} hitSlop={8}>
                        <ThemedText type="smallBold" themeColor="textSecondary">
                          Batal
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={createCategory}
                        disabled={!newName.trim() || creating}
                        style={[
                          styles.addButton,
                          { backgroundColor: theme.primary },
                          (!newName.trim() || creating) && styles.disabled,
                        ]}>
                        <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                          {creating ? 'Menyimpan…' : 'Tambah'}
                        </ThemedText>
                      </Pressable>
                    </View>
                  </ThemedView>
                )}
              </>
            )}

            <ThemedText type="small" themeColor="textSecondary">
              {FROM_LABEL[mode]}
            </ThemedText>
            {loaded && accounts.length === 0 && (
              <Pressable onPress={() => router.replace('/accounts')} style={chip(false)}>
                <ThemedText type="small">Belum ada akun. Tambahkan dulu →</ThemedText>
              </Pressable>
            )}
            {accountChips(accounts, accountId, pickFrom)}

            {isTransfer && (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  Ke akun
                </ThemedText>
                {accounts.length < 2 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Butuh minimal dua akun untuk transfer.
                  </ThemedText>
                ) : (
                  accountChips(
                    accounts.filter((a) => a.id !== accountId),
                    toAccountId,
                    setToAccountId,
                  )
                )}
              </>
            )}

            <Pressable
              onPress={() => setShowExtras((s) => !s)}
              style={({ pressed }) => [styles.extrasToggle, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ expanded: showExtras }}>
              <View style={styles.flex}>
                <ThemedText type="smallBold">Opsi tambahan</ThemedText>
                {!showExtras && (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {occurredAt ? whenFormat.format(occurredAt) : 'Sekarang'}
                    {note.trim() ? ` · ${note.trim()}` : ' · catatan'}
                  </ThemedText>
                )}
              </View>
              <AppSymbol
                material={showExtras ? 'expand_less' : 'expand_more'}
                sf={showExtras ? 'chevron.up' : 'chevron.down'}
                size={22}
                color={theme.textSecondary}
              />
            </Pressable>
            {showExtras && (
              <ThemedView type="backgroundElement" style={styles.panel}>
                <Pressable
                  onPress={() => setPickingDate((p) => !p)}
                  style={({ pressed }) => [
                    styles.when,
                    { backgroundColor: theme.backgroundSelected },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Ubah tanggal transaksi">
                  <AppSymbol material="calendar_month" sf="calendar" size={18} color={theme.primary} />
                  <ThemedText type="small" style={styles.flex}>
                    {occurredAt ? whenFormat.format(occurredAt) : 'Sekarang'}
                  </ThemedText>
                  <ThemedText type="smallBold" themeColor="primary">
                    {pickingDate ? 'Selesai' : 'Ubah'}
                  </ThemedText>
                </Pressable>
                {pickingDate && <DateTimeField value={occurredAt ?? new Date()} onChange={setOccurredAt} />}
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder={isOther ? 'Lainnya untuk apa? mis. kado ulang tahun teman' : 'Catatan: beli apa, di mana'}
                  placeholderTextColor={theme.textSecondary}
                  maxLength={120}
                  style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                />
                <ThemedText type="small" themeColor="textSecondary">
                  Foto struk bisa ditambahkan setelah disimpan: buka transaksinya dari Riwayat.
                </ThemedText>
              </ThemedView>
            )}

            {budgetNote && (
              <ThemedText
                type="small"
                themeColor={budgetNote.level === 'ok' ? 'textSecondary' : budgetNote.level === 'over' ? 'danger' : 'warning'}>
                {budgetNote.text}
              </ThemedText>
            )}
            {missing && (
              <ThemedText type="small" themeColor="warning">
                {missing}
              </ThemedText>
            )}
            {error && <ThemedText themeColor="danger">{error}</ThemedText>}
          </ScrollView>

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
      </KeyboardAvoidingView>
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
  if (after < 0) return { level: 'over' as const, text: `Ini melewati budget ${name} ${period} ${formatMoney(-after)}.` };
  if (after < (budget.limit_amount ?? 0) * LOW_BUDGET_SHARE)
    return { level: 'low' as const, text: `Hati-hati, sisa budget ${name} ${period} tinggal ${formatMoney(after)}.` };
  return { level: 'ok' as const, text: `Sisa budget ${name} ${period} setelah ini: ${formatMoney(after)}` };
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    // Narrower than other screens: a form stretched across a laptop is hard to scan.
    maxWidth: QUICK_LOG_WIDTH,
    alignSelf: 'center',
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
  middle: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderBottomWidth: 2,
    marginBottom: Spacing.one,
  },
  symbol: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: 700,
  },
  amount: {
    flex: 1,
    minWidth: 0,
    fontSize: 40,
    fontWeight: 700,
    paddingVertical: Spacing.two,
    // The row's underline shows focus; the browser's own ring is drawn off-position on web.
    outlineWidth: 0,
  },
  // Without this, a horizontal ScrollView on web grows to fill free height and stretches the chips.
  chipRow: {
    flexGrow: 0,
  },
  chips: {
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  grid: {
    gap: Spacing.two,
  },
  column: {
    gap: Spacing.two,
  },
  tile: {
    width: 76,
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    borderRadius: Spacing.three,
  },
  tileText: {
    fontSize: 12,
    lineHeight: 16,
  },
  newTile: {
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  panel: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  addButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  extrasToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  when: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Spacing.three,
  },
  input: {
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Spacing.three,
  },
  save: {
    alignItems: 'center',
    paddingVertical: Spacing.three + 2,
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
