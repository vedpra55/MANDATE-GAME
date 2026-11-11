import fs from 'node:fs/promises';
import path from 'node:path';
import { ASSETS_TOOL_DIR, assetOutputDir } from './paths.mjs';
import { variantFile } from './variants.mjs';

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const PICKED_PREFIX = '@picked:';

/**
 * Turn an asset's reference list into image file paths.
 * - "references"           -> every image in tools/assets/references (empty folder = none)
 * - "references/desk.png"  -> that file
 * - "@picked:<assetId>"    -> the variant chosen in review for that asset (e.g. the master scene)
 *
 * Returns { files, pending }: `pending` lists "@picked:" references whose asset has no pick yet.
 * A dry run can show them; a real run must refuse.
 */
export async function resolveReferences(manifest, references, baseDir = ASSETS_TOOL_DIR) {
  const files = [];
  const pending = [];
  for (const ref of references) {
    if (ref.startsWith(PICKED_PREFIX)) {
      const id = ref.slice(PICKED_PREFIX.length);
      const target = manifest.assets.find((a) => a.id === id);
      if (!target) throw new Error(`reference ${ref}: no asset with id "${id}"`);
      if (target.picked === undefined) {
        pending.push(ref);
        continue;
      }
      files.push(variantFile(assetOutputDir(id), target.picked));
      continue;
    }
    const full = path.resolve(baseDir, ref);
    if (!full.startsWith(baseDir + path.sep)) {
      throw new Error(`reference ${ref}: must stay inside tools/assets`);
    }
    const stat = await fs.stat(full).catch(() => null);
    if (!stat) throw new Error(`reference ${ref}: not found`);
    if (stat.isDirectory()) {
      const names = (await fs.readdir(full)).filter((n) =>
        IMAGE_EXT.has(path.extname(n).toLowerCase()),
      );
      files.push(...names.sort().map((n) => path.join(full, n)));
    } else {
      files.push(full);
    }
  }
  for (const file of files) {
    await fs.access(file).catch(() => {
      throw new Error(`reference file missing: ${path.relative(baseDir, file)}`);
    });
  }
  return { files: [...new Set(files)], pending };
}
