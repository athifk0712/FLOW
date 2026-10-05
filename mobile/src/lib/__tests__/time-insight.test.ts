import { computeTimeInsight, type InsightRow } from '@/lib/time-insight';

// Mondays to Fridays in Oct 2026 (5–9, 12–16), so the weekend slot stays out of the way.
const weekdays = [5, 6, 7, 8, 9, 12, 13, 14, 15, 16];

function row(i: number, hour: number, necessity: InsightRow['necessity'], amount = 50_000): InsightRow {
  return { occurred_at: new Date(2026, 9, weekdays[i % weekdays.length], hour).toISOString(), amount, necessity };
}

// Daytime needs make up most spending; impulse buys cluster in the evening.
const needs = Array.from({ length: 10 }, (_, i) => row(i, 12, 'NEED', 100_000));
const eveningImpulse = Array.from({ length: 5 }, (_, i) => row(i, 20, 'IMPULSE'));

describe('computeTimeInsight', () => {
  it('stays quiet until there is enough judged data', () => {
    expect(computeTimeInsight(eveningImpulse)).toBeNull();
    expect(computeTimeInsight([...needs.slice(0, 4), ...eveningImpulse, row(0, 9, null)])).toBeNull();
  });

  it('names the time slot where impulse buys cluster, against the baseline', () => {
    const insight = computeTimeInsight([...needs, ...eveningImpulse]);
    // Impulse: 250k, all in the evening. All judged: 1.25m, of which 250k (20%) in the evening.
    expect(insight).toEqual({
      headline: 'Hampir semua belanja impulsifmu terjadi malam hari (18.00–22.00).',
      detail: 'Padahal waktu itu hanya 20% dari semua pengeluaran yang sudah kamu nilai.',
      tip: expect.stringContaining('besok pagi'),
    });
  });

  it('falls back to wants when there are too few impulse buys', () => {
    const lateWants = Array.from({ length: 5 }, (_, i) => row(i, 23, 'WANT'));
    expect(computeTimeInsight([...needs, ...lateWants])?.headline).toBe(
      'Hampir semua belanja keinginanmu terjadi larut malam (22.00–05.00).',
    );
  });

  it('says nothing when impulse buys follow the usual rhythm', () => {
    const middayImpulse = Array.from({ length: 5 }, (_, i) => row(i, 12, 'IMPULSE'));
    expect(computeTimeInsight([...needs, ...middayImpulse])).toBeNull();
  });

  it('gives a percentage when the slot holds most but not all', () => {
    const mixed = [...eveningImpulse, row(0, 12, 'IMPULSE', 100_000)]; // 250k evening of 350k
    expect(computeTimeInsight([...needs, ...mixed])?.headline).toBe('71% belanja impulsifmu terjadi malam hari (18.00–22.00).');
  });

  it('picks up weekends', () => {
    const weekend = [3, 4, 10, 11, 17].map((d) => ({
      occurred_at: new Date(2026, 9, d, 12).toISOString(), // Sat/Sun
      amount: 50_000,
      necessity: 'IMPULSE' as const,
    }));
    expect(computeTimeInsight([...needs, ...weekend])?.headline).toBe('Hampir semua belanja impulsifmu terjadi akhir pekan.');
  });
});
