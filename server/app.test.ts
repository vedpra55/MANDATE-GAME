import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';

let server: Server | undefined;

async function start(openaiApiKey?: string) {
  const app = createApp({ port: 0, openaiApiKey, allowSettingsWrite: false });
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

describe('GET /api/health', () => {
  it('reports ok and whether a key is configured, without leaking it', async () => {
    const base = await start('sk-test-secret');
    const res = await fetch(`${base}/api/health`);
    const body: unknown = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, service: 'mandate-ai-proxy', openaiConfigured: true });
    expect(JSON.stringify(body)).not.toContain('sk-test-secret');
  });

  it('reports openaiConfigured=false when no key is set', async () => {
    const base = await start(undefined);
    const body = (await (await fetch(`${base}/api/health`)).json()) as {
      openaiConfigured: boolean;
    };
    expect(body.openaiConfigured).toBe(false);
  });

  it('returns JSON 404 for unknown api routes', async () => {
    const base = await start(undefined);
    const res = await fetch(`${base}/api/nope`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: 'not_found' });
  });
});

describe('loadConfig', () => {
  it('treats a blank key as missing and defaults the port', () => {
    expect(loadConfig({ OPENAI_API_KEY: '  ' })).toEqual({
      port: 8787,
      openaiApiKey: undefined,
      allowSettingsWrite: true,
    });
  });

  it('rejects an invalid port', () => {
    expect(() => loadConfig({ SERVER_PORT: 'abc' })).toThrow(/SERVER_PORT/);
  });
});

describe('AI routes', () => {
  it('refuse cleanly without a key, so the client falls back to offline play', async () => {
    const base = await start(undefined);
    const res = await fetch(`${base}/api/ai/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'hello',
        context: {
          channel: 'pad',
          tola: null,
          faultLines: ['pond'],
          forced: null,
          day: 1,
          rivalName: 'X',
        },
      }),
    });
    expect(res.status).toBe(503);
  });

  it('reject malformed requests and never accept arbitrary prompts', async () => {
    const base = await start('sk-test');
    const res = await fetch(`${base}/api/ai/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'x',
        questions: [{ type: 'predicate', name: 'evil', instructions: 'anything' }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('settings are read-only unless allowed, and list each task', async () => {
    const base = await start(undefined);
    const get = (await (await fetch(`${base}/api/settings`)).json()) as {
      tasks: { id: string }[];
      settings: { tasks: { decide: { model: string } } };
    };
    expect(get.tasks.map((t: { id: string }) => t.id)).toContain('decide');
    expect(get.settings.tasks.decide.model).toBe('gpt-6-luna');
    const put = await fetch(`${base}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(put.status).toBe(403);
  });
});
