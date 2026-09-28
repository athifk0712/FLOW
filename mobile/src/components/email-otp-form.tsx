import type { AuthError } from '@supabase/supabase-js';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { DANGER_COLOR } from '@/constants/necessity';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

/**
 * - `link`: attach an email to the current guest account (same user id, data stays).
 * - `signin`: sign in to an existing account; `allowSignUp` also creates one if it does not exist.
 */
type Mode = 'link' | 'signin';

function describeError(error: AuthError, mode: Mode) {
  const message = error.message.toLowerCase();
  if (error.code === 'email_exists' || message.includes('already been registered')) {
    return 'Email ini sudah punya akun. Pakai "Masuk dengan email" untuk membukanya.';
  }
  if (error.code === 'otp_expired' || message.includes('expired') || message.includes('invalid')) {
    return 'Kode salah atau sudah kedaluwarsa. Minta kode baru.';
  }
  if (error.code === 'over_email_send_rate_limit' || message.includes('security purposes') || error.status === 429) {
    return 'Terlalu sering minta kode. Tunggu sebentar lalu coba lagi.';
  }
  if (error.code === 'otp_disabled' || message.includes('signups not allowed')) {
    return mode === 'signin' ? 'Belum ada akun dengan email ini.' : error.message;
  }
  if (error.status === 500 || message.includes('sending')) {
    return 'Email gagal dikirim. Pengaturan SMTP di Supabase perlu dicek.';
  }
  return error.message;
}

export function EmailOtpForm({
  mode,
  allowSignUp = false,
  submitLabel,
  onDone,
}: {
  mode: Mode;
  allowSignUp?: boolean;
  submitLabel: string;
  onDone?: () => void;
}) {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = email.trim().toLowerCase();
  const canSubmit = !busy && (codeSent ? code.trim().length === 6 : /^\S+@\S+\.\S+$/.test(trimmed));

  async function sendCode() {
    setBusy(true);
    setError(null);
    const { error } =
      mode === 'link'
        ? await supabase.auth.updateUser({ email: trimmed })
        : await supabase.auth.signInWithOtp({ email: trimmed, options: { shouldCreateUser: allowSignUp } });
    setBusy(false);
    if (error) return setError(describeError(error, mode));
    setCodeSent(true);
  }

  async function verifyCode() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email: trimmed,
      token: code.trim(),
      type: mode === 'link' ? 'email_change' : 'email',
    });
    setBusy(false);
    if (error) return setError(describeError(error, mode));
    onDone?.();
  }

  function submit() {
    if (!canSubmit) return;
    if (codeSent) verifyCode();
    else sendCode();
  }

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }];

  return (
    <View style={styles.form}>
      {codeSent ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Kode 6 digit sudah dikirim ke {trimmed}. Cek juga folder spam.
          </ThemedText>
          <TextInput
            style={inputStyle}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
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
        </>
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
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            {codeSent ? 'Verifikasi kode' : submitLabel}
          </ThemedText>
        )}
      </Pressable>

      {codeSent && (
        <Pressable
          onPress={() => {
            setCodeSent(false);
            setCode('');
            setError(null);
          }}
          hitSlop={8}>
          <ThemedText type="small" themeColor="textSecondary">
            Ganti email atau kirim ulang kode
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.two,
  },
  input: {
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    borderRadius: Spacing.two,
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
    color: DANGER_COLOR,
  },
});
