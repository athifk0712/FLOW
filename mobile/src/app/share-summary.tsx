import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ShareCard } from '@/components/charts/share-card';
import { PrimaryButton } from '@/components/form-fields';
import { ShareToggle } from '@/components/share-toggle';
import { SubScreen } from '@/components/sub-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCycleDay } from '@/hooks/use-cycle-day';
import { useChartRows } from '@/lib/chart-data';
import { assignSlots, monthSlices } from '@/lib/charts';
import { cycleLabel, cycleRange } from '@/lib/cycle';
import { shareViewAsImage } from '@/lib/share-image';
import { STREAK_COLUMNS, streakFromProfile } from '@/lib/streak';
import { supabase } from '@/lib/supabase';

const MAX_CARD_WIDTH = 300;
// Room left for the title and the controls, so the whole picture fits without scrolling on most phones.
const CONTROLS_HEIGHT = 240;

// Previews the status picture before anything leaves the phone. Amounts stay hidden until the user turns them on.
export default function ShareSummaryScreen() {
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
  const [streakDays, setStreakDays] = useState(0);

  // Without it the card simply has no streak; never worth an error here.
  useEffect(() => {
    let alive = true;
    supabase
      .from('profiles')
      .select(STREAK_COLUMNS)
      .maybeSingle()
      .then(({ data }) => {
        if (alive && data) setStreakDays(streakFromProfile(data).view.days);
      });
    return () => {
      alive = false;
    };
  }, []);

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
              streakDays={streakDays}
            />
          </View>

          <ShareToggle
            label="Tampilkan nominal"
            detail={showAmounts ? 'Angka uangmu akan terlihat oleh yang melihat status.' : 'Hanya persentase yang terlihat.'}
            value={showAmounts}
            onChange={setShowAmounts}
          />

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
});
