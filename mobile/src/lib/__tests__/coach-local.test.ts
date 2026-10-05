import { answerLocal, type CoachExpense, startLocal, TRIGGERS } from '@/lib/coach-local';

const expense = (id: string, amount: number, category = 'Kopi'): CoachExpense => ({
  id,
  amount,
  occurred_at: new Date(2026, 9, 5, 9).toISOString(),
  merchant: null,
  category,
});

describe('local coach script', () => {
  it('asks whether a day without expenses really had none', () => {
    const { turn, state } = startLocal([]);
    expect(turn.options).toHaveLength(2);
    const end = answerLocal(state, 'Iya, hari ini aman');
    expect(end.turn.done).toBe(true);
    expect(end.state.tags).toEqual([]);
  });

  it('walks every expense, branching into a trigger question for wants', () => {
    let { state, turn } = startLocal([expense('a', 20000), expense('b', 50000, 'Belanja')]);
    expect(turn.message).toContain('Rp70.000');

    ({ state, turn } = answerLocal(state, 'Butuh banget'));
    expect(state.tags).toEqual([{ transaction_id: 'a', necessity: 'NEED' }]);
    expect(turn.message).toContain('Belanja');

    ({ state, turn } = answerLocal(state, 'Impulsif'));
    expect(turn.options).toEqual(TRIGGERS);

    ({ state, turn } = answerLocal(state, 'Lihat promo'));
    expect(state.tags[1]).toEqual({ transaction_id: 'b', necessity: 'IMPULSE', trigger: 'Lihat promo' });
    expect(state.step).toBe('mood');

    ({ state, turn } = answerLocal(state, 'Agak menyesal'));
    expect(turn.done).toBe(true);
    expect(turn.summary).toContain('Rp50.000');
    expect(turn.summary).toContain('promo');
  });

  it('re-asks when the answer is not one of the options', () => {
    const { state } = startLocal([expense('a', 1000)]);
    const next = answerLocal(state, 'entahlah');
    expect(next.state.tags).toEqual([]);
    expect(next.turn.done).toBe(false);
  });
});
