#!/usr/bin/env node
/**
 * Local review server for picking the best variant of each asset.
 * Serves review.html and generated images, and writes picks back to manifest.json.
 * Binds to 127.0.0.1 only.
 *
 *   node tools/assets/review.mjs            # http://localhost:5180
 *   node tools/assets/review.mjs --port 5181
 */
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { parseArgs, runMain } from './lib/cli.mjs';
import {
  EXPRESSIONS,
  loadManifest,
  saveManifest,
  SHEET_KINDS,
  sliceLabels,
} from './lib/manifest.mjs';
import { ASSETS_TOOL_DIR, assetOutputDir } from './lib/paths.mjs';
import { buildPrompt } from './lib/prompt.mjs';
import { listVariants, variantFile } from './lib/variants.mjs';

const ALLOWED_HOSTS = /^(localhost|127\.0\.0\.1)(:\d+)?$/;

runMain(async (argv) => {
  const args = parseArgs(argv, { port: 'number' });
  const port = args.port ?? 5180;
  await loadManifest(); // fail fast on an invalid manifest

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => sendJson(res, 500, { error: err.message }));
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Asset review: http://localhost:${port}  (Ctrl+C to stop)`);
  });
});

async function handle(req, res) {
  // Block DNS-rebinding style access from other origins.
  if (!ALLOWED_HOSTS.test(req.headers.host ?? ''))
    return sendJson(res, 403, { error: 'forbidden host' });
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(await fs.readFile(path.join(ASSETS_TOOL_DIR, 'review.html')));
  }
  if (req.method === 'GET' && url.pathname === '/api/state')
    return sendJson(res, 200, await state());

  const image = /^\/output\/([a-z0-9.-]+)\/(?:v(\d+)|sliced\/([a-z0-9]+))\.png$/.exec(url.pathname);
  if (req.method === 'GET' && image) return sendImage(res, image);

  if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
    const body = await readJson(req);
    const manifest = await loadManifest();
    const asset = manifest.assets.find((a) => a.id === body.id);
    if (!asset) return sendJson(res, 404, { error: `unknown asset ${body.id}` });

    if (url.pathname === '/api/pick') {
      const variants = await listVariants(assetOutputDir(asset.id));
      if (!variants.some((v) => v.number === body.variant)) {
        return sendJson(res, 400, { error: `no variant v${body.variant}` });
      }
      asset.picked = body.variant;
      asset.status = 'picked'; // a re-pick of a "final" asset needs optimize again
    } else if (url.pathname === '/api/unpick') {
      delete asset.picked;
      asset.status = (await listVariants(assetOutputDir(asset.id))).length ? 'generated' : 'todo';
    } else if (url.pathname === '/api/redo') {
      delete asset.picked;
      asset.status = 'todo';
    } else if (url.pathname === '/api/notes') {
      if (typeof body.notes !== 'string')
        return sendJson(res, 400, { error: 'notes must be text' });
      if (body.notes.trim()) asset.notes = body.notes.trim();
      else delete asset.notes;
    } else {
      return sendJson(res, 404, { error: 'not found' });
    }
    await saveManifest(manifest);
    return sendJson(res, 200, { ok: true, asset });
  }

  sendJson(res, 404, { error: 'not found' });
}

async function state() {
  const manifest = await loadManifest();
  const assets = await Promise.all(
    manifest.assets.map(async (asset) => {
      const dir = assetOutputDir(asset.id);
      const variants = (await listVariants(dir)).map((v) => v.number);
      const runs = JSON.parse(
        await fs.readFile(path.join(dir, 'runs.json'), 'utf8').catch(() => '[]'),
      );
      const lastRun = runs.at(-1);
      let prompt = lastRun?.prompt;
      if (!prompt) {
        const styleFile = asset.styleBlockFile ?? manifest.defaults.styleBlockFile;
        const style = await fs
          .readFile(path.resolve(ASSETS_TOOL_DIR, styleFile), 'utf8')
          .catch(() => '');
        prompt = buildPrompt(style, asset);
      }
      const hasSlices =
        SHEET_KINDS.includes(asset.kind) &&
        (await fs
          .access(path.join(dir, 'sliced', `${sliceLabels(asset.kind)[0]}.png`))
          .then(() => true)
          .catch(() => false));
      return {
        ...asset,
        variants,
        prompt,
        lastRun: lastRun && { at: lastRun.at, model: lastRun.model },
        hasSlices,
      };
    }),
  );
  return { defaults: manifest.defaults, assets, expressions: EXPRESSIONS };
}

async function sendImage(res, [, id, variant, expression]) {
  const manifest = await loadManifest();
  if (!manifest.assets.some((a) => a.id === id))
    return sendJson(res, 404, { error: 'unknown asset' });
  let file;
  if (variant) file = variantFile(assetOutputDir(id), Number(variant));
  else if ([...EXPRESSIONS, '1', '2', '3', '4'].includes(expression))
    file = path.join(assetOutputDir(id), 'sliced', `${expression}.png`);
  else return sendJson(res, 404, { error: 'not found' });
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: 'image not found' });
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error('body too large');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new Error('invalid JSON body');
  }
}
