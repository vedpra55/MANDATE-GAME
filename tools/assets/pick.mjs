#!/usr/bin/env node
/**
 * Mark a variant as picked (same effect as the review page).
 *   node tools/assets/pick.mjs scene.village-desk 3 [--golden]
 * --golden also copies it into references/ as a golden style reference for every later generation.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { runMain } from './lib/cli.mjs';
import { loadManifest, saveManifest } from './lib/manifest.mjs';
import { ASSETS_TOOL_DIR, assetFileBase, assetOutputDir } from './lib/paths.mjs';
import { listVariants, variantFile } from './lib/variants.mjs';

runMain(async (argv) => {
  const [id, n, flag] = argv;
  const variant = Number(n);
  if (!id || !Number.isInteger(variant))
    throw new Error('usage: pick.mjs <asset-id> <variant> [--golden]');
  const manifest = await loadManifest();
  const asset = manifest.assets.find((a) => a.id === id);
  if (!asset) throw new Error(`unknown asset ${id}`);
  if (!(await listVariants(assetOutputDir(id))).some((v) => v.number === variant)) {
    throw new Error(`${id} has no v${variant}`);
  }
  asset.picked = variant;
  asset.status = 'picked';
  await saveManifest(manifest);
  console.log(`✓ ${id} → v${variant}`);
  if (flag === '--golden') {
    const dest = path.join(ASSETS_TOOL_DIR, 'references', `${assetFileBase(id)}.png`);
    await fs.copyFile(variantFile(assetOutputDir(id), variant), dest);
    console.log(`✓ golden reference: ${path.relative(ASSETS_TOOL_DIR, dest)}`);
  }
});
