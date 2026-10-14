import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppSymbol } from '@/components/app-symbol';
import { ChipRow, Field, MoneyField, PrimaryButton, TextField } from '@/components/form-fields';
import { SubScreen } from '@/components/sub-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { assetCategory } from '@/constants/asset-categories';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { digitsToAmount } from '@/lib/amount-input';
import { type Asset, type AssetEvent, deleteAsset, loadAsset, sellAsset, undoAssetEvent, valueAsset } from '@/lib/asset-data';
import { formatQuantity, parseQuantity, plPercent, previewSale } from '@/lib/assets';
import { formatMoney } from '@/lib/money';
import { closeModal } from '@/lib/navigation';
import { newRequestId } from '@/lib/request-id';
import { supabase } from '@/lib/supabase';

type Panel = 'value' | 'sell' | null;

const dateFormat = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

const SOURCE_LABEL: Record<string, string> = {
  MANUAL: 'Estimasi kamu',
  PURCHASE: 'Harga beli terakhir',
  SALE: 'Harga jual terakhir',
};

// One asset: what it is worth (an estimate), what it cost, the P/L, and its history. Updating the value never moves
// money; selling puts the net proceeds into a wallet and records the realized P/L.
export default function AssetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [events, setEvents] = useState<AssetEvent[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      loadAsset(id).then(
        (loaded) => {
          setAsset(loaded.asset);
          setEvents(loaded.events);
        },
        (e) => setError(e instanceof Error ? e.message : 'Aset tidak ditemukan.'),
      ),
    [id],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function act(action: () => Promise<void>, after?: () => void) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      setConfirm(null);
      after?.();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal.');
    } finally {
      setBusy(false);
    }
  }

  if (!asset) {
    return (
      <SubScreen title="Aset">
        {error ? <ThemedText themeColor="danger">{error}</ThemedText> : <ActivityIndicator />}
      </SubScreen>
    );
  }

  const info = assetCategory(asset.category);
  const quantity = Number(asset.quantity ?? 0);
  const active = asset.status === 'ACTIVE';
  const cost = asset.cost_basis ?? 0;
  const unrealized = asset.unrealized_pl ?? 0;
  const pct = plPercent(unrealized, cost);
  const realized = asset.realized_pl ?? 0;
  const latest = events[0];
  const canUndo = !!latest && !(latest.kind === 'BUY' && events.filter((e) => e.kind === 'BUY').length === 1);

  return (
    <SubScreen title={asset.name ?? 'Aset'}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: `${info.color}22` }]}>
            <AppSymbol material={info.material} sf={info.sf} size={22} color={info.color} />
          </View>
          <View style={styles.flex}>
            <ThemedText type="smallBold" numberOfLines={2}>
              {asset.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {info.label}
              {asset.divisible ? ` · ${formatQuantity(quantity, asset.unit)}` : ''}
              {active ? '' : ' · sudah terjual'}
            </ThemedText>
          </View>
        </View>

        {active ? (
          <>
            <View>
              <ThemedText type="small" themeColor="textSecondary">
                Estimasi nilai sekarang
              </ThemedText>
              <ThemedText style={styles.big}>{formatMoney(asset.current_value ?? 0)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {SOURCE_LABEL[asset.value_source ?? 'PURCHASE']}
                {asset.divisible && asset.unit_value != null ? ` ${formatMoney(Math.round(asset.unit_value))}/${asset.unit ?? 'unit'}` : ''}
                {asset.valued_at ? ` · ${dateFormat.format(new Date(asset.valued_at))}` : ''}
              </ThemedText>
            </View>
            <Line label="Modal (harga + biaya beli)" value={formatMoney(cost)} />
            <Line
              label="Potensi untung/rugi"
              value={`${unrealized >= 0 ? '+' : ''}${formatMoney(unrealized)}${pct !== null ? ` (${pct >= 0 ? '+' : ''}${pct}%)` : ''}`}
              tone={unrealized > 0 ? 'positive' : unrealized < 0 ? 'danger' : undefined}
            />
          </>
        ) : (
          <Line label="Hasil bersih penjualan" value={formatMoney(asset.net_proceeds ?? 0)} />
        )}
        {realized !== 0 && (
          <Line
            label="Untung/rugi terealisasi"
            value={`${realized >= 0 ? '+' : ''}${formatMoney(realized)}`}
            tone={realized > 0 ? 'positive' : 'danger'}
          />
        )}
        <ThemedText type="small" themeColor="textSecondary">
          Nilai ini estimasi, belum tentu bisa langsung dicairkan, dan tidak ikut dihitung di &quot;Aman dibelanjakan&quot;.
          Harga belum diperbarui otomatis dari pasar; perbarui sendiri bila perlu.
        </ThemedText>
      </ThemedView>

      {active && (
        <View style={styles.actions}>
          <Action label="Perbarui nilai" material="edit" sf="pencil" on={panel === 'value'} onPress={() => setPanel(panel === 'value' ? null : 'value')} />
          <Action label="Jual" material="sell" sf="tag.fill" on={panel === 'sell'} onPress={() => setPanel(panel === 'sell' ? null : 'sell')} />
          {asset.divisible && (
            <Action
              label="Beli lagi"
              material="add"
              sf="plus"
              on={false}
              onPress={() => router.push({ pathname: '/asset-buy', params: { assetId: asset.id! } })}
            />
          )}
        </View>
      )}

      {panel === 'value' && <ValuePanel asset={asset} busy={busy} onSave={(value, note, req) => act(() => valueAsset(asset.id!, value, note, req), () => setPanel(null))} />}
      {panel === 'sell' && (
        <SellPanel
          asset={asset}
          busy={busy}
          onSell={(input) => act(() => sellAsset({ ...input, assetId: asset.id! }), () => setPanel(null))}
        />
      )}
      {error && <ThemedText themeColor="danger">{error}</ThemedText>}

      <ThemedText type="smallBold" themeColor="textSecondary">
        RIWAYAT
      </ThemedText>
      {events.map((e, i) => (
        <ThemedView key={e.id} type="backgroundElement" style={styles.event}>
          <View style={styles.row}>
            <ThemedText type="smallBold" style={styles.flex}>
              {eventTitle(e, asset)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {dateFormat.format(new Date(e.occurred_at))}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {eventDetail(e, asset)}
          </ThemedText>
          {!!e.note && (
            <ThemedText type="small" themeColor="textSecondary">
              {e.note}
            </ThemedText>
          )}
          {i === 0 && canUndo && (
            <Pressable
              onPress={() => (confirm === e.id ? act(() => undoAssetEvent(e.id)) : setConfirm(e.id))}
              hitSlop={8}
              style={styles.end}>
              <ThemedText type="small" themeColor="danger">
                {confirm === e.id
                  ? e.transaction_id
                    ? 'Yakin? Uangnya juga dikembalikan'
                    : 'Yakin batalkan?'
                  : 'Batalkan'}
              </ThemedText>
            </Pressable>
          )}
        </ThemedView>
      ))}

      <Pressable
        onPress={() =>
          confirm === 'delete' ? act(() => deleteAsset(asset.id!), () => closeModal()) : setConfirm('delete')
        }
        hitSlop={8}
        style={styles.center}>
        <ThemedText type="small" themeColor="danger">
          {confirm === 'delete'
            ? 'Ketuk lagi: hapus aset & semua riwayatnya (saldo dompet ikut dikembalikan)'
            : 'Hapus aset'}
        </ThemedText>
      </Pressable>
    </SubScreen>
  );
}

function eventTitle(e: AssetEvent, asset: Asset) {
  const qty = asset.divisible && e.quantity ? ` ${formatQuantity(Number(e.quantity), asset.unit)}` : '';
  if (e.kind === 'BUY') return `Beli${qty}`;
  if (e.kind === 'SELL') return `Jual${qty}`;
  return 'Perbarui nilai';
}

function eventDetail(e: AssetEvent, asset: Asset) {
  if (e.kind === 'VALUATION') {
    const v = Math.round(Number(e.unit_value ?? 0));
    return asset.divisible ? `Estimasi ${formatMoney(v)} per ${asset.unit ?? 'unit'}` : `Estimasi ${formatMoney(v)}`;
  }
  if (e.kind === 'BUY') {
    return `Harga ${formatMoney(e.amount ?? 0)}${e.fee ? ` + biaya ${formatMoney(e.fee)}` : ''} = keluar ${formatMoney((e.amount ?? 0) + e.fee)}`;
  }
  const net = (e.amount ?? 0) - e.fee - e.tax;
  const pl = net - (e.cost_allocated ?? 0);
  return (
    `Harga jual ${formatMoney(e.amount ?? 0)}` +
    `${e.fee ? ` − biaya ${formatMoney(e.fee)}` : ''}${e.tax ? ` − pajak ${formatMoney(e.tax)}` : ''}` +
    ` = masuk ${formatMoney(net)} · modal ${formatMoney(e.cost_allocated ?? 0)} · ${pl >= 0 ? 'untung' : 'rugi'} ${formatMoney(Math.abs(pl))}`
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'danger' }) {
  return (
    <View style={styles.line}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold" themeColor={tone}>
        {value}
      </ThemedText>
    </View>
  );
}

function Action({ label, material, sf, on, onPress }: { label: string; material: string; sf: string; on: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: on }}
      style={({ pressed }) => [styles.action, { backgroundColor: on ? theme.primary : theme.backgroundElement }, pressed && styles.pressed]}>
      <AppSymbol material={material} sf={sf} size={18} color={on ? theme.onPrimary : theme.primary} />
      <ThemedText type="smallBold" style={{ color: on ? theme.onPrimary : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function ValuePanel({ asset, busy, onSave }: { asset: Asset; busy: boolean; onSave: (unitValue: number, note: string, requestId: string) => void }) {
  const [digits, setDigits] = useState('');
  const [note, setNote] = useState('');
  const [requestId] = useState(newRequestId);
  const value = digitsToAmount(digits);
  const quantity = Number(asset.quantity ?? 0);
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <Field
        label={asset.divisible ? `Harga per ${asset.unit ?? 'unit'} sekarang` : 'Perkiraan harga jual sekarang'}
        hint={asset.divisible && value > 0 ? `Total ${formatQuantity(quantity, asset.unit)} ≈ ${formatMoney(Math.round(value * quantity))}` : undefined}>
        <MoneyField digits={digits} onChange={setDigits} accessibilityLabel="Nilai baru" />
      </Field>
      <TextField value={note} onChangeText={setNote} placeholder="Sumber harga (opsional), mis. cek di grup jual beli" maxLength={200} />
      <ThemedText type="small" themeColor="textSecondary">
        Hanya mengubah estimasi. Saldo dompet tidak berubah dan tidak dicatat sebagai pemasukan.
      </ThemedText>
      <PrimaryButton label="Simpan nilai" onPress={() => onSave(value, note, requestId)} disabled={value <= 0} busy={busy} />
    </ThemedView>
  );
}

function SellPanel({
  asset,
  busy,
  onSell,
}: {
  asset: Asset;
  busy: boolean;
  onSell: (input: { quantity: number; gross: number; fee: number; tax: number; accountId: string; note: string; requestId: string }) => void;
}) {
  const held = Number(asset.quantity ?? 0);
  const [quantityText, setQuantityText] = useState(asset.divisible ? '' : '1');
  const [gross, setGross] = useState('');
  const [fee, setFee] = useState('');
  const [tax, setTax] = useState('');
  const [note, setNote] = useState('');
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [requestId] = useState(newRequestId);

  useFocusEffect(
    useCallback(() => {
      supabase
        .from('accounts')
        .select('id, name')
        .is('archived_at', null)
        .order('created_at')
        .then(({ data }) => {
          setAccounts(data ?? []);
          setAccountId((current) => current ?? data?.[0]?.id ?? null);
        });
    }, []),
  );

  const quantity = asset.divisible ? parseQuantity(quantityText) : held;
  const preview = previewSale({
    held,
    costBasis: asset.cost_basis ?? 0,
    divisible: !!asset.divisible,
    quantity,
    gross: digitsToAmount(gross),
    fee: digitsToAmount(fee),
    tax: digitsToAmount(tax),
  });
  const grossAmount = digitsToAmount(gross);
  const ready = !preview.problem && grossAmount > 0 && !!accountId;
  const wallet = accounts.find((a) => a.id === accountId)?.name ?? '';

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {asset.divisible && (
        <Field label={`Jumlah dijual (punya ${formatQuantity(held, asset.unit)})`}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField value={quantityText} onChangeText={setQuantityText} placeholder="mis. 1,5" keyboardType="decimal-pad" />
            </View>
            <Pressable onPress={() => setQuantityText(String(held).replace('.', ','))} hitSlop={8}>
              <ThemedText type="smallBold" themeColor="primary">
                Semua
              </ThemedText>
            </Pressable>
          </View>
        </Field>
      )}
      <Field label="Harga jual (kotor)">
        <MoneyField digits={gross} onChange={setGross} accessibilityLabel="Harga jual" />
      </Field>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Field label="Biaya jual">
            <MoneyField digits={fee} onChange={setFee} accessibilityLabel="Biaya jual" />
          </Field>
        </View>
        <View style={styles.flex}>
          <Field label="Pajak (jika ada)">
            <MoneyField digits={tax} onChange={setTax} accessibilityLabel="Pajak" />
          </Field>
        </View>
      </View>
      <Field label="Uangnya masuk ke">
        <ChipRow options={accounts.map((a) => ({ value: a.id, label: a.name }))} value={accountId} onChange={setAccountId} />
      </Field>
      <TextField value={note} onChangeText={setNote} placeholder="Catatan (opsional), mis. dijual ke pembeli di grup" maxLength={200} />

      {grossAmount > 0 && !!quantity && !preview.problem && (
        <View style={styles.preview}>
          <Line label={`Masuk ke ${wallet}`} value={formatMoney(preview.net)} />
          <Line label="Modal unit yang dijual" value={formatMoney(preview.costOfSold)} />
          <Line
            label={preview.realized >= 0 ? 'Untung' : 'Rugi'}
            value={`${preview.realized >= 0 ? '+' : '−'}${formatMoney(Math.abs(preview.realized))}`}
            tone={preview.realized > 0 ? 'positive' : preview.realized < 0 ? 'danger' : undefined}
          />
          {preview.realized < 0 && (
            <ThemedText type="small" themeColor="danger">
              Penjualan ini rugi {formatMoney(-preview.realized)} dari modal. Tetap bisa disimpan kalau memang begitu.
            </ThemedText>
          )}
        </View>
      )}
      {preview.problem && grossAmount > 0 && (
        <ThemedText type="small" themeColor="warning">
          {preview.problem}
        </ThemedText>
      )}
      <PrimaryButton
        label={preview.realized < 0 && ready ? 'Jual walau rugi' : 'Jual sekarang'}
        tone={preview.realized < 0 ? 'danger' : 'primary'}
        disabled={!ready}
        busy={busy}
        onPress={() =>
          accountId &&
          quantity &&
          onSell({ quantity, gross: grossAmount, fee: digitsToAmount(fee), tax: digitsToAmount(tax), accountId, note, requestId })
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  big: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: 700,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  preview: {
    gap: Spacing.one,
  },
  event: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  end: {
    alignSelf: 'flex-end',
  },
  center: {
    alignSelf: 'center',
    padding: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
