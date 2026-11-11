# v1.1 plan: fixes and depth from the first playtest

Written 2026-11-11 after the owner's playtest of v1. Nothing new (rally, chaupal, scandal) is built
until these are done.

> **Status: built (2026-11-11).** A–F are done; how each was built, with numbers, is in
> `docs/ENGINE.md` §18. The player guide is `docs/GUIDE.md` (also in the game: "How to play" on the
> title screen and the "Kaise khelein?" note on the desk).

---

## 0. What the playtest found, and why

| #   | Owner's note                                                                                                                             | Root cause (checked in code)                                                                                                                                                                                                                                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bug | Sonu Bhaiya keeps asking about the kiln although I answered several times; the diary still says "you have said nothing yet"              | Only a clear **side** or a **believed** win-win is written to your public record. A compromise that people didn't believe (credibility below 0.75 or too vague) was silently counted as a dodge and **not recorded**. The rival only skips fault lines you have a recorded side on, so he asks the same question again every 3–4 days, and the diary keeps saying "nothing yet". |
| Bug | "Staying silent on the brick kiln" appears twice on the end card                                                                         | The question only shows as a badge on the phone and is due the same day, so it is easy to miss. Two separate silences also appear as two identical lines.                                                                                                                                                                                                                        |
| 1   | The opponent is invisible. In real life he promises the same things: "Sonu Bhaiya bhi yahi bole hai". A real player has to offer _more_. | The rival's moves only change numbers. He never makes promises, and voters don't compare you with him.                                                                                                                                                                                                                                                                           |
| 3   | Promise deadlines are set automatically; I want to decide when                                                                           | When no date is stated, the engine picks 3, 7 or 14 days by cost.                                                                                                                                                                                                                                                                                                                |
| 4   | No memory: I visit a tola several times and people reply almost the same way every time                                                  | The voices prompt gets only the current statement, no history: what you said before, what you built, what the rival did there, what they said last time.                                                                                                                                                                                                                         |
| 5   | Too few things to do. Sonu distributes sweets but I can't; I want to organise, play with children, debate                                | Only 5 verbs exist (statement, door to door, works, money, recruit).                                                                                                                                                                                                                                                                                                             |
| 6   | Ending the day by hand is tedious                                                                                                        | The calendar must be torn even when no slots are left.                                                                                                                                                                                                                                                                                                                           |

---

## A. Fix the question loop (bug, first)

1. **Record every public answer, including dodges.** The stance record keeps what you last said,
   with its quality:
   - side A or side B
   - a compromise (believed / **not yet believed**)
   - a dodge

   The diary then shows it plainly, for example _"The brick kiln: you offered a compromise
   (filters + jobs). People don't believe it yet."_

2. **A clear verdict after every answer.** The phone shows Pintu's reading right away: _"Priya
   reported: you sided with the jobs"_, or _"…they think it's hot air; deliver something and
   they'll believe you."_
3. **The rival doesn't ask the same question twice.** Once you have answered a fault line in any
   way, he moves on:
   - a dodge or a disbelieved compromise becomes his _attack material_ ("he still won't say"),
     an ordinary rival move, not a new question
   - a new question needs a different fault line, or a contradiction you made
   - at most one question per fault line per game
4. **Questions you can't miss.** The next morning, Pintu opens the phone himself ("Priya is
   waiting for your answer"). The answer is due by the **end of the next day**, not the same day.
5. **The end card groups repeated causes:** _"Staying silent on the brick kiln (twice), about 67
   votes"_.

## B. You decide the promise date

1. When the AI (or the keyword reader) finds a promise with **no date in your words**, a slip
   appears in the bahi-khata: Pintu asks _"Kab tak, bhaiya?"_ You pick a day on a small calendar
   strip, between tomorrow and the last campaign day, or **"after I win"**. Choosing a date is not
   speech, so a picker is fine here.
2. **If your words contain a date** ("do hafte mein", "by Holi"), it is used, and the slip shows it
   so you can see what you committed to.
3. **Changing a date later is public:** credibility −0.03, and Pintu warns you. People noticed.
4. Short dates are believed more (a small bonus) and are riskier. "After I win" costs nothing now
   but adds to promise inflation.

## C. The opponent you can see (the owner's #1)

**The rival campaigns like a person.** He makes promises of his own, and voters compare you with him.

1. **The rival's promises.** Each day he promises something in the tolas he visits, usually their
   top grievance, at his archetype's level of detail:
   - **Dynast:** "the old family will look after you"
   - **Firebrand:** big promises
   - **Technocrat:** specific ones

   These are stored in a rival ledger (`rival.promises`: tola, issue, how specific).

2. **"Sonu Bhaiya bhi yahi bole the."** When you promise the same issue in a tola where he already
   did, your words count only if you **go further**. Decide gets a new question, _"Compared with
   what the rival already promised here (given), does this statement offer something more
   concrete, credible or different?"_, scored 0–3.
   - **Generic me-too** (no more concrete than his): the effect drops to about 40%, and the
     villagers say _"Sonu Bhaiya bhi yahi bole the."_
   - **Going further** (a date, a cost, a how, or proof such as work you already finished on that
     issue): full effect, plus a bonus for out-bidding him.
   - **First to promise** an issue in a tola: a small first-mover bonus, so the race matters.

   This applies to **general issue promises** (education, roads, water…). Fault-line positions
   and personal actions stay as they are.

3. **His day is visible:**
   - **The map** shows a small pin where his people were today, with his promise on a paper tag
     ("Sonu Bhaiya: coaching centre").
   - **Pintu's diary** gets a "What Sonu Bhaiya did" line every morning.
   - **The newspaper** carries his promises in a side column.
4. **He reacts to you:** when you out-bid him, he may raise his offer the next day (bigger and
   vaguer, which feeds his own promise inflation), or attack your record instead.
5. **Proof beats promises:** if you have already delivered works on an issue, the me-too discount
   never applies there ("isne to kaam karke dikhaya").

## D. Memory and better voices (#4)

1. **Each tola remembers you.** A small ledger per tola (code, not AI) keeps:
   - your visits and what you said (the last 3 summaries)
   - promises made there, kept and broken
   - works built
   - your stance on its fault lines
   - the rival's visits and promises there
   - the last quotes people said
2. **Named residents.** Each tola gets 3–4 recurring people, built from the 48 portraits, each with
   a short identity ("Ramdeo kaka, 70, farmer, proud"). Reactions come from _them_, so the same
   faces return and remember.
3. **A stronger voices prompt.** It receives that tola's memory and must:
   - refer to it when it matters ("Pichhli baar bhi aap yahi bole the", "Handpump ab to chal raha
     hai, shukriya")
   - avoid repeating its last quotes (we pass them in)
   - vary the speakers
   - react to the rival comparison from C ("Sonu Bhaiya bhi yahi bole the")
4. **Repetition has a voice.** When the engine's diminishing returns apply, the facts say so, and
   villagers notice it: _"Aap yeh pehle bhi keh chuke ho."_
5. **Option:** in Settings, switch the voices task from `gpt-6-luna` to `gpt-6.1-terra` for
   richer writing (already supported).

## E. More to do: organise, meet, play, argue (#5)

New verbs, each priced in slots and money, with free text wherever you speak. All of them go
through the same engine rules: presence, repetition, the rival comparison, and fault lines.

| Verb                                               | Where                    | Cost                     | What it does                                                                                                                                    |
| -------------------------------------------------- | ------------------------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chai pe charcha**                                | Chowk / any tola         | 1 slot, ₹300             | A small group conversation (free text). Listening reveals more than door to door; strong with youth and traders.                                |
| **Nukkad sabha** (street meeting)                  | Any tola                 | 2 slots, ₹2,000          | You organise a meeting and give a short speech (free text): a mini-rally, bigger audience than door to door. Needs 3+ workers to gather people. |
| **Play cricket with the youth / visit the school** | Naya tola ground, school | 1 slot                   | Presence with youth and families; listening about jobs and education. Free text optional.                                                       |
| **Sit with an elder / the SHG / the graduate**     | Their tola               | 1 slot                   | One-to-one with a named opinion leader (free text). Win them and their group hears it through them.                                             |
| **Shramdaan** (clean-up with your workers)         | Any tola                 | 1 slot, needs 5+ workers | Visible work at no cost; builds workers' loyalty; small grievance relief (lanes, drains, pond edge).                                            |
| **Tea and sweets** at your meeting                 | With a sabha             | ₹1,000–3,000             | Legal hospitality: small mood gain, no heat (unlike cash for votes). Matches what the rival does.                                               |
| **Challenge the rival to a debate**                | Chowk                    | 2 slots, once            | Both speak (you in free text, him in AI voice); Decide judges who convinced which groups. High risk, high reward. _(Built last in this list.)_  |

Each tola card shows only the verbs that fit its landmarks (school in Purvi tola, the ground in
Naya tola, the pond in Pokhar tola, the chowk in the Bazaar). The rival draws on the same set, so
what he does is something you could also do.

## F. The day ends by itself (#6)

1. When the last slot is used and nothing is waiting (no unsent text, no question, no call), the
   day ends after about **3 seconds**: dusk falls on the desk, the calendar page tears itself,
   and the next morning Pintu shows what happened overnight.
2. **The wait is cancelled** if you open anything. You can still tear the page early by hand.
3. A **Settings** switch turns auto-advance off.

---

## Order of work

| Step  | Content                                                                                                                          | Why this order                                     |
| ----- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **1** | A (question loop) + F (auto day end)                                                                                             | Bugs and friction first; small                     |
| **2** | B (promise dates)                                                                                                                | Small; touches the promise ledger before C uses it |
| **3** | C (visible opponent, me-too rule)                                                                                                | The owner's main point; changes balance            |
| **4** | D (memory, named residents, better voices)                                                                                       | Builds on C's rival memory                         |
| **5** | E (new verbs; debate last)                                                                                                       | Biggest; uses everything above                     |
| **6** | Rebalance (`npm run sim` with new bots: the me-too promiser, the out-bidder), then a full browser game with the AI on, then docs | Make sure the challenge holds                      |

**Testing for every step:**

- engine tests for the new rules (no repeated question, recorded dodges, me-too discount,
  out-bidding, deadline choice)
- a browser check at 1366×768
- a few real AI calls to confirm the new questions read Hinglish correctly

## Out of scope until this is done

The rally with a live crowd, chaupal hearings, the scandal and the press interview with a timer,
and real Census and election data. The nukkad sabha (E) is a small first step toward the rally.
