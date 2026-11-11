/**
 * Thin OpenAI REST client for the three APIs the game uses. Server-side only: the key never
 * leaves this process. Every call has a timeout; callers fall back to offline logic on failure.
 */
const BASE = 'https://api.openai.com/v1';

export class AiError extends Error {}

async function post(
  apiKey: string,
  pathname: string,
  body: unknown,
  timeoutMs: number,
): Promise<unknown> {
  const res = await fetch(`${BASE}${pathname}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text.slice(0, 300);
    try {
      message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? message;
    } catch {
      // keep raw text
    }
    throw new AiError(`OpenAI ${res.status}: ${message}`);
  }
  return JSON.parse(text);
}

export function decide(apiKey: string, model: string, body: object): Promise<unknown> {
  return post(apiKey, '/decisions', { model, ...body }, 15000);
}

export async function moderate(
  apiKey: string,
  model: string,
  input: string,
): Promise<{ flagged: boolean; categories: string[] }> {
  const r = (await post(apiKey, '/moderations', { model, input }, 8000)) as {
    results: { flagged: boolean; categories: Record<string, boolean> }[];
  };
  const first = r.results[0];
  return {
    flagged: Boolean(first?.flagged),
    categories: Object.entries(first?.categories ?? {})
      .filter(([, v]) => v)
      .map(([k]) => k),
  };
}

/** Responses API with a strict JSON schema; returns the parsed JSON object. */
export async function generateJson(
  apiKey: string,
  model: string,
  effort: string,
  developer: string,
  user: unknown,
  name: string,
  schema: object,
  maxOutputTokens = 400,
): Promise<unknown> {
  const r = (await post(
    apiKey,
    '/responses',
    {
      model,
      reasoning: { effort },
      input: [
        { role: 'developer', content: developer },
        { role: 'user', content: typeof user === 'string' ? user : JSON.stringify(user) },
      ],
      text: { format: { type: 'json_schema', name, strict: true, schema } },
      max_output_tokens: maxOutputTokens,
    },
    20000,
  )) as { output?: { type: string; content?: { type: string; text?: string }[] }[] };
  const text = r.output
    ?.flatMap((o) => o.content ?? [])
    .find((c) => c.type === 'output_text')?.text;
  if (!text) throw new AiError('No output text');
  return JSON.parse(text);
}

let modelCache: { at: number; ids: string[] } | null = null;

/** Models this account can use (cached 10 minutes), to filter the settings dropdowns. */
export async function availableModels(apiKey: string): Promise<string[]> {
  if (modelCache && Date.now() - modelCache.at < 600_000) return modelCache.ids;
  const res = await fetch(`${BASE}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new AiError(`OpenAI ${res.status}`);
  const ids = ((await res.json()) as { data: { id: string }[] }).data.map((m) => m.id);
  modelCache = { at: Date.now(), ids };
  return ids;
}
