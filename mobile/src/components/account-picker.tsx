import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AccountBadge } from '@/components/account-badge';
import { SearchField } from '@/components/search-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type AccountGroup, type CatalogEntry, GROUPS, searchCatalog } from '@/lib/account-catalog';

type Tab = AccountGroup | 'ALL';

const TABS: { value: Tab; label: string }[] = [{ value: 'ALL', label: 'Populer' }, ...GROUPS];

type Props = {
  /** Names already picked (or already owned), shown with a check. */
  selected: string[];
  onPick: (entry: CatalogEntry) => void;
  /** Called with the typed text when nothing in the list fits. */
  onCustom: (name: string) => void;
};

// Pick a bank, e-wallet or marketplace balance: tabs keep the first screen short, search finds the rest.
export function AccountPicker({ selected, onPick, onCustom }: Props) {
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('ALL');
  const [query, setQuery] = useState('');
  // Searching looks through every group, so the user never has to guess the right tab first.
  const results = searchCatalog(query, query.trim() ? 'ALL' : tab);
  const typed = query.trim();
  const exact = results.some((e) => e.name.toLowerCase() === typed.toLowerCase());
  const isSelected = (name: string) => selected.some((s) => s.toLowerCase() === name.toLowerCase());

  return (
    <View style={styles.wrap}>
      <SearchField value={query} onChangeText={setQuery} placeholder="Cari bank, e-wallet, toko online…" />
      {!typed && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {TABS.map((t) => {
            const active = t.value === tab;
            return (
              <Pressable
                key={t.value}
                onPress={() => setTab(t.value)}
                style={[styles.tab, { backgroundColor: active ? theme.primary : theme.backgroundElement }]}>
                <ThemedText type="smallBold" style={{ color: active ? theme.onPrimary : theme.text }}>
                  {t.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <View style={styles.grid}>
        {results.map((e) => {
          const picked = isSelected(e.name);
          return (
            <Pressable
              key={`${e.group}-${e.name}`}
              onPress={() => onPick(e)}
              style={({ pressed }) => [
                styles.cell,
                { backgroundColor: picked ? theme.backgroundSelected : theme.backgroundElement },
                picked && { borderColor: theme.primary },
                pressed && styles.pressed,
              ]}>
              <AccountBadge name={e.name} color={e.color} size={40} />
              <ThemedText type="small" numberOfLines={1} style={styles.cellLabel}>
                {e.name}
              </ThemedText>
              {picked && (
                <View style={[styles.check, { backgroundColor: theme.primary }]}>
                  <ThemedText style={[styles.checkText, { color: theme.onPrimary }]}>✓</ThemedText>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      {!!typed && !exact && (
        <Pressable
          onPress={() => {
            onCustom(typed);
            setQuery('');
          }}
          style={({ pressed }) => [styles.custom, { borderColor: theme.textSecondary }, pressed && styles.pressed]}>
          <ThemedText type="smallBold">+ Tambah &quot;{typed}&quot;</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Tidak ada di daftar? Pakai nama ini.
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.three,
  },
  tabs: {
    gap: Spacing.two,
  },
  tab: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  cell: {
    width: '31%',
    flexGrow: 1,
    maxWidth: '32.5%',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.one,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cellLabel: {
    maxWidth: '100%',
  },
  check: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 800,
  },
  custom: {
    gap: Spacing.half,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  pressed: {
    opacity: 0.7,
  },
});
