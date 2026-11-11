/**
 * Browser-side AI calls. Every function returns null on any failure (server down, AI switched
 * off, timeout, invalid answer), and the caller falls back to the offline engine. The browser
 * never sees the API key: everything goes through /api/ai on our own server.
 */
import { draftsFromExtraction, type PromiseDraft } from '../engine/promises.ts';
import { interpretFallback } from '../engine/interpret.ts';
import { readCallFallback } from '../engine/interrupts.ts';
import type {
  CallReading,
  Channel,
  FaultLineId,
  GameState,
  Reading,
  TolaId,
} from '../engine/types.ts';
import {
  callReadingFromAnswers,
  decisionResponseSchema,
  extractedPromisesSchema,
  readingFromAnswers,
  voicesSchema,
  type VoiceFacts,
  type Voices,
} from './contract.ts';

const TIMEOUT = 15000;

async function post(path: string, body: unknown): Promise<unknown | null> {
  try {
    const res = await fetch(`/api/ai/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export type AiReading = { reading: Reading; flagged: boolean; model: string };

/** Read a statement with the Decisions API, merged over the offline reading. */
export async function aiReadStatement(
  s: GameState,
  text: string,
  channel: Channel,
  tola: TolaId | null,
  forced: FaultLineId | null,
): Promise<AiReading | null> {
  const r = (await post('read', {
    text,
    context: {
      channel,
      tola,
      faultLines: s.faultLines,
      forced,
      day: s.clock.day,
      rivalName: s.rival.name,
    },
  })) as {
    answers: unknown;
    moderation: { flagged: boolean; categories: string[] } | null;
    model: string;
  } | null;
  if (!r) return null;
  const parsed = decisionResponseSchema.safeParse({ answers: r.answers });
  if (!parsed.success) return null;
  const reading = readingFromAnswers(parsed.data.answers, interpretFallback(s, text), s.faultLines);
  const flagged = Boolean(r.moderation?.flagged);
  const hateful = r.moderation?.categories.some(
    (c) => c.startsWith('hate') || c.startsWith('harassment') || c.startsWith('violence'),
  );
  if (hateful) reading.risks.inflammatory = Math.max(reading.risks.inflammatory, 0.85);
  return { reading, flagged, model: r.model };
}

export async function aiReadCall(text: string): Promise<CallReading | null> {
  const r = (await post('read-call', { text })) as { answers: unknown } | null;
  if (!r) return null;
  const parsed = decisionResponseSchema.safeParse({ answers: r.answers });
  return parsed.success
    ? callReadingFromAnswers(parsed.data.answers, readCallFallback(text))
    : null;
}

export async function aiPromises(
  s: GameState,
  text: string,
  tola: TolaId | null,
): Promise<PromiseDraft[] | undefined> {
  const r = await post('promises', {
    text,
    context: { day: s.clock.day, daysToPoll: s.clock.daysToPoll, tola },
  });
  const parsed = extractedPromisesSchema.safeParse(r);
  return parsed.success ? draftsFromExtraction(s, parsed.data.promises, tola) : undefined;
}

export async function aiVoices(facts: VoiceFacts): Promise<Voices | null> {
  const r = (await post('voices', { facts })) as { voices: unknown } | null;
  if (!r) return null;
  const parsed = voicesSchema.safeParse(r.voices);
  return parsed.success ? parsed.data : null;
}
