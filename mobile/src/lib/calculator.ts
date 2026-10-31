// The Kalkulator screen: the expression is a plain string such as "12000+3000×2" or "50000+10%", changed one key at a
// time and worked out by a small parser (never eval). Numbers are written Indonesian style, with a decimal comma.
// A percent works like on a phone: "50000+10%" is 55000, "50000×10%" is 5000, and "10%" alone is 0,1.

export type CalcKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '000' | ',' | '+' | '−' | '×' | '÷' | '%';

const OPERATORS = '+−×÷';
const MAX_DIGITS = 15;

function lastNumber(expr: string) {
  return expr.match(/[\d,]+$/)?.[0] ?? '';
}

const digitCount = (number: string) => number.replace(',', '').length;

/** The expression after pressing a key; a key that makes no sense there changes nothing. */
export function pressKey(expr: string, key: CalcKey): string {
  const last = expr.at(-1) ?? '';
  const number = lastNumber(expr);
  if (OPERATORS.includes(key)) {
    if (!expr) return key === '−' ? '−' : '';
    if (expr === '−') return expr;
    if (OPERATORS.includes(last)) return `${expr.slice(0, -1)}${key}`;
    return `${expr.replace(/,$/, '')}${key}`;
  }
  if (key === '%') return number && !number.endsWith(',') ? `${expr}%` : expr;
  if (last === '%') return expr;
  if (key === ',') {
    if (number.includes(',')) return expr;
    return number ? `${expr},` : `${expr}0,`;
  }
  if (key === '000') {
    if (!number || /^[0,]+$/.test(number) || digitCount(number) + 3 > MAX_DIGITS) return expr;
    return `${expr}000`;
  }
  if (digitCount(number) >= MAX_DIGITS) return expr;
  // No leading zeros: "0" then "5" is "5".
  if (number === '0') return `${expr.slice(0, -1)}${key}`;
  return `${expr}${key}`;
}

export function dropLast(expr: string) {
  return expr.slice(0, -1);
}

type Term = { value: number; percent: boolean };

/**
 * The value of the expression, ignoring a trailing operator so the result shows while typing. Null when there is
 * nothing to work out, or it can't be worked out (divided by zero).
 */
export function evaluate(expr: string): number | null {
  const text = expr.replace(/[+−×÷]$/, '');
  if (!text || text === '−') return null;
  const tokens = text.match(/[\d,]+%?|[+−×÷]/g);
  if (!tokens) return null;

  // Multiply and divide first, leaving a list of terms to add up.
  const terms: { sign: 1 | -1; term: Term }[] = [];
  let sign: 1 | -1 = 1;
  let current: Term | null = null;
  let pending: string | null = null;
  for (const token of tokens) {
    if (OPERATORS.includes(token)) {
      if (token === '+' || token === '−') {
        if (current) terms.push({ sign, term: current });
        current = null;
        sign = token === '+' ? 1 : -1;
      } else {
        pending = token;
      }
      continue;
    }
    const percent = token.endsWith('%');
    const raw = Number(token.replace('%', '').replace(',', '.'));
    const value = percent ? raw / 100 : raw;
    if (current && pending) {
      if (pending === '÷' && value === 0) return null;
      current = { value: pending === '×' ? current.value * value : current.value / value, percent: false };
      pending = null;
    } else {
      current = { value, percent };
    }
  }
  if (current) terms.push({ sign, term: current });

  let total = 0;
  terms.forEach(({ sign: s, term }, i) => {
    // "a + 10%" is 10% of a; a percent with nothing before it is just its value.
    total += s * (term.percent && i > 0 ? total * term.value : term.value);
  });
  // Clears floating point dust such as 0,1 + 0,2.
  const clean = Number(total.toPrecision(12));
  return Number.isFinite(clean) ? clean : null;
}

function groupThousands(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** 1250000.5 -> "1.250.000,5", at most 6 decimals. */
export function formatResult(value: number) {
  const fixed = Math.abs(value).toFixed(6).replace(/\.?0+$/, '');
  const [whole, decimals] = fixed.split('.');
  return `${value < 0 ? '−' : ''}${groupThousands(whole)}${decimals ? `,${decimals}` : ''}`;
}

/** "12000+3000×2" -> "12.000 + 3.000 × 2". */
export function formatExpression(expr: string) {
  return expr
    .replace(/\d+/g, (run, at: number) => (expr[at - 1] === ',' ? run : groupThousands(run)))
    .replace(/([+×÷]|(?!^)−)/g, ' $1 ');
}

/** The result as a new expression, for pressing "=" and carrying on. */
export function resultToExpression(value: number) {
  const fixed = Math.abs(value).toFixed(6).replace(/\.?0+$/, '').replace('.', ',');
  return `${value < 0 ? '−' : ''}${fixed}`;
}

/** The result as a stored amount in the currency's smallest unit; null when it can't be logged. */
export function resultToAmount(value: number | null, decimals: number) {
  if (value === null || value <= 0) return null;
  const amount = Math.round(value * 10 ** decimals);
  return amount > 0 && Number.isSafeInteger(amount) ? amount : null;
}
