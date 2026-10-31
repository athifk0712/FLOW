import type { TablesInsert } from '@/lib/database.types';
import { isAlreadySaved } from '@/lib/request-id';
import { supabase } from '@/lib/supabase';

export async function loadBatchContext() {
  const [cats, accs, recent] = await Promise.all([
    supabase.from('categories').select('id, name').eq('kind', 'EXPENSE').order('created_at'),
    supabase.from('accounts').select('id, name').is('archived_at', null).order('created_at'),
    supabase
      .from('transactions')
      .select('merchant, category_id, from_account_id')
      .eq('type', 'EXPENSE')
      .is('fee_for_id', null)
      .order('occurred_at', { ascending: false })
      .limit(200),
  ]);
  const failed = cats.error ?? accs.error ?? recent.error;
  if (failed) throw new Error(failed.message);
  const accounts = accs.data ?? [];
  const lastUsed = recent.data?.[0]?.from_account_id;
  return {
    categories: cats.data ?? [],
    accounts,
    history: recent.data ?? [],
    defaultAccountId: accounts.find((a) => a.id === lastUsed)?.id ?? accounts[0]?.id ?? null,
  };
}

/** One insert, so all of them are saved or none. Each row has its own request id: a retry never saves twice. */
export async function saveBatch(rows: TablesInsert<'transactions'>[]) {
  const { error } = await supabase.from('transactions').insert(rows);
  if (error && !isAlreadySaved(error)) throw new Error(error.message);
}
