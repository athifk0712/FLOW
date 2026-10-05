import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CategoryIcon } from '@/components/category-icon';
import { SearchField } from '@/components/search-field';
import { ThemedText } from '@/components/themed-text';
import { type IconGroup, ICON_GROUPS, searchIcons } from '@/constants/category-icons';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  value: string;
  onChange: (key: string) => void;
};

// Filter chips by group plus a word search, so the user never scrolls through every icon.
export function IconPicker({ value, onChange }: Props) {
  const theme = useTheme();
  const [group, setGroup] = useState<IconGroup | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const icons = searchIcons(query, group);

  const chip = (active: boolean) => [styles.chip, { backgroundColor: active ? theme.primary : theme.backgroundSelected }];
  const chipText = (active: boolean) => ({ color: active ? theme.onPrimary : theme.text });

  return (
    <View style={styles.wrap}>
      <SearchField value={query} onChangeText={setQuery} placeholder="Cari ikon: kopi, bensin, pulsa…" />
      {!query.trim() && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Pressable onPress={() => setGroup('ALL')} style={chip(group === 'ALL')}>
            <ThemedText type="small" style={chipText(group === 'ALL')}>
              Semua
            </ThemedText>
          </Pressable>
          {ICON_GROUPS.map((g) => (
            <Pressable key={g.value} onPress={() => setGroup(g.value)} style={chip(group === g.value)}>
              <ThemedText type="small" style={chipText(group === g.value)}>
                {g.label}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <View style={styles.grid}>
        {icons.map((i) => {
          const selected = i.key === value;
          return (
            <Pressable
              key={i.key}
              onPress={() => onChange(i.key)}
              accessibilityLabel={i.words.split(' ')[0]}
              style={({ pressed }) => [
                styles.cell,
                selected && { borderColor: theme.primary, backgroundColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <CategoryIcon icon={i.key} size={40} />
            </Pressable>
          );
        })}
        {icons.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            Ikon tidak ditemukan. Coba kata lain.
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  chips: {
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Spacing.five,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  cell: {
    padding: Spacing.one,
    borderRadius: Spacing.three,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pressed: {
    opacity: 0.7,
  },
});
