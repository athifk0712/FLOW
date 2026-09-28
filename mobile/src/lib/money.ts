const rupiah = new Intl.NumberFormat('id-ID');

/** 35000 -> "Rp35.000" (rupiah has no decimals; amounts are stored as whole rupiah). */
export function formatRupiah(amount: number) {
  return `${amount < 0 ? '-' : ''}Rp${rupiah.format(Math.abs(amount))}`;
}

/** Digits typed into an amount field -> "1.200.000" for display. */
export function formatDigits(digits: string) {
  return digits ? rupiah.format(Number(digits)) : '';
}

/** Any text typed into an amount field -> digits only, without leading zeros. */
export function toDigits(text: string, maxDigits = 12) {
  return text.replace(/\D/g, '').replace(/^0+/, '').slice(0, maxDigits);
}

/** Local calendar month key matching the views' `month` column, e.g. "2026-09-01". */
export function currentMonthKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}
