import type { Tables } from '@/lib/database.types';

/** Transaction columns plus the names shown in lists. Accounts are aliased because both FKs point at accounts. */
export const TRANSACTION_SELECT =
  'id, type, amount, occurred_at, merchant, description, necessity, category_id, from_account_id, to_account_id, receipt_id, categories(name, icon), from_account:accounts!transactions_from_account_id_user_id_fkey(name), to_account:accounts!transactions_to_account_id_user_id_fkey(name)' as const;

export type TransactionRow = Pick<
  Tables<'transactions'>,
  | 'id'
  | 'type'
  | 'amount'
  | 'occurred_at'
  | 'merchant'
  | 'description'
  | 'necessity'
  | 'category_id'
  | 'from_account_id'
  | 'to_account_id'
  | 'receipt_id'
> & {
  categories: { name: string; icon: string | null } | null;
  from_account: { name: string } | null;
  to_account: { name: string } | null;
};

/** What a transaction is called in lists: merchant, else category, else a fallback per type. */
export function transactionTitle(t: TransactionRow) {
  if (t.type === 'TRANSFER') return t.merchant ?? 'Transfer';
  return t.merchant ?? t.categories?.name ?? (t.type === 'INCOME' ? 'Pemasukan' : 'Tanpa kategori');
}
