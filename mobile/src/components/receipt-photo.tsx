import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney, useCurrency } from '@/lib/money';
import {
  deleteReceipt,
  isScanResult,
  RECEIPT_BUCKET,
  receiptFileProblem,
  type ScanResult,
  scanReceipt,
  uploadReceipt,
} from '@/lib/receipts';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/session-provider';

const SIGNED_URL_SECONDS = 60 * 60;

type Props = {
  transactionId: string;
  receiptId: string | null;
  onChange: (receiptId: string | null) => void;
  /** Called when the user taps "Terapkan" on a scan result. */
  onApplyScan: (result: ScanResult) => void;
};

const scanDateFormat = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

/** Attach, view, or remove the receipt photo of one transaction. Changes are saved immediately.
 * New photos are read by OCR; the result is only applied to the form when the user taps "Terapkan". */
export function ReceiptPhoto({ transactionId, receiptId, onChange, onApplyScan }: Props) {
  const theme = useTheme();
  const { session } = useSession();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!receiptId) return;
    let active = true;
    supabase
      .from('receipts')
      .select('storage_path, ocr_json')
      .eq('id', receiptId)
      .single()
      .then(async ({ data, error }) => {
        if (!active) return;
        if (error) return setError(error.message);
        if (isScanResult(data.ocr_json)) setScan(data.ocr_json);
        const signed = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(data.storage_path, SIGNED_URL_SECONDS);
        if (!active) return;
        if (signed.error) return setError(signed.error.message);
        setUrl(signed.data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [receiptId]);

  async function pick(source: 'camera' | 'library') {
    const userId = session?.user.id;
    if (!userId || busy) return;
    setError(null);
    setConfirmRemove(false);

    if (source === 'camera' && Platform.OS !== 'web') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return setError('Izin kamera ditolak. Aktifkan dari pengaturan HP.');
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    const problem = receiptFileProblem(asset);
    if (problem) return setError(problem);

    setBusy(true);
    try {
      const newId = await uploadReceipt(userId, asset);
      const linked = await supabase.from('transactions').update({ receipt_id: newId }).eq('id', transactionId);
      if (linked.error) {
        await deleteReceipt(newId);
        throw linked.error;
      }

      // Replacing a photo: drop the old one only after the new one is linked.
      if (receiptId) await deleteReceipt(receiptId);

      setUrl(asset.uri);
      setScan(null);
      onChange(newId);
      setBusy(false);
      await runScan(newId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengunggah foto.');
      setBusy(false);
    }
  }

  async function runScan(id: string) {
    setScanning(true);
    setError(null);
    try {
      setScan(await scanReceipt(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal membaca struk.');
    } finally {
      setScanning(false);
    }
  }

  async function remove() {
    if (!receiptId || busy) return;
    if (!confirmRemove) return setConfirmRemove(true);
    setBusy(true);
    setError(null);
    const unlinked = await supabase.from('transactions').update({ receipt_id: null }).eq('id', transactionId);
    if (unlinked.error) {
      setBusy(false);
      return setError(unlinked.error.message);
    }
    await deleteReceipt(receiptId);
    setBusy(false);
    setConfirmRemove(false);
    setUrl(null);
    setScan(null);
    onChange(null);
  }

  const button = [styles.button, { backgroundColor: theme.backgroundElement }];

  return (
    <View style={styles.container}>
      {receiptId && (
        <ThemedView type="backgroundElement" style={styles.preview}>
          {url ? (
            <Image source={{ uri: url }} style={styles.image} contentFit="contain" />
          ) : (
            <ActivityIndicator />
          )}
        </ThemedView>
      )}

      <View style={styles.row}>
        <Pressable disabled={busy} onPress={() => pick('camera')} style={({ pressed }) => [button, pressed && styles.pressed]}>
          <ThemedText type="smallBold">{receiptId ? 'Foto ulang' : 'Foto struk'}</ThemedText>
        </Pressable>
        <Pressable disabled={busy} onPress={() => pick('library')} style={({ pressed }) => [button, pressed && styles.pressed]}>
          <ThemedText type="smallBold">Dari galeri</ThemedText>
        </Pressable>
      </View>

      {busy && <ActivityIndicator />}

      {scanning && (
        <View style={styles.scanning}>
          <ActivityIndicator />
          <ThemedText type="small" themeColor="textSecondary">
            Membaca struk…
          </ThemedText>
        </View>
      )}

      {scan && !scanning && <ScanCard scan={scan} onApply={() => onApplyScan(scan)} />}

      {receiptId && !scan && !scanning && !busy && (
        <Pressable onPress={() => runScan(receiptId)} style={({ pressed }) => [button, pressed && styles.pressed]}>
          <ThemedText type="smallBold">Baca struk otomatis</ThemedText>
        </Pressable>
      )}

      {receiptId && !busy && (
        <Pressable onPress={remove} style={styles.remove} hitSlop={8}>
          <ThemedText type="small" themeColor="danger">
            {confirmRemove ? 'Ketuk lagi untuk hapus foto' : 'Hapus foto'}
          </ThemedText>
        </Pressable>
      )}

      {error && <ThemedText themeColor="danger">{error}</ThemedText>}
    </View>
  );
}

function ScanCard({ scan, onApply }: { scan: ScanResult; onApply: () => void }) {
  const theme = useTheme();
  const currency = useCurrency();
  if (!scan.is_receipt) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Foto ini tidak terbaca sebagai struk.
      </ThemedText>
    );
  }
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(scan.date);
  const parts = [
    scan.merchant,
    scan.total > 0 && formatMoney(scan.total),
    date && scanDateFormat.format(new Date(Number(date[1]), Number(date[2]) - 1, Number(date[3]))),
    scan.time,
    scan.category,
  ].filter(Boolean);
  // The server leaves the total at 0 when the receipt is in a currency other than the user's.
  const otherCurrency = scan.total === 0 && !!scan.currency && scan.currency !== currency.code;
  return (
    <ThemedView type="backgroundElement" style={styles.scanCard}>
      <View style={styles.flex}>
        <ThemedText type="small" themeColor="textSecondary">
          Terbaca dari struk
        </ThemedText>
        <ThemedText type="smallBold">{parts.length > 0 ? parts.join(' · ') : 'Tidak ada yang terbaca'}</ThemedText>
        {otherCurrency && (
          <ThemedText type="small" themeColor="textSecondary">
            Struk ini dalam {scan.currency}, jadi nominalnya isi sendiri ya.
          </ThemedText>
        )}
      </View>
      {parts.length > 0 && (
        <Pressable onPress={onApply} style={({ pressed }) => [styles.apply, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
            Terapkan
          </ThemedText>
        </Pressable>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  preview: {
    height: 280,
    borderRadius: Spacing.three,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  scanning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  apply: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  remove: {
    alignSelf: 'center',
    padding: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
});
