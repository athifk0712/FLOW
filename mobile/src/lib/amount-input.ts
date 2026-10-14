// The keys of the amount keypad in Catat (components/amount-keypad). The amount is kept as a string of digits in the
// currency's smallest unit and saved as an integer; only the display is formatted.

export const MAX_AMOUNT_DIGITS = 12; // up to 999.999.999.999: far inside bigint, and beyond any real entry

/** "5" + "0" -> "50". A leading zero is never kept ("" + "0" stays ""); never grows past maxDigits. */
export function appendDigit(digits: string, digit: string, maxDigits = MAX_AMOUNT_DIGITS) {
  if (!/^\d$/.test(digit)) return digits;
  if (!digits && digit === '0') return digits;
  return digits.length >= maxDigits ? digits : `${digits}${digit}`;
}

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
