import { useEffect, useState } from 'react';

import type { Pocket, PocketMove, PocketSpend } from '@/lib/pockets';
import { supabase } from '@/lib/supabase';

/** Every pocket with its balance; the view's columns are never null for a row that exists. */
export async function loadPockets(): Promise<Pocket[]> {
  const { data, error } = await supabase
    .from('v_pocket_balances')
    .select('id, account_id, name, balance')
    .order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({ id: p.id!, account_id: p.account_id!, name: p.name!, balance: p.balance ?? 0 }));
}

/** The pockets for a form; it just shows none when they can't be loaded, since a pocket is optional. */
export function usePockets() {
  const [pockets, setPockets] = useState<Pocket[]>([]);
  useEffect(() => {
    loadPockets().then(setPockets, () => setPockets([]));
  }, []);
  return pockets;
}

export async function createPocket(accountId: string, name: string) {
  const { error } = await supabase.from('pockets').insert({ account_id: accountId, name: name.trim() });
  if (error) throw new Error(error.code === '23505' ? 'Nama ini sudah ada di akun ini.' : error.message);
}

export async function renamePocket(id: string, name: string) {
  const { error } = await supabase.from('pockets').update({ name: name.trim() }).eq('id', id);
  if (error) throw new Error(error.code === '23505' ? 'Nama ini sudah ada di akun ini.' : error.message);
}

export async function deletePocket(id: string) {
  const { error } = await supabase.from('pockets').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function movePocketMoney(
  accountId: string,
  from: string | null,
  to: string | null,
  amount: number,
  requestId: string,
) {
  const { error } = await supabase.rpc('move_pocket_money', {
    p_account_id: accountId,
    // The database treats null as Utama.
    p_from: from as string,
    p_to: to as string,
    p_amount: amount,
    p_request_id: requestId,
  });
  if (error) throw new Error(error.message);
}

const ACTIVITY_LIMIT = 20;

export async function loadPocketActivity(pocketId: string): Promise<{ moves: PocketMove[]; spends: PocketSpend[] }> {
  const [moves, spends] = await Promise.all([
    supabase
      .from('pocket_moves')
      .select('id, from_pocket_id, to_pocket_id, amount, created_at')
      .or(`from_pocket_id.eq.${pocketId},to_pocket_id.eq.${pocketId}`)
      .order('created_at', { ascending: false })
      .limit(ACTIVITY_LIMIT),
    supabase
      .from('transactions')
      .select('id, type, amount, occurred_at, merchant, categories(name)')
      .eq('pocket_id', pocketId)
      .order('occurred_at', { ascending: false })
      .limit(ACTIVITY_LIMIT),
  ]);
  const failed = moves.error ?? spends.error;
  if (failed) throw new Error(failed.message);
  return {
    moves: moves.data ?? [],
    spends: (spends.data ?? []).map((t) => ({
      id: t.id,
      type: t.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
      amount: t.amount,
      occurred_at: t.occurred_at,
      title: t.merchant ?? t.categories?.name ?? (t.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'),
    })),
  };
}
