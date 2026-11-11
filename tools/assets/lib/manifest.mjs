import fs from 'node:fs/promises';
import { z } from 'zod';
import { MANIFEST_PATH } from './paths.mjs';
import { sizeError } from './sizes.mjs';

export const CATEGORIES = ['scenes', 'props', 'characters', 'crowd', 'ui', 'textures'];
export const STATUSES = ['todo', 'generated', 'picked', 'final'];
/** Order of the 2×2 character sheet: top-left, top-right, bottom-left, bottom-right. */
export const EXPRESSIONS = ['neutral', 'pleased', 'angry', 'suspicious'];

const sizeSchema = z.string().superRefine((value, ctx) => {
  const error = sizeError(value);
  if (error) ctx.addIssue({ code: 'custom', message: error });
});

const generationSettings = {
  model: z.string().min(1),
  quality: z.enum(['low', 'medium', 'high', 'xhigh', 'max', 'auto']),
  variants: z.number().int().min(1).max(8),
  styleBlockFile: z.string().min(1),
  /** Paths relative to tools/assets, a folder (all images in it), or "@picked:<assetId>". */
  references: z.array(z.string().min(1)),
};

const assetSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/, 'lowercase, digits, "." and "-" only'),
    category: z.enum(CATEGORIES),
    kind: z.enum(['image', 'character-sheet']).default('image'),
    /** What to draw. Style and technical spec are added by the prompt builder. */
    description: z.string().min(10),
    size: sizeSchema,
    background: z.enum(['opaque', 'transparent', 'auto']),
    /** Width in CSS px at the 1920×1080 design size. optimize.mjs writes 1x and 2x of this. */
    displayWidth: z.number().int().positive(),
    /** Extra technical notes appended to the generated spec. */
    spec: z.string().optional(),
    /** Assets sharing a sprite name are packed into one sprite sheet by optimize.mjs. */
    sprite: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    status: z.enum(STATUSES).default('todo'),
    /** Variant number chosen in review. */
    picked: z.number().int().positive().optional(),
    notes: z.string().optional(),
    model: generationSettings.model.optional(),
    quality: generationSettings.quality.optional(),
    variants: generationSettings.variants.optional(),
    styleBlockFile: generationSettings.styleBlockFile.optional(),
    references: generationSettings.references.optional(),
  })
  .superRefine((asset, ctx) => {
    if ((asset.status === 'picked' || asset.status === 'final') && asset.picked === undefined) {
      ctx.addIssue({ code: 'custom', message: `status "${asset.status}" requires "picked"` });
    }
    if (asset.kind === 'character-sheet' && asset.sprite) {
      ctx.addIssue({ code: 'custom', message: 'character sheets cannot be sprite members' });
    }
  });

export const manifestSchema = z
  .object({
    version: z.literal(1),
    defaults: z.object(generationSettings),
    assets: z.array(assetSchema),
  })
  .superRefine((manifest, ctx) => {
    const seen = new Set();
    manifest.assets.forEach((asset, index) => {
      if (seen.has(asset.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['assets', index, 'id'],
          message: `duplicate id "${asset.id}"`,
        });
      }
      seen.add(asset.id);
    });
  });

/** Parse and validate raw manifest JSON; throws a readable error listing every problem. */
export function parseManifest(raw) {
  const result = manifestSchema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => {
      let where = issue.path.join('.');
      const [first, index] = issue.path;
      if (first === 'assets' && typeof index === 'number' && raw?.assets?.[index]?.id) {
        where = `${raw.assets[index].id} (${issue.path.slice(2).join('.') || 'asset'})`;
      }
      return `  - ${where || '(root)'}: ${issue.message}`;
    });
    throw new Error(`manifest.json is invalid:\n${lines.join('\n')}`);
  }
  return result.data;
}

export async function loadManifest(file = MANIFEST_PATH) {
  return parseManifest(JSON.parse(await fs.readFile(file, 'utf8')));
}

/** Validates, then writes atomically (temp file + rename) so a crash never leaves half a manifest. */
export async function saveManifest(manifest, file = MANIFEST_PATH) {
  parseManifest(manifest);
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.rename(tmp, file);
}

/** Asset with defaults filled in for generation settings. */
export function resolveAsset(manifest, asset) {
  return {
    ...asset,
    model: asset.model ?? manifest.defaults.model,
    quality: asset.quality ?? manifest.defaults.quality,
    variants: asset.variants ?? manifest.defaults.variants,
    styleBlockFile: asset.styleBlockFile ?? manifest.defaults.styleBlockFile,
    references: asset.references ?? manifest.defaults.references,
  };
}

/**
 * Pick which assets a command works on.
 * `only` (ids) wins; otherwise filter by `statuses`. Unknown ids are an error, not silently skipped.
 */
export function selectAssets(manifest, { only, statuses } = {}) {
  if (only && only.length > 0) {
    const byId = new Map(manifest.assets.map((a) => [a.id, a]));
    const missing = only.filter((id) => !byId.has(id));
    if (missing.length) throw new Error(`unknown asset id(s): ${missing.join(', ')}`);
    return only.map((id) => byId.get(id));
  }
  return manifest.assets.filter((a) => !statuses || statuses.includes(a.status));
}
