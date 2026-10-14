// Pure receipt logic (no Supabase), shared by the scan flow in Catat and the receipt photo on a transaction.

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
  /** 'high' when the category is clearly right; otherwise it is only a suggestion the user confirms. Older scans lack it. */
  category_confidence?: 'high' | 'low';
};

export function isScanResult(value: unknown): value is ScanResult {
  return typeof value === 'object' && value !== null && 'is_receipt' in value && 'total' in value;
}

export const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024; // the bucket's limit

/** Why a picked photo can't be used as a receipt, or null. */
export function receiptFileProblem(file: { mimeType?: string | null; fileSize?: number | null }) {
  const type = file.mimeType ?? 'image/jpeg';
  if (!RECEIPT_TYPES.includes(type)) return 'Pakai foto JPG, PNG, atau WebP.';
  if (file.fileSize && file.fileSize > RECEIPT_MAX_BYTES) return 'Fotonya terlalu besar (maks. 5 MB).';
  return null;
}

export type ScanDraft = {
  amount: number | null;
  merchant: string | null;
  occurredAt: Date | null;
  /** Set only when the scan is sure; otherwise see suggestedCategoryId. */
  categoryId: string | null;
  suggestedCategoryId: string | null;
};

/**
 * What a scan fills into the form. Only fields that were actually read are set (nothing is made up), and the
 * category must be one of the user's own expense categories.
 */
export function scanToDraft(
  scan: ScanResult,
  categories: { id: string; name: string; kind: string }[],
  now = new Date(),
): ScanDraft {
  if (!scan.is_receipt) return { amount: null, merchant: null, occurredAt: null, categoryId: null, suggestedCategoryId: null };
  const name = scan.category.trim().toLowerCase();
  const match = name ? categories.find((c) => c.kind === 'EXPENSE' && c.name.toLowerCase() === name) : undefined;
  const sure = !!match && scan.category_confidence === 'high';
  return {
    amount: Number.isSafeInteger(scan.total) && scan.total > 0 ? scan.total : null,
    merchant: scan.merchant.trim() ? scan.merchant.trim().slice(0, 100) : null,
    occurredAt: scannedDate(scan, now),
    categoryId: sure ? match.id : null,
    suggestedCategoryId: match && !sure ? match.id : null,
  };
}


/** Local Date from the scanned date/time, or null when the receipt has no date. */
export function scannedDate(result: ScanResult, now = new Date()) {
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
  const age = now.getTime() - scanned.getTime();
  return age >= -60 * 60_000 && age < 366 * 86_400_000 ? scanned : null;
}
