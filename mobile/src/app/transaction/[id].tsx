import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
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

import { AmountInput } from '@/components/amount-input';
import { DateTimeField } from '@/components/date-time-field';
import { PocketPicker } from '@/components/pockets/pocket-picker';
import { ReceiptPhoto } from '@/components/receipt-photo';
import { CategoryIcon } from '@/components/category-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { NECESSITY, NECESSITY_ORDER, type Necessity } from '@/constants/necessity';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Tables, TablesUpdate } from '@/lib/database.types';
import { formatMoney, getCurrency } from '@/lib/money';
import { closeModal } from '@/lib/navigation';
import { deleteReceipt, type ScanResult, scannedDate } from '@/lib/receipts';
import { supabase } from '@/lib/supabase';
import { isAssetType, isDebtType, TRANSACTION_SELECT, type TransactionRow } from '@/lib/transactions';

type Category = Pick<Tables<'categories'>, 'id' | 'name' | 'kind' | 'icon'>;
type Account = Pick<Tables<'accounts'>, 'id' | 'name' | 'archived_at'>;

const TYPE_LABEL: Record<TransactionRow['type'], string> = {
  EXPENSE: 'PENGELUARAN',
  INCOME: 'PEMASUKAN',
  TRANSFER: 'TRANSFER',
  ASSET_BUY: 'BELI ASET',
  ASSET_SELL: 'JUAL ASET',
  DEBT_OUT: 'UTANG-PIUTANG',
  DEBT_IN: 'UTANG-PIUTANG',
};

// Edit or delete one transaction. The type is fixed; to change it, delete and log it again.
export default function TransactionScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tx, setTx] = useState<TransactionRow | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [digits, setDigits] = useState('');
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [pocketId, setPocketId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [necessity, setNecessity] = useState<Necessity | null>(null);
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [occurredAt, setOccurredAt] = useState(() => new Date());

  // Rows written together with this one: a transfer's admin fee, or the debt payment this settles.
  const [linked, setLinked] = useState<{ fee: number | null; feeOf: boolean; debtPayment: boolean; assetId: string | null }>({
    fee: null,
    feeOf: false,
    debtPayment: false,
    assetId: null,
  });

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('transactions').select(TRANSACTION_SELECT).eq('id', id).single(),
      supabase.from('categories').select('id, name, kind, icon').order('created_at'),
      supabase.from('accounts').select('id, name, archived_at').order('created_at'),
      supabase.from('transactions').select('amount').eq('fee_for_id', id),
      supabase.from('transactions').select('fee_for_id').eq('id', id).single(),
      supabase.from('debt_payments').select('id').eq('transaction_id', id),
      supabase.from('asset_events').select('asset_id').eq('transaction_id', id).maybeSingle(),
    ]).then(([t, cats, accs, fees, own, payments, assetEvent]) => {
      const failed = t.error ?? cats.error ?? accs.error ?? fees.error ?? own.error ?? payments.error ?? assetEvent.error;
      if (failed) return setError(failed.message);
      const row = t.data;
      if (!row) return setError('Transaksi tidak ditemukan.');
      setTx(row);
      setCategories(cats.data ?? []);
      // Archived accounts stay listed only if this transaction already uses them.
      setAccounts(
        (accs.data ?? []).filter(
          (a) => !a.archived_at || a.id === row.from_account_id || a.id === row.to_account_id,
        ),
      );
      setDigits(String(row.amount));
      setFromId(row.from_account_id);
      setToId(row.to_account_id);
      setPocketId(row.pocket_id);
      setCategoryId(row.category_id);
      setNecessity(row.necessity);
      setMerchant(row.merchant ?? '');
      setDescription(row.description ?? '');
      setReceiptId(row.receipt_id);
      setOccurredAt(new Date(row.occurred_at));
      setLinked({
        fee: (fees.data ?? []).reduce((sum, f) => sum + f.amount, 0) || null,
        feeOf: !!own.data?.fee_for_id,
        debtPayment: (payments.data ?? []).length > 0,
        assetId: assetEvent.data?.asset_id ?? null,
      });
    });
  }, [id]);

  const type = tx?.type;
  const amount = Number(digits || '0');
  const accountsValid =
    type === 'EXPENSE'
      ? !!fromId
      : type === 'INCOME'
        ? !!toId
        : !!fromId && !!toId && fromId !== toId;
  const canSave = !!tx && amount > 0 && accountsValid && !saving;

  async function save() {
    if (!canSave || !tx) return;
    setSaving(true);
    setError(null);
    const changes: TablesUpdate<'transactions'> = {
      // A settlement's amount belongs to its debt payment (the database refuses a change).
      ...(linked.debtPayment ? {} : { amount }),
      occurred_at: occurredAt.toISOString(),
      merchant: merchant.trim() || null,
      description: description.trim() || null,
    };
    if (tx.type === 'EXPENSE') Object.assign(changes, { from_account_id: fromId, category_id: categoryId, necessity, pocket_id: pocketId });
    if (tx.type === 'INCOME') Object.assign(changes, { to_account_id: toId, category_id: categoryId, pocket_id: pocketId });
    if (tx.type === 'TRANSFER') Object.assign(changes, { from_account_id: fromId, to_account_id: toId });
    const { error } = await supabase.from('transactions').update(changes).eq('id', tx.id);
    setSaving(false);
    if (error) return setError(error.message);
    closeModal();
  }

  // Fills the form from a receipt scan; nothing is saved until "Simpan perubahan".
  function applyScan(scan: ScanResult) {
    if (scan.total > 0) setDigits(String(scan.total));
    if (scan.merchant) setMerchant(scan.merchant.slice(0, 100));
    const date = scannedDate(scan);
    if (date) setOccurredAt(date);
    const category = categories.find((c) => c.kind === tx?.type && c.name === scan.category);
    if (category && tx?.type !== 'TRANSFER') setCategoryId(category.id);
  }

  async function remove() {
    if (!tx || saving) return;
    // Two taps instead of a dialog, so it works the same on web.
    if (!confirmDelete) return setConfirmDelete(true);
    setSaving(true);
    setError(null);
    const { error } = await supabase.from('transactions').delete().eq('id', tx.id);
    if (!error && receiptId) await deleteReceipt(receiptId);
    setSaving(false);
    if (error) return setError(error.message);
    closeModal();
  }

  const chip = (selected: boolean) => [
    styles.chip,
    { backgroundColor: selected ? theme.primary : theme.backgroundElement },
  ];
  const chipText = (selected: boolean) => ({ color: selected ? theme.onPrimary : theme.text });
  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];

  function accountChips(selectedId: string | null, onPick: (id: string) => void, exclude?: string | null) {
    return (
      <View style={styles.chips}>
        {accounts
          .filter((a) => a.id !== exclude)
          .map((a) => (
            <Pressable key={a.id} onPress={() => onPick(a.id)} style={chip(a.id === selectedId)}>
              <ThemedText type="small" style={chipText(a.id === selectedId)}>
                {a.name}
                {a.archived_at ? ' (diarsipkan)' : ''}
              </ThemedText>
            </Pressable>
          ))}
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.safeArea} edges={ModalEdges}>
          <View style={styles.header}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {type ? `EDIT ${TYPE_LABEL[type]}` : 'TRANSAKSI'}
            </ThemedText>
            <Pressable onPress={closeModal} hitSlop={12}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Batal
              </ThemedText>
            </Pressable>
          </View>

          {!tx ? (
            error ? (
              <ThemedText themeColor="danger">{error}</ThemedText>
            ) : (
              <ActivityIndicator style={styles.flex} />
            )
          ) : isAssetType(tx.type) ? (
            // Buying or selling an asset: its amount and wallet belong to the asset's history.
            <ThemedView type="backgroundElement" style={styles.assetCard}>
              <ThemedText type="smallBold">{tx.merchant ?? (tx.type === 'ASSET_BUY' ? 'Beli aset' : 'Jual aset')}</ThemedText>
              <ThemedText>{formatMoney(tx.amount)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {tx.type === 'ASSET_BUY'
                  ? 'Uang keluar untuk membeli aset. Ini bukan pengeluaran konsumtif: nilainya pindah ke asetmu.'
                  : 'Uang masuk dari penjualan aset (sudah dipotong biaya). Bukan pemasukan biasa.'}{' '}
                Nominal dan dompetnya diatur dari halaman Aset; membatalkannya di sana juga mengembalikan saldo.
              </ThemedText>
              {linked.assetId && (
                <Pressable
                  onPress={() => router.replace({ pathname: '/asset/[id]', params: { id: linked.assetId! } })}
                  style={({ pressed }) => [styles.save, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
                  <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                    Buka aset
                  </ThemedText>
                </Pressable>
              )}
            </ThemedView>
          ) : isDebtType(tx.type) ? (
            // Lending, borrowing or repaying: its amount and wallet belong to the debt.
            <ThemedView type="backgroundElement" style={styles.assetCard}>
              <ThemedText type="smallBold">{tx.merchant ?? 'Utang & piutang'}</ThemedText>
              <ThemedText>{formatMoney(tx.amount)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Uang {tx.type === 'DEBT_OUT' ? 'keluar' : 'masuk'} karena utang-piutang, jadi tidak dihitung sebagai
                pengeluaran atau pemasukan. Nominal dan dompetnya diatur dari halaman Utang & Piutang.
              </ThemedText>
              <Pressable
                onPress={() => router.replace('/debts')}
                style={({ pressed }) => [styles.save, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
                <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                  Buka Utang & Piutang
                </ThemedText>
              </Pressable>
            </ThemedView>
          ) : (
            <>
              <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
                {/* Keyed so the time text resets when the date is set from outside (e.g. a receipt scan). */}
                <DateTimeField key={occurredAt.getTime()} value={occurredAt} onChange={setOccurredAt} />

                {linked.fee && (
                  <ThemedText type="small" themeColor="textSecondary">
                    Biaya admin {formatMoney(linked.fee)} tercatat terpisah sebagai pengeluaran, ikut pindah akun bila
                    akun asal diubah, dan ikut terhapus bila transfer ini dihapus.
                  </ThemedText>
                )}
                {linked.feeOf && (
                  <ThemedText type="small" themeColor="textSecondary">
                    Ini biaya admin sebuah transfer. Akun dan tanggalnya mengikuti transfer itu.
                  </ThemedText>
                )}
                {linked.debtPayment && (
                  <ThemedText type="small" themeColor="textSecondary">
                    Ini pembayaran utang/piutang. Nominalnya diatur dari halaman Utang & Piutang; menghapus transaksi
                    ini membatalkan pembayarannya.
                  </ThemedText>
                )}

                <View style={[styles.priceRow, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText style={styles.prefix}>{getCurrency().symbol.trim()}</ThemedText>
                  <AmountInput
                    digits={digits}
                    onChange={setDigits}
                    label="Nominal"
                    disabled={linked.debtPayment}
                    style={[styles.priceInput, { color: linked.debtPayment ? theme.textSecondary : theme.text }]}
                  />
                </View>

                {tx.type !== 'INCOME' && (
                  <>
                    <ThemedText type="small" themeColor="textSecondary">
                      {tx.type === 'TRANSFER' ? 'Dari akun' : 'Akun bayar'}
                    </ThemedText>
                    {accountChips(fromId, (a) => {
                      setFromId(a);
                      if (a !== fromId) setPocketId(null); // pockets belong to one account
                      if (a === toId) setToId(null);
                    })}
                  </>
                )}

                {tx.type !== 'EXPENSE' && (
                  <>
                    <ThemedText type="small" themeColor="textSecondary">
                      {tx.type === 'TRANSFER' ? 'Ke akun' : 'Masuk ke akun'}
                    </ThemedText>
                    {accountChips(
                      toId,
                      (a) => {
                        if (a !== toId) setPocketId(null);
                        setToId(a);
                      },
                      tx.type === 'TRANSFER' ? fromId : null,
                    )}
                  </>
                )}

                {tx.type !== 'TRANSFER' && !linked.feeOf && (
                  <PocketPicker
                    accountId={tx.type === 'INCOME' ? toId : fromId}
                    value={pocketId}
                    onChange={setPocketId}
                    direction={tx.type === 'INCOME' ? 'in' : 'out'}
                    amount={0}
                  />
                )}

                {tx.type !== 'TRANSFER' && (
                  <>
                    <ThemedText type="small" themeColor="textSecondary">
                      Kategori
                    </ThemedText>
                    <View style={styles.chips}>
                      {categories
                        .filter((c) => c.kind === tx.type)
                        .map((c) => (
                          <Pressable
                            key={c.id}
                            onPress={() => setCategoryId(c.id)}
                            style={[chip(c.id === categoryId), styles.iconChip]}>
                            <CategoryIcon icon={c.icon} size={24} />
                            <ThemedText type="small" style={chipText(c.id === categoryId)}>
                              {c.name}
                            </ThemedText>
                          </Pressable>
                        ))}
                    </View>
                  </>
                )}

                {tx.type === 'EXPENSE' && (
                  <>
                    <ThemedText type="small" themeColor="textSecondary">
                      Penilaian{necessity ? '' : ' (opsional, budget memakai sifat kategorinya)'}
                    </ThemedText>
                    <View style={styles.options}>
                      {NECESSITY_ORDER.map((n) => {
                        const selected = n === necessity;
                        return (
                          <Pressable
                            key={n}
                            onPress={() => setNecessity(selected ? null : n)}
                            style={[
                              styles.option,
                              { borderColor: NECESSITY[n].color },
                              selected && { backgroundColor: NECESSITY[n].color },
                            ]}>
                            <ThemedText type="smallBold" style={selected ? styles.white : undefined}>
                              {NECESSITY[n].label}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                )}

                <ThemedText type="small" themeColor="textSecondary">
                  Struk (langsung tersimpan)
                </ThemedText>
                <ReceiptPhoto
                  transactionId={tx.id}
                  receiptId={receiptId}
                  onChange={setReceiptId}
                  onApplyScan={applyScan}
                />

                <ThemedText type="small" themeColor="textSecondary">
                  Nama / toko (opsional)
                </ThemedText>
                <TextInput
                  style={inputStyle}
                  value={merchant}
                  onChangeText={setMerchant}
                  placeholder={tx.type === 'TRANSFER' ? 'Mis. Isi saldo GoPay' : 'Mis. Warteg Bahari'}
                  placeholderTextColor={theme.textSecondary}
                  maxLength={100}
                />

                <ThemedText type="small" themeColor="textSecondary">
                  Catatan (opsional)
                </ThemedText>
                <TextInput
                  style={[inputStyle, styles.multiline]}
                  value={description}
                  onChangeText={setDescription}
                  placeholderTextColor={theme.textSecondary}
                  multiline
                />

                {error && <ThemedText themeColor="danger">{error}</ThemedText>}

                <Pressable onPress={remove} disabled={saving} style={styles.delete} hitSlop={8}>
                  <ThemedText type="smallBold" themeColor="danger">
                    {confirmDelete
                      ? linked.fee
                        ? 'Ketuk lagi: transfer + biaya adminnya dihapus'
                        : 'Ketuk lagi untuk menghapus'
                      : 'Hapus transaksi'}
                  </ThemedText>
                </Pressable>
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
                    Simpan perubahan
                  </ThemedText>
                )}
              </Pressable>
            </>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  assetCard: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
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
  flex: {
    flex: 1,
    maxWidth: MaxContentWidth,
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
  form: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  input: {
    fontSize: 18,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  prefix: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 700,
  },
  priceInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: 700,
    paddingVertical: Spacing.three,
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
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  option: {
    flexGrow: 1,
    width: '45%',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
  },
  white: {
    color: '#ffffff',
  },
  delete: {
    alignSelf: 'center',
    padding: Spacing.three,
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
