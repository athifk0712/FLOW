import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppSymbol } from '@/components/app-symbol';
import { AssetCategoryPicker } from '@/components/asset-category-picker';
import { DateField } from '@/components/date-field';
import { Field, MoneyField, PrimaryButton, TextField } from '@/components/form-fields';
import { SubScreen } from '@/components/sub-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { type AssetCategory, assetCategory } from '@/constants/asset-categories';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { digitsToAmount } from '@/lib/amount-input';
import { addExistingAsset } from '@/lib/asset-data';
import { formatQuantity, parseQuantity, previewOpening } from '@/lib/assets';
import { formatMoney } from '@/lib/money';
import { newRequestId } from '@/lib/request-id';

// "Catat aset lama": something the user already owned before recording it in Flowku. Nothing is paid now, so no
// wallet is picked and no transaction is created; the wallets, spending, budgets and Safe to Spend stay exactly as
// they are. Only the asset's value joins net worth.
export default function ExistingAssetScreen() {
  const theme = useTheme();
  const [category, setCategory] = useState<AssetCategory>('GAME');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [quantityText, setQuantityText] = useState('1');
  const [cost, setCost] = useState('');
  const [costUnknown, setCostUnknown] = useState(false);
  const [value, setValue] = useState('');
  const [acquiredAt, setAcquiredAt] = useState<Date | null>(null);
  const [note, setNote] = useState('');
  const [requestId] = useState(newRequestId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const info = assetCategory(category);
  const divisible = info.divisible;
  const unitLabel = unit.trim() || null;
  const quantity = divisible ? parseQuantity(quantityText) : 1;
  const costAmount = costUnknown ? null : digitsToAmount(cost);
  const valueAmount = digitsToAmount(value);
  const preview = previewOpening({ cost: costAmount, value: valueAmount, quantity });
  const missing = !name.trim() ? 'Beri nama asetnya.' : preview.problem;

  function pickCategory(next: AssetCategory) {
    setCategory(next);
    const c = assetCategory(next);
    setUnit(c.unit ?? '');
    setQuantityText(c.divisible ? '' : '1');
  }

  async function save() {
    if (missing || saving || !quantity) return;
    setSaving(true);
    setError(null);
    try {
      const id = await addExistingAsset({
        name,
        category,
        unit: divisible ? unitLabel : null,
        divisible,
        quantity,
        cost: costAmount,
        value: valueAmount,
        acquiredAt,
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
    <SubScreen title="Catat aset lama" intro="Aset ini sudah kamu miliki sebelumnya. Saldo dompet tidak akan berubah.">
      <Field label="Jenis aset">
        <AssetCategoryPicker value={category} onChange={pickCategory} />
      </Field>
      <Field label="Nama">
        <TextField value={name} onChangeText={setName} placeholder={info.example} maxLength={80} />
      </Field>

      {divisible && (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Field label={info.trading ? 'Setoran di akun broker' : 'Jumlah dimiliki'}>
              <TextField
                value={quantityText}
                onChangeText={setQuantityText}
                placeholder={info.trading ? 'mis. 100' : 'mis. 2,5'}
                keyboardType="decimal-pad"
                accessibilityLabel="Jumlah unit"
              />
            </Field>
          </View>
          <View style={styles.unit}>
            <Field label="Satuan">
              <TextField value={unit} onChangeText={setUnit} placeholder="gram" maxLength={20} />
            </Field>
          </View>
        </View>
      )}

      <Field
        label={info.trading ? 'Total modal yang sudah disetor' : divisible ? 'Modal perolehan total' : 'Modal perolehan'}
        hint={
          info.trading
            ? 'Uang yang benar-benar kamu setor, bukan nilai kontrak atau lot. Hanya untuk menghitung untung-rugi, tidak memotong saldo.'
            : 'Harga yang dulu kamu bayar, termasuk biaya. Hanya untuk menghitung untung-rugi, tidak memotong saldo.'
        }>
        {!costUnknown && <MoneyField digits={cost} onChange={setCost} accessibilityLabel="Modal perolehan" />}
        <Pressable
          onPress={() => setCostUnknown((u) => !u)}
          style={styles.check}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: costUnknown }}
          hitSlop={6}>
          <View
            style={[
              styles.box,
              { borderColor: theme.primary, backgroundColor: costUnknown ? theme.primary : 'transparent' },
            ]}>
            {costUnknown && <AppSymbol material="check" sf="checkmark" size={14} color={theme.onPrimary} />}
          </View>
          <ThemedText type="small">Tidak ingat modalnya</ThemedText>
        </Pressable>
      </Field>

      <Field
        label={info.trading ? 'Equity sekarang' : divisible ? 'Perkiraan nilai total sekarang' : 'Perkiraan nilai sekarang'}
        hint={
          info.trading
            ? 'Lihat angka equity di aplikasi broker, lalu tulis nilainya dalam mata uang Flowku.'
            : divisible && quantity && valueAmount > 0
              ? `≈ ${formatMoney(Math.round(valueAmount / quantity))} per ${unitLabel ?? 'unit'}`
              : 'Kira-kira laku berapa kalau dijual hari ini.'
        }>
        <MoneyField digits={value} onChange={setValue} accessibilityLabel="Perkiraan nilai sekarang" />
      </Field>

      <Field label="Mulai dimiliki (opsional)">
        <DateField
          value={acquiredAt}
          onChange={setAcquiredAt}
          placeholder="Tidak ingat"
          clearable
          maxDate={new Date()}
          accessibilityLabel="Tanggal mulai dimiliki"
        />
      </Field>

      <Field label="Catatan (opsional)">
        <TextField value={note} onChangeText={setNote} placeholder="mis. dibeli tahun lalu dari teman" maxLength={200} />
      </Field>

      {valueAmount > 0 && !!quantity && (
        <ThemedView type="backgroundElement" style={styles.summary}>
          <ThemedText type="smallBold">Ringkasan</ThemedText>
          <ThemedText type="small">Saldo dompet tidak berubah · tidak dicatat sebagai pengeluaran</ThemedText>
          <ThemedText type="small">
            Nilai aset +{formatMoney(valueAmount)}
            {divisible ? ` untuk ${formatQuantity(quantity, unitLabel)}` : ''}
          </ThemedText>
          {costAmount !== null && costAmount > 0 ? (
            <>
              <ThemedText type="small">Modal {formatMoney(costAmount)}</ThemedText>
              {preview.unrealized !== null && (
                <ThemedText
                  type="small"
                  themeColor={preview.unrealized > 0 ? 'positive' : preview.unrealized < 0 ? 'danger' : undefined}>
                  Potensi {preview.unrealized >= 0 ? 'untung' : 'rugi'} {formatMoney(Math.abs(preview.unrealized))}
                  {preview.percent !== null ? ` (${preview.percent >= 0 ? '+' : ''}${preview.percent}%)` : ''}
                </ThemedText>
              )}
            </>
          ) : costUnknown ? (
            <ThemedText type="small" themeColor="textSecondary">
              Modal tidak diketahui, jadi untung-ruginya tidak dihitung.
            </ThemedText>
          ) : null}
        </ThemedView>
      )}

      {!!missing && (valueAmount > 0 || !!name.trim()) && (
        <ThemedText type="small" themeColor="warning">
          {missing}
        </ThemedText>
      )}
      {error && <ThemedText themeColor="danger">{error}</ThemedText>}
      <PrimaryButton label="Simpan aset" onPress={save} disabled={!!missing} busy={saving} />
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
  check: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 40,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
});
