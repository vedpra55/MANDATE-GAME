import fs from 'node:fs/promises';
import path from 'node:path';

const API_BASE = 'https://api.openai.com/v1';
const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};
const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504]);

/**
 * One image from the OpenAI Images API. With reference images it calls /images/edits
 * (multipart, one `image[]` field per reference); without, /images/generations.
 * Returns a PNG Buffer. Retries rate limits and server errors with backoff.
 */
export async function generateImage(
  { apiKey, model, prompt, size, quality, background, references = [] },
  { fetchImpl = fetch, retries = 3, timeoutMs = 240_000, sleep = defaultSleep } = {},
) {
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set (put it in .env)');

  const makeRequest = async () => {
    const common = { model, prompt, size, quality, background, output_format: 'png', n: 1 };
    if (references.length === 0) {
      return {
        url: `${API_BASE}/images/generations`,
        init: {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(common),
        },
      };
    }
    const form = new FormData();
    for (const [key, value] of Object.entries(common)) form.append(key, String(value));
    for (const ref of references) {
      const type = MIME[path.extname(ref).toLowerCase()];
      if (!type) throw new Error(`reference must be png, jpg or webp: ${ref}`);
      form.append('image[]', new Blob([await fs.readFile(ref)], { type }), path.basename(ref));
    }
    return {
      url: `${API_BASE}/images/edits`,
      init: { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form },
    };
  };

  for (let attempt = 0; ; attempt++) {
    const { url, init } = await makeRequest();
    let res;
    try {
      res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      if (attempt < retries) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw new Error(`image request failed: ${err.message}`, { cause: err });
    }
    if (res.ok) {
      const body = await res.json();
      const b64 = body?.data?.[0]?.b64_json;
      if (!b64) throw new Error('image response had no data[0].b64_json');
      return Buffer.from(b64, 'base64');
    }
    const text = await res.text();
    if (RETRYABLE.has(res.status) && attempt < retries) {
      await sleep(backoffMs(attempt));
      continue;
    }
    throw new Error(`OpenAI ${res.status}: ${summariseError(text)}`);
  }
}

function backoffMs(attempt) {
  return 2000 * 2 ** attempt;
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summariseError(text) {
  try {
    return JSON.parse(text)?.error?.message ?? text.slice(0, 300);
  } catch {
    return text.slice(0, 300);
  }
}
