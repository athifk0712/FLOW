import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { NECESSITY } from '@/constants/necessity';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { continueWithGoogle, type GoogleResult, guestHasData, type OAuthMode, takeWebLinkResult } from '@/lib/oauth';

/**
 * "Lanjut dengan Google": links Google to the guest account (`link`) or signs in with it (`signin`).
 * A link to a Google login that already has a Flowku account (e.g. on a second phone) turns into signing in to
 * that account: straight away when this guest has nothing logged yet, otherwise after one more tap and a warning.
 */
export function GoogleButton({ mode, label, onDone }: { mode: OAuthMode; label: string; onDone?: () => void }) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // This Google login already has an account, and switching would leave this guest's entries behind.
  const [taken, setTaken] = useState(false);

  async function handle(result: GoogleResult) {
    if (result.kind === 'error') setError(result.message);
    if (result.kind === 'ok') onDone?.();
    if (result.kind !== 'taken') return;
    if (await guestHasData()) return setTaken(true);
    await run('signin');
  }

  async function run(how: OAuthMode) {
    setBusy(true);
    setError(null);
    setTaken(false);
    const result = await continueWithGoogle(how);
    setBusy(false);
    await handle(result);
  }

  // Web: the page came back from a link attempt started here.
  useEffect(() => {
    if (mode !== 'link') return;
    takeWebLinkResult().then((result) => result && handle(result));
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.wrap}>
      <Pressable
        disabled={busy}
        onPress={() => run(mode)}
        style={({ pressed }) => [
          styles.button,
          { borderColor: theme.backgroundSelected, backgroundColor: theme.background },
          (pressed || busy) && styles.pressed,
        ]}>
        {busy ? (
          <ActivityIndicator />
        ) : (
          <>
            <ThemedText type="smallBold" style={styles.g}>
              G
            </ThemedText>
            <ThemedText type="smallBold">{label}</ThemedText>
          </>
        )}
      </Pressable>
      {taken && (
        <View style={styles.wrap}>
          <ThemedText type="small" style={styles.warning}>
            Google ini sudah punya akun Flowku. Masuk ke akun itu untuk melihat datamu. Catatan tamu di perangkat
            ini tidak ikut pindah.
          </ThemedText>
          <Pressable
            disabled={busy}
            onPress={() => run('signin')}
            style={({ pressed }) => [styles.button, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
              Masuk ke akun itu
            </ThemedText>
          </Pressable>
        </View>
      )}
      {error && <ThemedText themeColor="danger">{error}</ThemedText>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  g: {
    color: '#4285F4',
    fontSize: 18,
  },
  warning: {
    color: NECESSITY.IMPORTANT.color,
  },
  pressed: {
    opacity: 0.7,
  },
});
