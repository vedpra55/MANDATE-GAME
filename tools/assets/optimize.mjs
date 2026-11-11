#!/usr/bin/env node
/**
 * Turn picked variants into game-ready WebP files in src/assets/<category>/:
 *   <name>.webp and <name>@2x.webp      (1x = displayWidth, 2x = double, never upscaled)
 *   character sheets -> <name>-<expression>.webp (+ @2x), sliced automatically
 *   sprite groups    -> <sprite>.webp (+ @2x) and <sprite>.json atlas (1x coordinates)
 * Marks processed assets "final" in manifest.json.
 *
 *   node tools/assets/optimize.mjs                  # every "picked" asset
 *   node tools/assets/optimize.mjs --only prop.phone
 *   node tools/assets/optimize.mjs --all            # also redo "final" assets
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { parseArgs, runMain } from './lib/cli.mjs';
import { outputWidths, spriteLayout } from './lib/layout.mjs';
import {
  loadManifest,
  saveManifest,
  selectAssets,
  SHEET_KINDS,
  sliceLabels,
} from './lib/manifest.mjs';
import { assetFileBase, assetOutputDir, REPO_ROOT, SRC_ASSETS_DIR } from './lib/paths.mjs';
import { sliceSheet } from './lib/sheets.mjs';
import { variantFile } from './lib/variants.mjs';

const WEBP = { quality: 85, alphaQuality: 100, effort: 5 };

runMain(async (argv) => {
  const args = parseArgs(argv, { only: 'list', all: 'boolean' });
  const manifest = await loadManifest();
  const selected = selectAssets(manifest, {
    only: args.only,
    statuses: args.all ? ['picked', 'final'] : ['picked'],
  });
  const unpicked = selected.filter((a) => a.picked === undefined);
  if (unpicked.length) {
    throw new Error(`no picked variant for: ${unpicked.map((a) => a.id).join(', ')}`);
  }
  if (selected.length === 0) {
    console.log('Nothing to optimize. Pick variants in review first (npm run assets:review).');
    return;
  }

  const done = new Set();
  const spriteNames = new Set();

  for (const asset of selected) {
    if (asset.sprite) {
      spriteNames.add(asset.sprite);
      continue;
    }
    const source = variantFile(assetOutputDir(asset.id), asset.picked);
    const outDir = path.join(SRC_ASSETS_DIR, asset.category);
    const base = assetFileBase(asset.id);

    if (SHEET_KINDS.includes(asset.kind)) {
      const labels = sliceLabels(asset.kind);
      const sliced = await sliceSheet(
        source,
        path.join(assetOutputDir(asset.id), 'sliced'),
        labels,
      );
      for (const label of labels) {
        await writePair(sliced[label], outDir, `${base}-${label}`, asset.displayWidth);
      }
    } else {
      await writePair(source, outDir, base, asset.displayWidth);
    }
    done.add(asset.id);
  }

  // A sprite sheet always includes every picked/final member, not just the selected ones.
  for (const name of spriteNames) {
    const members = manifest.assets.filter(
      (a) =>
        a.sprite === name &&
        a.picked !== undefined &&
        (a.status === 'picked' || a.status === 'final'),
    );
    await writeSprite(name, members);
    members.forEach((m) => done.add(m.id));
  }

  for (const asset of manifest.assets) if (done.has(asset.id)) asset.status = 'final';
  await saveManifest(manifest);
  console.log(`\nMarked ${done.size} asset(s) final.`);
});

async function writePair(source, outDir, base, displayWidth) {
  await fs.mkdir(outDir, { recursive: true });
  const { width } = await sharp(source).metadata();
  const { oneX, twoX, twoXIsShort } = outputWidths(displayWidth, width);
  const oneFile = path.join(outDir, `${base}.webp`);
  const twoFile = path.join(outDir, `${base}@2x.webp`);
  await sharp(source).resize({ width: oneX }).webp(WEBP).toFile(oneFile);
  await sharp(source).resize({ width: twoX }).webp(WEBP).toFile(twoFile);
  console.log(`✓ ${rel(oneFile)} (${oneX}px), @2x (${twoX}px)`);
  if (twoXIsShort) {
    console.warn(
      `  ⚠ source is ${width}px wide; @2x wanted ${displayWidth * 2}px. Generate larger for crisp 2x.`,
    );
  }
}

async function writeSprite(name, members) {
  if (members.length === 0) return;
  // Each member gives one frame, or four if it is a 2×2 grid of different subjects.
  const frames = [];
  for (const m of members) {
    const file = variantFile(assetOutputDir(m.id), m.picked);
    if (m.kind === 'grid-4') {
      const labels = sliceLabels(m.kind);
      const sliced = await sliceSheet(file, path.join(assetOutputDir(m.id), 'sliced'), labels);
      labels.forEach((l) => frames.push({ id: `${m.id}-${l}`, file: sliced[l] }));
    } else {
      frames.push({ id: m.id, file });
    }
  }
  const sources = frames.map((f) => f.file);
  const sizes = await Promise.all(sources.map((s) => sharp(s).metadata()));
  const widths = new Set(members.map((m) => m.displayWidth));
  if (widths.size > 1) throw new Error(`sprite "${name}": members must share one displayWidth`);
  const ratios = new Set(sizes.map((s) => (s.width / s.height).toFixed(3)));
  if (ratios.size > 1) throw new Error(`sprite "${name}": members must share one aspect ratio`);

  const [displayWidth] = widths;
  const aspect = sizes[0].height / sizes[0].width;
  const category = members[0].category;
  const outDir = path.join(SRC_ASSETS_DIR, category);
  await fs.mkdir(outDir, { recursive: true });

  const atlas = {};
  for (const scale of [1, 2]) {
    const cellW = Math.min(displayWidth * scale, sizes[0].width);
    const cellH = Math.round(cellW * aspect);
    const layout = spriteLayout(frames.length, cellW, cellH);
    const tiles = await Promise.all(
      sources.map((s) =>
        sharp(s).resize({ width: cellW, height: cellH, fit: 'fill' }).png().toBuffer(),
      ),
    );
    const file = path.join(outDir, `${name}${scale === 2 ? '@2x' : ''}.webp`);
    await sharp({
      create: {
        width: layout.width,
        height: layout.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(
        tiles.map((input, i) => ({ input, left: layout.frames[i].x, top: layout.frames[i].y })),
      )
      .webp(WEBP)
      .toFile(file);
    console.log(
      `✓ sprite ${rel(file)} (${frames.length} frames, ${layout.width}×${layout.height})`,
    );
    if (scale === 1) {
      atlas.image = `${name}.webp`;
      atlas.image2x = `${name}@2x.webp`;
      atlas.cell = { w: cellW, h: cellH };
      atlas.frames = Object.fromEntries(frames.map((f, i) => [f.id, layout.frames[i]]));
    }
  }
  const atlasFile = path.join(outDir, `${name}.json`);
  await fs.writeFile(atlasFile, `${JSON.stringify(atlas, null, 2)}\n`);
  console.log(`✓ atlas ${rel(atlasFile)}`);
}

function rel(file) {
  return path.relative(REPO_ROOT, file);
}
