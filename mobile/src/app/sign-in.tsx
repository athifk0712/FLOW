import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmailOtpForm } from '@/components/email-otp-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Wordmark } from '@/components/wordmark';
import { DANGER_COLOR } from '@/constants/necessity';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/session-provider';

// Shown after signing out of an email account, or if the automatic guest sign-in failed.
export default function SignInScreen() {
  const { error: guestError } = useSession();
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
            <Wordmark size={40} />
            <ThemedText themeColor="textSecondary">
              Masuk dengan email untuk membuka datamu di HP dan laptop.
            </ThemedText>

            {guestError && <ThemedText style={styles.error}>Gagal masuk sebagai tamu: {guestError}</ThemedText>}

            <EmailOtpForm mode="signin" allowSignUp submitLabel="Kirim kode masuk" />

            <Pressable disabled={startingGuest} onPress={continueAsGuest} style={styles.guest} hitSlop={8}>
              {startingGuest ? (
                <ActivityIndicator />
              ) : (
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Lanjut tanpa akun →
                </ThemedText>
              )}
            </Pressable>
            {error && <ThemedText style={styles.error}>{error}</ThemedText>}
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
    gap: Spacing.three,
  },
  guest: {
    alignSelf: 'center',
    padding: Spacing.two,
  },
  error: {
    color: DANGER_COLOR,
  },
});
