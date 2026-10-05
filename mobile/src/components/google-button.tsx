import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { continueWithGoogle, type OAuthMode } from '@/lib/oauth';

/** "Lanjut dengan Google": links Google to the guest account (`link`) or signs in with it (`signin`). */
export function GoogleButton({ mode, label, onDone }: { mode: OAuthMode; label: string; onDone?: () => void }) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function press() {
    setBusy(true);
    setError(null);
    const message = await continueWithGoogle(mode);
    setBusy(false);
    if (message) setError(message);
    else onDone?.();
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        disabled={busy}
        onPress={press}
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
  pressed: {
    opacity: 0.7,
  },
});
