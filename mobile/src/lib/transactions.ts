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

export type TransactionType = TransactionRow['type'];

/** Buying or selling an asset: money moves, but it is neither spending nor income (see the Aset screen). */
export function isAssetType(type: TransactionType) {
  return type === 'ASSET_BUY' || type === 'ASSET_SELL';
}

/** Lending, borrowing or repaying: money moves, but it is neither spending nor income (see Utang & Piutang). */
export function isDebtType(type: TransactionType) {
  return type === 'DEBT_OUT' || type === 'DEBT_IN';
}

/** Which way money goes for the account(s) involved: out of one, into one, or between two of the user's own. */
export function moneyDirection(type: TransactionType): 'out' | 'in' | 'move' {
  if (type === 'EXPENSE' || type === 'ASSET_BUY' || type === 'DEBT_OUT') return 'out';
  if (type === 'INCOME' || type === 'ASSET_SELL' || type === 'DEBT_IN') return 'in';
  return 'move';
}

/** What a transaction is called in lists: merchant, else category, else a fallback per type. */
export function transactionTitle(t: TransactionRow) {
  if (t.type === 'TRANSFER') return t.merchant ?? 'Transfer';
  if (t.type === 'ASSET_BUY') return t.merchant ?? 'Beli aset';
  if (t.type === 'ASSET_SELL') return t.merchant ?? 'Jual aset';
  if (isDebtType(t.type)) return t.merchant ?? 'Utang & piutang';
  return t.merchant ?? t.categories?.name ?? (t.type === 'INCOME' ? 'Pemasukan' : 'Tanpa kategori');
}
