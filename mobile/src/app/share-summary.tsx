import { useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ShareCard } from '@/components/charts/share-card';
import { PrimaryButton } from '@/components/form-fields';
import { SubScreen } from '@/components/sub-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCycleDay } from '@/hooks/use-cycle-day';
import { useTheme } from '@/hooks/use-theme';
import { useChartRows } from '@/lib/chart-data';
import { assignSlots, monthSlices } from '@/lib/charts';
import { cycleLabel, cycleRange } from '@/lib/cycle';
import { shareViewAsImage } from '@/lib/share-image';

const MAX_CARD_WIDTH = 300;
// Room left for the title and the controls, so the whole picture fits without scrolling on most phones.
const CONTROLS_HEIGHT = 240;

// Previews the status picture before anything leaves the phone. Amounts stay hidden until the user turns them on.
export default function ShareSummaryScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ offset?: string }>();
  const offset = Math.min(0, Number(params.offset) || 0);
  const { day, loaded } = useCycleDay();
  const now = useMemo(() => new Date(), []);
  const { rows, error } = useChartRows(now, day);
  const window = useWindowDimensions();
  const card = useRef<View>(null);
  const [showAmounts, setShowAmounts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { expense, income } = useMemo(() => {
    const { start, end } = cycleRange(now, day, offset);
    return {
      expense: monthSlices(rows ?? [], 'EXPENSE', start, end, assignSlots(rows ?? [], 'EXPENSE')),
      income: monthSlices(rows ?? [], 'INCOME', start, end, new Map()).total,
    };
  }, [rows, now, day, offset]);

  const width = Math.min(MAX_CARD_WIDTH, window.width - Spacing.five * 2, ((window.height - CONTROLS_HEIGHT) * 9) / 16);
  const period = cycleLabel(cycleRange(now, day, offset).start, day);
  const empty = expense.total === 0 && income === 0;

  async function share() {
    setBusy(true);
    setMessage(null);
    try {
      const how = await shareViewAsImage(card, `flowku-rekap-${period.replace(/\s+/g, '-').toLowerCase()}.png`);
      if (how === 'saved') setMessage('Gambar tersimpan. Unggah dari galeri atau folder unduhan ke statusmu.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Gagal membuat gambar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SubScreen title="Bagikan rekap">
      {error && <ThemedText themeColor="danger">{error}</ThemedText>}
      {(rows === null || !loaded) && !error && <ActivityIndicator />}
      {rows !== null && loaded && (
        <>
          <View style={styles.center}>
            <ShareCard
              ref={card}
              width={width}
              period={period}
              income={income}
              expense={expense.total}
              slices={expense.slices}
              showAmounts={showAmounts}
            />
          </View>

          <Pressable
            onPress={() => setShowAmounts((v) => !v)}
            accessibilityRole="switch"
            accessibilityState={{ checked: showAmounts }}
            style={[styles.toggle, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.flex}>
              <ThemedText type="smallBold">Tampilkan nominal</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {showAmounts ? 'Angka rupiahmu akan terlihat oleh yang melihat status.' : 'Hanya persentase yang terlihat.'}
              </ThemedText>
            </View>
            <View style={[styles.track, { backgroundColor: showAmounts ? theme.primary : theme.backgroundSelected }]}>
              <View style={[styles.thumb, { backgroundColor: theme.onPrimary }, showAmounts && styles.thumbOn]} />
            </View>
          </Pressable>

          {message && (
            <ThemedText type="small" themeColor="textSecondary">
              {message}
            </ThemedText>
          )}
          {empty && (
            <ThemedText type="small" themeColor="textSecondary">
              Belum ada catatan di periode ini, jadi belum ada yang bisa dibagikan.
            </ThemedText>
          )}
          <PrimaryButton label="Bagikan ke status" onPress={share} disabled={empty} busy={busy} />
        </>
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
  },
  flex: {
    flex: 1,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  track: {
    width: 44,
    height: 26,
    padding: 3,
    borderRadius: 13,
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  thumbOn: {
    alignSelf: 'flex-end',
  },
});
