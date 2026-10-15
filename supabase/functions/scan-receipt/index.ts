// Reads a receipt photo with Gemini and returns merchant, total, date/time and a category guess.
// Runs as the calling user (their JWT), so RLS decides which receipt and file they may read.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding/base64';
import { GeminiError, generateJson } from '../_shared/gemini.ts';
import { QuotaExhausted, quotaResponse, withQuota } from '../_shared/quota.ts';

const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
type SupportedType = (typeof SUPPORTED_TYPES)[number];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Unknown values come back empty ("" / 0) so every field is always present.
const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    is_receipt: { type: 'boolean', description: 'false if the photo is not a purchase receipt or is unreadable' },
    merchant: { type: 'string', description: 'Store or merchant name as printed, or "" if unknown' },
    total: {
      type: 'number',
      description: 'Grand total actually paid as a plain number in normal units (45.600 rupiah -> 45600, $12.50 -> 12.5), or 0 if unknown',
    },
    currency: { type: 'string', description: 'ISO 4217 code of the currency printed on the receipt (IDR, USD, ...), or "" if unclear' },
    date: { type: 'string', description: 'Purchase date as YYYY-MM-DD, or "" if not printed' },
    time: { type: 'string', description: 'Purchase time as HH:MM (24h), or "" if not printed' },
    category: { type: 'string', description: 'Best matching name from the given category list, or ""' },
    category_confidence: {
      type: 'string',
      enum: ['high', 'low'],
      description: '"high" only when the receipt clearly belongs to that category (e.g. a fuel station -> fuel); else "low"',
    },
  },
  required: ['is_receipt', 'merchant', 'total', 'currency', 'date', 'time', 'category', 'category_confidence'],
  additionalProperties: false,
};

type ScanResult = {
  is_receipt: boolean;
  merchant: string;
  /** From the model: normal units. Sent to the app: the user's currency's smallest unit, like stored amounts. */
  total: number;
  currency: string;
  date: string;
  time: string;
  category: string;
  category_confidence: 'high' | 'low';
};

// Largest amount the app accepts (12 digits in the smallest unit).
const MAX_MINOR = 999_999_999_999;

/** Keeps only well-formed values: anything malformed becomes "unknown" rather than a guess. */
function sanitize(raw: Partial<ScanResult>, categoryNames: string[]): ScanResult {
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const date = text(raw.date, 10);
  const time = text(raw.time, 5);
  const category = categoryNames.find((n) => n.toLowerCase() === text(raw.category, 50).toLowerCase()) ?? '';
  return {
    is_receipt: raw.is_receipt === true,
    merchant: text(raw.merchant, 100),
    total: typeof raw.total === 'number' && Number.isFinite(raw.total) && raw.total > 0 ? raw.total : 0,
    currency: text(raw.currency, 3).toUpperCase(),
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
    time: /^\d{1,2}:\d{2}$/.test(time) ? time : '',
    category,
    category_confidence: category && raw.category_confidence === 'high' ? 'high' : 'low',
  };
}

// Same rule as the app (lib/currencies.ts): these are stored as whole units, everything else in cents.
const ZERO_DECIMAL = new Set(['IDR', 'JPY', 'KRW', 'VND']);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json({ error: 'OCR belum aktif: GEMINI_API_KEY belum diisi di Supabase.' }, 503);

  const { receipt_id: receiptId } = await req.json().catch(() => ({}));
  if (typeof receiptId !== 'string') return json({ error: 'receipt_id wajib diisi.' }, 400);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return json({ error: 'Sesi tidak valid. Buka ulang aplikasinya.' }, 401);
  const user = auth.user;

  const [receipt, categories, profile] = await Promise.all([
    supabase.from('receipts').select('storage_path').eq('id', receiptId).single(),
    supabase.from('categories').select('name').eq('kind', 'EXPENSE'),
    supabase.from('profiles').select('currency').maybeSingle(),
  ]);
  if (receipt.error) return json({ error: 'Struk tidak ditemukan.' }, 404);

  const file = await supabase.storage.from('receipts').download(receipt.data.storage_path);
  if (file.error) return json({ error: 'Foto struk tidak bisa dibuka.' }, 404);
  const mediaType = file.data.type as SupportedType;
  if (!SUPPORTED_TYPES.includes(mediaType)) return json({ error: `Format foto ${file.data.type} tidak didukung.` }, 415);
  const image = encodeBase64(new Uint8Array(await file.data.arrayBuffer()));

  const currency = profile.data?.currency ?? 'IDR';
  const categoryList = (categories.data ?? []).map((c) => c.name);
  const categoryNames = categoryList.join(', ');

  let result: ScanResult;
  try {
    result = await withQuota(user, 'scan', () => generateJson<ScanResult>({
      apiKey,
      schema: RESULT_SCHEMA,
      contents: [
        {
          role: 'user',
          parts: [
            { inline_data: { mime_type: mediaType, data: image } },
            {
              text:
                'This is a photo of a purchase receipt, usually from Indonesia. Extract the merchant name, the grand ' +
                'total actually paid (after discounts, service and tax: the line usually called TOTAL / GRAND TOTAL / ' +
                'TOTAL BAYAR) and its currency, and the purchase date and time as printed. Do NOT return the subtotal, ' +
                'a tax or service line, the cash handed over (TUNAI / CASH / BAYAR) or the change (KEMBALIAN / CHANGE). ' +
                'Mind the separators: rupiah uses "." for thousands, so "45.600" is 45600; "12.50" in dollars is 12.5. ' +
                `The user keeps their books in ${currency}. Pick the category that best fits from this list ` +
                `(exact name): ${categoryNames || '(none)'}, and say how sure you are. Leave any field empty (or 0) ` +
                'that you cannot read; never guess a value that is not printed.',
            },
          ],
        },
      ],
    }));
  } catch (error) {
    if (error instanceof QuotaExhausted) return quotaResponse(error, CORS);
    if (!(error instanceof GeminiError)) throw error;
    if (error.status === 422) return json({ error: 'Struk ini tidak bisa dibaca.' }, 422);
    return json({ error: error.message.replace(/^AI/, 'OCR') }, error.status);
  }

  // Into the user's currency's smallest unit. A receipt in another currency can't be converted here, so its
  // total is left for the user to type.
  result = sanitize(result, categoryList);
  const printed = result.currency;
  const sameCurrency = !printed || printed === currency;
  const decimals = ZERO_DECIMAL.has(currency) ? 0 : 2;
  const minor = Math.round(result.total * 10 ** decimals);
  const total = sameCurrency && minor > 0 && minor <= MAX_MINOR ? minor : 0;
  result = { ...result, total };

  // Kept for later (e.g. re-applying without another scan); failure here should not hide the result.
  await supabase.from('receipts').update({ ocr_json: result }).eq('id', receiptId);

  return json(result);
});
