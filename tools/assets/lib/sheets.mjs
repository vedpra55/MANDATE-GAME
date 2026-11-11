import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { sliceRects } from './layout.mjs';

/** Cut a 2×2 expression sheet into four PNGs named by expression. Returns { expression: file }. */
export async function sliceSheet(sheetFile, outDir, labels) {
  const { width, height } = await sharp(sheetFile).metadata();
  if (!width || !height) throw new Error(`cannot read image size: ${sheetFile}`);
  await fs.mkdir(outDir, { recursive: true });
  const files = {};
  for (const rect of sliceRects(width, height, labels)) {
    const { expression, ...region } = rect;
    const file = path.join(outDir, `${expression}.png`);
    await sharp(sheetFile).extract(region).png().toFile(file);
    files[expression] = file;
  }
  return files;
}
