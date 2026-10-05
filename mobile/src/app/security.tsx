import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { SubScreen } from '@/components/sub-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { biometricLabel, LOCK_SUPPORTED, setBiometric, useLockSettings } from '@/lib/app-lock';

export default function SecurityScreen() {
  const lock = useLockSettings();
  const [bioLabel, setBioLabel] = useState<string | null>(null);

  useEffect(() => {
    biometricLabel().then(setBioLabel, () => setBioLabel(null));
  }, []);

  return (
    <SubScreen title="Keamanan">
      <ThemedView type="backgroundElement" style={styles.card}>
        {LOCK_SUPPORTED ? (
          <>
            <View style={styles.row}>
              <View style={styles.flex}>
                <ThemedText type="smallBold">Kunci dengan PIN</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Diminta saat Flowku dibuka, atau kembali setelah lebih dari 1 menit.
                </ThemedText>
              </View>
              <Switch
                value={lock.enabled}
                onValueChange={(on) => router.push(on ? '/pin-setup' : '/pin-setup?mode=disable')}
              />
            </View>
            {lock.enabled && bioLabel && (
              <View style={styles.row}>
                <View style={styles.flex}>
                  <ThemedText type="smallBold">Buka dengan {bioLabel.toLowerCase()}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    PIN tetap bisa dipakai kapan saja.
                  </ThemedText>
                </View>
                <Switch value={lock.biometric} onValueChange={setBiometric} />
              </View>
            )}
            {lock.enabled && (
              <Pressable
                onPress={() => router.push('/pin-setup?mode=change')}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <View style={styles.flex}>
                  <ThemedText type="smallBold">Ganti PIN</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Masukkan PIN lama, lalu buat yang baru
                  </ThemedText>
                </View>
                <ThemedText type="smallBold">›</ThemedText>
              </Pressable>
            )}
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Kunci PIN dan sidik jari tersedia di aplikasi HP.
          </ThemedText>
        )}
      </ThemedView>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
