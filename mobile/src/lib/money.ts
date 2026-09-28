const rupiah = new Intl.NumberFormat('id-ID');

/** 35000 -> "Rp35.000" (rupiah has no decimals; amounts are stored as whole rupiah). */
export function formatRupiah(amount: number) {
  return `${amount < 0 ? '-' : ''}Rp${rupiah.format(Math.abs(amount))}`;
}
