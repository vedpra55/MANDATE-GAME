import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateImage } from './openai-images.mjs';

const PNG = Buffer.from('fake-png');
const ok = () =>
  new Response(JSON.stringify({ data: [{ b64_json: PNG.toString('base64') }] }), { status: 200 });
const params = {
  apiKey: 'sk-test',
  model: 'gpt-image-2.6-flare',
  prompt: 'a phone',
  size: '1024x1024',
  quality: 'medium',
  background: 'transparent',
};
const noSleep = async () => {};

describe('generateImage', () => {
  it('calls /images/generations with JSON when there are no references', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      return ok();
    };
    const png = await generateImage(params, { fetchImpl });
    expect(png.equals(PNG)).toBe(true);
    expect(calls[0].url).toBe('https://api.openai.com/v1/images/generations');
    expect(calls[0].init.headers.Authorization).toBe('Bearer sk-test');
    expect(JSON.parse(calls[0].init.body)).toEqual({
      model: 'gpt-image-2.6-flare',
      prompt: 'a phone',
      size: '1024x1024',
      quality: 'medium',
      background: 'transparent',
      output_format: 'png',
      n: 1,
    });
  });

  it('calls /images/edits with one image[] field per reference', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mandate-ref-'));
    const refs = [path.join(dir, 'a.png'), path.join(dir, 'b.webp')];
    await Promise.all(refs.map((f) => fs.writeFile(f, 'x')));
    let seen;
    const fetchImpl = async (url, init) => {
      seen = { url, form: init.body };
      return ok();
    };
    await generateImage({ ...params, references: refs }, { fetchImpl });
    await fs.rm(dir, { recursive: true, force: true });

    expect(seen.url).toBe('https://api.openai.com/v1/images/edits');
    const images = seen.form.getAll('image[]');
    expect(images.map((f) => [f.name, f.type])).toEqual([
      ['a.png', 'image/png'],
      ['b.webp', 'image/webp'],
    ]);
    expect(seen.form.get('model')).toBe('gpt-image-2.6-flare');
    expect(seen.form.get('background')).toBe('transparent');
  });

  it('retries rate limits, then succeeds', async () => {
    let n = 0;
    const fetchImpl = async () => (++n < 3 ? new Response('slow down', { status: 429 }) : ok());
    await generateImage(params, { fetchImpl, sleep: noSleep });
    expect(n).toBe(3);
  });

  it('does not retry client errors and surfaces the API message', async () => {
    let n = 0;
    const fetchImpl = async () => {
      n++;
      return new Response(JSON.stringify({ error: { message: 'bad size' } }), { status: 400 });
    };
    await expect(generateImage(params, { fetchImpl, sleep: noSleep })).rejects.toThrow(
      'OpenAI 400: bad size',
    );
    expect(n).toBe(1);
  });

  it('refuses to run without a key', async () => {
    await expect(generateImage({ ...params, apiKey: '' })).rejects.toThrow(/OPENAI_API_KEY/);
  });
});
