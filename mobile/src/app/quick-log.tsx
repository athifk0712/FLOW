import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
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
import { appendThousands, digitsToAmount, dropLastDigit, MAX_AMOUNT_DIGITS } from '@/lib/amount-input';
import { type CategoryUse, rankCategories } from '@/lib/category-rank';
import type { Tables, TablesInsert } from '@/lib/database.types';
import { formatDigits, formatMoney, fromWhole, toDigits, useCurrency } from '@/lib/money';
import { closeModal } from '@/lib/navigation';
import { deleteReceipt, receiptFileProblem, scanReceipt, scanToDraft, uploadReceipt } from '@/lib/receipts';
import { isAlreadySaved, newRequestId } from '@/lib/request-id';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/session-provider';

type Category = Pick<Tables<'categories'>, 'id' | 'name' | 'kind' | 'icon'>;
type Account = Pick<Tables<'accounts'>, 'id' | 'name'>;
type Mode = 'EXPENSE' | 'INCOME' | 'TRANSFER';
type CategoryBudget = Pick<Tables<'v_budget_remaining'>, 'category_id' | 'period' | 'limit_amount' | 'remaining'>;
type RecentRow = CategoryUse & Pick<Tables<'transactions'>, 'type' | 'from_account_id'>;

const PERIOD_LABEL = { WEEKLY: 'minggu ini', MONTHLY: 'bulan ini' } as const;
// Below this share of the limit left, the note turns into a gentle warning.
const LOW_BUDGET_SHARE = 0.2;
// Common Indonesian transfer fees (BI-FAST, online transfer), offered as one-tap amounts in rupiah.
const IDR_FEE_SHORTCUTS = [2500, 6500];

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

const isOtherName = (name: string) => name.trim().toLowerCase() === 'lainnya';

// Quick entry that fits one phone screen: type, when (a compact row; the calendar opens in place and pushes the form
// down, never over it), amount (the keyboard opens straight away, with 000 / ⌫ / clear keys under it), category
// (most used first), account, and a save button that stays above the keyboard. Note and shop name are folded under
// "Opsi tambahan". A receipt scan fills what it could read; everything stays editable until saved.
// Necessity is left NULL for the nightly check; only expenses go there.
// Saving is idempotent: the form keeps one request id, so a double tap or a retry never saves twice.
export default function QuickLogScreen() {
  const theme = useTheme();
  const currency = useCurrency();
  const { session } = useSession();
  const [mode, setMode] = useState<Mode>('EXPENSE');
  const [digits, setDigits] = useState('');
  const [amountFocused, setAmountFocused] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [feeDigits, setFeeDigits] = useState('');
  const [guess, setGuess] = useState<string | null>(null);
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExtras, setShowExtras] = useState(false);
  // null = "now"; set when logging something from earlier (e.g. yesterday's lunch).
  const [occurredAt, setOccurredAt] = useState<Date | null>(null);
  const [pickingDate, setPickingDate] = useState(false);
  const [note, setNote] = useState('');
  const [merchant, setMerchant] = useState('');
  // Inline "new category" form.
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('dots');
  const [iconTouched, setIconTouched] = useState(false);
  const [pickingIcon, setPickingIcon] = useState(false);
  const [creating, setCreating] = useState(false);
  // Receipt scan.
  const [choosingSource, setChoosingSource] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [suggestedId, setSuggestedId] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [requestId] = useState(newRequestId);
  // A scanned receipt that never got saved with a transaction is removed when the form closes.
  const pendingReceipt = useRef<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('categories').select('id, name, kind, icon').order('created_at'),
      supabase.from('accounts').select('id, name').is('archived_at', null).order('created_at'),
      // One query for both the category ranking and the defaults below (no per-category lookups).
      supabase
        .from('transactions')
        .select('category_id, from_account_id, occurred_at, type')
        .in('type', ['EXPENSE', 'INCOME'])
        .order('occurred_at', { ascending: false })
        .limit(200),
      supabase
        .from('v_budget_remaining')
        .select('category_id, period, limit_amount, remaining')
        .eq('scope', 'CATEGORY'),
    ]).then(([cats, accs, recentRes, buds]) => {
      const failed = cats.error ?? accs.error ?? recentRes.error ?? buds.error;
      if (failed) return setError(failed.message);

      const accountRows = accs.data ?? [];
      const recentRows = recentRes.data ?? [];
      const expenses = recentRows.filter((t) => t.type === 'EXPENSE');
      setCategories(cats.data ?? []);
      setAccounts(accountRows);
      setRecent(recentRows);
      setBudgets(buds.data ?? []);
      setLoaded(true);

      // Default account: the one used last, else the first one. The last one may since have been archived,
      // and then it isn't in the list (and shouldn't get new transactions).
      const lastUsed = expenses[0]?.from_account_id;
      const defaultAccount = accountRows.find((a) => a.id === lastUsed)?.id ?? accountRows[0]?.id ?? null;
      setAccountId(defaultAccount);
      setToAccountId(accountRows.find((a) => a.id !== defaultAccount)?.id ?? null);

      // Smart guess: the category logged most often around this hour.
      const hour = new Date().getHours();
      const counts = new Map<string, number>();
      for (const t of expenses.slice(0, 100)) {
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
    return () => {
      if (pendingReceipt.current) deleteReceipt(pendingReceipt.current);
    };
  }, []);

  const amount = digitsToAmount(digits);
  const fee = mode === 'TRANSFER' ? digitsToAmount(feeDigits) : 0;
  const isTransfer = mode === 'TRANSFER';
  const accountsValid = isTransfer ? !!accountId && !!toAccountId && accountId !== toAccountId : !!accountId;
  const kind = mode === 'INCOME' ? 'INCOME' : 'EXPENSE';
  const visibleCategories = rankCategories(
    categories.filter((c) => c.kind === kind),
    recent,
  );
  const selected = visibleCategories.find((c) => c.id === categoryId);
  const suggested = !selected ? visibleCategories.find((c) => c.id === suggestedId) : undefined;
  const isOther = !!selected && isOtherName(selected.name);
  const missing =
    amount <= 0
      ? null
      : !isTransfer && !selected
        ? 'Pilih kategori dulu, supaya jelas uang ini untuk apa.'
        : !isTransfer && isOther && !note.trim()
          ? '"Lainnya" untuk apa? Tulis di catatan (Opsi tambahan), atau buat kategori baru.'
          : null;
  const canSave = amount > 0 && accountsValid && !missing && !saving && !scanning;
  const guessed = mode === 'EXPENSE' && !!guess && categoryId === guess;
  const budgetNote = mode === 'EXPENSE' ? describeBudget(budgets, categories, categoryId, amount) : null;
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '';

  // Categories in columns of two, so the grid scrolls sideways in two compact rows.
  const columns: Category[][] = [];
  for (let i = 0; i < visibleCategories.length; i += 2) columns.push(visibleCategories.slice(i, i + 2));

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    // The time-of-day guess only applies to expenses.
    setCategoryId(next === 'EXPENSE' ? guess : null);
    setSuggestedId(null);
  }

  function pickFrom(id: string) {
    setAccountId(id);
    // Keep a transfer valid: move the destination off the account just picked as source.
    if (id === toAccountId) setToAccountId(accounts.find((a) => a.id !== id)?.id ?? null);
  }

  function pickCategory(c: Category) {
    const on = c.id === categoryId;
    setCategoryId(on ? null : c.id);
    setSuggestedId(null);
    setAdding(false);
    // "Lainnya" needs a note, so open the section where the note lives.
    if (!on && isOtherName(c.name)) setShowExtras(true);
  }

  function toggleDate() {
    Keyboard.dismiss();
    setPickingDate((p) => !p);
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

  // Receipt -> upload -> OCR -> fill in what was read. Nothing is saved as a transaction until the user saves.
  async function scan(source: 'camera' | 'library') {
    const userId = session?.user.id;
    setChoosingSource(false);
    if (!userId || scanning) return;
    setError(null);
    setScanNote(null);
    if (source === 'camera' && Platform.OS !== 'web') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return setScanNote('Izin kamera ditolak. Aktifkan dari pengaturan HP, atau pilih dari galeri.');
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };
    const picked =
      source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset) return;
    const problem = receiptFileProblem(asset);
    if (problem) return setScanNote(problem);

    Keyboard.dismiss();
    setScanning(true);
    try {
      // A second scan replaces the first one's photo.
      if (pendingReceipt.current) await deleteReceipt(pendingReceipt.current);
      const id = await uploadReceipt(userId, asset);
      pendingReceipt.current = id;
      setReceiptId(id);
      const draft = scanToDraft(await scanReceipt(id), categories);
      const read: string[] = [];
      if (draft.amount) {
        setDigits(String(draft.amount));
        read.push('nominal');
      }
      if (draft.merchant) {
        setMerchant(draft.merchant);
        read.push('toko');
      }
      if (draft.occurredAt) {
        setOccurredAt(draft.occurredAt);
        read.push('tanggal');
      }
      if (mode !== 'EXPENSE') setMode('EXPENSE');
      if (draft.categoryId) {
        setCategoryId(draft.categoryId);
        read.push('kategori');
      }
      setSuggestedId(draft.suggestedCategoryId);
      setScanNote(
        read.length === 0
          ? 'Struk belum terbaca jelas. Isi sendiri ya; fotonya tetap tersimpan bersama transaksi.'
          : `Terisi dari struk: ${read.join(', ')}. Cek dulu sebelum simpan.`,
      );
    } catch (e) {
      setScanNote(e instanceof Error ? e.message : 'Gagal membaca struk. Isi manual saja ya.');
    } finally {
      setScanning(false);
    }
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    let failed: { message: string; code?: string } | null;
    if (mode === 'TRANSFER') {
      // Transfer and its fee are written together by the database (all or nothing).
      const { error } = await supabase.rpc('create_transfer', {
        p_from: accountId!,
        p_to: toAccountId!,
        p_amount: amount,
        p_fee: fee,
        p_occurred_at: occurredAt?.toISOString(),
        p_note: note.trim() || undefined,
        p_request_id: requestId,
      });
      failed = error;
    } else {
      const row: TablesInsert<'transactions'> =
        mode === 'EXPENSE'
          ? { type: mode, amount, from_account_id: accountId, category_id: categoryId }
          : { type: mode, amount, to_account_id: accountId, category_id: categoryId };
      row.client_request_id = requestId;
      if (occurredAt) row.occurred_at = occurredAt.toISOString();
      if (note.trim()) row.description = note.trim();
      if (merchant.trim()) row.merchant = merchant.trim();
      if (receiptId && mode === 'EXPENSE') row.receipt_id = receiptId;
      const { error } = await supabase.from('transactions').insert(row);
      // Already saved by an earlier attempt whose answer got lost: that is a success.
      failed = isAlreadySaved(error) ? null : error;
      if (!failed && row.receipt_id) pendingReceipt.current = null;
    }
    setSaving(false);
    if (failed) return setError(failed.message);
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
  const key = (label: string, onPress: () => void, a11y: string, icon?: { material: string; sf: string }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.key, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
      {icon ? (
        <AppSymbol material={icon.material} sf={icon.sf} size={20} color={theme.text} />
      ) : (
        <ThemedText type="smallBold">{label}</ThemedText>
      )}
    </Pressable>
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
            <View style={styles.row}>
              <Pressable
                onPress={toggleDate}
                style={({ pressed }) => [styles.when, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Ubah tanggal dan jam transaksi"
                accessibilityState={{ expanded: pickingDate }}>
                <AppSymbol material="calendar_month" sf="calendar" size={18} color={theme.primary} />
                <ThemedText type="small" numberOfLines={1} style={styles.flex}>
                  {occurredAt ? whenFormat.format(occurredAt) : 'Sekarang'}
                </ThemedText>
                <ThemedText type="smallBold" themeColor="primary">
                  {pickingDate ? 'Selesai' : 'Ubah'}
                </ThemedText>
              </Pressable>
              {!isTransfer && (
                <Pressable
                  onPress={() => setChoosingSource((c) => !c)}
                  disabled={scanning}
                  style={({ pressed }) => [styles.when, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Scan struk">
                  {scanning ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <AppSymbol material="document_scanner" sf="doc.viewfinder" size={18} color={theme.primary} />
                  )}
                  <ThemedText type="smallBold" themeColor="primary">
                    {scanning ? 'Membaca…' : 'Scan struk'}
                  </ThemedText>
                </Pressable>
              )}
            </View>
            {choosingSource && (
              <View style={styles.row}>
                <Pressable onPress={() => scan('camera')} style={[chip(false), styles.sourceChip]}>
                  <AppSymbol material="photo_camera" sf="camera.fill" size={18} color={theme.text} />
                  <ThemedText type="small">Kamera</ThemedText>
                </Pressable>
                <Pressable onPress={() => scan('library')} style={[chip(false), styles.sourceChip]}>
                  <AppSymbol material="photo_library" sf="photo.on.rectangle" size={18} color={theme.text} />
                  <ThemedText type="small">Galeri</ThemedText>
                </Pressable>
              </View>
            )}
            {pickingDate && (
              <ThemedView type="backgroundElement" style={styles.panel}>
                <DateTimeField
                  key={occurredAt?.getTime() ?? 0}
                  value={occurredAt ?? new Date()}
                  onChange={setOccurredAt}
                />
                {occurredAt && (
                  <Pressable onPress={() => setOccurredAt(null)} hitSlop={8}>
                    <ThemedText type="small" themeColor="primary">
                      Kembali ke sekarang
                    </ThemedText>
                  </Pressable>
                )}
              </ThemedView>
            )}

            <View style={[styles.amountRow, { borderColor: amountFocused ? theme.primary : theme.backgroundSelected }]}>
              <ThemedText style={[styles.symbol, { color: theme.textSecondary }]}>{currency.symbol.trim()}</ThemedText>
              <TextInput
                value={formatDigits(digits)}
                onChangeText={(t) => setDigits(toDigits(t, MAX_AMOUNT_DIGITS))}
                onFocus={() => {
                  setAmountFocused(true);
                  setPickingDate(false);
                }}
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
            <View style={styles.keys}>
              {key('000', () => setDigits((d) => appendThousands(d)), 'Tambah tiga nol')}
              {key('⌫', () => setDigits(dropLastDigit), 'Hapus satu angka', { material: 'backspace', sf: 'delete.left' })}
              {key('Hapus', () => setDigits(''), 'Kosongkan nominal')}
            </View>

            {scanNote && (
              <ThemedText type="small" themeColor="textSecondary">
                {scanNote}
              </ThemedText>
            )}
            {suggested && (
              <Pressable
                onPress={() => pickCategory(suggested)}
                style={({ pressed }) => [styles.suggest, { borderColor: theme.primary }, pressed && styles.pressed]}>
                <CategoryIcon icon={suggested.icon} size={24} />
                <ThemedText type="small" style={styles.flex}>
                  Saran kategori dari struk: <ThemedText type="smallBold">{suggested.name}</ThemedText>
                </ThemedText>
                <ThemedText type="smallBold" themeColor="primary">
                  Pakai
                </ThemedText>
              </Pressable>
            )}

            {!isTransfer && (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  Kategori{guessed ? ' (tebakan dari jam ini)' : ' · yang sering dipakai di depan'}
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
                        onChange={(next) => {
                          setNewIcon(next);
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

                <ThemedText type="small" themeColor="textSecondary">
                  Biaya admin (opsional)
                </ThemedText>
                <View style={styles.row}>
                  <View style={[styles.feeRow, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      {currency.symbol.trim()}
                    </ThemedText>
                    <TextInput
                      value={formatDigits(feeDigits)}
                      onChangeText={(t) => setFeeDigits(toDigits(t, MAX_AMOUNT_DIGITS))}
                      placeholder="0"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="number-pad"
                      accessibilityLabel="Biaya admin transfer"
                      style={[styles.feeInput, { color: theme.text }]}
                    />
                  </View>
                  {currency.code === 'IDR' &&
                    IDR_FEE_SHORTCUTS.map((value) => (
                      <Pressable
                        key={value}
                        onPress={() => setFeeDigits(String(fromWhole(value)))}
                        style={chip(fee === fromWhole(value))}>
                        <ThemedText type="small" style={chipText(fee === fromWhole(value))}>
                          {formatDigits(String(fromWhole(value)))}
                        </ThemedText>
                      </Pressable>
                    ))}
                </View>
                {amount > 0 && accountsValid && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {accountName(accountId)} berkurang {formatMoney(amount + fee)} · {accountName(toAccountId)} bertambah{' '}
                    {formatMoney(amount)}
                    {fee > 0 ? ` · biaya ${formatMoney(fee)} dicatat sebagai pengeluaran` : ''}
                  </ThemedText>
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
                    {[merchant.trim(), note.trim()].filter(Boolean).join(' · ') || 'Catatan, nama toko'}
                    {receiptId ? ' · foto struk terlampir' : ''}
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
                {!isTransfer && (
                  <TextInput
                    value={merchant}
                    onChangeText={setMerchant}
                    placeholder="Nama toko / tempat (opsional)"
                    placeholderTextColor={theme.textSecondary}
                    maxLength={100}
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                  />
                )}
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder={isOther ? 'Lainnya untuk apa? mis. kado ulang tahun teman' : 'Catatan: beli apa, di mana'}
                  placeholderTextColor={theme.textSecondary}
                  maxLength={120}
                  style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                />
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
    outlineColor: 'transparent',
  },
  keys: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  // At least 44pt tall: comfortable to hit with a thumb.
  key: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
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
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
  suggest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1,
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
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    flexShrink: 1,
    flexGrow: 1,
  },
  feeRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  feeInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    paddingVertical: Spacing.two,
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
