import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ASSETS_TOOL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = path.resolve(ASSETS_TOOL_DIR, '..', '..');
export const MANIFEST_PATH = path.join(ASSETS_TOOL_DIR, 'manifest.json');
/** Raw generated variants. Git-ignored: only picked finals are committed (to src/assets). */
export const OUTPUT_DIR = path.join(ASSETS_TOOL_DIR, 'output');
export const SRC_ASSETS_DIR = path.join(REPO_ROOT, 'src', 'assets');

/** Folder for one asset's raw variants. */
export function assetOutputDir(assetId) {
  return path.join(OUTPUT_DIR, assetId);
}

/** File base name used for optimised files in src/assets: "scene.village-desk" -> "scene-village-desk". */
export function assetFileBase(assetId) {
  return assetId.replaceAll('.', '-');
}
