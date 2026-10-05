import { cycleKey, cycleLabel, cycleRange, cycleStart, untilLabel } from '@/lib/cycle';

describe('cycle', () => {
  it('matches calendar months on day 1', () => {
    const now = new Date(2026, 9, 5, 10);
    expect(cycleRange(now, 1)).toEqual({ start: new Date(2026, 9, 1), end: new Date(2026, 10, 1) });
    expect(cycleKey(now, 1)).toBe('2026-10-01');
    expect(cycleLabel(cycleStart(now, 1), 1)).toBe('Oktober 2026');
    expect(untilLabel(new Date(2026, 10, 1), 1)).toBe('akhir bulan');
  });

  it('starts on payday, belonging to the previous cycle before it', () => {
    expect(cycleKey(new Date(2026, 9, 24, 23, 59), 25)).toBe('2026-09-25');
    expect(cycleKey(new Date(2026, 9, 25, 0, 0), 25)).toBe('2026-10-25');
  });

  it('crosses the year boundary like the database function', () => {
    expect(cycleKey(new Date(2026, 0, 10), 25)).toBe('2025-12-25');
  });

  it('steps whole cycles back for reports', () => {
    const now = new Date(2026, 9, 5);
    expect(cycleRange(now, 25, -1)).toEqual({ start: new Date(2026, 7, 25), end: new Date(2026, 8, 25) });
  });

  it('labels a payday cycle by its first and last day', () => {
    expect(cycleLabel(new Date(2026, 8, 25), 25)).toBe('25 Sep – 24 Okt');
    expect(untilLabel(new Date(2026, 9, 25), 25)).toBe('gajian 25 Okt');
  });
});
