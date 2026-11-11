import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { defaultSettings, TASK_IDS, TASKS, type Settings } from './tasks.ts';

const FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'data',
  'settings.json',
);

const settingsSchema = z.object({
  aiEnabled: z.boolean(),
  tasks: z.record(
    z.string(),
    z.object({
      model: z.string().min(1).max(80),
      enabled: z.boolean(),
      effort: z.enum(['none', 'low', 'medium']),
    }),
  ),
});

/** Keep only known tasks and allowlisted models; anything else falls back to the default. */
export function sanitise(input: unknown): Settings {
  const base = defaultSettings();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return base;
  base.aiEnabled = parsed.data.aiEnabled;
  for (const id of TASK_IDS) {
    const t = parsed.data.tasks[id];
    if (!t) continue;
    const allowed = TASKS[id].allowed as readonly string[];
    base.tasks[id] = {
      model: allowed.includes(t.model) ? t.model : TASKS[id].default,
      enabled: t.enabled,
      effort: t.effort,
    };
  }
  return base;
}

let cache: Settings | null = null;

export async function loadSettings(): Promise<Settings> {
  if (cache) return cache;
  try {
    cache = sanitise(JSON.parse(await fs.readFile(FILE, 'utf8')));
  } catch {
    cache = defaultSettings();
  }
  return cache;
}

export async function saveSettings(input: unknown): Promise<Settings> {
  const s = sanitise(input);
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, `${JSON.stringify(s, null, 2)}\n`);
  cache = s;
  return s;
}
