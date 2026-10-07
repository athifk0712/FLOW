import { adminFeeMessages, adminFeeProblem } from '@/lib/admin-fee';

// jest hoists this above the import; the helpers under test never touch Supabase.
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const rule = { name: 'Biaya admin BCA', amount: 15000, account_name: 'BCA', is_admin_fee: true, posted: 1 };

describe('admin fee', () => {
  it('describes a charged fee', () => {
    expect(adminFeeMessages([rule])).toEqual(['Biaya admin bulanan BCA sebesar Rp15.000 telah dipotong otomatis.']);
  });

  it('adds up caught-up months', () => {
    expect(adminFeeMessages([{ ...rule, posted: 2 }])).toEqual([
      'Biaya admin bulanan BCA sebesar Rp30.000 (2 bulan) telah dipotong otomatis.',
    ]);
  });

  it('stays quiet about other recurring rules', () => {
    expect(adminFeeMessages([{ ...rule, is_admin_fee: false, name: 'Netflix' }])).toEqual([]);
  });

  it('checks the form', () => {
    expect(adminFeeProblem({ enabled: false, amount: 0, day: 0 })).toBeNull();
    expect(adminFeeProblem({ enabled: true, amount: 0, day: 25 })).toMatch(/nominal/);
    expect(adminFeeProblem({ enabled: true, amount: 15000, day: 32 })).toMatch(/1–31/);
    expect(adminFeeProblem({ enabled: true, amount: 15000, day: 25 })).toBeNull();
  });
});
