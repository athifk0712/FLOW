import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { ChartTransaction } from '@/lib/charts';
import { cycleRange } from '@/lib/cycle';
import { supabase } from '@/lib/supabase';

// How far back the Diagram tab can go. Colors are assigned over this whole window, so they hold between months.
export const CHART_WINDOW = 12;

/** Income and spending of the last CHART_WINDOW periods, reloaded whenever the screen comes back into focus. */
export function useChartRows(now: Date, cycleDay: number) {
  const [rows, setRows] = useState<ChartTransaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      supabase
        .from('transactions')
        .select('type, amount, occurred_at, category_id, categories(name, icon)')
        .in('type', ['INCOME', 'EXPENSE'])
        .gte('occurred_at', cycleRange(now, cycleDay, -(CHART_WINDOW - 1)).start.toISOString())
        .lt('occurred_at', cycleRange(now, cycleDay, 0).end.toISOString())
        .then(({ data, error }) => {
          if (!active) return;
          if (error) return setError(error.message);
          setError(null);
          setRows(data ?? []);
        });
      return () => {
        active = false;
      };
    }, [now, cycleDay]),
  );

  return { rows, error };
}
