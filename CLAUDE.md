# MANDATE — Project Brief

> **Working title:** MANDATE
> **Tagline:** *Every vote has a price.*
> **One-liner:** An AI-driven political career game set in India. You start as a village sarpanch candidate and try to rise to Prime Minister, and every shortcut you take along the way comes back to collect.

This file is the single source of truth for the project. Read it fully before doing any work. When a decision changes, update the **Decisions Log** at the bottom.

---

## 1. Vision

MANDATE is **not** a 3D game and **not** a classic 2D game. It is a **real-life simulation told through the physical objects of a politician's world**: a desk, a ringing phone, a ledger, tomorrow's newspaper, a constituency map pinned to the wall.

The player **writes their own speeches and statements in free text** (English, Hindi or Hinglish). AI characters (voters, journalists, rivals, donors) react to what the player actually said. The world is grounded in **real public data** about the chosen region.

### Core theme: "What does power cost you?"
Every system feeds this theme. A businessman's money, a party worker's crime, the divisive speech that won a rally: each is a debt that comes due later. Players should finish a career either proud of it or a little ashamed, and the game should show exactly which choices led there.

### Design pillars
1. **Your words are the controller.** Free-text statements, never multiple choice, for anything that is "speech."
2. **Consequences compound.** Promises, favours and scandals are tracked forever and resurface.
3. **Diegetic UI.** No app-style menus, no HUD bars. Every system is a physical object in the world.
4. **Uncertainty is real.** Polls show ranges, not exact numbers. Exact numbers appear only on counting day.
5. **Grounded in real India, populated by fictional people.** Real geography and real public data. Fictional politicians, parties and symbols.

---

## 2. The golden architecture rule

> **AI plays the people. Code keeps the score.**

LLMs are bad at consistently tracking money, time and consequences, and they can be talked into anything. So:

- All hard state (cash, trust per bloc, legal heat, ledgers, days) lives in **deterministic TypeScript game logic**.
- AI calls return **structured, schema-validated output** (OpenAI Structured Outputs / JSON schema) describing *intent and classification*, never "+5 votes."
- The game engine applies effects using its own rules and numbers.
- A player must never be able to prompt-inject their way to victory. Treat all player text as **data**, never as instructions to the model.

### Two AI roles
| Role | Job | Output |
|---|---|---|
| **Judge** (fast, structured) | Interpret speeches, score bloc reactions, decide rival moves, pick events, flag risky content | Strict JSON matching a schema |
| **Voice** (dialogue) | Journalist questions, voter quotes, donor phone calls, newspaper headlines, PA whispers | Short text, constrained by state passed in |

Use OpenAI models for both. Pick a small, fast model for Judge calls and per-voter chatter, and a stronger model only for key characters (rival, senior journalist). Check current OpenAI docs for model names; don't hardcode assumptions.

---

## 3. The career ladder

Each tier adds a **new system**, not just bigger numbers, so the game teaches itself.

| Tier | Electorate | New system introduced | Feel |
|---|---|---|---|
| **1. Gram Panchayat — Sarpanch** | ~1–5k voters | Relationships, grievances, free-text speeches | Face to face. You know names. One family feud can swing it. |
| **2. Zila Parishad / Municipal ward** | ~20–50k | Money and donors | First real cash, first local journalist, party scouts notice you. |
| **3. MLA** | ~2–3 lakh | Party tickets, cadre, booth management | Caste and issue arithmetic, a rival who studies you. |
| **4. Minister / CM** | State | Governing: budgets, crises, coalitions | You must deliver on promises now. |
| **5. MP → PM** | National | Alliances, national narrative | Managing dozens of ambitious people below you. |

**Realism note:** in most states panchayat elections are officially non-party. Parties back candidates unofficially. Formal party tickets begin at tier 3.

**Losing is never game over.** The player enters "the wilderness": rebuild, switch party, run for a smaller seat, or become a kingmaker.

**Between elections** there is a governing term: budget allocation, surprise crises (flood, exam paper leak, factory closure, viral scandal video), donor IOUs coming due, and the promise ledger turning into a report card. How you governed becomes the anti-incumbency (or goodwill) for the next election.

---

## 4. Game state (owned by code)

```ts
type GameState = {
  day: number;                 // in-game day
  daysToPoll: number;
  slotsLeftToday: 0 | 1 | 2 | 3; // morning / afternoon / evening
  tier: 1 | 2 | 3 | 4 | 5;
  region: RegionId;

  cash: { personal: number; party?: number };
  reputation: number;          // overall public image, -100..100
  blocs: Record<BlocId, {
    trust: number;             // -100..100
    turnoutLikelihood: number; // 0..1
    keyIssues: IssueId[];
  }>;
  cadre: { size: number; loyalty: number };   // workers; drives booth turnout
  partyStanding?: number;      // high command trust (tier 3+)
  legalHeat: number;           // 0..100; thresholds trigger FIR / raid / case
  mediaNarrative: { outletId: OutletId; tone: number; storyline: string }[];

  promiseLedger: Promise[];    // every promise made, auto-extracted from speeches
  favourLedger: Favour[];      // every IOU owed to donors / allies / strongmen
  statementHistory: Statement[]; // everything the player ever said (journalists use this)

  rival: RivalState;
  events: EventLog[];
};
```

**Voter blocs** are defined by **interests and identity together** (farmers, youth, women, traders, landless labourers, specific communities, urban middle class, etc.), and each has its own issue weights. Communities are modelled as people with interests (jobs, safety, dignity, representation), **never as stereotypes**.

---

## 5. Key systems

### 5.1 Free-text statements (the heart of the game)
Pipeline for every speech, tweet, press reply or grievance response:

1. **Player writes text** in English, Hindi or Hinglish.
2. **Interpreter (Judge)** returns:
   ```ts
   {
     issues: { id: IssueId; stance: number; intensity: number }[];
     tone: "aggressive" | "emotional" | "policy" | "humble" | "evasive" | "divisive";
     promises: { text: string; issueId: IssueId; costEstimate: "low"|"med"|"high"; deadlineHint?: string }[];
     targetedBlocs: BlocId[];
     contradictsPast: { statementId: string; explanation: string }[];
     riskFlags: ("inflammatory" | "defamatory" | "factually_false" | "unconstitutional")[];
     confidence: number;
   }
   ```
3. **Engine applies effects** using each bloc's issue weights and current trust.
4. **Promises are added to the ledger** automatically.
5. **Reactions come back:** 2–3 short voter quotes, a newspaper headline, the rival's counter-move, a shifted (uncertain) poll range.

**Live crowd reaction:** during rally speeches, re-score after each completed sentence (debounced) so the crowd murmurs, claps or goes quiet *while* the player writes.

### 5.2 Donors and favours
- Money arrives with an **IOU**: "When you're in power, the highway contract goes to me."
- Stored in the favour ledger with hidden properties (how dangerous the donor is, leak likelihood).
- Once in office, the donor calls to collect. Paying angers voters if it leaks. Refusing means he funds your rival or leaks the deal himself.

### 5.3 Party
- Start independent, or beg an existing (fictional) party for a ticket at tier 3. A party brings machinery and money, but you must obey the high command.
- **Founding your own party** unlocks at tier 3+: choose ideology, name, colours and symbol, and build cadre from zero.
- Defections, breakaways and mergers happen to you and by you.

### 5.4 Scandals (party member commits a crime)
- Random events weighted by who you've recruited. A strongman brings votes **and** risk.
- The player responds in free text: defend, expel, stay silent, quietly protect. Each choice moves legal heat, bloc trust and cadre loyalty differently.

### 5.5 Press
- AI journalists with **memory and outlet bias**: a friendly channel, a hostile channel, an independent YouTuber, a local Hindi paper.
- Press conferences are free text with a reply timer. Journalists quote the player's past statements back and catch contradictions (uses `statementHistory`).

### 5.6 Opposition
- The rival is an AI agent with its own cash, blocs and strategy. It reads the player's moves and responds.
- Rival archetypes: the dynast, the firebrand, the technocrat, the local don.

### 5.7 Endings
No single "win." A career ends in a profile: the reformer, the kingmaker, the dynasty founder, the jailed ex-minister, the honest MLA who never rose higher, the PM who broke every promise. Generate a **shareable "political obituary" card** at the end.

---

## 6. Regions and real data

At game start the player picks **1 of 5 regions** with very different politics. Example set:
- a rural Bihar block
- a Punjab farming belt
- a Mumbai municipal ward
- a Kerala panchayat
- a tribal area in Jharkhand

Each region loads real public data, then an AI "region director" turns it into the opening situation (who's angry, about what, who holds power):
- Census (village-level population, literacy, occupation)
- Election Commission of India historical results and margins
- NFHS district health and development indicators
- Employment and migration data
- Current live local issues (water, roads, crop prices, unemployment, paper leaks, floods)

Store processed region data as static JSON in `/src/data/regions/`. Village and constituency names in-game can be fictionalised while the underlying numbers stay real.

---

## 7. Sensitive content rules (non-negotiable)

India's politics involves religion and caste; ignoring them would make the game fake. Handle them carefully:

- **Fictional people, fictional parties, fictional symbols.** No real politicians, no real party names.
- **Avoid real party symbols** (lotus, hand, broom, elephant, lantern, bicycle-as-symbol, etc.) and real party flag colour combinations for fictional parties.
- **Blocs are interests, not stereotypes.** AI voices from any community talk about real concerns, never caricatures. Keep visual identity markers respectful and varied *within* every bloc so appearance never maps to voting behaviour.
- **Players can attempt divisive politics, and consequences are realistic:** short-term consolidation of one bloc, Election Commission notices, communal tension events, fear affecting your own supporters, rising legal heat, other blocs turning on you permanently.
- **The AI never generates hateful content.** If player text is inflammatory, the interpreter flags it and the game shows consequences. AI characters react to it but never repeat or amplify it.
- Run a moderation pass on player text before it reaches the Voice models.

---

## 8. Look and feel

### 8.1 Diegetic UI: the screen is the politician's desk
Top-down 2D illustrated desk. Every system is an object:

| System | Object |
|---|---|
| Days left | Tear-off wall calendar (tear a page to end the day) |
| Cash | Tin box at village level → briefcase later |
| Promise and favour ledgers | Red cloth *bahi-khata* register you flip through |
| Calls, donors, threats | Old phone that rings and shakes |
| Press and narrative | Tomorrow's newspaper, folded on the desk |
| Public mood | Your PA's notebook with handwritten tallies per area |
| Constituency | Paper map pinned to the wall, with pins and string |
| Grievances | Stack of files (*janta darbar*) |

**The desk evolves with the career**; this is the progression display:
- **Sarpanch:** charpai under a neem tree, chai glass, notebook, bicycle leaning nearby
- **Ward / Zila:** small rented office, flex posters, plastic chair, one phone
- **MLA:** party office, garlanded photos, three phones, workers in the doorway
- **CM:** big wooden secretariat desk, file mountains, official car outside
- **PM:** quiet, almost empty desk

### 8.2 Scenes (leaving the desk)
1. **Constituency map:** illustrated top-down village (tolas, chowk, school, well, fields, places of worship). Subtle mood tint per area. Click an area to visit.
2. **Chaupal / visit:** villagers come one at a time with portraits (*Papers, Please* style). Each brings a grievance; respond in free text.
3. **Rally stage:** crowd seen from behind the player's shoulder; type the speech on a lectern notepad; the crowd reacts live.
4. **Press scrum:** mics in your face, reply timer, journalists quoting your past words.
5. **Counting day (the climax):** round-by-round counting, TV-style leading/trailing graphics, cadre faces, ringing phones.

### 8.3 The PA character
Your personal assistant is the tutorial and the stat interpreter. Instead of stat screens, the PA whispers in plain language: *"Bhaiya, Purvi tola is unhappy about the handpump."* Raw numbers appear only where real politicians see them: counting day.

### 8.4 Controls (desktop first)
- **Mouse = physical actions:** answer the phone, flip the register, drag files to approve/reject piles, drag workers onto booths, tear the calendar page.
- **Keyboard = your voice:** typing is the sacred act. When writing a speech the view moves to the lectern, the crowd goes quiet, and words appear in a handwriting-style font.
- **Time:** each day has 3 slots (morning, afternoon, evening); each action costs a slot. Interruptions (phone rings, reporter at the door) add pressure inside a turn-based structure.

### 8.5 Screen sizes
- Design at **1920×1080**; test at **1366×768** from day one (common Indian student laptop).
- The desk is divided into fixed **zones**: wall (calendar, map), desk surface (register, files, newspaper), edges (phone, cash, PA).
- Mobile (later): zones become swipeable "drawers," keeping the desk metaphor. Possible second mobile mode where the in-game phone *is* the whole UI.

### 8.6 Art direction
- **Style:** "hand-painted signboard meets newspaper." Flat illustration, paper/print textures, limited palette, slightly imperfect hand-drawn lines. Borrow the visual language of Indian politics: flex banners, wall paintings, painted symbols, marigold garlands, rubber stamps, carbon copies, newsprint, matchbox-label colours.
- **Not realistic art** (expensive, drifts toward real faces, dates quickly).
- **Named characters:** illustrated portraits, chest-up three-quarter view, 4 expressions each (neutral, pleased, angry, suspicious).
- **Typography:** one display face with hand-painted banner energy, one clean body face, one matching Devanagari face. Plan for Hindi from day one.
- **Sound (later):** crowd murmur, dhol, auto-rickshaw loudspeaker announcing your name, phone ring, TV news sting.

---

## 9. Asset pipeline

### Phase 0 — lock the style before mass production
1. Generate **3 style directions** for the same test scene (village desk):
   - A: hand-painted signboard, flat colour, thick lines
   - B: newspaper/print, halftone texture, muted palette
   - C: a blend
2. Pick one and write `tools/assets/style-bible.md`: palette (8–10 hex), line weight, texture, lighting (warm afternoon light from top-left, always), camera angles, banned elements.
3. Choose **3–5 golden images** → `tools/assets/references/`. Attach them as reference images to every future generation.
4. Prompt template never changes: `[STYLE BLOCK] + [ASSET DESCRIPTION] + [TECHNICAL SPEC]`.

### Image model
OpenAI image API. As of Nov 2026 the API offers **GPT-Image-2.6 Flare** (fast, for exploration) and **GPT-Image-2.6 Sunburst** (precise editing, for matching props to the master scene). Both accept reference images. Verify exact model IDs in the OpenAI docs before coding.

### Key technique: generate the scene, then rebuild it in layers
1. Generate the full desk scene as one image (the **target**).
2. Regenerate each prop individually on a transparent background, with the target attached as reference.
3. Rebuild in React: empty desk background + each prop as its own element positioned from a layout manifest, so props can animate and be clicked.

### Characters
- Generate **all 4 expressions in one 2×2 sheet** per character (consistency is far better within one image), then slice with a script.
- Village crowd for the MVP: **40–60 complete portraits** generated in batches. A modular layered face system is postponed (AI is bad at pixel alignment); build it later in SVG if needed.

### Never bake dynamic text into images
Newspapers, register pages, files and the phone screen are **blank textures**; text is live React on top. Only fixed decorative text (painted shop signs) may be baked in.

### Asset inventory (MVP)
| Category | Items | Built how | Format |
|---|---|---|---|
| Scenes | Village desk, village map, chaupal, rally stage, counting centre | Full-scene generation at 2K | WebP, 1x + 2x |
| Desk props | Phone, register, newspaper, cash tin, calendar, files, PA notebook, chai glass | Individual, transparent background | PNG → WebP |
| Named characters | Rival, PA, donor, journalist, 2–3 villagers | 2×2 expression sheets, sliced | WebP |
| Villager portraits | 40–60 | Batches | WebP |
| Crowd silhouettes | 10–15 variants | Generated, animated in code | Sprite sheet |
| UI kit | Rubber stamps (these are buttons), torn paper edges, pins, string, tape, paper cards | Hand-built or traced to SVG | SVG |
| Textures | Paper grain, newsprint, cloth, wood | Tileable | WebP |

### Per-asset checks
- No resemblance to real politicians.
- No real party symbols or flag colour combinations.
- Matches the style bible (palette, light direction, line weight).

Budget ~5–10 generations per final asset. Human picking and cleanup is the real cost.

---

## 10. Tech stack

- **Frontend:** React + Vite + TypeScript.
- **Desk, papers, text input, ledgers:** plain React DOM + CSS (text-heavy UI, typing and Devanagari rendering are much easier in the DOM). Animation with Framer Motion or CSS.
- **Map, crowds, counting-day animation:** PixiJS via `@pixi/react`.
- **State:** a pure TypeScript game engine (no React inside it) + Zustand (or similar) to bind state to the UI. Engine functions are pure and unit-tested.
- **AI:** OpenAI API (the owner has OpenAI credits). Structured Outputs with JSON schema for all Judge calls; validate again with Zod on receipt.
- **Backend:** a thin server (Node/Express or serverless functions, e.g. Vercel) that holds the OpenAI key and proxies AI calls. **Never expose API keys in the Vite frontend.**
- **Testing:** Vitest for engine logic.

### Proposed folder structure
```
/                         CLAUDE.md (this file)
/src
  /engine                 pure game logic: state, rules, effects, events, elections
  /ai                     client wrappers for Judge and Voice calls, schemas (Zod)
  /ui
    /desk                 desk scene + props
    /scenes               map, chaupal, rally, press, counting
    /components           stamps, paper cards, register, phone
  /data
    /regions              processed real data per region (JSON)
    desk-layout.json      prop positions, hotspots, z-order per tier
  /assets                 scenes/ props/ characters/ crowd/ ui/ textures/
/server                   AI proxy endpoints, prompts, moderation
/tools/assets
  style-bible.md
  style-block.txt
  references/
  manifest.json           every asset: id, prompt, size, status
  generate.mjs            reads manifest, calls OpenAI image API, saves 4 variants each
  review.html             local page to pick the best variant
  slice.mjs               cuts 2×2 character sheets
  optimize.mjs            PNG → WebP, 1x/2x, sprite sheets
```

---

## 11. MVP scope: "The Sarpanch Election"

Build only this until it's fun. If writing a speech and watching the village react doesn't feel magical, no PM-level content will save it.

- **One region**, one fictional village grounded in real data
- **21 in-game days**, 3 action slots per day
- **4–5 voter blocs**
- **One rival** (AI agent)
- **One donor offer** with an IOU
- **One scandal event**
- **Free-text speeches** with interpreter → effects → reactions
- **Live crowd reaction** at one rally
- **Village desk, village map, chaupal, rally stage, counting day**
- **Counting day** with round-by-round results
- A simple end card (win/lose + what decided it)

Out of scope for MVP: tiers 2–5, party founding, governing phase, mobile layout, sound beyond placeholders, Hindi UI (but keep text in i18n-ready structure).

---

## 12. Next steps (do these in order)

1. **Scaffold the repo:** React + Vite + TypeScript, ESLint/Prettier, Vitest, the folder structure above, and a tiny `/server` with one health-check endpoint and env-based OpenAI key.
2. **Build the asset tooling** in `/tools/assets/`: `manifest.json` format, `generate.mjs` (reads `style-block.txt` + references, calls the OpenAI image API, saves 4 variants per asset), `review.html`, `slice.mjs`, `optimize.mjs`. **Ask the owner before running any batch that spends API credits.**
3. **Phase 0 style exploration:** write prompts for the 3 style directions (A/B/C) of the village desk scene. Generate, let the owner pick, then draft `style-bible.md`.
4. **Desk prototype with placeholders:** while art is in progress, build the village desk in React using placeholder shapes positioned from `desk-layout.json`: clickable phone, flippable register, tear-off calendar, newspaper with live text. Swap in real art as it arrives.
5. **Engine skeleton:** `GameState`, day/slot loop, blocs, ledgers, with unit tests. No AI yet; use stubbed interpreter output. Full design: `docs/ENGINE.md` (milestones E1–E3).
6. **Wire the interpreter:** one server endpoint that takes player text + relevant state and returns schema-validated JSON. Apply effects in the engine. Show PA whisper + voter quotes. Design: `docs/ENGINE.md` (milestones E4–E7).

Work in small, reviewable steps. After each step, summarise what changed and what's next.

---

## 13. Working conventions for Claude Code

- Keep the **engine pure** (no React, no fetch). UI reads state and dispatches actions.
- Every AI call has a **Zod schema** and a **fallback** if the call fails or returns invalid data.
- Player text is **untrusted data**: wrap it clearly in prompts, never let it act as instructions.
- Never commit API keys. Use `.env` and `.env.example`.
- Don't spend image/LLM credits in batches without asking the owner first.
- Prefer clear names over clever abstractions; this project will grow large.
- Update the Decisions Log when anything in this file changes.

---

## 14. Open questions

- Which single region for the MVP? (Default suggestion: a rural Hindi-belt village, fictional name, real district data.)
- Final game name (see below).
- ~~Which style direction (A/B/C)?~~ C, see Decisions Log.
- ~~Hosting for the AI proxy~~: small Node server for now (see Decisions Log); revisit at deploy time.

### Name options
- **MANDATE** (current working title). Short, global, and the word Indian politics itself uses for an election win. *Check store/trademark availability before launch; an unrelated space strategy game called "The Mandate" may already exist.*
- **KINGMAKER** — strong, but common in games.
- **THE LEDGER** — leans into the promise/favour ledger and the cost-of-power theme.
- **SWING** — short and punchy; about swing voters and swing moments.

---

## 15. Decisions Log

| Date | Decision |
|---|---|
| 2026-11-11 | Game concept: AI-driven Indian political career, village → nation. |
| 2026-11-11 | Golden rule: AI plays the people, code keeps the score. |
| 2026-11-11 | Free-text player statements, no multiple choice for speech. |
| 2026-11-11 | Diegetic desk UI; desktop first (1920×1080, test 1366×768). |
| 2026-11-11 | Stack: React + Vite + TypeScript; PixiJS for map/crowds; OpenAI for LLM and images (not Jev). |
| 2026-11-11 | MVP = one sarpanch election in one region over 21 days. |
| 2026-11-11 | Real data + fictional people/parties/symbols; strict sensitive-content rules. |
| 2026-11-11 | Working title: MANDATE. |
| 2026-11-11 | AI proxy starts as a small Node + Express server (`/server`, run with `tsx`); Vite proxies `/api` to it in dev. Kept portable to serverless later. |
| 2026-11-11 | Scaffold: React 19 + Vite 8 + TypeScript (strict, `noUncheckedIndexedAccess`), ESLint flat config with an engine-purity rule, Prettier, Vitest. |
| 2026-11-11 | Player-facing strings live in `src/ui/strings.ts` (i18n-ready from day one). |
| 2026-11-11 | Image model IDs verified against the API: `gpt-image-2.6-flare` (exploration, default) and `gpt-image-2.6-sunburst` (prop matching). |
| 2026-11-11 | Asset pipeline in `tools/assets/` (see its README). `generate.mjs` is dry-run by default; spending needs `--yes`, a non-placeholder style block, and stays under `--max-images`. Review is a small local server (`review.mjs`) serving `review.html`. |
| 2026-11-11 | Style locked: direction C ("signboard printed on paper"). Rules and palette in `tools/assets/style-bible.md`; production plan in `tools/assets/PLAN.md`. |
| 2026-11-11 | Production model: `gpt-image-2.6-flare`, medium quality, one image per request, self-reviewed against a checklist, max 3 attempts. |
| 2026-11-11 | Era: present day. The desk phone is a cheap Android smartphone (blank screen = live UI for cadre messages), replacing §8.1's "old phone". |
| 2026-11-11 | Sarpanch desk: the bicycle is the control to ride out to the village map; spiral pad = player's writing pad; khaki pocket diary = PA's mood notebook. |
| 2026-11-11 | UI kit (stamps, pins, string, tape, torn edges) is hand-built in SVG/CSS, not generated. |
| 2026-11-11 | MVP asset pack generated and exported to `src/assets/` (43 assets; known issues listed in `tools/assets/PLAN.md`). |
| 2026-11-11 | Desk prototype (step 4): fixed 1920×1080 stage scaled to fit; props placed from `src/data/desk-layout.json` (positions measured from the master desk); every system opens as a physical object overlay; rubber stamps are the only buttons. Fonts: Rozha One (display), Hind (body), Kalam (handwriting); all three cover Devanagari. |
| 2026-11-11 | UI state: Zustand store in `src/state/` binds the pure engine to React; placeholder world content lives in `src/ui/content.ts` until the engine and AI are wired. |
| 2026-11-11 | Reading views with live text (open ledger, newspaper, diary, phone, sheets) are built in code with generated textures, never live text over a painted page: painted rules and perspective can never line up with HTML text. Generated "open" art is for decoration only. |
| 2026-11-11 | Engine design in `docs/ENGINE.md`: three layers. (1) Engine: pure TS owns every number and rule. (2) Decide: OpenAI Decisions API (`/v1/decisions`, `gpt-6-luna`) measures player text and makes NPC choices as probabilities over engine-defined options. (3) Generate: Responses API extracts promises and writes all character text, voicing the engine's verdict. The brief's "Judge" role is split between Decide (classification/scoring) and Generate (structured extraction). |
| 2026-11-11 | AI models are a **per-task setting** (Settings stamp on the title screen; server-side `settings.json`, allowlisted). Defaults to save cost: `gpt-6-luna` for every task and `omni-moderation-latest` for safety; `gpt-6.1-terra` / `gpt-6.1-sol` are opt-in per task. See `docs/ENGINE.md` §11.1. |
| 2026-11-11 | Full game walk-through in `docs/PLAYTHROUGH.md` (first launch to end card, all major branches); it adds the new-game form, day-0 statement, silence period, last night, polling day, tie by lots and stacked endings (`ENGINE.md` §15). |
| 2026-11-11 | Engine E1–E3 built (offline, no AI): seeded pure engine in `src/engine/`, village data in `src/data/regions/bihar-village.json` (provisional numbers), keyword fallback interpreter (English/Hinglish/Hindi), promises, deeds, rival utility AI, vote model, polls, counting, endings. Playable end to end: title → nomination → 21 days → polling → counting → end card. Autosave in localStorage. |
| 2026-11-11 | Tola "Nadi-paar" renamed **Pokhar tola** (by the pond) to match the map art. Balance tuned with `npm run sim`; numbers in `docs/ENGINE.md` §16. |
| 2026-11-11 | **Challenge redesign** (`docs/CHALLENGE.md`): the first build was solved by one visible recipe. The game now centres on building a coalition across real fault lines (conflicting interests, never identity), under fog of war, with a procedurally varied village, a rival who attacks the seams of your coalition, real scarcity and tempting shortcuts. The honest path is the hardest that is still winnable; win-win solutions must be found and written. Built as C1–C6 before AI wiring. |
| 2026-11-11 | Challenge layer C1–C6 built: fault lines (pool of 6 interest conflicts, 3 per village) with sides, believed or disbelieved win-wins, evasion, public stance record and contradictions; fog of war; seeded village variation; rival archetypes (dynast, firebrand, technocrat) with wedge questions; neglect; works that take days and slip; booth assignment; the donor tied to the kiln, with leaks. Results in `docs/CHALLENGE.md` §7. |
| 2026-11-11 | AI wired (`docs/ENGINE.md` §17): Decisions API reads every statement and the donor reply; Responses API extracts promises and writes voices; moderation runs on every text. Model per task in Settings. The game always falls back to offline play. Script decides language in code; the AI judges meaning. |
| 2026-11-11 | Free will = fixed verbs (priced by the engine) × chosen targets × free words; NPCs choose among engine options with Decide probabilities sampled by a seeded RNG; every AI answer is logged so games replay exactly. |
| 2026-11-11 | MVP voter model: 5 interest blocs (farmers, labourers, youth, traders, elders) × gender cross-cut × 5 tolas = 50 vote cells; opinion leaders spread influence. |
