/**
 * AI routes. The client sends the *kind* of request and the text; the server builds the prompts
 * from the shared contract, so a client can never send arbitrary prompts or burn credits on
 * questions of its own. Any failure returns an error and the client falls back to offline logic.
 */
import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  callRequestBody,
  decisionResponseSchema,
  extractedPromisesSchema,
  PROMISE_DEVELOPER,
  PROMISE_SCHEMA,
  statementRequestBody,
  VOICES_DEVELOPER,
  VOICES_SCHEMA,
  voicesSchema,
} from '../../src/ai/contract.ts';
import { FAULT_LINES, ISSUES, TOLAS } from '../../src/engine/types.ts';
import { AiError, availableModels, decide, generateJson, moderate } from './openai.ts';
import { loadSettings, saveSettings } from './settings.ts';
import { TASK_IDS, TASKS, type TaskId } from './tasks.ts';

const MAX_TEXT = 1200;

const readSchema = z.object({
  text: z.string().min(1).max(MAX_TEXT),
  context: z.object({
    channel: z.enum(['declaration', 'pad', 'visit', 'answer', 'chai', 'sabha', 'leader', 'debate']),
    tola: z.enum(TOLAS).nullable(),
    faultLines: z.array(z.enum(FAULT_LINES)).max(6),
    forced: z.enum(FAULT_LINES).nullable(),
    day: z.number().int().min(0).max(40),
    rivalName: z.string().max(40),
    rivalPromises: z
      .array(
        z.object({
          issue: z.enum(ISSUES),
          tola: z.enum([...TOLAS, 'village']),
          how: z.enum(['vague', 'big', 'specific']),
        }),
      )
      .max(12)
      .optional(),
  }),
});
const callSchema = z.object({ text: z.string().min(1).max(MAX_TEXT) });
const promiseSchema = z.object({
  text: z.string().min(1).max(MAX_TEXT),
  context: z.object({
    day: z.number().int(),
    daysToPoll: z.number().int(),
    tola: z.enum(TOLAS).nullable(),
  }),
});
const voicesInput = z.object({
  facts: z.object({
    address: z.string().max(20),
    language: z.enum(['hindi', 'english', 'hinglish', 'other']),
    candidateSaid: z.string().max(MAX_TEXT).nullable(),
    summary: z.string().max(400),
    reactions: z
      .array(
        z.object({
          who: z.string().max(60),
          about: z.string().max(160),
          verdict: z.string().max(80),
        }),
      )
      .max(4),
    paFacts: z.array(z.string().max(240)).max(4),
    memory: z.array(z.string().max(300)).max(8),
    avoid: z.array(z.string().max(240)).max(6),
  }),
});

/** Very small per-IP rate limit: protects the key from runaway loops. */
const hits = new Map<string, number[]>();
function limited(req: Request, perMinute = 60): boolean {
  const ip = req.ip ?? 'local';
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > perMinute;
}

export function aiRouter(apiKey: string | undefined) {
  const router = Router();

  const ready = async (task: TaskId) => {
    const s = await loadSettings();
    if (!apiKey || !s.aiEnabled || !s.tasks[task].enabled) return null;
    return s.tasks[task];
  };

  router.post('/read', async (req, res) => {
    if (limited(req)) return res.status(429).json({ error: 'rate_limited' });
    const parsed = readSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'bad_request' });
    const task = await ready('decide');
    if (!task) return res.status(503).json({ error: 'ai_off' });
    const mod = await ready('moderate');
    const { text, context } = parsed.data;
    const started = Date.now();
    try {
      const [answers, moderation] = await Promise.all([
        decide(apiKey!, task.model, statementRequestBody(context, text)).then(
          (r) => decisionResponseSchema.parse(r).answers,
        ),
        mod ? moderate(apiKey!, mod.model, text).catch(() => null) : Promise.resolve(null),
      ]);
      res.json({ answers, moderation, model: task.model, ms: Date.now() - started });
    } catch (err) {
      res.status(502).json({ error: err instanceof AiError ? err.message : 'ai_failed' });
    }
  });

  router.post('/read-call', async (req, res) => {
    if (limited(req)) return res.status(429).json({ error: 'rate_limited' });
    const parsed = callSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'bad_request' });
    const task = await ready('decide');
    if (!task) return res.status(503).json({ error: 'ai_off' });
    try {
      const r = await decide(apiKey!, task.model, callRequestBody(parsed.data.text));
      res.json({ answers: decisionResponseSchema.parse(r).answers, model: task.model });
    } catch (err) {
      res.status(502).json({ error: err instanceof AiError ? err.message : 'ai_failed' });
    }
  });

  router.post('/promises', async (req, res) => {
    if (limited(req)) return res.status(429).json({ error: 'rate_limited' });
    const parsed = promiseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'bad_request' });
    const task = await ready('extract_promises');
    if (!task) return res.status(503).json({ error: 'ai_off' });
    try {
      const out = await generateJson(
        apiKey!,
        task.model,
        task.effort,
        PROMISE_DEVELOPER,
        { today: parsed.data.context, statement: parsed.data.text },
        'promises',
        PROMISE_SCHEMA,
      );
      res.json({ ...extractedPromisesSchema.parse(out), model: task.model });
    } catch (err) {
      res.status(502).json({ error: err instanceof AiError ? err.message : 'ai_failed' });
    }
  });

  router.post('/voices', async (req, res) => {
    if (limited(req)) return res.status(429).json({ error: 'rate_limited' });
    const parsed = voicesInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'bad_request' });
    const task = await ready('voice_reactions');
    if (!task) return res.status(503).json({ error: 'ai_off' });
    try {
      const out = await generateJson(
        apiKey!,
        task.model,
        task.effort,
        VOICES_DEVELOPER,
        parsed.data.facts,
        'voices',
        VOICES_SCHEMA,
        500,
      );
      res.json({ voices: voicesSchema.parse(out), model: task.model });
    } catch (err) {
      res.status(502).json({ error: err instanceof AiError ? err.message : 'ai_failed' });
    }
  });

  return router;
}

/** Model settings per task (owner panel). Writable only when allowed (development). */
export function settingsRouter(apiKey: string | undefined, opts: { allowSettingsWrite: boolean }) {
  const router = Router();
  router.get('/settings', async (_req, res) => {
    const settings = await loadSettings();
    let available: string[] | null = null;
    if (apiKey) available = await availableModels(apiKey).catch(() => null);
    res.json({
      settings,
      keyConfigured: Boolean(apiKey),
      canWrite: opts.allowSettingsWrite,
      tasks: TASK_IDS.map((id) => ({
        id,
        label: TASKS[id].label,
        api: TASKS[id].api,
        default: TASKS[id].default,
        generate: TASKS[id].generate,
        allowed: (TASKS[id].allowed as readonly string[]).filter(
          (m) => !available || available.includes(m),
        ),
      })),
    });
  });

  router.put('/settings', async (req, res) => {
    if (!opts.allowSettingsWrite)
      return res.status(403).json({ error: 'settings are read-only here' });
    res.json({ settings: await saveSettings(req.body) });
  });

  return router;
}
