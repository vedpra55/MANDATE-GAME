import sharp from 'sharp';

/**
 * Edits often re-grade the whole image. Match an edited image back to its source by fitting a
 * per-channel gain/offset (mean and std) over regions that the edit should not have changed.
 */
export async function matchColour(sourceFile, editedFile, outFile, regions) {
  const stats = async (file) => {
    const sums = [0, 0, 0].map(() => ({ n: 0, s: 0, ss: 0 }));
    for (const r of regions) {
      const { data, info } = await sharp(file)
        .removeAlpha()
        .extract(r)
        .raw()
        .toBuffer({ resolveWithObject: true });
      for (let i = 0; i < data.length; i += info.channels) {
        for (let c = 0; c < 3; c++) {
          const v = data[i + c];
          sums[c].n++;
          sums[c].s += v;
          sums[c].ss += v * v;
        }
      }
    }
    return sums.map(({ n, s, ss }) => ({ mean: s / n, std: Math.sqrt(ss / n - (s / n) ** 2) }));
  };
  const [src, ed] = await Promise.all([stats(sourceFile), stats(editedFile)]);
  const gain = src.map((s, c) => s.std / ed[c].std);
  const offset = src.map((s, c) => s.mean - gain[c] * ed[c].mean);
  await sharp(editedFile).removeAlpha().linear(gain, offset).png().toFile(outFile);
  return { gain, offset, src, ed };
}
