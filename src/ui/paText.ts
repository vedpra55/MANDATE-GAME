/**
 * Turns the engine's structured notes, stories and end-card deciders into sentences.
 * The engine never produces text; this keeps the game translatable.
 */
import type { Address, Decider, PaNote, Story } from '../engine/types.ts';
import { headlines } from './content.ts';
import { strings as S } from './strings.ts';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function addressWord(a: Address): string {
  return a === 'didi' ? 'Didi' : 'Bhaiya';
}

export function noteText(n: PaNote, address: Address): string {
  const A = addressWord(address);
  switch (n.kind) {
    case 'welcome':
      return `${A}, nomination is done! 21 days. Rajendra Babu's family is handing out sweets. They think nobody can beat them.`;
    case 'groupShift':
      return `${A}, ${S.groups[n.group]} are ${n.up ? 'warming to you' : 'cooling'}: ${S.bands[n.band]}.`;
    case 'tolaShift':
      return `${A}, ${S.tolas[n.tola]} is ${n.up ? 'warming to you' : 'cooling'}: ${S.bands[n.band]}.`;
    case 'confused':
      return `${A}, log samjhe nahi aap kya keh rahe the. People didn't understand what you meant.`;
    case 'noEffect':
      return `Nobody really reacted to that, ${A}.`;
    case 'promiseNoted':
      return `I've written it in the bahi-khata: ${S.issues[n.issue]}${n.deadlineDay ? `, by day ${n.deadlineDay}` : ', if we win'}.`;
    case 'promiseKept':
      return `${n.tola ? S.tolas[n.tola] : 'The village'} saw you keep your word on ${S.issues[n.issue]}. "Isne kaha tha, aur kiya."`;
    case 'promiseBroken':
      return `${A}, the ${S.issues[n.issue]} promise${n.tola ? ` in ${S.tolas[n.tola]}` : ''} has passed its day. People noticed.`;
    case 'deadlineSoon':
      return `The ${S.issues[n.issue]} promise is due ${n.daysLeft === 0 ? 'today' : `in ${n.daysLeft} day${n.daysLeft === 1 ? '' : 's'}`}.`;
    case 'heatWarning':
      return `Careful, ${A}. People are complaining to the block office about you.`;
    case 'notice':
      return `A notice has come from the Election Commission, ${A}.`;
    case 'fir':
      return `An FIR has been filed. Tomorrow morning we have to go to the police station.`;
    case 'giftsFilmed':
      return `${A}… someone filmed the money in ${S.tolas[n.tola]}. It's on every phone.`;
    case 'divisive':
      return `${A}… what you said will not be forgotten. Not by anyone.`;
    case 'cadreUnpaid':
      return `The workers haven't had tea money. They're grumbling.`;
    case 'rivalMove':
      return S.rivalMoves[n.move](n.tola ? S.tolas[n.tola] : '', n.issue ? S.issues[n.issue] : '');
    case 'silence':
      return `Campaigning is over, ${A}. Only quiet visits today.`;
    case 'lastNight':
      return `${A}… envelopes are going round in ${S.tolas[n.tola]} tonight. Rajendra Babu's people.`;
    case 'pollingDay':
      return `Polling day. Nothing more to say, ${A}. Let's see who comes out.`;
  }
}

export function storyHeadline(st: Story): string {
  const t = st.tola ? S.tolas[st.tola] : 'the village';
  const i = st.issue ? S.issues[st.issue] : '';
  switch (st.kind) {
    case 'quiet':
      return headlines[(st.day - 1) % headlines.length]!;
    case 'statement':
      return i
        ? `New candidate speaks out on ${i}`
        : 'New candidate makes the rounds of the tea stalls';
    case 'visit':
      return `New candidate goes door to door in ${t}`;
    case 'publicWorks':
      return `New candidate fixes ${i} in ${t} with own money`;
    case 'giftsFilmed':
      return `Video: cash handed out in ${t}`;
    case 'promiseBroken':
      return `Candidate's ${i} promise lapses`;
    case 'promiseKept':
      return `Promise kept: ${i} in ${t}`;
    case 'divisive':
      return "Candidate's remarks spark anger across the village";
    case 'notice':
      return 'Election Commission issues notice to candidate';
    case 'fir':
      return 'FIR filed against new candidate';
    case 'rivalSweets':
      return `Old family distributes sweets in ${t}`;
    case 'rivalRally':
      return 'Rajendra Babu draws a big crowd';
    case 'rivalAttack':
      return "Rajendra Babu questions the newcomer's promises";
    case 'rivalLastNight':
      return `Late-night cash in ${t}, villagers allege`;
    case 'pollingDay':
      return 'The village votes today';
  }
}

export function deciderText(d: Decider): string {
  const t = d.tola ? S.tolas[d.tola] : 'the village';
  const i = d.issue ? S.issues[d.issue] : '';
  const day = `day ${d.day}`;
  switch (d.kind) {
    case 'declaration':
      return 'Your first words';
    case 'statement':
      return i ? `Your statement on ${i} (${day})` : `Your statement on ${day}`;
    case 'visit':
      return `Going door to door in ${t} (${day})`;
    case 'publicWorks':
      return `Fixing ${i} in ${t} (${day})`;
    case 'gifts':
      return `Cash handed out in ${t} (${day})`;
    case 'giftsFilmed':
      return `The video of cash in ${t}`;
    case 'recruit':
      return `Recruiting workers in ${t}`;
    case 'promiseKept':
      return `Keeping your ${i} promise`;
    case 'promiseBroken':
      return `Breaking your ${i} promise`;
    case 'divisive':
      return `Your divisive remarks (${day})`;
    case 'notice':
      return 'The Election Commission notice';
    case 'fir':
      return 'The FIR';
    case 'communalTension':
      return 'Communal tension in the village';
    case 'cadreUnpaid':
      return 'Unpaid workers';
    case 'rivalDoorToDoor':
      return `Rajendra Babu's door-to-door in ${t}`;
    case 'rivalSweets':
      return `Rajendra Babu's sweets in ${t}`;
    case 'rivalCounterIssue':
      return `Rajendra Babu taking up ${i}`;
    case 'rivalAttack':
      return 'Rajendra Babu attacking your broken promise';
    case 'rivalMock':
      return 'Rajendra Babu mocking your promises';
    case 'rivalRally':
      return "Rajendra Babu's rally";
    case 'rivalLastNight':
      return `Rajendra Babu's envelopes in ${t}`;
  }
}

export { cap };
