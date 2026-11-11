#!/usr/bin/env node
/**
 * Contact sheet of assets for review: one labelled cell per asset (latest or picked variant).
 *   node tools/assets/contact-sheet.mjs --prefix prop. --out output/contact-props.jpg
 *   node tools/assets/contact-sheet.mjs --only a,b --which latest
 * Transparent assets are shown on a checkerboard so missing alpha is obvious.
 */
import path from 'node:path';
import sharp from 'sharp';
import { parseArgs, runMain } from './lib/cli.mjs';
import { loadManifest } from './lib/manifest.mjs';
import { ASSETS_TOOL_DIR, assetOutputDir } from './lib/paths.mjs';
import { listVariants, variantFile } from './lib/variants.mjs';

runMain(async (argv) => {
  const args = parseArgs(argv, {
    only: 'list',
    prefix: 'string',
    which: 'string',
    out: 'string',
    cell: 'number',
    columns: 'number',
  });
  const which = args.which ?? 'picked';
  const cell = args.cell ?? 420;
  const manifest = await loadManifest();
  let assets = manifest.assets.filter((a) => !a.id.startsWith('phase0.'));
  if (args.only) assets = assets.filter((a) => args.only.includes(a.id));
  if (args.prefix) assets = assets.filter((a) => a.id.startsWith(args.prefix));

  const tiles = [];
  for (const a of assets) {
    const variants = await listVariants(assetOutputDir(a.id));
    const n = which === 'latest' ? variants.at(-1)?.number : (a.picked ?? variants.at(-1)?.number);
    if (!n) continue;
    tiles.push({
      label: `${a.id}  v${n}${a.picked === n ? ' ✓' : ''}`,
      file: variantFile(assetOutputDir(a.id), n),
    });
  }
  if (!tiles.length) throw new Error('nothing to show');

  const columns = args.columns ?? Math.min(4, tiles.length);
  const labelH = 34;
  const rows = Math.ceil(tiles.length / columns);
  const checker = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${cell}" height="${cell}"><defs><pattern id="p" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#eee"/><rect width="10" height="10" fill="#ccc"/><rect x="10" y="10" width="10" height="10" fill="#ccc"/></pattern></defs><rect width="100%" height="100%" fill="url(#p)"/></svg>`,
  );
  const composites = [];
  for (const [i, t] of tiles.entries()) {
    const x = (i % columns) * cell;
    const y = Math.floor(i / columns) * (cell + labelH);
    const img = await sharp(t.file)
      .resize({
        width: cell,
        height: cell,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    composites.push({ input: checker, left: x, top: y }, { input: img, left: x, top: y });
    const label = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${cell}" height="${labelH}"><rect width="100%" height="100%" fill="#2b2118"/><text x="10" y="23" font-family="sans-serif" font-size="16" fill="#f3e9d2">${t.label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`,
    );
    composites.push({ input: label, left: x, top: y + cell });
  }
  const out = path.resolve(ASSETS_TOOL_DIR, args.out ?? 'output/contact-sheet.jpg');
  await sharp({
    create: {
      width: columns * cell,
      height: rows * (cell + labelH),
      channels: 3,
      background: '#2b2118',
    },
  })
    .composite(composites)
    .jpeg({ quality: 82 })
    .toFile(out);
  console.log(`✓ ${path.relative(process.cwd(), out)} (${tiles.length} assets)`);
});
