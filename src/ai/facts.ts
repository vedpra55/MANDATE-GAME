/**
 * What the AI voices are allowed to know about a statement: the engine's verdicts in words,
 * never numbers, and never the player's words if moderation flagged them (CLAUDE.md §7).
 */
import { GROUPS, type GameState, type GroupId, type Statement } from '../engine/types.ts';
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
  const reactions = top.map(([g, d]) => {
    const score = reading?.reactions[g]?.score ?? (d > 0.5 ? 3 : d < -0.5 ? 1 : 2);
    return {
      who: `${S.groups[g]}${st.tola ? ` in ${S.tolas[st.tola]}` : ''}`,
      verdict: VERDICT[Math.max(0, Math.min(4, Math.round(score)))]!,
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
  };
}
