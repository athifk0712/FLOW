import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/session-provider';

// Fallback only: normally the app signs in anonymously. Shown when that fails.
// Email OTP (6-digit code) instead of a magic link: no deep-link setup needed on mobile.
export default function SignInScreen() {
  const theme = useTheme();
  const { error: guestError } = useSession();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !busy && (codeSent ? code.trim().length === 6 : email.includes('@'));

  async function sendCode() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    setBusy(false);
    if (error) return setError(error.message);
    setCodeSent(true);
  }

  async function verifyCode() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    // On success the session provider flips the guard and the router leaves this screen.
    if (error) setError(error.message);
  }

  function submit() {
    if (!canSubmit) return;
    if (codeSent) verifyCode();
    else sendCode();
  }

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle">FLOW</ThemedText>
          {guestError && <ThemedText style={styles.error}>Gagal masuk sebagai tamu: {guestError}</ThemedText>}
          <ThemedText themeColor="textSecondary">
            {codeSent ? `Masukkan kode 6 digit yang dikirim ke ${email.trim()}` : 'Masuk dengan email'}
          </ThemedText>

          {codeSent ? (
            <TextInput
              style={inputStyle}
              value={code}
              onChangeText={setCode}
              onSubmitEditing={submit}
              placeholder="123456"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              returnKeyType="done"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              autoFocus
            />
          ) : (
            <TextInput
              style={inputStyle}
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={submit}
              placeholder="kamu@email.com"
              placeholderTextColor={theme.textSecondary}
              keyboardType="email-address"
              returnKeyType="send"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              autoFocus
            />
          )}

          {error && <ThemedText style={styles.error}>{error}</ThemedText>}

          <Pressable
            disabled={!canSubmit}
            onPress={submit}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.text },
              !canSubmit && !busy && styles.disabled,
              (pressed || busy) && styles.pressed,
            ]}>
            {busy ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText style={{ color: theme.background }}>{codeSent ? 'Verifikasi' : 'Kirim kode'}</ThemedText>
            )}
          </Pressable>

          {codeSent && (
            <Pressable
              onPress={() => {
                setCodeSent(false);
                setCode('');
                setError(null);
              }}>
              <ThemedText type="link" themeColor="textSecondary">
                Ganti email
              </ThemedText>
            </Pressable>
          )}
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
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  input: {
    fontSize: 18,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  button: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.7,
  },
  error: {
    color: '#e5484d',
  },
});
