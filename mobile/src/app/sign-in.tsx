import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

// Email OTP (6-digit code) instead of a magic link: no deep-link setup needed on mobile.
export default function SignInScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">FLOW</ThemedText>
        <ThemedText themeColor="textSecondary">
          {codeSent ? `Masukkan kode 6 digit yang dikirim ke ${email.trim()}` : 'Masuk dengan email'}
        </ThemedText>

        {codeSent ? (
          <TextInput
            style={inputStyle}
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
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
            placeholder="kamu@email.com"
            placeholderTextColor={theme.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            autoFocus
          />
        )}

        {error && <ThemedText style={styles.error}>{error}</ThemedText>}

        <Pressable
          disabled={busy || (codeSent ? code.trim().length < 6 : !email.includes('@'))}
          onPress={codeSent ? verifyCode : sendCode}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.text },
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
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
  pressed: {
    opacity: 0.7,
  },
  error: {
    color: '#e5484d',
  },
});
