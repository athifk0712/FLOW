import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { ModalEdges } from '@/constants/safe-area';

import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  dateFromToday,
  daysFromToday,
  type Debt,
  type DebtDirection,
  dueStatus,
  formatDay,
  sortDebts,
} from '@/lib/debts';
import type { Tables } from '@/lib/database.types';
import { formatDigits, formatMoney, getCurrency, toDigits } from '@/lib/money';
import { closeModal } from '@/lib/navigation';
import { syncDueReminders } from '@/lib/reminders';
import { newRequestId } from '@/lib/request-id';
import { supabase } from '@/lib/supabase';

type Account = Pick<Tables<'accounts'>, 'id' | 'name'>;
type Payment = Pick<Tables<'debt_payments'>, 'id' | 'amount' | 'paid_at' | 'transaction_id'>;

const paidFormat = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

// 'new' = the add form; an id = that debt is open (payment / edit).
type Open = 'new' | string | null;

const DIRECTIONS: { value: DebtDirection; label: string; hint: string; person: string }[] = [
  { value: 'OWED_TO_ME', label: 'Piutang', hint: 'Uangku yang dipinjam orang', person: 'Siapa yang pinjam?' },
  { value: 'I_OWE', label: 'Utang', hint: 'Uang orang yang aku pinjam', person: 'Pinjam dari siapa?' },
];

const DUE_SHORTCUTS = [
  { label: '1 minggu', days: 7 },
  { label: '2 minggu', days: 14 },
  { label: '1 bulan', days: 30 },
];

// Who owes whom, with partial payments. A payment can also move the money: received into a wallet (piutang) or paid
// from one (utang). The database writes the payment and its transaction together (record_debt_payment), refuses
// more than what is left, and treats a repeated request as the same payment. Cancelling a payment takes the money
// back out again.
export default function DebtsScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ direction?: DebtDirection }>();
  const [direction, setDirection] = useState<DebtDirection>(params.direction === 'I_OWE' ? 'I_OWE' : 'OWED_TO_ME');
  const [debts, setDebts] = useState<Debt[] | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const [editing, setEditing] = useState(false);
  const [showSettled, setShowSettled] = useState(false);

  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [dueDays, setDueDays] = useState<number | null>(null);
  const [payment, setPayment] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  // The wallet the money goes into / comes from; null = record the payment only (balances unchanged).
  const [walletId, setWalletId] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [confirmUndo, setConfirmUndo] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(newRequestId);

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [list, accs] = await Promise.all([
      supabase.from('v_debts').select('*'),
      supabase.from('accounts').select('id, name').is('archived_at', null).order('created_at'),
    ]);
    const failed = list.error ?? accs.error;
    if (failed) return setError(failed.message);
    setDebts(sortDebts(list.data ?? []));
    setAccounts(accs.data ?? []);
    syncDueReminders();
  }, []);

  const loadPayments = useCallback(async (debtId: string) => {
    const { data, error } = await supabase
      .from('debt_payments')
      .select('id, amount, paid_at, transaction_id')
      .eq('debt_id', debtId)
      .order('paid_at', { ascending: false });
    if (error) return setError(error.message);
    setPayments(data ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function openDebt(target: Open) {
    const debt = debts?.find((d) => d.id === target);
    setOpen(target);
    setEditing(target === 'new');
    setPerson(debt?.person ?? '');
    setAmount(debt?.amount ? String(debt.amount) : '');
    setNote(debt?.note ?? '');
    setDueDays(debt?.due_date ? daysFromToday(debt.due_date) : null);
    setPayment('');
    setConfirmDelete(false);
    setConfirmUndo(null);
    setError(null);
    setPayments([]);
    setWalletId((current) => current ?? accounts[0]?.id ?? null);
    setRequestId(newRequestId());
    if (target && target !== 'new') loadPayments(target);
  }

  function switchDirection(next: DebtDirection) {
    setDirection(next);
    setOpen(null);
  }

  async function run(action: () => PromiseLike<{ error: { message: string } | null }>, close = true) {
    setSaving(true);
    setError(null);
    const { error } = await action();
    setSaving(false);
    if (error) return setError(error.message);
    if (close) setOpen(null);
    setPayment('');
    await load();
  }

  const canSave = person.trim().length > 0 && Number(amount) > 0 && !saving;

  function save() {
    if (!canSave) return;
    const values = {
      person: person.trim(),
      amount: Number(amount),
      note: note.trim() || null,
      due_date: dueDays === null ? null : dateFromToday(dueDays),
    };
    run(() =>
      open === 'new'
        ? supabase.from('debts').insert({ ...values, direction })
        : supabase.from('debts').update(values).eq('id', open!),
    );
  }

  async function pay(debt: Debt, value: number) {
    if (!debt.id || value <= 0 || saving) return;
    if (value > (debt.remaining ?? 0)) return setError(`Sisanya tinggal ${formatMoney(debt.remaining ?? 0)}.`);
    const settles = value === debt.remaining;
    await run(
      () =>
        supabase.rpc('record_debt_payment', {
          p_debt_id: debt.id!,
          p_amount: value,
          p_account_id: walletId ?? undefined,
          p_request_id: requestId,
        }),
      settles,
    );
    // The next payment is a new request; reload the history if the card stays open.
    setRequestId(newRequestId());
    if (!settles) loadPayments(debt.id);
  }

  async function undo(debt: Debt, paymentId: string) {
    if (saving) return;
    if (confirmUndo !== paymentId) return setConfirmUndo(paymentId);
    setConfirmUndo(null);
    await run(() => supabase.rpc('delete_debt_payment', { p_payment_id: paymentId }), false);
    if (debt.id) loadPayments(debt.id);
  }

  function remove(id: string) {
    if (!confirmDelete) return setConfirmDelete(true);
    run(() => supabase.from('debts').delete().eq('id', id));
  }

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }];
  const priceRow = [styles.priceRow, { backgroundColor: theme.backgroundSelected }];
  const chip = (selected: boolean) => [
    styles.chip,
    { backgroundColor: selected ? theme.primary : theme.backgroundSelected },
  ];
  const chipText = (selected: boolean) => ({ color: selected ? theme.onPrimary : theme.text });
  const meta = DIRECTIONS.find((d) => d.value === direction)!;

  const form = (
    <View style={styles.form}>
      <TextInput
        style={inputStyle}
        value={person}
        onChangeText={setPerson}
        placeholder={meta.person}
        placeholderTextColor={theme.textSecondary}
        maxLength={100}
        autoFocus={open === 'new'}
      />
      <View style={priceRow}>
        <ThemedText type="smallBold">{getCurrency().symbol.trim()}</ThemedText>
        <TextInput
          style={[styles.priceInput, { color: theme.text }]}
          value={formatDigits(amount)}
          onChangeText={(t) => setAmount(toDigits(t))}
          placeholder="Jumlah"
          placeholderTextColor={theme.textSecondary}
          keyboardType="number-pad"
        />
      </View>
      <TextInput
        style={inputStyle}
        value={note}
        onChangeText={setNote}
        placeholder="Catatan (opsional), mis. patungan tiket konser"
        placeholderTextColor={theme.textSecondary}
      />
      <ThemedText type="small" themeColor="textSecondary">
        Jatuh tempo
      </ThemedText>
      {dueDays === null ? (
        <View style={styles.chips}>
          <Pressable style={chip(true)}>
            <ThemedText type="small" style={chipText(true)}>
              Tanpa tenggat
            </ThemedText>
          </Pressable>
          {DUE_SHORTCUTS.map((s) => (
            <Pressable key={s.days} onPress={() => setDueDays(s.days)} style={chip(false)}>
              <ThemedText type="small">{s.label}</ThemedText>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.stepper}>
          <Pressable onPress={() => setDueDays(dueDays - 1)} hitSlop={8}>
            <ThemedText type="smallBold">‹</ThemedText>
          </Pressable>
          <ThemedText type="smallBold" style={styles.flex}>
            {formatDay(dateFromToday(dueDays))}
          </ThemedText>
          <Pressable onPress={() => setDueDays(dueDays + 1)} hitSlop={8}>
            <ThemedText type="smallBold">›</ThemedText>
          </Pressable>
          <Pressable onPress={() => setDueDays(null)} hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary">
              Hapus
            </ThemedText>
          </Pressable>
        </View>
      )}
      {error && <ThemedText themeColor="danger">{error}</ThemedText>}
      <View style={styles.inline}>
        {open !== 'new' ? (
          <Pressable onPress={() => remove(open!)} disabled={saving} hitSlop={8}>
            <ThemedText type="smallBold" themeColor="danger">
              {confirmDelete ? 'Ketuk lagi untuk hapus' : 'Hapus'}
            </ThemedText>
          </Pressable>
        ) : (
          <View />
        )}
        <View style={[styles.inline, styles.right]}>
          <Pressable onPress={() => (open === 'new' ? setOpen(null) : setEditing(false))} hitSlop={8}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Batal
            </ThemedText>
          </Pressable>
          <Pressable
            disabled={!canSave}
            onPress={save}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primary },
              !canSave && !saving && styles.disabled,
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
              Simpan
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );

  function renderDebt(debt: Debt) {
    const isOpen = open === debt.id;
    const due = dueStatus(debt);
    const settledVerb = direction === 'OWED_TO_ME' ? 'Sudah dibayar' : 'Sudah kubayar';
    return (
      <ThemedView key={debt.id} type="backgroundElement" style={[styles.card, debt.settled && styles.settled]}>
        <Pressable onPress={() => (isOpen ? setOpen(null) : openDebt(debt.id))} style={styles.debt}>
          <View style={styles.inline}>
            <ThemedText type="smallBold" numberOfLines={1} style={styles.flex}>
              {debt.person}
            </ThemedText>
            <ThemedText type="smallBold">
              {debt.settled ? 'Lunas' : formatMoney(debt.remaining ?? 0)}
            </ThemedText>
          </View>
          {!debt.settled && (debt.paid ?? 0) > 0 && (
            <ProgressBar total={debt.amount ?? 0} segments={[{ value: debt.paid ?? 0, color: theme.primary }]} height={6} />
          )}
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {[
              (debt.paid ?? 0) > 0 && !debt.settled
                ? `${settledVerb} ${formatMoney(debt.paid ?? 0)} dari ${formatMoney(debt.amount ?? 0)}`
                : formatMoney(debt.amount ?? 0),
              debt.note,
            ]
              .filter(Boolean)
              .join(' · ')}
          </ThemedText>
          {due && (
            <ThemedText type="small" themeColor={due.overdue ? 'danger' : 'warning'}>
              {due.text}
            </ThemedText>
          )}
        </Pressable>

        {isOpen &&
          (editing ? (
            form
          ) : (
            <View style={styles.form}>
              {!debt.settled && (
                <>
                  <ThemedText type="small" themeColor="textSecondary">
                    {direction === 'OWED_TO_ME' ? 'Uangnya masuk ke' : 'Dibayar dari'}
                  </ThemedText>
                  <View style={styles.chips}>
                    {accounts.map((a) => (
                      <Pressable key={a.id} onPress={() => setWalletId(a.id)} style={chip(walletId === a.id)}>
                        <ThemedText type="small" style={chipText(walletId === a.id)}>
                          {a.name}
                        </ThemedText>
                      </Pressable>
                    ))}
                    <Pressable onPress={() => setWalletId(null)} style={chip(walletId === null)}>
                      <ThemedText type="small" style={chipText(walletId === null)}>
                        Saldo tidak berubah
                      </ThemedText>
                    </Pressable>
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {walletLine(direction, debt.person ?? '', accounts.find((a) => a.id === walletId)?.name ?? null)}
                  </ThemedText>
                  <View style={styles.inline}>
                    <View style={[...priceRow, styles.flex]}>
                      <ThemedText type="smallBold">{getCurrency().symbol.trim()}</ThemedText>
                      <TextInput
                        style={[styles.priceInput, { color: theme.text }]}
                        value={formatDigits(payment)}
                        onChangeText={(t) => setPayment(toDigits(t))}
                        placeholder="Dibayar sebagian"
                        placeholderTextColor={theme.textSecondary}
                        keyboardType="number-pad"
                      />
                    </View>
                    <Pressable
                      disabled={saving || !payment}
                      onPress={() => pay(debt, Number(payment))}
                      style={({ pressed }) => [
                        styles.button,
                        { backgroundColor: theme.backgroundSelected },
                        (!payment || saving) && styles.disabled,
                        pressed && styles.pressed,
                      ]}>
                      <ThemedText type="smallBold">Catat</ThemedText>
                    </Pressable>
                  </View>
                  <Pressable
                    disabled={saving}
                    onPress={() => pay(debt, debt.remaining ?? 0)}
                    style={({ pressed }) => [
                      styles.fullButton,
                      { backgroundColor: theme.primary },
                      (pressed || saving) && styles.pressed,
                    ]}>
                    {saving ? (
                      <ActivityIndicator color={theme.onPrimary} />
                    ) : (
                      <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                        Tandai lunas ({formatMoney(debt.remaining ?? 0)})
                      </ThemedText>
                    )}
                  </Pressable>
                </>
              )}
              {payments.length > 0 && (
                <View style={styles.payments}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Riwayat pembayaran
                  </ThemedText>
                  {payments.map((p) => (
                    <View key={p.id} style={styles.inline}>
                      <ThemedText type="small" style={styles.flex}>
                        {paidFormat.format(new Date(p.paid_at))} · {formatMoney(p.amount)}
                        {p.transaction_id ? '' : ' (saldo tidak diubah)'}
                      </ThemedText>
                      <Pressable onPress={() => undo(debt, p.id)} disabled={saving} hitSlop={8}>
                        <ThemedText type="smallBold" themeColor="danger">
                          {confirmUndo === p.id ? 'Yakin batalkan?' : 'Batalkan'}
                        </ThemedText>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
              {error && <ThemedText themeColor="danger">{error}</ThemedText>}
              <Pressable onPress={() => setEditing(true)} hitSlop={8} style={styles.editLink}>
                <ThemedText type="smallBold">Edit catatan</ThemedText>
              </Pressable>
            </View>
          ))}
      </ThemedView>
    );
  }

  const mine = (debts ?? []).filter((d) => d.direction === direction);
  const active = mine.filter((d) => !d.settled);
  const settled = mine.filter((d) => d.settled);
  const total = active.reduce((s, d) => s + (d.remaining ?? 0), 0);

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.safeArea} edges={ModalEdges}>
          <View style={styles.header}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              UTANG & PIUTANG
            </ThemedText>
            <Pressable onPress={closeModal} hitSlop={12}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Tutup
              </ThemedText>
            </Pressable>
          </View>

          <View style={[styles.modes, { backgroundColor: theme.backgroundElement }]}>
            {DIRECTIONS.map((d) => (
              <Pressable
                key={d.value}
                onPress={() => switchDirection(d.value)}
                style={[styles.mode, d.value === direction && { backgroundColor: theme.primary }]}>
                <ThemedText type="smallBold" style={chipText(d.value === direction)}>
                  {d.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {debts === null ? (
            error ? (
              <ThemedText themeColor="danger">{error}</ThemedText>
            ) : (
              <ActivityIndicator style={styles.flex} />
            )
          ) : (
            <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
              <View>
                <ThemedText type="small" themeColor="textSecondary">
                  {meta.hint} · belum lunas
                </ThemedText>
                <ThemedText style={styles.total}>{formatMoney(total)}</ThemedText>
              </View>

              {active.map(renderDebt)}

              {open === 'new' ? (
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="smallBold">{direction === 'OWED_TO_ME' ? 'Piutang baru' : 'Utang baru'}</ThemedText>
                  {form}
                </ThemedView>
              ) : (
                <Pressable
                  onPress={() => openDebt('new')}
                  style={({ pressed }) => [styles.add, { borderColor: theme.textSecondary }, pressed && styles.pressed]}>
                  <ThemedText type="smallBold">+ Catat {direction === 'OWED_TO_ME' ? 'piutang' : 'utang'}</ThemedText>
                </Pressable>
              )}

              {settled.length > 0 && (
                <>
                  <Pressable onPress={() => setShowSettled((s) => !s)} hitSlop={8} style={styles.settledToggle}>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      {showSettled ? 'Sembunyikan' : 'Lihat'} yang sudah lunas ({settled.length})
                    </ThemedText>
                  </Pressable>
                  {showSettled && settled.map(renderDebt)}
                </>
              )}

              <ThemedText type="small" themeColor="textSecondary">
                Membuat catatan utang/piutang tidak mengubah saldo. Saat dibayar, pilih dompetnya supaya saldo ikut
                berubah; membatalkan pembayaran mengembalikan saldonya.
              </ThemedText>
            </ScrollView>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

/** What recording a payment will do, in one line. */
function walletLine(direction: DebtDirection, person: string, wallet: string | null) {
  if (!wallet) return 'Hanya mencatat pembayarannya. Pilih ini kalau uangnya sudah kamu catat sendiri di Catat.';
  return direction === 'OWED_TO_ME'
    ? `Dicatat sebagai pemasukan "Pelunasan Piutang: ${person}", saldo ${wallet} bertambah.`
    : `Dicatat sebagai pengeluaran "Pelunasan Utang: ${person}", saldo ${wallet} berkurang.`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.three,
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
  list: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  total: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: 700,
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  settled: {
    opacity: 0.6,
  },
  debt: {
    gap: Spacing.one,
  },
  form: {
    gap: Spacing.three,
  },
  input: {
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  priceInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: 600,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  right: {
    gap: Spacing.three,
  },
  button: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
  fullButton: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  payments: {
    gap: Spacing.one,
  },
  editLink: {
    alignSelf: 'flex-end',
  },
  add: {
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  settledToggle: {
    alignSelf: 'center',
    padding: Spacing.two,
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.7,
  },
});
