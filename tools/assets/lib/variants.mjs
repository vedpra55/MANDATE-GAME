import fs from 'node:fs/promises';
import path from 'node:path';

const VARIANT_FILE = /^v(\d+)\.png$/;

/** Existing variants in an asset's output folder, sorted by number. */
export async function listVariants(dir) {
  let names;
  try {
    names = await fs.readdir(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  return names
    .map((name) => VARIANT_FILE.exec(name))
    .filter(Boolean)
    .map((m) => ({ number: Number(m[1]), file: path.join(dir, m[0]) }))
    .sort((a, b) => a.number - b.number);
}

/** New runs never overwrite: numbering continues after the highest existing variant. */
export function nextVariantNumber(variants) {
  return variants.reduce((max, v) => Math.max(max, v.number), 0) + 1;
}

export function variantFile(dir, number) {
  return path.join(dir, `v${number}.png`);
}
