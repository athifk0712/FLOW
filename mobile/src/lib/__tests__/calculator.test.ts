import {
  type CalcKey,
  dropLast,
  evaluate,
  formatExpression,
  formatResult,
  pressKey,
  resultToAmount,
  resultToExpression,
} from '@/lib/calculator';

const type = (...keys: CalcKey[]) => keys.reduce((expr, key) => pressKey(expr, key), '');

describe('pressKey', () => {
  it('builds an expression, with 000 on the current number', () => {
    expect(type('1', '2', '000', '+', '3', '000')).toBe('12000+3000');
  });

  it('000 needs a number to multiply', () => {
    expect(type('000')).toBe('');
    expect(type('0', '000')).toBe('0');
    expect(type('5', '+', '000')).toBe('5+');
  });

  it('a second operator replaces the first', () => {
    expect(type('5', '+', '×')).toBe('5×');
  });

  it('only a minus can start an expression', () => {
    expect(type('×')).toBe('');
    expect(type('−', '5')).toBe('−5');
  });

  it('one comma per number, and a bare comma starts at zero', () => {
    expect(type('1', ',', '5', ',')).toBe('1,5');
    expect(type(',', '5')).toBe('0,5');
    expect(type('1', ',', '+')).toBe('1+');
  });

  it('no leading zeros, nothing after a percent, length capped', () => {
    expect(type('0', '5')).toBe('5');
    expect(type('5', '%', '1')).toBe('5%');
    expect(pressKey('9'.repeat(15), '1')).toBe('9'.repeat(15));
    expect(pressKey('9'.repeat(13), '000')).toBe('9'.repeat(13));
  });

  it('backspace removes one character', () => {
    expect(dropLast('12+')).toBe('12');
  });
});

describe('evaluate', () => {
  it('multiplies before adding', () => {
    expect(evaluate('12000+3000×2')).toBe(18000);
    expect(evaluate('10−2−3')).toBe(5);
    expect(evaluate('100÷4×2')).toBe(50);
  });

  it('handles a leading minus and decimals', () => {
    expect(evaluate('−5+10')).toBe(5);
    expect(evaluate('1,5×2')).toBe(3);
  });

  it('clears floating point dust', () => {
    expect(evaluate('0,1+0,2')).toBe(0.3);
  });

  it('percent works like on a phone', () => {
    expect(evaluate('50000+10%')).toBe(55000);
    expect(evaluate('50000−10%')).toBe(45000);
    expect(evaluate('50000×10%')).toBe(5000);
    expect(evaluate('10%')).toBe(0.1);
  });

  it('ignores a trailing operator while typing', () => {
    expect(evaluate('12+')).toBe(12);
  });

  it('nothing to work out, or dividing by zero, is null', () => {
    expect(evaluate('')).toBeNull();
    expect(evaluate('−')).toBeNull();
    expect(evaluate('5÷0')).toBeNull();
  });
});

describe('formatting', () => {
  it('groups thousands and uses a decimal comma', () => {
    expect(formatResult(1250000.5)).toBe('1.250.000,5');
    expect(formatResult(-1500)).toBe('−1.500');
    expect(formatResult(0)).toBe('0');
    expect(formatExpression('12000+3000×2')).toBe('12.000 + 3.000 × 2');
    expect(formatExpression('−1000,1234')).toBe('−1.000,1234');
  });

  it('a result carries on as an expression', () => {
    expect(resultToExpression(1500.5)).toBe('1500,5');
    expect(resultToExpression(-20)).toBe('−20');
    expect(evaluate(`${resultToExpression(-20)}+50`)).toBe(30);
  });

  it('only a positive result can be logged, in minor units', () => {
    expect(resultToAmount(18000, 0)).toBe(18000);
    expect(resultToAmount(12.5, 2)).toBe(1250);
    expect(resultToAmount(1500.6, 0)).toBe(1501);
    expect(resultToAmount(-5, 0)).toBeNull();
    expect(resultToAmount(null, 0)).toBeNull();
  });
});
