/**
 * Turns the engine's structured notes, stories and end-card deciders into sentences.
 * The engine never produces text; this keeps the game translatable.
 */
import type { Address, Decider, FaultLineId, PaNote, Stance, Story } from '../engine/types.ts';
import { FAULT_LINE_DATA } from '../engine/world.ts';
import { headlines } from './content.ts';
import { strings as S } from './strings.ts';

export function addressWord(a: Address): string {
  return a === 'didi' ? 'Didi' : 'Bhaiya';
}

const fl = (f: FaultLineId) => S.faultLines[f].name.toLowerCase();

export function stanceLabel(f: FaultLineId, st: Stance): string {
  if (st === 'side_a') return S.faultLines[f].a;
  if (st === 'side_b') return S.faultLines[f].b;
  if (st === 'win_win') return 'A way for both sides';
  if (st === 'evasive') return 'Dodged';
  return '';
}

export function noteText(n: PaNote, address: Address, rival = 'Rajendra Babu'): string {
  const A = addressWord(address);
  switch (n.kind) {
    case 'welcome':
      return `${A}, nomination is done! 21 days. ${rival}'s people are already going house to house. They think nobody can beat them.`;
    case 'groupShift':
      return `${A}, ${S.groups[n.group]} are ${n.up ? 'warming to you' : 'cooling'}: ${S.bands[n.band]}.`;
    case 'tolaShift':
      return `${A}, ${S.tolas[n.tola]} is ${n.up ? 'warming to you' : 'cooling'}: ${S.bands[n.band]}.`;
    case 'confused':
      return `${A}, log samjhe nahi aap kya keh rahe the. People didn't understand what you meant.`;
    case 'noEffect':
      return `Nobody really reacted to that, ${A}.`;
    case 'promiseNoted':
      return n.needsDate
        ? `I've written ${S.issues[n.issue]} in the bahi-khata. Kab tak, ${A}? You didn't say when.`
        : `I've written it in the bahi-khata: ${S.issues[n.issue]}${n.deadlineDay ? `, by day ${n.deadlineDay}` : ', if we win'}.`;
    case 'promiseDateChanged':
      return `${A}, people noticed you moved the date on ${S.issues[n.issue]}. "Tareekh pe tareekh."`;
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
      return 'An FIR has been filed. Tomorrow morning we have to go to the police station.';
    case 'giftsFilmed':
      return `${A}… someone filmed the money in ${S.tolas[n.tola]}. It's on every phone.`;
    case 'divisive':
      return `${A}… what you said will not be forgotten. Not by anyone.`;
    case 'cadreUnpaid':
      return "The workers haven't had tea money. They're grumbling.";
    case 'rivalMove':
      return (
        S.rivalMoves[n.move](
          n.tola ? S.tolas[n.tola] : '',
          n.faultLine ? fl(n.faultLine) : n.issue ? S.issues[n.issue] : '',
          rival,
        ) + (n.promised && n.move !== 'counterIssue' ? S.rivalPromised(S.issues[n.promised]) : '')
      );
    case 'leader':
      return n.won === true
        ? S.verbs.leaderWon(n.name)
        : n.won === false
          ? S.verbs.leaderLost(n.name)
          : S.verbs.leaderNeutral(n.name);
    case 'debate':
      return S.verbs.debate(n.won, rival);
    case 'play':
      return S.verbs.play[n.play];
    case 'shramdaan':
      return S.verbs.shramdaan(S.tolas[n.tola]);
    case 'meToo':
      return S.compare.meToo(rival, S.issues[n.issue]);
    case 'outbid':
      return S.compare.outbid(rival, S.issues[n.issue]);
    case 'proofBeatsPromise':
      return S.compare.proof(rival, S.issues[n.issue]);
    case 'silence':
      return `Campaigning is over, ${A}. Only quiet visits today.`;
    case 'lastNight':
      return `${A}… envelopes are going round in ${S.tolas[n.tola]} tonight. ${rival}'s people.`;
    case 'pollingDay':
      return `Polling day. Nothing more to say, ${A}. Decide who goes to which booth.`;
    case 'stanceTaken':
      return n.stance === 'evasive'
        ? `${A}, on ${fl(n.faultLine)} people heard you dodge it. Both sides noticed.`
        : n.stance === 'win_win'
          ? `${A}, on ${fl(n.faultLine)} you offered a way for both. Now it has to happen, or both will turn.`
          : `${A}, on ${fl(n.faultLine)} you've chosen: "${stanceLabel(n.faultLine, n.stance)}". One side is happy. The other won't forget.`;
    case 'notBelieved':
      return `${A}, on ${fl(n.faultLine)} people didn't believe it. Too vague, or they don't trust us yet. They heard a dodge.`;
    case 'contradiction':
      return `${A}! On ${fl(n.faultLine)} you said one thing before and the opposite now. Everyone is repeating both.`;
    case 'learned': {
      const parts = [
        ...n.issues.map((i) => S.issues[i]),
        ...n.faultLines.map((f) => `a fight over ${fl(f)}`),
      ];
      return `In ${S.tolas[n.tola]} I learned: ${parts.join(', ')}.`;
    }
    case 'wedge':
      return `${A}, ${rival} is asking about ${fl(n.faultLine)} in public. Priya wants your answer today. Check the phone.`;
    case 'silent':
      return `${A}, we didn't answer on ${fl(n.faultLine)}. The paper calls it silence. Both sides are angry.`;
    case 'neglect':
      return `${A}, ${S.tolas[n.tola]} says: "Woh to kabhi aaye hi nahi." ${rival}'s people were there.`;
    case 'worksStarted':
      return `Work has started in ${S.tolas[n.tola]}. The contractor says day ${n.dueDay}.`;
    case 'worksDone':
      return `The work in ${S.tolas[n.tola]} is finished. People can see it.`;
    case 'worksLate':
      return `${A}, the work in ${S.tolas[n.tola]} is late. The contractor says two more days.`;
    case 'donorCall':
      return `${A}, an unknown number keeps calling. Some contractor. Check the phone.`;
    case 'donorDemand':
      return `${A}… Mahesh-ji wants something for his money. Check the phone.`;
    case 'donorResult':
      return n.result === 'refused'
        ? `You said no to Mahesh-ji. He went straight to ${rival}.`
        : n.result === 'angry'
          ? `Mahesh-ji is angry. He is telling everyone about the money he gave you.`
          : `The money is in the tin. And Mahesh-ji's favour is in the bahi-khata.`;
    case 'favourLeaked':
      return `${A}… people know about Mahesh-ji's money. It's in every tea stall.`;
    case 'boothsUnmanned':
      return `${n.count} booth${n.count === 1 ? ' has' : 's have'} nobody of ours. We'll lose votes there.`;
  }
}

export function storyHeadline(st: Story, rival = 'Rajendra Babu'): string {
  const t = st.tola ? S.tolas[st.tola] : 'the village';
  const i = st.issue ? S.issues[st.issue] : '';
  const f = st.faultLine ? S.faultLines[st.faultLine].name : '';
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
    case 'worksDone':
      return `New candidate fixes ${i || 'a long-standing problem'} in ${t} with own money`;
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
      return `${rival}'s people distribute sweets in ${t}`;
    case 'rivalRally':
      return `${rival} draws a big crowd`;
    case 'rivalAttack':
      return `${rival} questions the newcomer's promises`;
    case 'rivalLastNight':
      return `Late-night cash in ${t}, villagers allege`;
    case 'pollingDay':
      return 'The village votes today';
    case 'stance':
      return st.stance === 'win_win'
        ? `${f}: candidate proposes a way out for both sides`
        : `${f}: candidate takes a side`;
    case 'dodge':
      return `Candidate dodges the ${f.toLowerCase()} question`;
    case 'contradiction':
      return `${f}: candidate says one thing, then the opposite`;
    case 'wedge':
      return `${rival} asks: where does the newcomer stand on ${f.toLowerCase()}?`;
    case 'silent':
      return `${f}: candidate stays silent`;
    case 'solution':
      return `${f}: the promised compromise is built`;
    case 'favourLeaked':
      return "Contractor's money in the new candidate's campaign";
  }
}

export function deciderText(d: Decider, rival = 'Rajendra Babu'): string {
  const t = d.tola ? S.tolas[d.tola] : 'the village';
  const i = d.issue ? S.issues[d.issue] : '';
  const f = d.faultLine ? S.faultLines[d.faultLine].name.toLowerCase() : '';
  const day = `day ${d.day}`;
  switch (d.kind) {
    case 'declaration':
      return 'Your first words';
    case 'statement':
      return i ? `Your statement on ${i} (${day})` : `Your statement on ${day}`;
    case 'visit':
      return `Going door to door in ${t} (${day})`;
    case 'publicWorks':
    case 'worksStarted':
      return `Fixing ${i || 'things'} in ${t} (${day})`;
    case 'worksDone':
      return `Finishing the work in ${t}`;
    case 'solutionDelivered':
      return `Delivering your compromise on ${f}`;
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
    case 'chai':
      return `Chai pe charcha in ${t} (${day})`;
    case 'sabha':
      return `Your nukkad sabha in ${t} (${day})`;
    case 'sweetsShared':
      return `Tea and sweets in ${t}`;
    case 'play':
      return `Time with the young and the school in ${t}`;
    case 'leaderMet':
      return `Sitting with the elder in ${t} (${day})`;
    case 'leaderWon':
      return `Winning over the opinion leader in ${t}`;
    case 'shramdaan':
      return `Shramdaan in ${t}`;
    case 'debate':
      return `The debate with ${rival}`;
    case 'promiseDated':
      return `Giving a date for ${i}`;
    case 'promiseDateChanged':
      return `Moving the date on ${i}`;
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
    case 'stance':
      return d.stance === 'win_win'
        ? `Offering a way for both on ${f}`
        : `Your side on ${f}: "${stanceLabel(d.faultLine!, d.stance!)}"`;
    case 'evasion':
      return `Dodging ${f} (${day})`;
    case 'contradiction':
      return `Saying two things on ${f}`;
    case 'silence':
      return `Staying silent on ${f}`;
    case 'neglect':
      return `Neglecting ${t}`;
    case 'donorAccepted':
      return "Taking Mahesh-ji's money";
    case 'donorRefused':
      return "Refusing Mahesh-ji's money";
    case 'favourLeaked':
    case 'donorAngry':
      return "Mahesh-ji's money coming out";
    case 'rivalWedge':
      return `${rival} raising ${f}`;
    case 'rivalDoorToDoor':
      return `${rival}'s door-to-door in ${t}`;
    case 'rivalSweets':
      return `${rival}'s sweets in ${t}`;
    case 'rivalCounterIssue':
      return `${rival} taking up ${i}`;
    case 'rivalAttack':
      return `${rival} attacking your broken promise`;
    case 'rivalMock':
      return `${rival} mocking your promises`;
    case 'rivalAttackDodge':
      return `${rival} saying you won't take a stand on ${f}`;
    case 'rivalPromise':
      return `${rival} promising ${i} in ${t}`;
    case 'rivalRaise':
      return `${rival} raising his offer on ${i}`;
    case 'rivalDoubt':
      return `${rival} calling your compromise hot air`;
    case 'rivalRally':
      return `${rival}'s rally`;
    case 'rivalLastNight':
      return `${rival}'s envelopes in ${t}`;
  }
}

export function solutionLabel(f: FaultLineId): string {
  return `${S.faultLines[f].name}: ${FAULT_LINE_DATA[f].describe.winWin.replace(/^a concrete (plan|arrangement|sharing plan|transparency plan) (that serves both sides|both can accept)?,? ?(e\.g\. )?/, '')}`;
}
