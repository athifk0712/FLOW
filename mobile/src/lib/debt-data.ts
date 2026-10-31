import type { DebtDirection } from '@/lib/debts';
import { supabase } from '@/lib/supabase';

// Writes for the Utang & Piutang screen that move a wallet. The database writes the debt and its wallet row together
// and treats a repeated request id as done.

export type NewDebt = {
  direction: DebtDirection;
  person: string;
  amount: number;
  /** The wallet the money left or entered; null = only a note, balances stay as they are. */
  accountId: string | null;
  note: string | null;
  dueDate: string | null;
  requestId: string;
};

export function createDebt(input: NewDebt) {
  return supabase.rpc('create_debt', {
    p_direction: input.direction,
    p_person: input.person,
    p_amount: input.amount,
    p_account_id: input.accountId ?? undefined,
    p_note: input.note ?? undefined,
    p_due_date: input.dueDate ?? undefined,
    p_request_id: input.requestId,
  });
}

/** Picks, changes or removes (null) the wallet of an existing debt. */
export function setDebtWallet(debtId: string, accountId: string | null) {
  return supabase.rpc('set_debt_wallet', { p_debt_id: debtId, p_account_id: accountId ?? undefined });
}
