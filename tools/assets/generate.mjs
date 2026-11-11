#!/usr/bin/env node
/**
 * Generate image variants for assets in manifest.json.
 *
 * DRY RUN BY DEFAULT: prints every prompt and the number of images, spends nothing.
 * Spending credits needs --yes, and is capped by --max-images (default 12).
 *
 *   node tools/assets/generate.mjs                          # dry run for all "todo" assets
 *   node tools/assets/generate.mjs --only scene.village-desk
 *   node tools/assets/generate.mjs --only scene.village-desk --yes
 *
 * Flags: --only id,id  --status todo,generated  --variants N  --model ID  --quality Q
 *        --max-images N  --concurrency N  --yes
 */
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs, runMain } from './lib/cli.mjs';
import { loadManifest, resolveAsset, saveManifest, selectAssets } from './lib/manifest.mjs';
import { generateImage } from './lib/openai-images.mjs';
import { ASSETS_TOOL_DIR, assetOutputDir, REPO_ROOT } from './lib/paths.mjs';
import { buildPrompt, isPlaceholderStyle } from './lib/prompt.mjs';
import { resolveReferences } from './lib/references.mjs';
import { listVariants, nextVariantNumber, variantFile } from './lib/variants.mjs';
import { checkAlpha, writePreview } from './lib/inspect.mjs';

const FLAGS = {
  only: 'list',
  status: 'list',
  variants: 'number',
  model: 'string',
  quality: 'string',
  'max-images': 'number',
  concurrency: 'number',
  yes: 'boolean',
  help: 'boolean',
};

runMain(async (argv) => {
  const args = parseArgs(argv, FLAGS);
  if (args.help) {
    console.log((await fs.readFile(new URL(import.meta.url), 'utf8')).split('*/')[0]);
    return;
  }
  const spend = Boolean(args.yes);
  const maxImages = args['max-images'] ?? 12;
  const concurrency = Math.max(1, Math.min(4, args.concurrency ?? 2));

  const manifest = await loadManifest();
  const selected = selectAssets(manifest, { only: args.only, statuses: args.status ?? ['todo'] });
  if (selected.length === 0) {
    console.log('No assets selected. Use --only <id> or --status <status>.');
    return;
  }

  // Build every job up front so the dry run shows exactly what a real run would send.
  const jobs = [];
  for (const raw of selected) {
    const asset = resolveAsset(manifest, {
      ...raw,
      ...(args.variants !== undefined && { variants: args.variants }),
      ...(args.model && { model: args.model }),
      ...(args.quality && { quality: args.quality }),
    });
    const styleText = await fs.readFile(
      path.resolve(ASSETS_TOOL_DIR, asset.styleBlockFile),
      'utf8',
    );
    const { files: references, pending } = await resolveReferences(manifest, asset.references);
    jobs.push({
      asset,
      prompt: buildPrompt(styleText, asset, { referenceCount: references.length }),
      placeholderStyle: isPlaceholderStyle(styleText),
      references,
      pending,
    });
  }

  const totalImages = jobs.reduce((sum, job) => sum + job.asset.variants, 0);
  for (const job of jobs) printJob(job);
  console.log(
    `\n${spend ? 'Generating' : 'Would generate'} ${totalImages} image(s) across ${jobs.length} asset(s).`,
  );

  if (!spend) {
    console.log('Dry run: nothing was sent. Re-run with --yes to spend image credits.');
    return;
  }

  const placeholders = jobs.filter((j) => j.placeholderStyle).map((j) => j.asset.id);
  if (placeholders.length) {
    throw new Error(
      `style block is still a placeholder for: ${placeholders.join(', ')}. Write the style first.`,
    );
  }
  const blocked = jobs.filter((j) => j.pending.length);
  if (blocked.length) {
    throw new Error(
      `waiting on picks: ${blocked.map((j) => `${j.asset.id} needs ${j.pending.join(', ')}`).join('; ')}`,
    );
  }
  if (totalImages > maxImages) {
    throw new Error(
      `${totalImages} images exceeds --max-images ${maxImages}. Raise it deliberately.`,
    );
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set (put it in .env)');

  let failures = 0;
  for (const job of jobs) {
    const { asset } = job;
    const dir = assetOutputDir(asset.id);
    await fs.mkdir(dir, { recursive: true });
    const first = nextVariantNumber(await listVariants(dir));
    const numbers = Array.from({ length: asset.variants }, (_, i) => first + i);

    console.log(`\n▶ ${asset.id}: variants ${numbers.map((n) => `v${n}`).join(', ')}`);
    const results = await mapLimit(numbers, concurrency, async (number) => {
      const started = Date.now();
      const png = await generateImage({
        apiKey,
        model: asset.model,
        prompt: job.prompt,
        size: asset.size,
        quality: asset.quality,
        background: asset.background,
        references: job.references,
      });
      // Exclusive create: a concurrent run can never overwrite a variant; take the next free number.
      let saved = number;
      for (;;) {
        try {
          await fs.writeFile(variantFile(dir, saved), png, { flag: 'wx' });
          break;
        } catch (err) {
          if (err.code !== 'EEXIST') throw err;
          saved = Math.max(saved + 1, nextVariantNumber(await listVariants(dir)));
        }
      }
      const file = variantFile(dir, saved);
      const preview = await writePreview(file);
      let alphaNote = '';
      if (asset.background === 'transparent') {
        const alpha = await checkAlpha(file);
        alphaNote = alpha.ok
          ? ` · alpha ok (${alpha.transparentPct}% clear)`
          : ` · ⚠ ${alpha.message}`;
      }
      console.log(
        `  ✓ v${saved} (${((Date.now() - started) / 1000).toFixed(1)}s)${alphaNote} · preview ${path.relative(REPO_ROOT, preview)}`,
      );
      return saved;
    });

    const saved = results.filter((r) => r.ok).map((r) => r.value);
    for (const r of results.filter((r) => !r.ok)) console.error(`  ✖ ${r.error.message}`);
    failures += results.length - saved.length;

    await appendRunLog(dir, {
      at: new Date().toISOString(),
      model: asset.model,
      size: asset.size,
      quality: asset.quality,
      background: asset.background,
      references: job.references.map((f) => path.relative(REPO_ROOT, f)),
      prompt: job.prompt,
      variants: saved,
      failed: results.length - saved.length,
    });

    if (saved.length > 0) {
      // Re-read so edits made in review.html during a long run are not overwritten.
      const fresh = await loadManifest();
      const entry = fresh.assets.find((a) => a.id === asset.id);
      if (entry && entry.status === 'todo') entry.status = 'generated';
      await saveManifest(fresh);
    }
  }

  console.log(failures ? `\nDone with ${failures} failed image(s).` : '\nDone.');
  console.log('Next: npm run assets:review');
  if (failures) process.exitCode = 1;
});

function printJob({ asset, prompt, references, pending, placeholderStyle }) {
  console.log(`\n━━ ${asset.id}  [${asset.category}/${asset.kind}]`);
  console.log(
    `   model ${asset.model} · ${asset.size} · quality ${asset.quality} · bg ${asset.background} · ${asset.variants} variant(s)`,
  );
  console.log(
    `   references: ${references.length ? references.map((f) => path.relative(ASSETS_TOOL_DIR, f)).join(', ') : 'none'}`,
  );
  if (pending.length) console.log(`   ⚠ waiting on picks: ${pending.join(', ')}`);
  if (placeholderStyle) console.log(`   ⚠ style block ${asset.styleBlockFile} is a placeholder`);
  console.log(prompt.replace(/^/gm, '   │ '));
}

async function appendRunLog(dir, entry) {
  const file = path.join(dir, 'runs.json');
  const existing = JSON.parse(await fs.readFile(file, 'utf8').catch(() => '[]'));
  existing.push(entry);
  await fs.writeFile(file, `${JSON.stringify(existing, null, 2)}\n`);
}

/** Run `fn` over items with at most `limit` in flight; never throws, returns per-item results. */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { ok: true, value: await fn(items[i]) };
      } catch (error) {
        results[i] = { ok: false, error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
