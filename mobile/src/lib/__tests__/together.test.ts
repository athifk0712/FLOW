import { deadlineText, fallbackReminder, targetProgress } from '@/lib/together';

const members = [
  { user_id: 'a', display_name: 'Athif', role: 'owner' },
  { user_id: 'b', display_name: 'Budi', role: 'member' },
  { user_id: 'c', display_name: 'Citra', role: 'member' },
];
const now = new Date(2026, 9, 14, 10);
const target = { target_amount: 3_000_000, deadline: '2026-10-26', status: 'ACTIVE' };

describe('targetProgress', () => {
  it('counts only verified contributions towards the target', () => {
    const p = targetProgress(
      target,
      members,
      [
        { user_id: 'a', amount: 1_000_000, status: 'VERIFIED' },
        { user_id: 'b', amount: 500_000, status: 'PENDING' },
        { user_id: 'c', amount: 900_000, status: 'REJECTED' },
      ],
      now,
    );
    expect(p.verified).toBe(1_000_000);
    expect(p.pending).toBe(500_000);
    expect(p.remaining).toBe(2_000_000);
    expect(p.percent).toBe(33);
    expect(p.daysLeft).toBe(12);
  });

  it('gives each member a status from an even share', () => {
    const p = targetProgress(
      target,
      members,
      [
        { user_id: 'a', amount: 1_000_000, status: 'VERIFIED' },
        { user_id: 'b', amount: 200_000, status: 'PENDING' },
      ],
      now,
    );
    const status = Object.fromEntries(p.members.map((m) => [m.user_id, m.status]));
    expect(status).toEqual({ a: 'LUNAS', b: 'BERJALAN', c: 'BELUM' });
    expect(p.members[0].share).toBe(1_000_000);
  });

  it('ranks by verified total, equal totals share a rank, nothing verified has no rank', () => {
    const p = targetProgress(
      target,
      members,
      [
        { user_id: 'b', amount: 300_000, status: 'VERIFIED' },
        { user_id: 'c', amount: 300_000, status: 'VERIFIED' },
      ],
      now,
    );
    expect(p.members.map((m) => [m.name, m.rank])).toEqual([
      ['Budi', 1],
      ['Citra', 1],
      ['Athif', null],
    ]);
  });

  it('never shows a negative remainder or more than 100%', () => {
    const p = targetProgress(target, members, [{ user_id: 'a', amount: 3_500_000, status: 'VERIFIED' }], now);
    expect(p.remaining).toBe(0);
    expect(p.percent).toBe(100);
    expect(p.reached).toBe(true);
    expect(p.deadlineText).toBe('Target tercapai');
  });

  it('explains a passed deadline instead of a negative day count', () => {
    const p = targetProgress({ ...target, deadline: '2026-10-10' }, members, [], now);
    expect(p.daysLeft).toBe(-4);
    expect(p.deadlineText).toBe('Lewat 4 hari dari tenggat');
  });
});

describe('deadlineText', () => {
  it('reads naturally', () => {
    expect(deadlineText(null, false)).toBeNull();
    expect(deadlineText(0, false)).toBe('Hari ini');
    expect(deadlineText(1, false)).toBe('Besok');
  });
});

describe('fallbackReminder', () => {
  it('is friendly and names nobody', () => {
    const text = fallbackReminder('Geng Bali', 'Villa', 'Rp2.000.000', '12 hari lagi');
    expect(text).toContain('Villa');
    expect(text).toContain('Rp2.000.000');
    expect(text).not.toMatch(/Budi|Citra/);
  });
});
