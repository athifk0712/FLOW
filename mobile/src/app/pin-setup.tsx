import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PinPad } from '@/components/pin-pad';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  biometricLabel,
  checkPin,
  cooldownLeft,
  disableLock,
  enableLock,
  PIN_LENGTH,
  useLockSettings,
} from '@/lib/app-lock';
import { closeModal } from '@/lib/navigation';
import { useSession } from '@/providers/session-provider';

type Mode = 'enable' | 'change' | 'disable';
type Step = 'current' | 'new' | 'confirm' | 'biometric';

const TITLE: Record<Step, string> = {
  current: 'Masukkan PIN sekarang',
  new: 'Buat PIN 4 angka',
  confirm: 'Ulangi PIN',
  biometric: 'Buka lebih cepat?',
};

// Turn the app lock on, change the PIN, or turn it off. Changing or turning off asks for the current PIN first.
export default function PinSetupScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const lock = useLockSettings();
  const params = useLocalSearchParams<{ mode?: Mode }>();
  const mode: Mode = params.mode === 'change' || params.mode === 'disable' ? params.mode : 'enable';
  const [step, setStep] = useState<Step>(mode === 'enable' ? 'new' : 'current');
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [wrong, setWrong] = useState(false);
  const [bioLabel, setBioLabel] = useState<string | null>(null);

  useEffect(() => {
    biometricLabel().then(setBioLabel, () => setBioLabel(null));
  }, []);

  async function finish(useBiometric: boolean) {
    await enableLock(first, useBiometric);
    closeModal();
  }

  async function onChange(next: string) {
    setWrong(false);
    setMessage(null);
    setPin(next);
    if (next.length < PIN_LENGTH) return;
    setPin('');

    if (step === 'current') {
      const result = await checkPin(next);
      if (result !== 'ok') {
        setWrong(true);
        return setMessage(result === 'blocked' ? `Terlalu banyak percobaan. Tunggu ${cooldownLeft()} detik.` : 'PIN belum cocok.');
      }
      if (mode === 'disable') {
        await disableLock();
        return closeModal();
      }
      return setStep('new');
    }
    if (step === 'new') {
      setFirst(next);
      return setStep('confirm');
    }
    if (next !== first) {
      setWrong(true);
      setMessage('PIN tidak sama. Buat ulang dari awal.');
      return setStep('new');
    }
    if (bioLabel && mode === 'enable') return setStep('biometric');
    // Changing the PIN keeps the fingerprint choice; enabling without biometrics is PIN only.
    await finish(mode === 'change' && lock.biometric);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
        <View style={styles.header}>
          <ThemedText type="subtitle">{TITLE[step]}</ThemedText>
          <Pressable onPress={closeModal} hitSlop={12}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Batal
            </ThemedText>
          </Pressable>
        </View>

        {step === 'biometric' ? (
          <View style={styles.bio}>
            <ThemedText themeColor="textSecondary">
              Pakai {bioLabel?.toLowerCase()} untuk membuka Flowku. PIN tetap bisa dipakai kapan saja.
            </ThemedText>
            <Pressable onPress={() => finish(true)} style={[styles.button, { backgroundColor: theme.primary }]}>
              <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                Ya, pakai {bioLabel?.toLowerCase()}
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => finish(false)} style={[styles.button, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold">PIN saja</ThemedText>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.note}>
              {step === 'new' && session?.user.is_anonymous && (
                <ThemedText type="small" themeColor="warning" style={styles.center}>
                  Kamu memakai akun tamu: kalau PIN terlupa (dan sidik jari tidak aktif), datanya tidak bisa dipulihkan.
                  Simpan akun dengan email dulu supaya lebih aman.
                </ThemedText>
              )}
              {message && (
                <ThemedText type="small" themeColor="warning" style={styles.center}>
                  {message}
                </ThemedText>
              )}
            </View>
            <PinPad value={pin} onChange={onChange} error={wrong} />
          </>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safe: {
    flex: 1,
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  note: {
    minHeight: 60,
    justifyContent: 'center',
    gap: Spacing.two,
  },
  center: {
    textAlign: 'center',
  },
  bio: {
    gap: Spacing.three,
  },
  button: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
});
