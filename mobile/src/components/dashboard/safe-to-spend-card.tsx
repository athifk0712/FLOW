import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppSymbol } from '@/components/app-symbol';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/money';
import type { SafeToSpend } from '@/lib/safe-to-spend';

const dayFormat = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });
const HIDDEN = '•••••••';

type Props = {
  data: SafeToSpend;
  cash: number;
  until: string;
  /** Amounts masked, e.g. when someone is looking over your shoulder. */
  hidden?: boolean;
  onToggleHidden?: () => void;
  /** Shown under the headline numbers (Beranda puts its quick actions here). */
  children?: React.ReactNode;
};

/**
 * The one number to check before spending. Calm by default: the breakdown stays folded until asked for,
 * and a shortfall is worded as a pause, not an alarm.
 */
export function SafeToSpendCard({ data, cash, until, hidden = false, onToggleHidden, children }: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const short = data.safe < 0;
  const overToday = !short && data.leftToday < 0;
  const spentToday = data.dailyLimit - data.leftToday;
  const money = (amount: number) => (hidden ? HIDDEN : formatMoney(amount));

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.head}>
        <View style={styles.labelRow}>
          <ThemedText type="small" themeColor="textSecondary">
            Aman dibelanjakan
          </ThemedText>
          {onToggleHidden && (
            <Pressable onPress={onToggleHidden} hitSlop={12} accessibilityLabel={hidden ? 'Tampilkan saldo' : 'Sembunyikan saldo'}>
              <AppSymbol
                material={hidden ? 'visibility_off' : 'visibility'}
                sf={hidden ? 'eye.slash' : 'eye'}
                size={18}
                color={theme.textSecondary}
              />
            </Pressable>
          )}
        </View>
        <ThemedText style={[styles.amount, short && { color: theme.warning }]}>
          {hidden ? HIDDEN : short ? formatMoney(0) : formatMoney(data.safe)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Total saldo {hidden ? HIDDEN : formatMoney(cash)} · {data.daysLeft} hari lagi sampai {until}
        </ThemedText>
      </View>

      {short ? (
        <ThemedText type="small" themeColor="warning">
          Kebutuhan wajib sampai {until} melebihi saldomu {money(-data.safe)}. Tahan dulu belanja keinginan,
          ya.
        </ThemedText>
      ) : (
        <View style={styles.today}>
          <View style={styles.row}>
            <ThemedText type="smallBold">
              {overToday ? `Lewat ${money(-data.leftToday)} hari ini` : `Sisa hari ini ${money(data.leftToday)}`}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              dari {money(data.dailyLimit)}/hari
            </ThemedText>
          </View>
          <ProgressBar
            total={Math.max(data.dailyLimit, spentToday)}
            segments={[{ value: spentToday, color: overToday ? theme.warning : theme.primary }]}
          />
          {overToday && (
            <ThemedText type="small" themeColor="textSecondary">
              Tidak apa-apa. Batas besok menyesuaikan sendiri.
            </ThemedText>
          )}
        </View>
      )}

      <Pressable
        onPress={() => setOpen((o) => !o)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}>
        <ThemedText type="smallBold" themeColor="primary">
          {open ? 'Tutup rincian' : 'Dari mana angka ini?'}
        </ThemedText>
      </Pressable>

      {open && (
        <View style={styles.breakdown}>
          <Line label="Total uang di semua akun" amount={cash} />
          {data.bills.map((b, i) => (
            <Line key={i} label={`${b.name} · ${dayFormat.format(b.date)}`} amount={-b.amount} />
          ))}
          {data.debtsDue > 0 && <Line label="Utang jatuh tempo" amount={-data.debtsDue} onPress={() => router.push('/debts')} />}
          {data.goalsSaved > 0 && (
            <Line label="Disisihkan untuk tabungan" amount={-data.goalsSaved} onPress={() => router.push('/goals')} />
          )}
          {data.hasEssentialBudget ? (
            <Line label="Cadangan kebutuhan pokok" amount={-data.essentials} />
          ) : (
            <Pressable onPress={() => router.push('/settings')} hitSlop={4}>
              <ThemedText type="small" themeColor="textSecondary">
                Atur budget Butuh & Penting di Pengaturan supaya kebutuhan pokok ikut dicadangkan →
              </ThemedText>
            </Pressable>
          )}
          <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
          <Line label="Aman dibelanjakan" amount={data.safe} bold />
        </View>
      )}
      {children}
    </ThemedView>
  );
}

function Line({ label, amount, bold, onPress }: { label: string; amount: number; bold?: boolean; onPress?: () => void }) {
  const content = (
    <View style={styles.row}>
      <ThemedText type={bold ? 'smallBold' : 'small'} themeColor={bold ? 'text' : 'textSecondary'} style={styles.label}>
        {label}
      </ThemedText>
      <ThemedText type={bold ? 'smallBold' : 'small'}>
        {amount < 0 ? `− ${formatMoney(-amount)}` : formatMoney(amount)}
      </ThemedText>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  head: {
    gap: Spacing.half,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  amount: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: 700,
  },
  today: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  label: {
    flex: 1,
  },
  breakdown: {
    gap: Spacing.two,
  },
  divider: {
    height: 1,
  },
});
