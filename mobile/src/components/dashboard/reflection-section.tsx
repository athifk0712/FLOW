import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { RegretInsight } from '@/components/dashboard/regret-insight';
import { SpendingMix } from '@/components/dashboard/spending-mix';
import { TimeInsightCard } from '@/components/dashboard/time-insight-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { cycleKey } from '@/lib/cycle';
import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { computeTimeInsight, type TimeInsight } from '@/lib/time-insight';

type MixRow = Tables<'v_spending_mix_monthly'>;
type RegretRow = Tables<'v_regret_by_necessity'>;

// The reflective part of Flowku, for when the user wants to look back: this cycle's needs-vs-wants split, when the
// "wants" tend to happen, and which kinds of spending they regretted. Lives on the Diagram tab, not on Beranda, so a
// quick visit to log something never feels like an evaluation.
export function ReflectionSection({ cycleDay }: { cycleDay: number }) {
  const [mix, setMix] = useState<MixRow[]>([]);
  const [regret, setRegret] = useState<RegretRow[]>([]);
  const [timeInsight, setTimeInsight] = useState<TimeInsight | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const now = new Date();
      const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90).toISOString();
      Promise.all([
        supabase.from('v_spending_mix_monthly').select('*').eq('month', cycleKey(now, cycleDay)),
        supabase.from('v_regret_by_necessity').select('*'),
        supabase
          .from('transactions')
          .select('occurred_at, amount, necessity')
          .eq('type', 'EXPENSE')
          .not('necessity', 'is', null)
          .gte('occurred_at', since),
      ]).then(([mixRes, reg, judged]) => {
        if (!active) return;
        // Nice to have: a failed part is simply left out.
        setMix(mixRes.data ?? []);
        setRegret(reg.data ?? []);
        setTimeInsight(computeTimeInsight(judged.data ?? []));
      });
      return () => {
        active = false;
      };
    }, [cycleDay]),
  );

  const hasRegret = regret.some((r) => (r.reviewed ?? 0) > 0);
  if (mix.length === 0 && !timeInsight && !hasRegret) return null;

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        KEBUTUHAN & KEINGINAN BULAN INI
      </ThemedText>
      <SpendingMix rows={mix} />
      {(timeInsight || hasRegret) && (
        <>
          <ThemedText type="smallBold" themeColor="textSecondary">
            REFLEKSI
          </ThemedText>
          {timeInsight && <TimeInsightCard insight={timeInsight} />}
          <RegretInsight rows={regret} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
});
