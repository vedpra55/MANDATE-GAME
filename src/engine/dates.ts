/**
 * "Kab tak, bhaiya?" You decide when a promise is due. Choosing a date for an undated promise is
 * free; moving a date you already gave is public and costs credibility. A short date is believed a
 * little more (and is riskier); "after I win" costs nothing now but feeds promise inflation.
 */
import { canDate } from './promises.ts';
import { record } from './state.ts';
import { checkInflation } from './statements.ts';
import type { GameState, GroupId, PaNote } from './types.ts';

export const DATE_CHANGE_CREDIBILITY = -0.03;
const SHORT_DATE_DAYS = 3;
const SHORT_DATE_TRUST = 1;

export function setPromiseDate(s: GameState, id: number, day: number | null): PaNote[] {
  const p = s.promises.find((pr) => pr.id === id);
  if (!p || !canDate(p)) return [];
  const notes: PaNote[] = [];
  const firstChoice = p.dateSource === 'default';
  const same = day === null ? p.when === 'if_elected' : p.deadlineDay === day;
  if (same && !firstChoice) return [];

  if (day === null) {
    p.when = 'if_elected';
    p.deadlineDay = null;
  } else {
    p.when = 'during_campaign';
    p.deadlineDay = day;
  }
  p.dateSource = 'player';

  if (firstChoice) {
    const short = day !== null && day - s.clock.day <= SHORT_DATE_DAYS;
    const trust: Partial<Record<GroupId, number>> = {};
    if (short) for (const g of p.beneficiaries) trust[g] = SHORT_DATE_TRUST;
    record(s, {
      actor: 'player',
      kind: 'promiseDated',
      issue: p.issue,
      promiseId: p.id,
      effect: { trust },
    });
  } else {
    p.dateChanges = (p.dateChanges ?? 0) + 1;
    record(s, {
      actor: 'player',
      kind: 'promiseDateChanged',
      issue: p.issue,
      promiseId: p.id,
      effect: { credibility: DATE_CHANGE_CREDIBILITY },
    });
    notes.push({ day: s.clock.day, kind: 'promiseDateChanged', issue: p.issue });
  }
  if (day === null) checkInflation(s, p);
  return notes;
}
