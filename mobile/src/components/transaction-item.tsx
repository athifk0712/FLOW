import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryIcon } from '@/components/category-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { NECESSITY, UNREVIEWED_COLOR } from '@/constants/necessity';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/money';
import { transactionTitle, type TransactionRow } from '@/lib/transactions';

const timeFormat = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' });

/** One transaction in a list (Riwayat, Kalender): icon with its necessity dot, title, time · account, amount. */
export function TransactionItem({ item }: { item: TransactionRow }) {
  const theme = useTheme();
  const sign = item.type === 'EXPENSE' ? '-' : item.type === 'INCOME' ? '+' : '';
  const dotColor =
    item.type === 'EXPENSE' ? (item.necessity ? NECESSITY[item.necessity].color : UNREVIEWED_COLOR) : null;
  const account =
    item.type === 'TRANSFER'
      ? `${item.from_account?.name ?? '-'} → ${item.to_account?.name ?? '-'}`
      : ((item.type === 'INCOME' ? item.to_account : item.from_account)?.name ?? '-');

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id } })}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={styles.row}>
        <View>
          <CategoryIcon icon={item.type === 'TRANSFER' ? 'transfer' : item.categories?.icon} size={38} />
          {dotColor && (
            <View style={[styles.dot, { backgroundColor: dotColor, borderColor: theme.backgroundElement }]} />
          )}
        </View>
        <View style={styles.rowText}>
          <ThemedText numberOfLines={1}>{transactionTitle(item)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {timeFormat.format(new Date(item.occurred_at))} · {account}
            {item.receipt_id ? ' · ada struk' : ''}
          </ThemedText>
        </View>
        <ThemedText type="smallBold" style={item.type === 'INCOME' && { color: theme.primary }}>
          {sign}
          {formatMoney(item.amount)}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  rowText: {
    flex: 1,
  },
  // Necessity tag as a small dot on the icon's corner.
  dot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
