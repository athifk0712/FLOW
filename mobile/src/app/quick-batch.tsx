import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ChipRow, Field, PrimaryButton, TextField } from '@/components/form-fields';
import { SubScreen } from '@/components/sub-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { announceSaved } from '@/lib/last-saved';
import { formatMoney, useCurrency } from '@/lib/money';
import { closeModal } from '@/lib/navigation';
import { batchTitle, matchCategory, parseBatch } from '@/lib/quick-batch';
import { loadBatchContext, saveBatch } from '@/lib/quick-batch-data';
import { newRequestId } from '@/lib/request-id';

type Context = Awaited<ReturnType<typeof loadBatchContext>>;
type Day = 'today' | 'yesterday';

const DAYS: { value: Day; label: string }[] = [
  { value: 'today', label: 'Hari ini' },
  { value: 'yesterday', label: 'Kemarin' },
];

// Several expenses in one go: type them as one line, check the list, save them all. Each row's category can be changed
// with a tap; a word that isn't recognised lands in Lainnya, so nothing has to be filled in one by one.
export default function QuickBatchScreen() {
  const theme = useTheme();
  const currency = useCurrency();
  const [context, setContext] = useState<Context | null>(null);
  const [text, setText] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [day, setDay] = useState<Day>('today');
  // Categories picked by hand, by the row's name, so they survive further typing.
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIds = useRef<string[]>([]);

  useEffect(() => {
    loadBatchContext().then(
      (loaded) => {
        setContext(loaded);
        setAccountId(loaded.defaultAccountId);
      },
      (e) => setError(e instanceof Error ? e.message : 'Gagal memuat.'),
    );
  }, []);

  const parsed = useMemo(() => parseBatch(text, currency.decimals), [text, currency.decimals]);
  const rows = parsed.entries.map((entry, index) => {
    const key = `${index}:${entry.label.toLowerCase()}`;
    const category =
      context?.categories.find((c) => c.id === picked[entry.label.toLowerCase()]) ??
      (context ? matchCategory(entry.label, context.categories, context.history) : null);
    return { ...entry, key, category };
  });
  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  const canSave = rows.length > 0 && !!accountId && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const now = new Date();
    const occurredAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day === 'yesterday' ? 1 : 0), now.getHours(), now.getMinutes());
    try {
      await saveBatch(
        rows.map((r, i) => {
          requestIds.current[i] ??= newRequestId();
          return {
            type: 'EXPENSE',
            amount: r.amount,
            from_account_id: accountId,
            category_id: r.category?.id ?? null,
            merchant: batchTitle(r.label, r.category?.name),
            occurred_at: occurredAt.toISOString(),
            client_request_id: requestIds.current[i],
          };
        }),
      );
      announceSaved(`Tercatat: ${rows.length} pengeluaran, total ${formatMoney(total)}`);
      closeModal();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
      setSaving(false);
    }
  }

  if (!context) {
    return (
      <SubScreen title="Catat cepat">
        {error ? <ThemedText themeColor="danger">{error}</ThemedText> : <ActivityIndicator />}
      </SubScreen>
    );
  }

  return (
    <SubScreen title="Catat cepat" intro="Tulis semua pengeluaranmu sekaligus, cek daftarnya, lalu simpan.">
      <TextField
        value={text}
        onChangeText={setText}
        placeholder="kopi 25rb, makan siang 30k, bensin 50.000"
        multiline
        autoFocus
        accessibilityLabel="Daftar pengeluaran"
        style={styles.input}
      />

      {rows.length > 0 && (
        <ThemedView type="backgroundElement" style={styles.card}>
          {rows.map((r) => (
            <View key={r.key} style={styles.entry}>
              <View style={styles.row}>
                <ThemedText style={styles.flex} numberOfLines={1}>
                  {batchTitle(r.label, r.category?.name) ?? r.category?.name ?? 'Tanpa kategori'}
                </ThemedText>
                <ThemedText type="smallBold">{formatMoney(r.amount)}</ThemedText>
              </View>
              <Pressable
                onPress={() => setOpenRow(openRow === r.key ? null : r.key)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Ubah kategori ${r.label}`}
                style={[styles.categoryChip, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="small">{r.category?.name ?? 'Pilih kategori'} ▾</ThemedText>
              </Pressable>
              {openRow === r.key && (
                <ChipRow
                  options={context.categories.map((c) => ({ value: c.id, label: c.name }))}
                  value={r.category?.id ?? null}
                  onChange={(id) => {
                    setPicked((p) => ({ ...p, [r.label.toLowerCase()]: id }));
                    setOpenRow(null);
                  }}
                />
              )}
            </View>
          ))}
        </ThemedView>
      )}

      {parsed.skipped.length > 0 && (
        <ThemedText type="small" themeColor="warning">
          Belum ada nominalnya, jadi tidak ikut disimpan: {parsed.skipped.join(', ')}
        </ThemedText>
      )}

      <Field label="Bayar pakai">
        {context.accounts.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Belum ada dompet. Tambahkan dulu di Akun & dompet.
          </ThemedText>
        ) : (
          <ChipRow options={context.accounts.map((a) => ({ value: a.id, label: a.name }))} value={accountId} onChange={setAccountId} />
        )}
      </Field>
      <Field label="Tanggal">
        <ChipRow options={DAYS} value={day} onChange={setDay} />
      </Field>

      {error && <ThemedText themeColor="danger">{error}</ThemedText>}
      <PrimaryButton
        label={rows.length > 0 ? `Simpan ${rows.length} pengeluaran · ${formatMoney(total)}` : 'Simpan'}
        onPress={save}
        disabled={!canSave}
        busy={saving}
      />
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  input: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  entry: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.three,
  },
});
