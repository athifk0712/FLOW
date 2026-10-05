import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/money';
import type { SafeToSpend } from '@/lib/safe-to-spend';

const dayFormat = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });

/**
 * The one number to check before spending. Calm by default: the breakdown stays folded until asked for,
 * and a shortfall is worded as a pause, not an alarm.
 */
export function SafeToSpendCard({ data, cash, until }: { data: SafeToSpend; cash: number; until: string }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const short = data.safe < 0;
  const overToday = !short && data.leftToday < 0;
  const spentToday = data.dailyLimit - data.leftToday;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.head}>
        <ThemedText type="small" themeColor="textSecondary">
          Aman dibelanjakan
        </ThemedText>
        <ThemedText style={[styles.amount, short && { color: theme.warning }]}>
          {short ? formatMoney(0) : formatMoney(data.safe)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {data.daysLeft} hari lagi sampai {until}
        </ThemedText>
      </View>

      {short ? (
        <ThemedText type="small" themeColor="warning">
          Kebutuhan wajib sampai {until} melebihi saldomu {formatMoney(-data.safe)}. Tahan dulu belanja keinginan,
          ya.
        </ThemedText>
      ) : (
        <View style={styles.today}>
          <View style={styles.row}>
            <ThemedText type="smallBold">
              {overToday ? `Lewat ${formatMoney(-data.leftToday)} hari ini` : `Sisa hari ini ${formatMoney(data.leftToday)}`}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              dari {formatMoney(data.dailyLimit)}/hari
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
