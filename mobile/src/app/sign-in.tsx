import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmailOtpForm } from '@/components/email-otp-form';
import { GoogleButton } from '@/components/google-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

// Welcome: what a device without a session sees (first launch, or after signing out). Returning users keep their
// session and go straight to Beranda. Google and email open an existing account or make a new one; guest mode
// starts right away and can be saved to Google or email later from Pengaturan. New accounts continue to the
// onboarding (name, payday, accounts).
export default function WelcomeScreen() {
  const theme = useTheme();
  const [showEmail, setShowEmail] = useState(false);
  const [startingGuest, setStartingGuest] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continueAsGuest() {
    setStartingGuest(true);
    setError(null);
    const { error } = await supabase.auth.signInAnonymously();
    setStartingGuest(false);
    // On success the session provider flips the guard and the router leaves this screen.
    if (error) setError(error.message);
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.flex}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.hero}>
              <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
              <ThemedText style={[styles.brand, { color: theme.primary }]}>Flowku</ThemedText>
              <ThemedText type="subtitle" style={styles.center}>
                Uangmu mengalir tenang.
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.center}>
                Catat pengeluaran dalam dua ketukan, lihat polanya, dan tahu berapa yang aman dibelanjakan hari ini.
              </ThemedText>
            </View>

            <View style={styles.actions}>
              <GoogleButton mode="signin" label="Daftar / Masuk dengan Google" />

              {showEmail ? (
                <ThemedView type="backgroundElement" style={styles.emailCard}>
                  <EmailOtpForm mode="signin" allowSignUp submitLabel="Kirim kode masuk" />
                </ThemedView>
              ) : (
                <Pressable
                  onPress={() => setShowEmail(true)}
                  style={({ pressed }) => [
                    styles.button,
                    { borderColor: theme.backgroundSelected, backgroundColor: theme.background },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold">Masuk dengan email</ThemedText>
                </Pressable>
              )}

              <View style={styles.divider}>
                <View style={[styles.line, { backgroundColor: theme.backgroundSelected }]} />
                <ThemedText type="small" themeColor="textSecondary">
                  atau
                </ThemedText>
                <View style={[styles.line, { backgroundColor: theme.backgroundSelected }]} />
              </View>

              <Pressable
                disabled={startingGuest}
                onPress={continueAsGuest}
                style={({ pressed }) => [
                  styles.button,
                  styles.guest,
                  { backgroundColor: theme.primary },
                  (pressed || startingGuest) && styles.pressed,
                ]}>
                {startingGuest ? (
                  <ActivityIndicator color={theme.onPrimary} />
                ) : (
                  <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                    Coba dulu tanpa akun (Mode Tamu)
                  </ThemedText>
                )}
              </Pressable>
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                Mode tamu menyimpan data di perangkat ini. Simpan ke Google atau email kapan saja dari Pengaturan.
              </ThemedText>
              {error && <ThemedText themeColor="danger">{error}</ThemedText>}
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    gap: Spacing.five,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 24,
    marginBottom: Spacing.two,
  },
  brand: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: 800,
    letterSpacing: -0.5,
  },
  center: {
    textAlign: 'center',
  },
  actions: {
    gap: Spacing.three,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  guest: {
    borderWidth: 0,
  },
  emailCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  line: {
    flex: 1,
    height: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
