import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseArgs } from './cli.mjs';
import { resolveReferences } from './references.mjs';
import { sliceSheet } from './sheets.mjs';
import { listVariants, nextVariantNumber } from './variants.mjs';

let dir;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mandate-assets-'));
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('variants', () => {
  it('lists numbered variants and continues numbering after the highest', async () => {
    for (const name of ['v1.png', 'v3.png', 'v10.png', 'notes.txt', 'runs.json']) {
      await fs.writeFile(path.join(dir, name), '');
    }
    const variants = await listVariants(dir);
    expect(variants.map((v) => v.number)).toEqual([1, 3, 10]);
    expect(nextVariantNumber(variants)).toBe(11);
    expect(nextVariantNumber(await listVariants(path.join(dir, 'missing')))).toBe(1);
  });
});

describe('resolveReferences', () => {
  const manifest = {
    assets: [
      { id: 'scene.desk', picked: undefined },
      { id: 'scene.other', picked: 99 },
    ],
  };

  it('expands folders to their images and keeps files', async () => {
    await fs.mkdir(path.join(dir, 'references'));
    await fs.writeFile(path.join(dir, 'references', 'b.png'), '');
    await fs.writeFile(path.join(dir, 'references', 'a.webp'), '');
    await fs.writeFile(path.join(dir, 'references', 'readme.txt'), '');
    const { files, pending } = await resolveReferences(manifest, ['references'], dir);
    expect(files.map((f) => path.basename(f))).toEqual(['a.webp', 'b.png']);
    expect(pending).toEqual([]);
  });

  it('reports unpicked @picked references as pending instead of failing', async () => {
    const { files, pending } = await resolveReferences(manifest, ['@picked:scene.desk'], dir);
    expect(files).toEqual([]);
    expect(pending).toEqual(['@picked:scene.desk']);
  });

  it('errors on unknown assets, missing files and paths outside the tool folder', async () => {
    await expect(resolveReferences(manifest, ['@picked:nope'], dir)).rejects.toThrow(/no asset/);
    await expect(resolveReferences(manifest, ['@picked:scene.other'], dir)).rejects.toThrow(
      /missing/,
    );
    await expect(resolveReferences(manifest, ['ghost.png'], dir)).rejects.toThrow(/not found/);
    await expect(resolveReferences(manifest, ['../../etc/passwd'], dir)).rejects.toThrow(/inside/);
  });
});

describe('sliceSheet', () => {
  it('cuts a 2×2 sheet into the right quadrants', async () => {
    const colours = [
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 255, b: 0 },
      { r: 0, g: 0, b: 255 },
      { r: 255, g: 255, b: 0 },
    ];
    const quadrant = (c) =>
      sharp({ create: { width: 32, height: 32, channels: 3, background: c } })
        .png()
        .toBuffer();
    const tiles = await Promise.all(colours.map(quadrant));
    const sheet = path.join(dir, 'sheet.png');
    await sharp({ create: { width: 64, height: 64, channels: 3, background: '#000' } })
      .composite(
        tiles.map((input, i) => ({ input, left: (i % 2) * 32, top: Math.floor(i / 2) * 32 })),
      )
      .png()
      .toFile(sheet);

    const files = await sliceSheet(sheet, path.join(dir, 'sliced'));
    const expected = {
      neutral: colours[0],
      pleased: colours[1],
      angry: colours[2],
      suspicious: colours[3],
    };
    for (const [expression, colour] of Object.entries(expected)) {
      const { data, info } = await sharp(files[expression])
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect([info.width, info.height]).toEqual([32, 32]);
      expect([data[0], data[1], data[2]]).toEqual([colour.r, colour.g, colour.b]);
    }
  });
});

describe('parseArgs', () => {
  const spec = { only: 'list', yes: 'boolean', variants: 'number', model: 'string' };

  it('parses flags in both forms', () => {
    expect(parseArgs(['--only', 'a,b', '--yes', '--variants=2', '--model', 'm'], spec)).toEqual({
      only: ['a', 'b'],
      yes: true,
      variants: 2,
      model: 'm',
    });
  });

  it('rejects unknown flags and missing values', () => {
    expect(() => parseArgs(['--spend'], spec)).toThrow(/unknown flag/);
    expect(() => parseArgs(['--only'], spec)).toThrow(/needs a value/);
    expect(() => parseArgs(['--variants', 'x'], spec)).toThrow(/number/);
  });
});
