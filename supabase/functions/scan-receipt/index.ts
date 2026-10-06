// Reads a receipt photo with Gemini and returns merchant, total, date/time and a category guess.
// Runs as the calling user (their JWT), so RLS decides which receipt and file they may read.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding/base64';
import { GeminiError, generateJson } from '../_shared/gemini.ts';

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
  },
  required: ['is_receipt', 'merchant', 'total', 'currency', 'date', 'time', 'category'],
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
};

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
  const categoryNames = (categories.data ?? []).map((c) => c.name).join(', ');

  let result: ScanResult;
  try {
    result = await generateJson<ScanResult>({
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
                'total actually paid (after discounts and tax) and its currency, and the purchase date and time as ' +
                'printed. Mind the separators: rupiah uses "." for thousands, so "45.600" is 45600; "12.50" in ' +
                `dollars is 12.5. The user keeps their books in ${currency}. Pick the category that best fits ` +
                `from this list: ${categoryNames || '(none)'}. Leave any field empty that you cannot read.`,
            },
          ],
        },
      ],
    });
  } catch (error) {
    if (!(error instanceof GeminiError)) throw error;
    if (error.status === 422) return json({ error: 'Struk ini tidak bisa dibaca.' }, 422);
    return json({ error: error.message.replace(/^AI/, 'OCR') }, error.status);
  }

  // Into the user's currency's smallest unit. A receipt in another currency can't be converted here, so its
  // total is left for the user to type.
  const printed = (result.currency ?? '').trim().toUpperCase();
  const sameCurrency = !printed || printed === currency;
  const decimals = ZERO_DECIMAL.has(currency) ? 0 : 2;
  const total = sameCurrency && result.total > 0 ? Math.round(result.total * 10 ** decimals) : 0;
  result = { ...result, total, currency: printed };

  // Kept for later (e.g. re-applying without another scan); failure here should not hide the result.
  await supabase.from('receipts').update({ ocr_json: result }).eq('id', receiptId);

  return json(result);
});
