import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PinPad } from '@/components/pin-pad';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Wordmark } from '@/components/wordmark';
import { Spacing } from '@/constants/theme';
import {
  biometricLabel,
  checkPin,
  cooldownLeft,
  disableLock,
  PIN_LENGTH,
  unlockWithBiometric,
  useLockSettings,
  useLocked,
} from '@/lib/app-lock';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/session-provider';

/** Covers the whole app while locked. Mounted fresh on every lock, so no state carries over. */
export function LockScreen() {
  const locked = useLocked();
  return locked ? <LockPanel /> : null;
}

/** Offers fingerprint/Face ID first, the PIN pad always. */
function LockPanel() {
  const { biometric } = useLockSettings();
  const { session } = useSession();
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [wrong, setWrong] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bioLabel, setBioLabel] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [forgot, setForgot] = useState(false);

  // Ask for the fingerprint right away when the lock appears.
  useEffect(() => {
    if (!biometric) return;
    biometricLabel().then((label) => {
      setBioLabel(label);
      if (label) unlockWithBiometric();
    });
  }, [biometric]);

  // Count down the pause after too many wrong PINs.
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(cooldownLeft()), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function onChange(next: string) {
    setWrong(false);
    setMessage(null);
    setPin(next);
    if (next.length < PIN_LENGTH) return;
    setBusy(true);
    const result = await checkPin(next);
    setBusy(false);
    if (result === 'ok') return;
    setPin('');
    setWrong(true);
    if (result === 'blocked') {
      setWait(cooldownLeft());
      setMessage('Terlalu banyak percobaan.');
    } else {
      setMessage('PIN belum cocok. Coba lagi.');
    }
  }

  async function resetWithEmail() {
    await disableLock();
    await supabase.auth.signOut();
  }

  const guest = !!session?.user.is_anonymous;

  return (
    <ThemedView style={StyleSheet.absoluteFill}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.top}>
          <Wordmark size={36} />
          <ThemedText themeColor="textSecondary">Masukkan PIN untuk membuka</ThemedText>
        </View>

        <PinPad
          value={pin}
          onChange={onChange}
          disabled={busy || wait > 0}
          error={wrong}
          extra={bioLabel ? { label: bioLabel, onPress: unlockWithBiometric } : null}
        />

        <View style={styles.bottom}>
          {(message || wait > 0) && (
            <ThemedText type="small" themeColor="warning" style={styles.center}>
              {message}
              {wait > 0 ? ` Coba lagi dalam ${wait} detik.` : ''}
            </ThemedText>
          )}
          {forgot ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {guest
                ? 'Akun tamu hanya bisa dibuka dengan PIN atau sidik jari di perangkat ini, karena belum tersimpan dengan email.'
                : 'Keluar, lalu masuk lagi dengan email. Kunci akan dimatikan dan datamu tetap aman.'}
            </ThemedText>
          ) : (
            <Pressable onPress={() => setForgot(true)} hitSlop={8}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Lupa PIN?
              </ThemedText>
            </Pressable>
          )}
          {forgot && !guest && (
            <Pressable onPress={resetWithEmail} hitSlop={8}>
              <ThemedText type="smallBold" themeColor="primary">
                Keluar dan masuk dengan email
              </ThemedText>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
  top: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  bottom: {
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 64,
  },
  center: {
    textAlign: 'center',
  },
});
