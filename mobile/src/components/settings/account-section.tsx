import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EmailOtpForm } from '@/components/email-otp-form';
import { GoogleButton } from '@/components/google-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DANGER_COLOR, NECESSITY } from '@/constants/necessity';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/session-provider';

type Panel = 'none' | 'link' | 'signin';

/** Guest: save the account with Google or email, or open an existing one. Signed-in user: show it, allow signing out. */
export function AccountSection() {
  const theme = useTheme();
  const { session } = useSession();
  const [panel, setPanel] = useState<Panel>('none');
  const [linked, setLinked] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const user = session?.user;

  if (user && !user.is_anonymous) {
    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        <View>
          <ThemedText type="small" themeColor="textSecondary">
            Masuk sebagai
          </ThemedText>
          <ThemedText type="smallBold">{user.email}</ThemedText>
        </View>
        {linked && (
          <ThemedText type="small" style={styles.success}>
            Akun tersimpan. Datamu sekarang bisa dibuka di perangkat lain dengan akun ini.
          </ThemedText>
        )}
        <ThemedText type="small" themeColor="textSecondary">
          Buka Flowku di perangkat lain, lalu masuk dengan Google atau email yang sama di Pengaturan.
        </ThemedText>
        {confirmSignOut ? (
          <View style={styles.row}>
            <Pressable
              onPress={() => setConfirmSignOut(false)}
              style={[styles.half, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold">Batal</ThemedText>
            </Pressable>
            <Pressable onPress={() => supabase.auth.signOut()} style={[styles.half, styles.danger]}>
              <ThemedText type="smallBold" style={styles.white}>
                Ya, keluar
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setConfirmSignOut(true)} hitSlop={8}>
            <ThemedText type="smallBold" themeColor="danger">
              Keluar dari akun
            </ThemedText>
          </Pressable>
        )}
      </ThemedView>
    );
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">Akun tamu</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Datamu tersimpan, tapi hanya bisa dibuka dari perangkat ini. Simpan dengan Google atau email supaya aman dan
        bisa dibuka di HP maupun laptop.
      </ThemedText>

      {panel === 'signin' ? (
        <>
          <ThemedText type="small" style={styles.warning}>
            Kamu akan pindah ke akun itu. Data tamu di perangkat ini tidak ikut digabung.
          </ThemedText>
          <GoogleButton mode="signin" label="Masuk dengan Google" />
          <EmailOtpForm mode="signin" submitLabel="Kirim kode masuk" />
        </>
      ) : (
        <>
          <GoogleButton mode="link" label="Simpan dengan Google" onDone={() => setLinked(true)} />
          {panel === 'link' ? (
            <EmailOtpForm mode="link" submitLabel="Kirim kode" onDone={() => setLinked(true)} />
          ) : (
            <Pressable
              onPress={() => setPanel('link')}
              style={({ pressed }) => [styles.button, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
              <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                Simpan dengan email
              </ThemedText>
            </Pressable>
          )}
        </>
      )}

      <Pressable onPress={() => setPanel(panel === 'signin' ? 'link' : 'signin')} hitSlop={8}>
        <ThemedText type="smallBold" themeColor={panel === 'signin' ? 'textSecondary' : 'primary'}>
          {panel === 'signin' ? '← Simpan akun tamu ini saja' : 'Sudah pernah pakai Flowku di HP lain? Masuk di sini'}
        </ThemedText>
      </Pressable>
    </ThemedView>
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
    gap: Spacing.two,
  },
  half: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two + Spacing.one,
    borderRadius: Spacing.three,
  },
  button: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  danger: {
    backgroundColor: DANGER_COLOR,
  },
  white: {
    color: '#ffffff',
  },
  success: {
    color: NECESSITY.NEED.color,
  },
  warning: {
    color: NECESSITY.IMPORTANT.color,
  },
  pressed: {
    opacity: 0.7,
  },
});
