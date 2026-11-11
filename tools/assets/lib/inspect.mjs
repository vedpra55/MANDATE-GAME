import path from 'node:path';
import sharp from 'sharp';

/** Small JPEG next to a variant, for quick visual review (v3.png -> v3.preview.jpg). */
export async function writePreview(file, width = 1024) {
  const out = path.join(path.dirname(file), `${path.basename(file, '.png')}.preview.jpg`);
  await sharp(file)
    .flatten({ background: '#bfbfbf' })
    .resize({ width })
    .jpeg({ quality: 80 })
    .toFile(out);
  return out;
}

/** OpenAI's guide: "check the decoded alpha channel". Reports the share of fully transparent pixels. */
export async function checkAlpha(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let clear = 0;
  for (let i = 3; i < data.length; i += info.channels) if (data[i] === 0) clear++;
  const pct = Math.round((clear / (info.width * info.height)) * 100);
  if (pct < 5)
    return { ok: false, transparentPct: pct, message: `only ${pct}% transparent pixels` };
  return { ok: true, transparentPct: pct };
}
