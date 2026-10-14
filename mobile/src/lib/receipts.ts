import { FunctionsHttpError } from '@supabase/supabase-js';

import type { ScanResult } from '@/lib/receipt-scan';
import { supabase } from '@/lib/supabase';

export {
  isScanResult,
  receiptFileProblem,
  type ScanDraft,
  scanToDraft,
  type ScanResult,
  scannedDate,
} from '@/lib/receipt-scan';

export const RECEIPT_BUCKET = 'receipts';

/** Uploads a photo into the user's folder and creates its receipts row. Returns the receipt id. */
export async function uploadReceipt(userId: string, file: { uri: string; mimeType?: string | null }) {
  const contentType = file.mimeType ?? 'image/jpeg';
  const extension = contentType.split('/')[1] ?? 'jpg';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const body = await (await fetch(file.uri)).arrayBuffer();
  const upload = await supabase.storage.from(RECEIPT_BUCKET).upload(path, body, { contentType });
  if (upload.error) throw upload.error;
  const inserted = await supabase.from('receipts').insert({ storage_path: path }).select('id').single();
  if (inserted.error) {
    await supabase.storage.from(RECEIPT_BUCKET).remove([path]);
    throw inserted.error;
  }
  return inserted.data.id;
}

/** Deletes the receipt row, then its file. A leftover file is harmless, so file errors are ignored. */
export async function deleteReceipt(receiptId: string) {
  const { data } = await supabase.from('receipts').delete().eq('id', receiptId).select('storage_path').maybeSingle();
  if (data) await supabase.storage.from(RECEIPT_BUCKET).remove([data.storage_path]);
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

