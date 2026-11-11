import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';

let server: Server | undefined;

async function start(openaiApiKey?: string) {
  const app = createApp({ port: 0, openaiApiKey });
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
    expect(loadConfig({ OPENAI_API_KEY: '  ' })).toEqual({ port: 8787, openaiApiKey: undefined });
  });

  it('rejects an invalid port', () => {
    expect(() => loadConfig({ SERVER_PORT: 'abc' })).toThrow(/SERVER_PORT/);
  });
});
