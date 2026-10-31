import { celebrationMessage, localDayKey, savesLeft, shouldCelebrate, streakFromProfile, streakView } from '@/lib/streak';

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

  it('one missed day with a save left is at risk, not over', () => {
    expect(streakView(5, '2026-10-12', today, 1)).toEqual({ days: 5, activeToday: false, atRisk: true });
  });

  it('a save only reaches one missed day', () => {
    expect(streakView(5, '2026-10-11', today, 2)).toEqual({ days: 0, activeToday: false });
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

describe('streak saves', () => {
  const today = '2026-10-14';
  const profile = {
    streak_count: 5,
    last_active_date: '2026-10-12',
    streak_saves_used: 1,
    streak_saves_month: '2026-10-01',
    streak_saved_on: null,
  };

  it('counts what is left this month', () => {
    expect(savesLeft(profile, today)).toBe(1);
    expect(savesLeft({ ...profile, streak_saves_used: 2 }, today)).toBe(0);
  });

  it('a new month starts over', () => {
    expect(savesLeft({ ...profile, streak_saves_month: '2026-09-01', streak_saves_used: 2 }, today)).toBe(2);
    expect(savesLeft({ ...profile, streak_saves_month: null, streak_saves_used: 0 }, today)).toBe(2);
  });

  it('no save left ends the streak after a missed day', () => {
    expect(streakFromProfile({ ...profile, streak_saves_used: 2 }, today).view.days).toBe(0);
    expect(streakFromProfile(profile, today).view.atRisk).toBe(true);
  });

  it('knows when a save was used today', () => {
    expect(streakFromProfile({ ...profile, streak_saved_on: today }, today).savedToday).toBe(true);
    expect(streakFromProfile(profile, today).savedToday).toBe(false);
  });
});
