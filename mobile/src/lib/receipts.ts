import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

/** What the scan-receipt edge function reads from a photo. Unknown fields are "" or 0. */
export type ScanResult = {
  is_receipt: boolean;
  merchant: string;
  /** In the user's currency's smallest unit (like stored amounts); 0 when unread or printed in another currency. */
  total: number;
  currency?: string; // as printed, e.g. "IDR"
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  category: string;
};

export function isScanResult(value: unknown): value is ScanResult {
  return typeof value === 'object' && value !== null && 'is_receipt' in value && 'total' in value;
}

/** Runs OCR on a stored receipt. Throws with a readable (Indonesian) message on failure. */
export async function scanReceipt(receiptId: string): Promise<ScanResult> {
  const { data, error } = await supabase.functions.invoke('scan-receipt', { body: { receipt_id: receiptId } });
  if (error) {
    // The function answers errors as { error: "..." }; surface that text instead of the generic HTTP message.
    const body = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
    throw new Error(body?.error ?? 'Gagal membaca struk.');
  }
  return data as ScanResult;
}

/** Local Date from the scanned date/time, or null when the receipt has no date. */
export function scannedDate(result: ScanResult) {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(result.date);
  if (!date) return null;
  const time = /^(\d{1,2}):(\d{2})$/.exec(result.time);
  const scanned = new Date(
    Number(date[1]),
    Number(date[2]) - 1,
    Number(date[3]),
    time ? Number(time[1]) : 12,
    time ? Number(time[2]) : 0,
  );
  // Ignore misreads that land in the future or implausibly far back.
  const age = Date.now() - scanned.getTime();
  return age >= -60 * 60_000 && age < 366 * 86_400_000 ? scanned : null;
}
