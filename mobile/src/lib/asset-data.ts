import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

// Reads and writes for the Aset screens. Every money-moving step goes through a database function that writes the
// asset history and the wallet transaction together (all or nothing) and treats a repeated request id as done.

export type Asset = Tables<'v_assets'>;
export type AssetEvent = Pick<
  Tables<'asset_events'>,
  | 'id'
  | 'kind'
  | 'occurred_at'
  | 'quantity'
  | 'amount'
  | 'fee'
  | 'tax'
  | 'cost_allocated'
  | 'unit_value'
  | 'note'
  | 'transaction_id'
  | 'created_at'
  | 'opening'
  | 'cost_known'
>;

const EVENT_SELECT =
  'id, kind, occurred_at, quantity, amount, fee, tax, cost_allocated, unit_value, note, transaction_id, created_at, opening, cost_known';

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function listAssets() {
  const { data, error } = await supabase.from('v_assets').select('*').order('created_at', { ascending: false });
  fail(error);
  return data ?? [];
}

/** Sales of all assets (for realized P/L per period). */
export async function listSales() {
  const { data, error } = await supabase
    .from('asset_events')
    .select('kind, occurred_at, amount, fee, tax, cost_allocated, cost_known')
    .eq('kind', 'SELL');
  fail(error);
  return data ?? [];
}

export async function loadAsset(id: string) {
  const [asset, events] = await Promise.all([
    supabase.from('v_assets').select('*').eq('id', id).single(),
    supabase
      .from('asset_events')
      .select(EVENT_SELECT)
      .eq('asset_id', id)
      .order('occurred_at', { ascending: false })
      .order('created_at', { ascending: false }),
  ]);
  fail(asset.error ?? events.error);
  return { asset: asset.data!, events: events.data ?? [] };
}

export type BuyInput = {
  assetId: string | null;
  name: string;
  category: string;
  unit: string | null;
  divisible: boolean;
  quantity: number;
  price: number;
  fee: number;
  accountId: string;
  occurredAt: Date | null;
  note: string;
  requestId: string;
};

export async function buyAsset(input: BuyInput) {
  const { data, error } = await supabase.rpc('buy_asset', {
    p_asset_id: input.assetId,
    p_name: input.assetId ? null : input.name,
    p_category: input.assetId ? null : input.category,
    p_unit: input.assetId ? null : input.unit,
    p_divisible: input.assetId ? null : input.divisible,
    p_quantity: input.quantity,
    p_price: input.price,
    p_fee: input.fee,
    p_account_id: input.accountId,
    p_occurred_at: input.occurredAt?.toISOString(),
    p_note: input.note.trim() || undefined,
    p_request_id: input.requestId,
  });
  fail(error);
  return data!;
}

export type ExistingInput = {
  name: string;
  category: string;
  unit: string | null;
  divisible: boolean;
  quantity: number;
  /** Historical cost of all of it; null when the user does not remember. */
  cost: number | null;
  /** What all of it is worth today. */
  value: number;
  /** When it started being theirs; null = not remembered (today is used). */
  acquiredAt: Date | null;
  note: string;
  requestId: string;
};

/** Records an asset the user already owned. No wallet changes and no transaction is created. Returns the asset id. */
export async function addExistingAsset(input: ExistingInput) {
  const { data, error } = await supabase.rpc('add_existing_asset', {
    p_name: input.name,
    p_category: input.category,
    p_unit: input.unit,
    p_divisible: input.divisible,
    p_quantity: input.quantity,
    p_cost: input.cost,
    p_value: input.value,
    p_acquired_at: input.acquiredAt?.toISOString(),
    p_note: input.note.trim() || undefined,
    p_request_id: input.requestId,
  });
  fail(error);
  return data!;
}

export async function valueAsset(assetId: string, unitValue: number, note: string, requestId: string) {
  const { error } = await supabase.rpc('value_asset', {
    p_asset_id: assetId,
    p_unit_value: unitValue,
    p_note: note.trim() || undefined,
    p_request_id: requestId,
  });
  fail(error);
}

export type SellInput = {
  assetId: string;
  quantity: number;
  gross: number;
  fee: number;
  tax: number;
  accountId: string;
  /** When it was sold; null = now. */
  occurredAt: Date | null;
  note: string;
  requestId: string;
};

export async function sellAsset(input: SellInput) {
  const { error } = await supabase.rpc('sell_asset', {
    p_asset_id: input.assetId,
    p_quantity: input.quantity,
    p_gross: input.gross,
    p_fee: input.fee,
    p_tax: input.tax,
    p_account_id: input.accountId,
    p_occurred_at: input.occurredAt?.toISOString(),
    p_note: input.note.trim() || undefined,
    p_request_id: input.requestId,
  });
  fail(error);
}

export async function undoAssetEvent(eventId: string) {
  const { error } = await supabase.rpc('undo_asset_event', { p_event_id: eventId });
  fail(error);
}

export async function deleteAsset(assetId: string) {
  const { error } = await supabase.rpc('delete_asset', { p_asset_id: assetId });
  fail(error);
}

export async function renameAsset(assetId: string, name: string) {
  const { error } = await supabase.from('assets').update({ name: name.trim() }).eq('id', assetId);
  fail(error);
}
