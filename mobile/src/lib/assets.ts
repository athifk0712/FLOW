// Asset math shown in the app before and after saving. The database (buy_asset / sell_asset, v_assets) is the
// authority; these mirror its rules so a form can preview the result exactly:
//   cost basis      = price + acquisition fee, minus the cost of units already sold
//   cost of a sale  = cost basis x sold / held (weighted average); everything held -> all of the cost basis
//   net proceeds    = gross - selling fee - tax          (goes into the wallet)
//   realized P/L    = net proceeds - cost of the units sold
//   unrealized P/L  = current estimate - cost basis      (no money moves)
// Net worth = cash in accounts + estimated assets + receivables - debts. Safe to Spend never includes assets.
//
// An asset owned before it was recorded ("aset lama") has no cash row at all: wallets, spending, budgets and Safe to
// Spend stay as they were; only its value joins net worth. Its cost may be unknown (cost_known = false): then it has
// no unrealized P/L, and selling it records no realized P/L, rather than pretending everything was profit.

import { inRange, type Range } from '@/lib/asset-periods';

export type AssetRow = {
  status: string | null;
  current_value: number | null;
  cost_basis: number | null;
  unrealized_pl: number | null;
  realized_pl: number | null;
  cost_known?: boolean | null;
};

const MAX_DECIMALS = 8;

/**
 * Quantity as typed, Indonesian style or not: "2,5" / "2.5" -> 2.5; "1.000,5" -> 1000.5; "0,0035" -> 0.0035.
 * Null when it isn't a positive number with at most 8 decimals.
 */
export function parseQuantity(text: string): number | null {
  let t = text.trim().replace(/\s/g, '');
  if (!t) return null;
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.');
  else if (t.includes(',')) t = t.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const [, decimals = ''] = t.split('.');
  if (decimals.length > MAX_DECIMALS) return null;
  const n = Number(t);
  return n > 0 && Number.isFinite(n) ? n : null;
}

/** 2.5 -> "2,5"; 0.0035 -> "0,0035"; 1000 -> "1.000", with the unit when there is one. */
export function formatQuantity(quantity: number, unit?: string | null) {
  const text = new Intl.NumberFormat('id-ID', { maximumFractionDigits: MAX_DECIMALS }).format(quantity);
  return unit ? `${text} ${unit}` : text;
}

/** P/L as a share of what it cost, rounded to one decimal; null when there is no cost to compare with. */
export function plPercent(pl: number, cost: number) {
  if (cost <= 0) return null;
  return Math.round((pl / cost) * 1000) / 10;
}

export type SalePreview = {
  net: number;
  costOfSold: number;
  realized: number;
  problem: string | null;
};

/** What selling `quantity` of a holding would do, before it is saved. */
export function previewSale(input: {
  held: number;
  costBasis: number;
  divisible: boolean;
  quantity: number | null;
  gross: number;
  fee: number;
  tax: number;
}): SalePreview {
  const { held, costBasis, divisible, quantity, gross, fee, tax } = input;
  const net = gross - fee - tax;
  let problem: string | null = null;
  if (held <= 0) problem = 'Aset ini sudah terjual semua.';
  else if (!quantity || quantity <= 0) problem = 'Isi jumlah yang dijual.';
  else if (quantity > held) problem = 'Jumlah yang dijual melebihi yang kamu punya.';
  else if (!divisible && quantity !== held) problem = 'Barang satuan dijual utuh.';
  else if (net < 0) problem = 'Biaya dan pajak melebihi harga jual.';
  const q = quantity && quantity > 0 ? Math.min(quantity, held) : 0;
  const costOfSold = held > 0 && q > 0 ? (q === held ? costBasis : Math.round((costBasis * q) / held)) : 0;
  return { net, costOfSold, realized: net - costOfSold, problem };
}

export type AssetSummary = {
  value: number;
  cost: number;
  unrealized: number;
  realized: number;
  active: number;
  /** Active assets whose cost is unknown: in `value`, but not in `cost` or `unrealized`. */
  unknownCost: number;
};

/** Totals over the user's assets; only active holdings count towards value, cost and unrealized P/L. */
export function summarizeAssets(rows: AssetRow[]): AssetSummary {
  const active = rows.filter((r) => r.status === 'ACTIVE');
  const known = active.filter((r) => r.cost_known !== false);
  type MoneyKey = 'current_value' | 'cost_basis' | 'unrealized_pl' | 'realized_pl';
  const sum = (list: AssetRow[], key: MoneyKey) => list.reduce((s, r) => s + (r[key] ?? 0), 0);
  return {
    value: sum(active, 'current_value'),
    cost: sum(known, 'cost_basis'),
    unrealized: sum(known, 'unrealized_pl'),
    realized: sum(rows, 'realized_pl'),
    active: active.length,
    unknownCost: active.length - known.length,
  };
}

export type SaleEvent = {
  kind: string;
  occurred_at: string;
  amount: number | null;
  fee: number;
  tax: number;
  cost_allocated: number | null;
  cost_known?: boolean | null;
};

export type PeriodSales = { realized: number; sales: number; unknownCost: number };

/** Realized P/L of the sales inside `range`; sales of assets with an unknown cost are counted but add no P/L. */
export function salesIn(events: SaleEvent[], range: Range): PeriodSales {
  const inside = events.filter((e) => e.kind === 'SELL' && inRange(new Date(e.occurred_at), range));
  const known = inside.filter((e) => e.cost_known !== false);
  return {
    realized: known.reduce((s, e) => s + (e.amount ?? 0) - e.fee - e.tax - (e.cost_allocated ?? 0), 0),
    sales: inside.length,
    unknownCost: inside.length - known.length,
  };
}

/** Realized P/L of the sales that happened in [from, to). */
export function realizedBetween(events: SaleEvent[], from: Date, to: Date) {
  return salesIn(events, { start: from, end: to }).realized;
}

export type OpeningPreview = {
  /** Potential P/L if the cost is known, else null (never guessed from the value). */
  unrealized: number | null;
  percent: number | null;
  problem: string | null;
};

/** Recording an asset already owned: nothing moves in any wallet; this is only what the record will show. */
export function previewOpening(input: { cost: number | null; value: number; quantity: number | null }): OpeningPreview {
  const { cost, value, quantity } = input;
  let problem: string | null = null;
  if (!quantity || quantity <= 0) problem = 'Isi jumlahnya (mis. 2,5).';
  else if (cost !== null && cost <= 0) problem = 'Isi modalnya, atau pilih "Tidak ingat modalnya".';
  else if (value <= 0) problem = 'Isi perkiraan nilainya sekarang.';
  if (cost === null || cost <= 0) return { unrealized: null, percent: null, problem };
  return { unrealized: value - cost, percent: plPercent(value - cost, cost), problem };
}

export type NetWorth = { cash: number; assets: number; receivables: number; debts: number; total: number };

export function netWorth(input: { cash: number; assets: number; receivables: number; debts: number }): NetWorth {
  return { ...input, total: input.cash + input.assets + input.receivables - input.debts };
}
