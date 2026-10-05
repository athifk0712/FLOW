import { NECESSITY } from '@/constants/necessity';
import type { TransactionRow } from '@/lib/transactions';

const TYPE_LABEL: Record<TransactionRow['type'], string> = {
  INCOME: 'Pemasukan',
  EXPENSE: 'Pengeluaran',
  TRANSFER: 'Transfer',
};

const HEADER = ['Tanggal', 'Jenis', 'Jumlah', 'Kategori', 'Dari akun', 'Ke akun', 'Merchant', 'Catatan', 'Kebutuhan'];

/** Quotes a cell when it contains a comma, quote or line break (RFC 4180). */
export function csvCell(value: string | number | null | undefined) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** "2026-10-05 08:30" in the device's local time. */
export function localDateTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function transactionsToCsv(rows: TransactionRow[]) {
  const lines = [HEADER, ...rows.map((t) => [
    localDateTime(t.occurred_at),
    TYPE_LABEL[t.type],
    t.amount,
    t.categories?.name,
    t.from_account?.name,
    t.to_account?.name,
    t.merchant,
    t.description,
    t.necessity ? NECESSITY[t.necessity].label : '',
  ])];
  // BOM so Excel reads the file as UTF-8.
  return '﻿' + lines.map((cells) => cells.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
