// Minimal Gemini API client (REST generateContent) shared by the edge functions. Asks for JSON matching a
// schema and returns the parsed object, or a GeminiError carrying the HTTP status to send back to the app.
// Tried in order: when one is overloaded or rate-limited, the next one answers instead. The flash-lite models
// sit on separate capacity, so they often still answer when the bigger ones are busy (common on the free tier).
export const GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];
const RETRYABLE = new Set([429, 500, 503, 504]);
// One more pass over the list after a short pause, since busy spikes are usually brief.
const PASSES = 2;
const PASS_DELAY_MS = 1500;
const BUSY_MESSAGE = 'Flowku AI lagi ramai. Coba kirim lagi sebentar.';

export type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };
export type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] };

export class GeminiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function generateJson<T>(opts: {
  apiKey: string;
  system?: string;
  contents: GeminiContent[];
  schema: Record<string, unknown>;
}): Promise<T> {
  const body = JSON.stringify({
    ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
    contents: opts.contents,
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: opts.schema },
  });
  let res!: Response;
  let detail = '';
  attempts: for (let pass = 0; pass < PASSES; pass++) {
    if (pass > 0) await new Promise((resolve) => setTimeout(resolve, PASS_DELAY_MS));
    for (const model of GEMINI_MODELS) {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.apiKey },
        body,
      });
      if (res.ok) break attempts;
      detail = await res.text().catch(() => '');
      // A model this key can't use (404) is skipped like a busy one; anything else is a real error.
      if (!RETRYABLE.has(res.status) && res.status !== 404) break attempts;
      console.warn('Gemini', model, 'unavailable', res.status);
    }
  }

  if (!res.ok) {
    console.error('Gemini error', res.status, detail);
    if (RETRYABLE.has(res.status) || res.status === 404) throw new GeminiError(503, BUSY_MESSAGE);
    if (res.status === 400 && detail.includes('API_KEY_INVALID')) throw new GeminiError(503, 'GEMINI_API_KEY tidak valid.');
    if (res.status === 401 || res.status === 403) throw new GeminiError(503, 'GEMINI_API_KEY tidak valid.');
    throw new GeminiError(502, `AI gagal (${res.status}).`);
  }

  const data = await res.json();
  if (data.promptFeedback?.blockReason) throw new GeminiError(422, 'Permintaan ini ditolak oleh AI.');
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
    .map((p: { text: string }) => p.text)
    .join('');
  if (!text) {
    if (candidate?.finishReason === 'SAFETY') throw new GeminiError(422, 'Permintaan ini ditolak oleh AI.');
    throw new GeminiError(502, 'AI tidak mengembalikan jawaban.');
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GeminiError(502, 'Jawaban AI tidak terbaca.');
  }
}
