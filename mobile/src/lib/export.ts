import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { NECESSITY } from '@/constants/necessity';
import { supabase } from '@/lib/supabase';
import { TRANSACTION_SELECT, type TransactionRow } from '@/lib/transactions';

const PAGE_SIZE = 1000; // PostgREST caps a single response at 1000 rows.

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

async function fetchAllTransactions() {
  const rows: TransactionRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('transactions')
      .select(TRANSACTION_SELECT)
      .order('occurred_at', { ascending: true })
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data as TransactionRow[]));
    if (data.length < PAGE_SIZE) return rows;
  }
}

/** Builds a CSV of every transaction and hands it to the share sheet (or downloads it on web). Returns the row count. */
export async function exportTransactionsCsv() {
  const rows = await fetchAllTransactions();
  const csv = transactionsToCsv(rows);
  const name = `flowku-transaksi-${localDateTime(new Date().toISOString()).slice(0, 10)}.csv`;

  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
    return rows.length;
  }

  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Fitur berbagi tidak tersedia di perangkat ini.');
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: name });
  return rows.length;
}
