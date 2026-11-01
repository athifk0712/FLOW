import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';

import { PrimaryButton } from '@/components/form-fields';
import { SwitchRow } from '@/components/switch-row';
import { SubScreen } from '@/components/sub-screen';
import { ThemedText } from '@/components/themed-text';
import { GroupShareCard } from '@/components/together/group-share-card';
import { Spacing } from '@/constants/theme';
import { findCurrency } from '@/lib/currencies';
import { type GroupDetail, loadGroup } from '@/lib/groups';
import { shareViewAsImage } from '@/lib/share-image';
import { targetProgress } from '@/lib/together';

const MAX_CARD_WIDTH = 300;
// Room left for the title and the two switches.
const CONTROLS_HEIGHT = 320;

// Previews a shared target's status picture. Amounts and member names stay hidden until the user turns them on.
export default function ShareGroupScreen() {
  const params = useLocalSearchParams<{ group: string; target: string }>();
  const window = useWindowDimensions();
  const card = useRef<View>(null);
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [showAmounts, setShowAmounts] = useState(false);
  const [showNames, setShowNames] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadGroup(params.group).then(
      (loaded) => {
        if (alive) setDetail(loaded);
      },
      (e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Gagal memuat grup.');
      },
    );
    return () => {
      alive = false;
    };
  }, [params.group]);

  const target = detail?.targets.find((t) => t.id === params.target) ?? null;
  const progress = useMemo(
    () =>
      detail && target
        ? targetProgress(target, detail.members, detail.contributions.filter((c) => c.target_id === target.id))
        : null,
    [detail, target],
  );
  const width = Math.min(MAX_CARD_WIDTH, window.width - Spacing.five * 2, ((window.height - CONTROLS_HEIGHT) * 9) / 16);

  async function share() {
    if (!target) return;
    setBusy(true);
    setMessage(null);
    try {
      const how = await shareViewAsImage(card, `flowku-patungan-${target.name.replace(/\W+/g, '-').toLowerCase()}.png`);
      if (how === 'saved') setMessage('Gambar tersimpan. Unggah dari galeri atau folder unduhan ke statusmu.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Gagal membuat gambar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SubScreen title="Bagikan patungan">
      {error && <ThemedText themeColor="danger">{error}</ThemedText>}
      {!detail && !error && <ActivityIndicator />}
      {detail && !target && <ThemedText themeColor="textSecondary">Target ini sudah tidak ada.</ThemedText>}
      {detail && target && progress && (
        <>
          <View style={styles.center}>
            <GroupShareCard
              ref={card}
              width={width}
              groupName={detail.group.name}
              targetName={target.name}
              targetAmount={target.target_amount}
              currency={findCurrency(detail.group.currency)}
              progress={progress}
              showAmounts={showAmounts}
              showNames={showNames}
            />
          </View>

          <SwitchRow
            label="Tampilkan nominal"
            detail={showAmounts ? 'Jumlah uang grup akan terlihat oleh yang melihat status.' : 'Hanya persentase yang terlihat.'}
            value={showAmounts}
            onChange={setShowAmounts}
          />
          <SwitchRow
            label="Tampilkan nama anggota"
            detail={showNames ? 'Pastikan teman-temanmu tidak keberatan namanya terlihat.' : 'Anggota hanya tampil sebagai titik.'}
            value={showNames}
            onChange={setShowNames}
          />

          {message && (
            <ThemedText type="small" themeColor="textSecondary">
              {message}
            </ThemedText>
          )}
          <PrimaryButton label="Bagikan ke status" onPress={share} busy={busy} />
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
