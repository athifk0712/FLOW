// Minimal Gemini API client (REST generateContent) shared by the edge functions. Asks for JSON matching a
// schema and returns the parsed object, or a GeminiError carrying the HTTP status to send back to the app.
// Tried in order until one answers. Flash-Lite first: it is the fastest and the least often overloaded on the
// free tier, and a short chat turn or a receipt doesn't need more. Each gets the lowest thinking level it supports
// (3.8 Flash has no 'minimal'), since thinking is most of the latency.
export const GEMINI_MODELS: { id: string; thinking: 'minimal' | 'low' }[] = [
  { id: 'gemini-3.5-flash-lite', thinking: 'minimal' },
  { id: 'gemini-3.6-flash', thinking: 'minimal' },
  { id: 'gemini-3.8-flash', thinking: 'low' },
  { id: 'gemini-3.1-flash-lite', thinking: 'minimal' },
];
const RETRYABLE = new Set([429, 500, 503, 504]);
// A busy model sometimes takes ~25 s just to say so: give each try at most ATTEMPT_MS, the whole call DEADLINE_MS.
const ATTEMPT_MS = 10_000;
const DEADLINE_MS = 30_000;
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
  const request = (thinking: string) =>
    JSON.stringify({
      ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
      contents: opts.contents,
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: opts.schema,
        thinkingConfig: { thinkingLevel: thinking },
      },
    });

  const deadline = Date.now() + DEADLINE_MS;
  let res: Response | null = null;
  let detail = '';
  // Two rounds over the list, as long as time is left: busy spikes are usually brief.
  attempts: for (let round = 0; round < 2; round++) {
    for (const model of GEMINI_MODELS) {
      const remaining = deadline - Date.now();
      if (remaining < 1_000) break attempts;
      const started = Date.now();
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.apiKey },
          body: request(model.thinking),
          signal: AbortSignal.timeout(Math.min(ATTEMPT_MS, remaining)),
        });
      } catch (error) {
        if (!(error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError'))) throw error;
        console.warn('Gemini', model.id, 'timed out after', Date.now() - started, 'ms');
        res = null;
        continue;
      }
      if (res.ok) {
        console.log('Gemini', model.id, 'answered in', Date.now() - started, 'ms');
        break attempts;
      }
      detail = await res.text().catch(() => '');
      // A model this key can't use (404) is skipped like a busy one; anything else is a real error.
      if (!RETRYABLE.has(res.status) && res.status !== 404) break attempts;
      console.warn('Gemini', model.id, 'unavailable', res.status, 'after', Date.now() - started, 'ms');
    }
  }

  if (!res) throw new GeminiError(503, BUSY_MESSAGE);
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
