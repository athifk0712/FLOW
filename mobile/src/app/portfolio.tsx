import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppSymbol } from '@/components/app-symbol';
import { PrimaryButton } from '@/components/form-fields';
import { SubScreen } from '@/components/sub-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { type AssetCategory, ASSET_CATEGORIES, assetCategory } from '@/constants/asset-categories';
import { Spacing } from '@/constants/theme';
import { useCycleDay } from '@/hooks/use-cycle-day';
import { useTheme } from '@/hooks/use-theme';
import { type Asset, listAssets, listSales } from '@/lib/asset-data';
import { formatQuantity, plPercent, realizedBetween, type SaleEvent, summarizeAssets } from '@/lib/assets';
import { cycleRange } from '@/lib/cycle';
import { formatMoney } from '@/lib/money';

type Period = 'cycle' | 'all';

// Aset: what the user owns besides cash (game accounts, gold, stocks, crypto, ...). Values are estimates; they never
// count as spendable money, and buying or selling moves cash without counting as spending or income.
export default function AssetsScreen() {
  const theme = useTheme();
  const { day: cycleDay } = useCycleDay();
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [sales, setSales] = useState<SaleEvent[]>([]);
  const [filter, setFilter] = useState<AssetCategory | 'ALL'>('ALL');
  const [period, setPeriod] = useState<Period>('cycle');
  const [showSold, setShowSold] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([listAssets(), listSales()]).then(
        ([list, sold]) => {
          setError(null);
          setAssets(list);
          setSales(sold);
        },
        (e) => setError(e instanceof Error ? e.message : 'Gagal memuat aset.'),
      );
    }, []),
  );

  if (assets === null) {
    return (
      <SubScreen title="Aset">{error ? <ThemedText themeColor="danger">{error}</ThemedText> : <ActivityIndicator />}</SubScreen>
    );
  }

  const summary = summarizeAssets(assets);
  const pct = plPercent(summary.unrealized, summary.cost);
  const range = cycleRange(new Date(), cycleDay);
  const realized = period === 'all' ? summary.realized : realizedBetween(sales, range.start, range.end);
  const shown = assets.filter((a) => filter === 'ALL' || a.category === filter);
  const active = shown.filter((a) => a.status === 'ACTIVE');
  const sold = shown.filter((a) => a.status !== 'ACTIVE');
  const usedCategories = ASSET_CATEGORIES.filter((c) => assets.some((a) => a.category === c.value));

  return (
    <SubScreen title="Aset">
      {assets.length === 0 ? (
        <ThemedView type="backgroundElement" style={styles.card}>
          <AppSymbol material="savings" sf="dollarsign.circle.fill" size={36} color={theme.accent} />
          <ThemedText type="subtitle" style={styles.title}>
            Catat yang kamu miliki
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            Akun game, emas, saham, kripto, barang koleksi, atau aset usaha. Lihat modalnya, perkirakan nilainya
            sekarang, dan ketahui untung-ruginya saat dijual.
          </ThemedText>
        </ThemedView>
      ) : (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small" themeColor="textSecondary">
            Estimasi nilai aset aktif
          </ThemedText>
          <ThemedText style={styles.big}>{formatMoney(summary.value)}</ThemedText>
          <Line label="Modal aset aktif" value={formatMoney(summary.cost)} />
          <Line
            label="Potensi untung/rugi"
            value={`${summary.unrealized >= 0 ? '+' : ''}${formatMoney(summary.unrealized)}${pct !== null ? ` (${pct >= 0 ? '+' : ''}${pct}%)` : ''}`}
            tone={summary.unrealized > 0 ? 'positive' : summary.unrealized < 0 ? 'danger' : undefined}
          />
          <View style={styles.line}>
            <View style={styles.flex}>
              <ThemedText type="small" themeColor="textSecondary">
                Untung/rugi dari penjualan
              </ThemedText>
              <View style={styles.periods}>
                {(['cycle', 'all'] as const).map((p) => (
                  <Pressable key={p} onPress={() => setPeriod(p)} hitSlop={6}>
                    <ThemedText type="small" themeColor={period === p ? 'primary' : 'textSecondary'} style={period === p && styles.bold}>
                      {p === 'cycle' ? 'Bulan ini' : 'Semua'}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
            <ThemedText type="smallBold" themeColor={realized > 0 ? 'positive' : realized < 0 ? 'danger' : undefined}>
              {realized >= 0 ? '+' : ''}
              {formatMoney(realized)}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Estimasi, bukan uang yang siap dipakai: tidak dihitung di &quot;Aman dibelanjakan&quot;.
          </ThemedText>
        </ThemedView>
      )}

      <PrimaryButton label="+ Beli / tambah aset" onPress={() => router.push('/asset-buy')} />

      {usedCategories.length > 1 && (
        <View style={styles.filters}>
          {[{ value: 'ALL' as const, label: 'Semua' }, ...usedCategories].map((c) => {
            const on = filter === c.value;
            return (
              <Pressable
                key={c.value}
                onPress={() => setFilter(c.value)}
                style={[styles.filter, { backgroundColor: on ? theme.primary : theme.backgroundElement }]}>
                <ThemedText type="small" style={{ color: on ? theme.onPrimary : theme.text }}>
                  {c.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      )}

      {active.map((a) => (
        <AssetCard key={a.id} asset={a} />
      ))}

      {sold.length > 0 && (
        <>
          <Pressable onPress={() => setShowSold((s) => !s)} hitSlop={8} style={styles.center}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {showSold ? 'Sembunyikan' : 'Lihat'} yang sudah terjual ({sold.length})
            </ThemedText>
          </Pressable>
          {showSold && sold.map((a) => <AssetCard key={a.id} asset={a} />)}
        </>
      )}
      {error && <ThemedText themeColor="danger">{error}</ThemedText>}
    </SubScreen>
  );
}

// What each kind needs on its card: a game account its cost and estimated selling price; gold, stocks and crypto
// the amount held and the price per unit as well.
function AssetCard({ asset }: { asset: Asset }) {
  const theme = useTheme();
  const info = assetCategory(asset.category);
  const active = asset.status === 'ACTIVE';
  const pl = active ? (asset.unrealized_pl ?? 0) : (asset.realized_pl ?? 0);
  const pct = plPercent(pl, active ? (asset.cost_basis ?? 0) : (asset.invested ?? 0));
  const detail = active
    ? asset.divisible
      ? `${formatQuantity(Number(asset.quantity ?? 0), asset.unit)} · ${formatMoney(Math.round(asset.unit_value ?? 0))}/${asset.unit ?? 'unit'} · modal ${formatMoney(asset.cost_basis ?? 0)}`
      : `Modal ${formatMoney(asset.cost_basis ?? 0)} · ${asset.value_source === 'MANUAL' ? 'estimasi jual' : 'belum dinilai ulang'}`
    : `Terjual · hasil bersih ${formatMoney(asset.net_proceeds ?? 0)}`;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/asset/[id]', params: { id: asset.id! } })}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={[styles.item, !active && styles.dim]}>
        <View style={[styles.icon, { backgroundColor: `${info.color}22` }]}>
          <AppSymbol material={info.material} sf={info.sf} size={20} color={info.color} />
        </View>
        <View style={styles.flex}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {asset.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {detail}
          </ThemedText>
        </View>
        <View style={styles.right}>
          <ThemedText type="smallBold">{formatMoney(active ? (asset.current_value ?? 0) : (asset.net_proceeds ?? 0))}</ThemedText>
          <ThemedText type="small" style={{ color: pl > 0 ? theme.positive : pl < 0 ? theme.danger : theme.textSecondary }}>
            {pl >= 0 ? '+' : ''}
            {formatMoney(pl)}
            {pct !== null ? ` (${pct >= 0 ? '+' : ''}${pct}%)` : ''}
          </ThemedText>
        </View>
      </ThemedView>
    </Pressable>
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

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
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
  periods: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  bold: {
    fontWeight: 700,
  },
  flex: {
    flex: 1,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  filter: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  right: {
    alignItems: 'flex-end',
    maxWidth: '45%',
  },
  dim: {
    opacity: 0.65,
  },
  center: {
    alignSelf: 'center',
    padding: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
