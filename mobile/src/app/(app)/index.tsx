import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/session-provider';

// Temporary home: proves auth + RLS work end to end. Replaced by the dashboard in v0.1.
export default function HomeScreen() {
  const { session } = useSession();
  const [categoryCount, setCategoryCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('categories')
      .select('id', { count: 'exact', head: true })
      .then(({ count, error }) => {
        if (error) setError(error.message);
        else setCategoryCount(count);
      });
  }, []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">FLOW</ThemedText>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small" themeColor="textSecondary">
            Masuk sebagai
          </ThemedText>
          <ThemedText>{session?.user.email}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Kategori dari database
          </ThemedText>
          <ThemedText>{error ?? (categoryCount === null ? '…' : `${categoryCount} kategori`)}</ThemedText>
        </ThemedView>

        <Pressable onPress={() => supabase.auth.signOut()} style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText type="link" themeColor="textSecondary">
            Keluar
          </ThemedText>
        </Pressable>
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
    paddingBottom: BottomTabInset + Spacing.three,
    gap: Spacing.three,
  },
  card: {
    gap: Spacing.one,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  pressed: {
    opacity: 0.7,
  },
});
