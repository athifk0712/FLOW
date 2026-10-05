// Minimal Gemini API client (REST generateContent) shared by the edge functions. Asks for JSON matching a
// schema and returns the parsed object, or a GeminiError carrying the HTTP status to send back to the app.
// Tried in order: when one is overloaded or rate-limited, the next one answers instead.
export const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];
const RETRYABLE = new Set([429, 500, 503, 504]);

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
  for (const model of GEMINI_MODELS) {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.apiKey },
      body,
    });
    if (!RETRYABLE.has(res.status) || model === GEMINI_MODELS[GEMINI_MODELS.length - 1]) break;
    console.warn('Gemini', model, 'unavailable', res.status);
    await res.body?.cancel();
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('Gemini error', res.status, detail);
    if (res.status === 429) throw new GeminiError(429, 'AI sedang sibuk, coba lagi sebentar.');
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
