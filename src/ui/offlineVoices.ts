/**
 * Quotes when the AI is off: the same named residents and the same memory rules, in short
 * Hinglish lines picked by code. Less varied than the AI, but people still remember.
 */
import { voiceFacts } from '../ai/facts.ts';
import { tolaMemory } from '../engine/residents.ts';
import type { GameState, Statement } from '../engine/types.ts';
import { strings as S } from './strings.ts';

const BY_VERDICT: Record<string, string[]> = {
  offended: ['Aisi baat sunne nahi aaye the.', 'Yeh kya bol rahe ho? Hum yaad rakhenge.'],
  unconvinced: [
    'Bolne se kya hota hai? Karke dikhao.',
    'Sab yahi kehte hain. Kaam kab hoga?',
    'Pehle bhi bahut log aaye, bahut bole.',
  ],
  indifferent: [
    'Dekhenge. Chunav ke time sab aate hain.',
    'Theek hai. Abhi kuch keh nahi sakte.',
    'Hmm. Aur kuch?',
  ],
  encouraged: [
    'Baat to sahi hai. Dekhte hain kitna karte ho.',
    'Pehli baar kisi ne yeh poocha.',
    'Achha laga sunke. Ab nibhana bhi.',
  ],
  enthusiastic: [
    'Haan! Yahi to chahiye tha.',
    'Is baar aapke saath hain.',
    'Bas aise hi kaam karo.',
  ],
};

export function offlineQuotes(game: GameState, st: Statement): { who: string; text: string }[] {
  const facts = voiceFacts(game, st, false, game.paNotes.length);
  const rivalShort = game.rival.name.split(' ')[0]!;
  const repeating =
    st.channel === 'visit' && st.tola ? tolaMemory(game, st.tola, st).repeating : false;
  const special: string[] = [];
  if (st.compare?.meToo.length)
    special.push(`${rivalShort} bhi yahi bole the. Aap kya alag karoge?`);
  if (st.compare?.proof.length)
    special.push(`${S.issues[st.compare.proof[0]!]} ka kaam to dikha diya. Isne karke dikhaya.`);
  if (repeating) special.push('Aap yeh pehle bhi keh chuke ho.');
  if (st.compare?.outbid.length)
    special.push(`${rivalShort} sirf bolte hain, aap to tareekh bhi bata rahe ho.`);
  return facts.reactions.slice(0, 2).map((r, i) => {
    const pool = BY_VERDICT[r.verdict] ?? BY_VERDICT.indifferent!;
    const text = special[i] ?? pool[(st.id + i * 2) % pool.length]!;
    return { who: r.who, text };
  });
}
