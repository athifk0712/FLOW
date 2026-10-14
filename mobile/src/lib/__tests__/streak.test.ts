import { celebrationMessage, localDayKey, shouldCelebrate, streakView } from '@/lib/streak';

describe('streakView', () => {
  const today = '2026-10-14';

  it('active today', () => {
    expect(streakView(5, '2026-10-14', today)).toEqual({ days: 5, activeToday: true });
  });

  it('yesterday still counts, but today is not done yet', () => {
    expect(streakView(5, '2026-10-13', today)).toEqual({ days: 5, activeToday: false });
  });

  it('a gap ends the streak', () => {
    expect(streakView(5, '2026-10-12', today)).toEqual({ days: 0, activeToday: false });
    expect(streakView(0, null, today)).toEqual({ days: 0, activeToday: false });
  });

  it('crosses month and year boundaries', () => {
    expect(streakView(3, '2026-12-31', '2027-01-01').days).toBe(3);
    expect(streakView(3, '2026-09-30', '2026-10-01').days).toBe(3);
  });
});

describe('shouldCelebrate', () => {
  const today = '2026-10-14';
  it('only once a day, only after today counted', () => {
    expect(shouldCelebrate({ days: 2, activeToday: true }, null, today)).toBe(true);
    expect(shouldCelebrate({ days: 2, activeToday: true }, today, today)).toBe(false);
    expect(shouldCelebrate({ days: 2, activeToday: false }, null, today)).toBe(false);
  });
});

describe('celebrationMessage', () => {
  it('mentions the count', () => {
    expect(celebrationMessage(5)).toContain('5 hari beruntun');
  });
});

describe('localDayKey', () => {
  it('pads month and day', () => {
    expect(localDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
