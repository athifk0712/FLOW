// Shortcut keys under the amount field (the phone's own number keyboard does the rest). The amount is kept as a
// string of digits in the currency's smallest unit and saved as an integer; only the display is formatted.

export const MAX_AMOUNT_DIGITS = 12; // up to 999.999.999.999: far inside bigint, and beyond any real entry

/** "50" -> "50000". Nothing to multiply when empty; never grows past maxDigits. */
export function appendThousands(digits: string, maxDigits = MAX_AMOUNT_DIGITS) {
  if (!digits || /^0+$/.test(digits)) return digits;
  return digits.length + 3 > maxDigits ? digits : `${digits}000`;
}

/** Removes the last digit: "50000" -> "5000". */
export function dropLastDigit(digits: string) {
  return digits.slice(0, -1);
}

/** Digits -> the integer that is stored (0 when empty). */
export function digitsToAmount(digits: string) {
  const n = Number(digits || '0');
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}
