import { router } from 'expo-router';
import { useEffect, useEffectEvent, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
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
import { formatMoney, getCurrency } from '@/lib/money';
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
  { value: 'EXPENSE', label: 'Keluar' },
  { value: 'INCOME', label: 'Masuk' },
  { value: 'TRANSFER', label: 'Transfer' },
];

const SAVE_LABEL: Record<Mode, string> = {
  EXPENSE: 'SIMPAN PENGELUARAN',
  INCOME: 'SIMPAN PEMASUKAN',
  TRANSFER: 'SIMPAN TRANSFER',
};

const FROM_LABEL: Record<Mode, string> = {
  EXPENSE: 'Akun bayar',
  INCOME: 'Masuk ke akun',
  TRANSFER: 'Dari akun',
};

const whenFormat = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const QUICK_LOG_WIDTH = 520;

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'] as const;
const MAX_DIGITS = 12;

// With cents, "000" would jump from $1 to $1000; "00" closes a whole amount instead.
const keyDigits = (key: (typeof KEYS)[number]) => (key === '000' && getCurrency().decimals > 0 ? '00' : key);

// Two-tap quick log: amount -> category -> save. Necessity is left NULL for the nightly chat.
// Income and transfers use the same screen; only expenses go to the nightly chat.
// A category is required (nothing is saved "somewhere"); "Lainnya" also needs a note saying what it was,
// and a missing category can be created right here with its own icon.
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
  const [typingNote, setTypingNote] = useState(false);

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
  const kind = mode === 'INCOME' ? 'INCOME' : 'EXPENSE';
  const visibleCategories = categories.filter((c) => c.kind === kind);
  const selected = visibleCategories.find((c) => c.id === categoryId);
  const isOther = selected?.name.trim().toLowerCase() === 'lainnya';
  const missing =
    amount <= 0
      ? null
      : !isTransfer && !selected
        ? 'Pilih kategori dulu, supaya jelas uang ini untuk apa.'
        : !isTransfer && isOther && !note.trim()
          ? '"Lainnya" untuk apa? Tulis di catatan, atau buat kategori baru.'
          : null;
  const canSave = amount > 0 && accountsValid && !missing && !saving;
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
      const next = (d + keyDigits(key)).replace(/^0+/, '');
      return next.length > MAX_DIGITS ? d : next;
    });
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

  // On a laptop: type the amount, Backspace to correct, Enter to save. Ignored while typing in a text field.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[0-9]$/.test(e.key)) press(e.key as (typeof KEYS)[number]);
    else if (e.key === 'Backspace') press('del');
    else if (e.key === 'Enter') save();
    else if (e.key === 'Escape') closeModal();
    else return;
    e.preventDefault();
  });
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const listener = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

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

        {/* Scrolls when the date calendar is open on a short phone screen; keypad and save stay put. */}
        <ScrollView style={styles.middle} contentContainerStyle={styles.middleContent} keyboardShouldPersistTaps="handled">
        <ThemedText style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
          {formatMoney(amount)}
        </ThemedText>

        <Pressable
          onPress={() => setPickingDate((p) => !p)}
          style={({ pressed }) => [styles.when, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Ubah tanggal transaksi">
          <AppSymbol material="calendar_month" sf="calendar" size={18} color={theme.primary} />
          <ThemedText type="small">{occurredAt ? whenFormat.format(occurredAt) : 'Sekarang'}</ThemedText>
          <ThemedText type="smallBold" themeColor="primary">
            {pickingDate ? 'Selesai' : 'Ubah'}
          </ThemedText>
        </Pressable>
        {pickingDate && <DateTimeField value={occurredAt ?? new Date()} onChange={setOccurredAt} />}

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
                  onPress={() => {
                    setCategoryId(c.id === categoryId ? null : c.id);
                    setAdding(false);
                  }}
                  style={[chip(c.id === categoryId), styles.iconChip]}>
                  <CategoryIcon icon={c.icon} size={24} />
                  <ThemedText type="small" style={chipText(c.id === categoryId)}>
                    {c.name}
                  </ThemedText>
                </Pressable>
              ))}
              {!adding && (
                <Pressable
                  onPress={openNewCategory}
                  style={[styles.chip, styles.iconChip, styles.newChip, { borderColor: theme.primary }]}>
                  <AppSymbol material="add" sf="plus" size={20} color={theme.primary} />
                  <ThemedText type="small" themeColor="primary">
                    Kategori baru
                  </ThemedText>
                </Pressable>
              )}
            </View>
            {adding && (
              <ThemedView type="backgroundElement" style={styles.newForm}>
                <View style={styles.newRow}>
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
                <View style={styles.newRow}>
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
                    style={[styles.addButton, { backgroundColor: theme.primary }, (!newName.trim() || creating) && styles.disabled]}>
                    <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                      {creating ? 'Menyimpan…' : 'Tambah'}
                    </ThemedText>
                  </Pressable>
                </View>
              </ThemedView>
            )}
          </>
        )}

        <TextInput
          value={note}
          onChangeText={setNote}
          onFocus={() => setTypingNote(true)}
          onBlur={() => setTypingNote(false)}
          placeholder={isOther ? 'Lainnya untuk apa? mis. kado ulang tahun teman' : 'Catatan: beli apa, di mana (opsional)'}
          placeholderTextColor={theme.textSecondary}
          maxLength={120}
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />

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

        {/* While the calendar or a text field is open it takes the keypad's place, so everything fits on a phone. */}
        <View style={[styles.keypad, (pickingDate || adding || typingNote) && styles.hidden]}>
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
              <ThemedText style={styles.keyText}>{key === 'del' ? '⌫' : keyDigits(key)}</ThemedText>
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
  if (after < 0) return { level: 'over' as const, text: `Ini melewati budget ${name} ${period} ${formatMoney(-after)}.` };
  if (after < (budget.limit_amount ?? 0) * LOW_BUDGET_SHARE)
    return { level: 'low' as const, text: `Hati-hati, sisa budget ${name} ${period} tinggal ${formatMoney(after)}.` };
  return { level: 'ok' as const, text: `Sisa budget ${name} ${period} setelah ini: ${formatMoney(after)}` };
}

const styles = StyleSheet.create({
  middle: {
    flex: 1,
  },
  middleContent: {
    gap: Spacing.two,
  },
  when: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  newChip: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    paddingVertical: Spacing.two - 1.5,
  },
  newForm: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  addButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  input: {
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  iconChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingLeft: Spacing.one + 2,
  },
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    // Narrower than other screens: a keypad stretched across a laptop is hard to use.
    maxWidth: QUICK_LOG_WIDTH,
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
  hidden: {
    display: 'none',
  },
  pressed: {
    opacity: 0.7,
  },
});
