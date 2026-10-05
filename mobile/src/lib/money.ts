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
