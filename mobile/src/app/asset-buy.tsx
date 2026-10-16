import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppSymbol } from '@/components/app-symbol';
import { AssetCategoryPicker } from '@/components/asset-category-picker';
import { DateTimeField } from '@/components/date-time-field';
import { ChipRow, Field, MoneyField, PrimaryButton, TextField } from '@/components/form-fields';
import { SubScreen } from '@/components/sub-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { type AssetCategory, assetCategory } from '@/constants/asset-categories';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { digitsToAmount } from '@/lib/amount-input';
import { type Asset, buyAsset, loadAsset } from '@/lib/asset-data';
import { formatQuantity, parseQuantity } from '@/lib/assets';
import { formatMoney } from '@/lib/money';
import { newRequestId } from '@/lib/request-id';
import { supabase } from '@/lib/supabase';

const whenFormat = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Buying an asset: a new one, or more units of one you already hold (?assetId=). The wallet pays price + fee in one
// step together with the asset record; the fee counts towards what the asset cost you (its cost basis).
export default function AssetBuyScreen() {
  const theme = useTheme();
  const { assetId } = useLocalSearchParams<{ assetId?: string }>();
  const [existing, setExisting] = useState<Asset | null>(null);
  const [category, setCategory] = useState<AssetCategory>('GAME');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [quantityText, setQuantityText] = useState('1');
  const [price, setPrice] = useState('');
  const [fee, setFee] = useState('');
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [occurredAt, setOccurredAt] = useState<Date | null>(null);
  const [pickingDate, setPickingDate] = useState(false);
  const [note, setNote] = useState('');
  const [requestId] = useState(newRequestId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('accounts')
      .select('id, name')
      .is('archived_at', null)
      .order('created_at')
      .then(({ data, error }) => {
        if (error) return setError(error.message);
        setAccounts(data ?? []);
        setAccountId(data?.[0]?.id ?? null);
      });
    if (assetId) {
      loadAsset(assetId).then(
        ({ asset }) => {
          setExisting(asset);
          setQuantityText('');
        },
        (e) => setError(e instanceof Error ? e.message : 'Aset tidak ditemukan.'),
      );
    }
  }, [assetId]);

  const info = assetCategory(existing?.category ?? category);
  const divisible = existing ? !!existing.divisible : info.divisible;
  const unitLabel = (existing ? existing.unit : unit.trim()) || null;
  const quantity = divisible ? parseQuantity(quantityText) : 1;
  const priceAmount = digitsToAmount(price);
  const feeAmount = digitsToAmount(fee);
  const total = priceAmount + feeAmount;
  const accountName = accounts.find((a) => a.id === accountId)?.name ?? '';
  const missing = !existing && !name.trim()
    ? 'Beri nama asetnya.'
    : !quantity
      ? 'Isi jumlahnya (mis. 2,5).'
      : priceAmount <= 0
        ? 'Isi harga belinya.'
        : !accountId
          ? 'Pilih dompet yang dipakai membayar.'
          : null;

  function pickCategory(next: AssetCategory) {
    setCategory(next);
    const c = assetCategory(next);
    setUnit(c.unit ?? '');
    setQuantityText(c.divisible ? '' : '1');
  }

  async function save() {
    if (missing || saving || !quantity || !accountId) return;
    setSaving(true);
    setError(null);
    try {
      const id = await buyAsset({
        assetId: existing?.id ?? null,
        name,
        category,
        unit: divisible ? unit.trim() || null : null,
        divisible,
        quantity,
        price: priceAmount,
        fee: feeAmount,
        accountId,
        occurredAt,
        note,
        requestId,
      });
      router.replace({ pathname: '/asset/[id]', params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
      setSaving(false);
    }
  }

  return (
    <SubScreen
      title={existing ? `Beli lagi: ${existing.name}` : 'Beli aset baru'}
      intro="Untuk pembelian sekarang: saldo dompet berkurang. Uangnya pindah ke aset, jadi bukan pengeluaran harian. Sudah punya asetnya dari dulu? Pakai Catat aset lama.">
      {!existing && (
        <>
          <Field label="Jenis aset">
            <AssetCategoryPicker value={category} onChange={pickCategory} />
          </Field>
          <Field label="Nama">
            <TextField value={name} onChangeText={setName} placeholder={info.example} maxLength={80} />
          </Field>
        </>
      )}

      {divisible && (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Field label="Jumlah">
              <TextField
                value={quantityText}
                onChangeText={setQuantityText}
                placeholder="mis. 2,5"
                keyboardType="decimal-pad"
                accessibilityLabel="Jumlah unit"
              />
            </Field>
          </View>
          {!existing && (
            <View style={styles.unit}>
              <Field label="Satuan">
                <TextField value={unit} onChangeText={setUnit} placeholder="gram" maxLength={20} />
              </Field>
            </View>
          )}
        </View>
      )}

      <Field
        label={divisible ? 'Harga beli total' : 'Harga beli'}
        hint={
          divisible && quantity && priceAmount > 0
            ? `≈ ${formatMoney(Math.round(priceAmount / quantity))} per ${unitLabel ?? 'unit'}`
            : undefined
        }>
        <MoneyField digits={price} onChange={setPrice} accessibilityLabel="Harga beli" />
      </Field>
      <Field label="Biaya tambahan (opsional)" hint="Mis. biaya admin, jasa perantara, ongkos kirim. Dihitung sebagai modal aset.">
        <MoneyField digits={fee} onChange={setFee} accessibilityLabel="Biaya tambahan" />
      </Field>

      <Field label="Bayar pakai">
        {accounts.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Belum ada dompet. Tambahkan dulu di Akun & dompet.
          </ThemedText>
        ) : (
          <ChipRow options={accounts.map((a) => ({ value: a.id, label: a.name }))} value={accountId} onChange={setAccountId} />
        )}
      </Field>

      <Field label="Tanggal beli">
        <Pressable
          onPress={() => setPickingDate((p) => !p)}
          style={[styles.when, { backgroundColor: theme.backgroundElement }]}
          accessibilityRole="button">
          <AppSymbol material="calendar_month" sf="calendar" size={18} color={theme.primary} />
          <ThemedText type="small" style={styles.flex}>
            {occurredAt ? whenFormat.format(occurredAt) : 'Sekarang'}
          </ThemedText>
          <ThemedText type="smallBold" themeColor="primary">
            {pickingDate ? 'Selesai' : 'Ubah'}
          </ThemedText>
        </Pressable>
        {pickingDate && <DateTimeField value={occurredAt ?? new Date()} onChange={setOccurredAt} />}
      </Field>

      <Field label="Catatan (opsional)">
        <TextField value={note} onChangeText={setNote} placeholder="mis. beli dari grup jual beli" maxLength={200} />
      </Field>

      {total > 0 && !!accountId && !!quantity && (
        <ThemedView type="backgroundElement" style={styles.summary}>
          <ThemedText type="smallBold">Ringkasan</ThemedText>
          <ThemedText type="small">
            {accountName} berkurang {formatMoney(total)}
          </ThemedText>
          <ThemedText type="small">
            Modal aset {formatMoney(total)}
            {feeAmount > 0 ? ` (harga ${formatMoney(priceAmount)} + biaya ${formatMoney(feeAmount)})` : ''}
            {divisible ? ` untuk ${formatQuantity(quantity, unitLabel)}` : ''}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Nilai awal aset dicatat sesuai harga beli ({formatMoney(priceAmount)}). Kekayaan bersihmu hanya turun sebesar
            biaya tambahannya.
          </ThemedText>
        </ThemedView>
      )}

      {!!missing && (priceAmount > 0 || !!name.trim()) && (
        <ThemedText type="small" themeColor="warning">
          {missing}
        </ThemedText>
      )}
      {error && <ThemedText themeColor="danger">{error}</ThemedText>}
      <PrimaryButton
        label={!missing && total > 0 ? `Bayar ${formatMoney(total)} dari ${accountName}` : 'Simpan pembelian'}
        onPress={save}
        disabled={!!missing}
        busy={saving}
      />
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  unit: {
    width: 120,
  },
  when: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  summary: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
});
