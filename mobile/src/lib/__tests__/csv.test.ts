import { csvCell, localDateTime, transactionsToCsv } from '@/lib/csv';
import type { TransactionRow } from '@/lib/transactions';

const base: TransactionRow = {
  id: '1',
  type: 'EXPENSE',
  amount: 35000,
  occurred_at: new Date(2026, 9, 5, 8, 30).toISOString(),
  merchant: 'Warung Bu Sri',
  description: null,
  necessity: 'NEED',
  category_id: 'c1',
  from_account_id: 'a1',
  to_account_id: null,
  receipt_id: null,
  categories: { name: 'Makan' },
  from_account: { name: 'Cash' },
  to_account: null,
};

describe('csv', () => {
  it('quotes only cells that need it', () => {
    expect(csvCell('Kopi')).toBe('Kopi');
    expect(csvCell(12000)).toBe('12000');
    expect(csvCell(null)).toBe('');
    expect(csvCell('Nasi, telur')).toBe('"Nasi, telur"');
    expect(csvCell('Kata "murah"')).toBe('"Kata ""murah"""');
    expect(csvCell('baris\nbaru')).toBe('"baris\nbaru"');
  });

  it('formats dates in local time', () => {
    expect(localDateTime(new Date(2026, 0, 2, 3, 4).toISOString())).toBe('2026-01-02 03:04');
  });

  it('writes a BOM, a header and one line per transaction', () => {
    const csv = transactionsToCsv([
      base,
      {
        ...base,
        id: '2',
        type: 'TRANSFER',
        amount: 100000,
        merchant: null,
        necessity: null,
        categories: null,
        to_account: { name: 'BCA' },
      },
    ]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1).trimEnd().split('\r\n')).toEqual([
      'Tanggal,Jenis,Jumlah,Kategori,Dari akun,Ke akun,Merchant,Catatan,Kebutuhan',
      '2026-10-05 08:30,Pengeluaran,35000,Makan,Cash,,Warung Bu Sri,,Butuh',
      '2026-10-05 08:30,Transfer,100000,,Cash,BCA,,,',
    ]);
  });
});
