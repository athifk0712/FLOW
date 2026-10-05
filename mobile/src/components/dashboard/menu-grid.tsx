import { type Href, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppSymbol } from '@/components/app-symbol';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type MenuItem = { label: string; href: Href; material: string; sf: string; badge?: string };

/** Round icons with a label under each, four to a row, like the service grid of a banking app. */
export function MenuGrid({ items, columns = 4 }: { items: MenuItem[]; columns?: number }) {
  const theme = useTheme();
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <Pressable
          key={item.label}
          onPress={() => router.push(item.href)}
          style={({ pressed }) => [styles.item, { width: `${100 / columns}%` }, pressed && styles.pressed]}>
          <View style={[styles.circle, { backgroundColor: theme.backgroundSelected }]}>
            <AppSymbol material={item.material} sf={item.sf} size={24} color={theme.primary} />
            {item.badge && (
              <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                <ThemedText type="smallBold" style={[styles.badgeText, { color: theme.onAccent }]}>
                  {item.badge}
                </ThemedText>
              </View>
            )}
          </View>
          <ThemedText type="small" style={styles.label} numberOfLines={2}>
            {item.label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

/** A row of round action buttons inside a card (Catat, Riwayat, ...). */
export function QuickActions({ items }: { items: MenuItem[] }) {
  const theme = useTheme();
  return (
    <View style={[styles.actions, { borderTopColor: theme.backgroundSelected }]}>
      {items.map((item) => (
        <Pressable
          key={item.label}
          onPress={() => router.push(item.href)}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <View style={[styles.actionCircle, { backgroundColor: theme.primary }]}>
            <AppSymbol material={item.material} sf={item.sf} size={22} color={theme.onPrimary} />
          </View>
          <ThemedText type="small" numberOfLines={1}>
            {item.label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.three,
  },
  item: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.half,
  },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 18,
  },
  label: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 17,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  actionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
