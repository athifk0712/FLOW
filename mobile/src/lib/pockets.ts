// Kantong: one account's balance divided by purpose. The money stays in the account, so these numbers always add up
// to the account's balance; Utama is whatever is not in a pocket.

export type Pocket = { id: string; account_id: string; name: string; balance: number };

export type PocketMove = {
  id: string;
  from_pocket_id: string | null;
  to_pocket_id: string | null;
  amount: number;
  created_at: string;
};

export type PocketSpend = {
  id: string;
  type: 'EXPENSE' | 'INCOME';
  amount: number;
  occurred_at: string;
  title: string;
};

export type PocketActivity = { id: string; title: string; amount: number; at: string };

export const POCKET_SUGGESTIONS = ['Jajan', 'Cicilan', 'Tagihan', 'Tabungan', 'Darurat'];

/** Utama: the account's balance minus every pocket. Negative when more was spent from it than it held. */
export function mainBalance(accountBalance: number, pockets: Pick<Pocket, 'balance'>[]) {
  return pockets.reduce((rest, p) => rest - p.balance, accountBalance);
}

/** Why this name can't be used, or null. Names repeat only across accounts. */
export function pocketNameProblem(name: string, others: Pick<Pocket, 'name'>[]) {
  const trimmed = name.trim();
  if (!trimmed) return 'Beri nama kantongnya dulu.';
  if (trimmed.toLowerCase() === 'utama') return '"Utama" sudah dipakai untuk sisa saldo akun.';
  if (others.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) return 'Nama ini sudah ada di akun ini.';
  return null;
}

/** Why this move can't be saved, or null. `available` is what the source holds. */
export function moveProblem(from: string | null, to: string | null, amount: number, available: number) {
  if (from === to) return 'Pilih asal dan tujuan yang berbeda.';
  if (amount > 0 && amount > Math.max(0, available)) return 'Saldo asalnya tidak cukup.';
  return null;
}

/** A pocket's history, newest first. Amounts are signed from the pocket's point of view. */
export function pocketActivity(
  pocketId: string,
  moves: PocketMove[],
  spends: PocketSpend[],
  nameOf: (id: string | null) => string,
): PocketActivity[] {
  const fromMoves = moves.map((m) => {
    const incoming = m.to_pocket_id === pocketId;
    return {
      id: m.id,
      title: incoming ? `Dari ${nameOf(m.from_pocket_id)}` : `Ke ${nameOf(m.to_pocket_id)}`,
      amount: incoming ? m.amount : -m.amount,
      at: m.created_at,
    };
  });
  const fromSpends = spends.map((s) => ({
    id: s.id,
    title: s.title,
    amount: s.type === 'INCOME' ? s.amount : -s.amount,
    at: s.occurred_at,
  }));
  return [...fromMoves, ...fromSpends].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
