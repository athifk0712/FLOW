import { formatMoney } from '@/lib/money';
import { supabase } from '@/lib/supabase';

// Monthly bank admin fee per account: a recurring expense rule flagged is_admin_fee (one per account), posted by
// post_due_recurring_details() on the due day like any other recurring rule.

export const ADMIN_FEE_CATEGORY = 'Biaya Admin Bank';

export type AdminFee = { id: string; account_id: string; amount: number; day_of_month: number };
export type AdminFeeSettings = { enabled: boolean; amount: number; day: number };
export type PostedRule = { name: string; amount: number; account_name: string; is_admin_fee: boolean; posted: number };

/** The admin fee rule of every account, by account id. */
export async function loadAdminFees() {
  const { data, error } = await supabase
    .from('recurring_transactions')
    .select('id, account_id, amount, day_of_month')
    .eq('is_admin_fee', true);
  if (error) throw error;
  return new Map((data ?? []).map((r) => [r.account_id, r]));
}

/** "Biaya Admin Bank", created with a bank icon the first time it is needed. */
async function adminFeeCategoryId() {
  const found = await supabase
    .from('categories')
    .select('id')
    .eq('kind', 'EXPENSE')
    .ilike('name', ADMIN_FEE_CATEGORY)
    .limit(1)
    .maybeSingle();
  if (found.error) throw found.error;
  if (found.data) return found.data.id;
  const created = await supabase
    .from('categories')
    .insert({ name: ADMIN_FEE_CATEGORY, kind: 'EXPENSE', icon: 'bank' })
    .select('id')
    .single();
  if (created.error) throw created.error;
  return created.data.id;
}

/**
 * Turns the account's admin fee on (creating or updating its rule) or off (removing the rule; fees already posted
 * stay as normal transactions). A new rule's first charge is the next due day from today on, never a past one: the
 * balance the user just typed already includes this month's fee if it was charged.
 */
export async function saveAdminFee(accountId: string, accountName: string, existing: AdminFee | undefined, fee: AdminFeeSettings) {
  if (!fee.enabled) {
    if (!existing) return;
    const { error } = await supabase.from('recurring_transactions').delete().eq('id', existing.id);
    if (error) throw error;
    return;
  }
  const values = {
    amount: fee.amount,
    day_of_month: fee.day,
    name: `Biaya admin ${accountName}`,
    category_id: await adminFeeCategoryId(),
    active: true,
  };
  const { error } = existing
    ? await supabase.from('recurring_transactions').update(values).eq('id', existing.id)
    : await supabase
        .from('recurring_transactions')
        .insert({ ...values, type: 'EXPENSE', account_id: accountId, necessity: 'NEED', is_admin_fee: true });
  if (error) throw error;
}

/** Problem with the form's admin fee fields, or null when they can be saved. */
export function adminFeeProblem(fee: AdminFeeSettings) {
  if (!fee.enabled) return null;
  if (fee.amount <= 0) return 'Isi nominal biaya admin.';
  if (!Number.isInteger(fee.day) || fee.day < 1 || fee.day > 31) return 'Tanggal potongan harus 1–31.';
  return null;
}

/** One toast line per admin fee that was just charged; other recurring rules post quietly. */
export function adminFeeMessages(rows: PostedRule[]) {
  return rows
    .filter((r) => r.is_admin_fee && r.posted > 0)
    .map(
      (r) =>
        `Biaya admin bulanan ${r.account_name} sebesar ${formatMoney(r.amount * r.posted)}` +
        `${r.posted > 1 ? ` (${r.posted} bulan)` : ''} telah dipotong otomatis.`,
    );
}
