import { cooldownHours, describeCooldown } from '@/lib/cooldown';

describe('cooldownHours', () => {
  // Same boundaries the database returned for a Rp80.000 daily limit.
  it.each([
    [30_000, 0],
    [39_999, 0],
    [40_000, 1],
    [80_000, 1],
    [80_001, 6],
    [240_000, 6],
    [240_001, 24],
    [1_000_000, 24],
  ])('Rp%i -> %i hours', (cost, hours) => {
    expect(cooldownHours(cost, 80_000)).toBe(hours);
  });

  it('pauses a full day when nothing is safe to spend', () => {
    expect(cooldownHours(1_000, 0)).toBe(24);
  });
});

describe('describeCooldown', () => {
  it('names the daily limit', () => {
    expect(describeCooldown(6, 80_000)).toContain('Rp80.000/hari');
    expect(describeCooldown(0, 80_000)).toMatch(/^Tanpa jeda/);
  });

  it('explains a shortfall without a limit', () => {
    expect(describeCooldown(24, 0)).toContain('belum ada ruang aman');
  });
});
