import { type Href, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/app-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCycleDay } from '@/hooks/use-cycle-day';
import { useTheme } from '@/hooks/use-theme';
import { displayName, initials } from '@/lib/display-name';
import { useLockSettings } from '@/lib/app-lock';
import { APPEARANCE_OPTIONS, useAppearance } from '@/lib/appearance';
import { useCurrency } from '@/lib/money';
import { closeModal } from '@/lib/navigation';
import { useSession } from '@/providers/session-provider';

type Row = {
  title: string;
  href: Href;
  material: string;
  sf: string;
  /** Current value, shown greyed on the right. */
  value?: string;
  badge?: string;
};

// Pengaturan as one calm list: a profile card on top, then grouped rows with an icon and a chevron.
// Each row opens its own page, so this screen stays short. Opened from the gear on Beranda.
export default function SettingsScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const currency = useCurrency();
  const appearance = useAppearance();
  const lock = useLockSettings();
  const { day } = useCycleDay();
  const user = session?.user;
  const guest = !user || user.is_anonymous;
  const name = displayName(user);

  const sections: { title: string; rows: Row[] }[] = [
    {
      title: 'Keuangan',
      rows: [
        { title: 'Mata uang', href: '/currency', material: 'currency_exchange', sf: 'coloncurrencysign.circle', value: currency.code },
        { title: 'Akun & dompet', href: '/accounts', material: 'account_balance_wallet', sf: 'wallet.bifold' },
        { title: 'Kategori & ikon', href: '/categories', material: 'category', sf: 'square.grid.2x2' },
        { title: 'Budget mingguan', href: '/weekly-budget', material: 'savings', sf: 'chart.bar' },
        { title: 'Budget per kategori', href: '/budgets', material: 'donut_large', sf: 'chart.pie' },
        { title: 'Siklus gajian', href: '/cycle', material: 'calendar_month', sf: 'calendar', value: `Tgl ${day}` },
        { title: 'Transaksi rutin', href: '/recurring', material: 'event_repeat', sf: 'repeat' },
        { title: 'Target tabungan', href: '/goals', material: 'flag', sf: 'flag' },
        { title: 'Utang & piutang', href: '/debts', material: 'handshake', sf: 'person.2' },
      ],
    },
    {
      title: 'Preferensi',
      rows: [
        {
          title: 'Tampilan',
          href: '/appearance',
          material: 'palette',
          sf: 'paintpalette',
          value: APPEARANCE_OPTIONS.find((o) => o.value === appearance)?.label,
        },
        { title: 'Pengingat', href: '/reminders', material: 'notifications', sf: 'bell' },
        { title: 'Keamanan', href: '/security', material: 'shield_lock', sf: 'lock.shield', value: lock.enabled ? 'PIN aktif' : undefined },
      ],
    },
    {
      title: 'Aktivitas',
      rows: [
        { title: 'Laporan bulanan', href: '/report', material: 'bar_chart', sf: 'chart.bar.doc.horizontal' },
        { title: 'Kebiasaan & pencapaian', href: '/habits', material: 'self_improvement', sf: 'leaf' },
        { title: 'Data & cadangan', href: '/backup', material: 'download', sf: 'square.and.arrow.down' },
      ],
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { backgroundColor: theme.primary }]}>
          <View style={[styles.bubble, styles.bubbleOne, { backgroundColor: theme.accent }]} />
          <View style={[styles.bubble, styles.bubbleTwo, { backgroundColor: theme.onPrimary }]} />
          <SafeAreaView edges={['top', 'left', 'right']} style={styles.heroInner}>
            <Pressable onPress={closeModal} hitSlop={12} style={styles.back} accessibilityLabel="Kembali">
              <AppSymbol material="arrow_back" sf="chevron.left" size={24} color={theme.onPrimary} />
            </Pressable>
            <ThemedText type="subtitle" style={{ color: theme.onPrimary }}>
              Pengaturan
            </ThemedText>
          </SafeAreaView>
        </View>

        <View style={styles.body}>
          <Pressable onPress={() => router.push('/profile')} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.profile}>
              <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                <ThemedText type="smallBold" style={[styles.avatarText, { color: theme.onPrimary }]}>
                  {initials(name)}
                </ThemedText>
              </View>
              <View style={styles.flex}>
                <ThemedText type="subtitle" style={styles.name} numberOfLines={1}>
                  {name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {guest ? 'Mode tamu · ketuk untuk ubah nama' : user.email}
                </ThemedText>
              </View>
              <AppSymbol material="edit" sf="pencil" size={22} color={theme.text} />
            </ThemedView>
          </Pressable>

          {guest && (
            <Pressable
              onPress={() => router.push('/profile')}
              style={({ pressed }) => [styles.strip, { backgroundColor: theme.accent }, pressed && styles.pressed]}>
              <AppSymbol material="verified_user" sf="checkmark.shield.fill" size={22} color={theme.onAccent} />
              <ThemedText type="smallBold" style={[styles.flex, { color: theme.onAccent }]}>
                Simpan datamu dengan Google atau email
              </ThemedText>
              <View style={[styles.stripArrow, { backgroundColor: theme.onAccent }]}>
                <AppSymbol material="arrow_forward" sf="arrow.right" size={16} color={theme.accent} />
              </View>
            </Pressable>
          )}

          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
                {section.title}
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.card}>
                {section.rows.map((row, i) => (
                  <Pressable
                    key={row.title}
                    onPress={() => router.push(row.href)}
                    style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundSelected }]}>
                    <AppSymbol material={row.material} sf={row.sf} size={24} color={theme.text} />
                    <View
                      style={[
                        styles.rowMain,
                        i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected },
                      ]}>
                      <ThemedText style={styles.flex} numberOfLines={1}>
                        {row.title}
                      </ThemedText>
                      {row.badge && (
                        <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                          <ThemedText type="smallBold" style={[styles.badgeText, { color: theme.onPrimary }]}>
                            {row.badge}
                          </ThemedText>
                        </View>
                      )}
                      {row.value && (
                        <ThemedText type="small" themeColor="textSecondary">
                          {row.value}
                        </ThemedText>
                      )}
                      <AppSymbol material="chevron_right" sf="chevron.right" size={22} color={theme.textSecondary} />
                    </View>
                  </Pressable>
                ))}
              </ThemedView>
            </View>
          ))}

          <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
            Flowku · uangmu mengalir tenang
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingBottom: Spacing.five,
  },
  hero: {
    height: 150,
    overflow: 'hidden',
  },
  heroInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
  },
  back: {
    padding: Spacing.one,
  },
  // Soft shapes in the band, echoing the sun-over-waves mark.
  bubble: {
    position: 'absolute',
    borderRadius: 999,
  },
  bubbleOne: {
    width: 120,
    height: 120,
    right: -20,
    top: -30,
    opacity: 0.9,
  },
  bubbleTwo: {
    width: 260,
    height: 260,
    right: -60,
    top: 70,
    opacity: 0.08,
  },
  body: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    marginTop: -56,
    gap: Spacing.four,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
  },
  name: {
    fontSize: 22,
    lineHeight: 28,
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    marginTop: -Spacing.two,
  },
  stripArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    paddingHorizontal: Spacing.one,
  },
  card: {
    borderRadius: Spacing.four,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingLeft: Spacing.three,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three + 2,
    paddingRight: Spacing.two,
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.three,
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
  },
  flex: {
    flex: 1,
  },
  footer: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
