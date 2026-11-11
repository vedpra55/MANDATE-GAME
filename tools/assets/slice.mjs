#!/usr/bin/env node
/**
 * Slice 2×2 character expression sheets into neutral / pleased / angry / suspicious PNGs.
 * Output: tools/assets/output/<id>/sliced/<expression>.png
 *
 *   node tools/assets/slice.mjs                         # every picked character sheet
 *   node tools/assets/slice.mjs --only character.pa --variant 3   # preview a variant before picking
 */
import path from 'node:path';
import { parseArgs, runMain } from './lib/cli.mjs';
import { loadManifest, selectAssets } from './lib/manifest.mjs';
import { assetOutputDir, REPO_ROOT } from './lib/paths.mjs';
import { sliceSheet } from './lib/sheets.mjs';
import { variantFile } from './lib/variants.mjs';

runMain(async (argv) => {
  const args = parseArgs(argv, { only: 'list', variant: 'number' });
  const manifest = await loadManifest();
  const sheets = selectAssets(manifest, {
    only: args.only,
    statuses: ['picked', 'final'],
  }).filter((a) => a.kind === 'character-sheet');

  if (args.variant !== undefined && sheets.length !== 1) {
    throw new Error('--variant needs exactly one sheet: use --only <id>');
  }
  if (sheets.length === 0) {
    console.log('No character sheets to slice (need kind "character-sheet" and a picked variant).');
    return;
  }

  for (const sheet of sheets) {
    const number = args.variant ?? sheet.picked;
    if (number === undefined) {
      console.log(`- ${sheet.id}: no picked variant; skip (or pass --variant N)`);
      continue;
    }
    const dir = assetOutputDir(sheet.id);
    const files = await sliceSheet(variantFile(dir, number), path.join(dir, 'sliced'));
    console.log(`✓ ${sheet.id} v${number} →`);
    for (const file of Object.values(files)) console.log(`    ${path.relative(REPO_ROOT, file)}`);
  }
});
