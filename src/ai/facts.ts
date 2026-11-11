/**
 * What the AI voices are allowed to know about a statement: the engine's verdicts in words,
 * never numbers, and never the player's words if moderation flagged them (CLAUDE.md §7).
 */
import { GROUPS, type GameState, type GroupId, type Statement } from '../engine/types.ts';
import { speakerFor, tolaMemory } from '../engine/residents.ts';
import { FAULT_LINE_DATA } from '../engine/world.ts';
import { noteText, addressWord } from '../ui/paText.ts';
import { strings as S } from '../ui/strings.ts';

const VERDICT = ['offended', 'unconvinced', 'indifferent', 'encouraged', 'enthusiastic'];

export function voiceFacts(
  s: GameState,
  st: Statement,
  flagged: boolean,
  notesBefore: number,
): import('./contract.ts').VoiceFacts {
  const entry = s.log.find(
    (e) =>
      e.statementId === st.id &&
      (e.kind === 'statement' || e.kind === 'visit' || e.kind === 'declaration'),
  );
  const trust = entry?.effect.trust ?? {};
  const reading = st.reading;
  const top = (Object.entries(trust) as [GroupId, number][])
    .filter(([g]) => GROUPS.includes(g))
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 2);
  const taken = new Set<string>();
  const reactions = top.map(([g, d]) => {
    const score = reading?.reactions[g]?.score ?? (d > 0.5 ? 3 : d < -0.5 ? 1 : 2);
    const verdict = VERDICT[Math.max(0, Math.min(4, Math.round(score)))]!;
    const r = speakerFor(s, g, st.tola, taken);
    if (!r) return { who: S.groups[g], about: 'a villager', verdict };
    taken.add(r.id);
    return {
      who: r.name,
      about: `${r.age}, ${r.about}, lives in ${S.tolas[r.tola]}`.slice(0, 160),
      verdict,
    };
  });
  const stances = s.log
    .filter((e) => e.statementId === st.id && (e.kind === 'stance' || e.kind === 'evasion'))
    .map(
      (e) =>
        `${e.kind === 'evasion' ? 'dodged' : e.stance === 'win_win' ? 'offered a compromise on' : 'took a side on'} ${FAULT_LINE_DATA[e.faultLine!].describe.topic.split(':')[0]}`,
    );
  const where =
    st.channel === 'visit' && st.tola
      ? `went door to door in ${S.tolas[st.tola]}`
      : st.channel === 'answer'
        ? 'answered a public question'
        : 'made a statement in the paper';
  const issues = st.issues.map((i) => S.issues[i]).join(', ');
  return {
    address: addressWord(s.player.address),
    language: reading?.language ?? 'hinglish',
    candidateSaid: flagged ? null : st.text,
    summary:
      `The candidate ${where}${issues ? ` about ${issues}` : ''}${stances.length ? `; ${stances.join('; ')}` : ''}${flagged ? '; the words were hurtful to others' : ''}.`.slice(
        0,
        400,
      ),
    reactions,
    paFacts: s.paNotes
      .slice(notesBefore)
      .slice(0, 3)
      .map((n) => noteText(n, s.player.address, s.rival.name)),
    ...memoryFacts(s, st),
  };
}

/** What the place remembers, in plain words for the voices (never numbers). */
export function memoryFacts(s: GameState, st: Statement): { memory: string[]; avoid: string[] } {
  const rival = s.rival.name;
  const rivalShort = rival.split(' ')[0]!;
  const memory: string[] = [];
  const avoid: string[] = [];
  const cmp = st.compare;
  if (cmp?.meToo.length)
    memory.push(
      `${rival} already promised the same (${cmp.meToo.map((i) => S.issues[i]).join(', ')}) and the candidate offered nothing more: someone says "${rivalShort} bhi yahi bole the" in their own words.`,
    );
  if (cmp?.outbid.length)
    memory.push(
      `${rival} promised ${cmp.outbid.map((i) => S.issues[i]).join(', ')} too, but the candidate went further (more concrete); people notice the difference.`,
    );
  if (cmp?.proof.length)
    memory.push(
      `The candidate already built works on ${cmp.proof.map((i) => S.issues[i]).join(', ')}; people contrast that with mere promises ("isne to kaam karke dikhaya").`,
    );
  if (st.channel === 'visit' && st.tola) {
    const m = tolaMemory(s, st.tola, st);
    if (m.repeating)
      memory.push(
        'The candidate is repeating what they already told this tola a few days ago: someone says "aap yeh pehle bhi keh chuke ho".',
      );
    if (m.visits.length)
      memory.push(
        `Earlier visits here: ${m.visits.map((v) => `day ${v.day}: "${v.text}"`).join('; ')}.`.slice(
          0,
          300,
        ),
      );
    if (m.promises.length)
      memory.push(
        `Promises made to this tola: ${m.promises
          .map(
            (p) =>
              `${S.issues[p.issue]} (${p.status === 'open' ? (p.deadlineDay ? `due day ${p.deadlineDay}` : 'if elected') : p.status})`,
          )
          .join(', ')}.`,
      );
    if (m.works.length)
      memory.push(
        `Works here: ${m.works
          .map(
            (w) =>
              `${w.faultLine ? S.faultLines[w.faultLine].name : w.issue ? S.issues[w.issue] : 'works'} ${w.done ? '(finished, people use it)' : '(still being built)'}`,
          )
          .join(', ')}.`,
      );
    if (m.rival.visitedDay !== null || m.rival.promised.length)
      memory.push(
        `${rival} ${m.rival.visitedDay !== null ? `campaigned here on day ${m.rival.visitedDay}` : 'has people here'}${m.rival.promised.length ? ` and promised ${m.rival.promised.map((i) => S.issues[i]).join(', ')}` : ''}.`,
      );
    for (const q of m.lastQuotes) avoid.push(q.text.slice(0, 240));
  } else {
    const kept = s.promises.filter((p) => p.status === 'kept').length;
    const broken = s.promises.filter((p) => p.status === 'broken').length;
    if (kept || broken)
      memory.push(
        `So far the candidate has kept ${kept ? 'some' : 'no'} promises and broken ${broken ? 'some' : 'none'}.`,
      );
    for (const q of s.statements.slice(-4, -1).flatMap((x) => x.voices?.quotes ?? []))
      avoid.push(q.text.slice(0, 240));
  }
  return { memory: memory.slice(0, 8), avoid: avoid.slice(-6) };
}
