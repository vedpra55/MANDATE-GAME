# MVP asset pack: production plan

Owner of this plan: Claude (project lead). Client: the project owner, who reviews the finished pack.
Written 2026-11-11, after Phase 0. Decisions here are final for the MVP unless the client overrides them.

## 1. Locked decisions

| Topic                                           | Decision                                                                                                                                                                                   | Why                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Style                                           | Direction **C** (signboard shapes + letterpress texture), from `phase0.desk-style-c` v2                                                                                                    | Client's pick; readable behind live text, hand-made feel                 |
| Model                                           | `gpt-image-2.6-flare`, quality `medium`, **1 image per request**                                                                                                                           | Fast (~11 s), good enough; client's call                                 |
| Era                                             | **Present day** (2020s rural Bihar)                                                                                                                                                        | Brief already implies it: viral videos, YouTuber journalist, paper leaks |
| Phone                                           | Cheap Android smartphone in a worn rubber case, cracked screen guard, **blank screen**                                                                                                     | Era; screen becomes live UI (WhatsApp-style cadre messages)              |
| Camera                                          | Surfaces seen from above; every object on them at the **same gentle three-quarter tilt** (top + front face visible); hanging things (calendar, posters) face the viewer                    | One rule that props generated alone can repeat                           |
| Leaves                                          | Neem is **pinnate**: small serrated leaflets lined along a central stalk, in drooping sprays, **never fanning from one point**. Shadows are soft dappled patches, **not leaf silhouettes** | Fan-shaped leaves read as cannabis: a screenshot joke waiting to happen  |
| Bicycle                                         | Stays in the desk background as a **control**: click to ride out to the village map                                                                                                        | Diegetic navigation; gives the big right-hand zone a job                 |
| Notebooks                                       | **Spiral pad + pencil** = your writing pad (click to write a statement). **Khaki pocket diary with rubber band** = PA's mood tallies                                                       | Two systems, two objects, never confused                                 |
| Scene size                                      | 2048×1152                                                                                                                                                                                  | Brief's "2K"; 2x is short of 3840, accepted for MVP                      |
| UI kit (stamps, pins, string, tape, torn edges) | **Not generated**: built as SVG/CSS in the desk prototype                                                                                                                                  | Brief: "hand-built or traced to SVG"; crisp at any size                  |
| Villager portraits, crowd                       | Generated as **2×2 grids of four different people**, sliced                                                                                                                                | 4 portraits per request, consistent style inside a sheet                 |

## 2. The pack (43 first-pass images)

Order matters: each phase uses the approved images of the previous one as references.

**A. Master desk** (sets the style for everything)

1. `scene.village-desk`: full desk with every prop, all decisions above applied.
2. `scene.village-desk-empty`: edit of #1 with loose props removed (tree, calendar nail, charpai, stool, bicycle, ground stay). This is the background the game layers props onto.
   → Approved #1 is copied to `references/` as the first golden image.

**B. Desk props** (transparent, 1024², each with the master desk attached: "redraw this object exactly as in the reference, isolated")
3 phone · 4 bahi-khata closed · 5 bahi-khata open (blank pages, 1536×1024) · 6 newspaper (blank columns) · 7 cash tin · 8 tear-off calendar · 9 tied files · 10 PA's khaki diary · 11 writing pad + pencil · 12 chai glass on saucer

**C. Named characters** (2×2 expression sheets: neutral, pleased, angry, suspicious)
13 PA (approved sheet becomes the golden character reference) · 14 rival (old sarpanch family's heir: the dynast) · 15 donor (local contractor) · 16 journalist (young local reporter / YouTuber) · 17–19 three recurring villagers (elderly farmer, SHG leader, unemployed graduate)

**D. Other scenes**
20 village map (high three-quarter view like the desk; changed from top-down after review because it reads better, distinct clickable areas: tolas, chowk, school, well, fields, small temple and mosque) · 21 chaupal (empty spot where a villager stands; portrait layered in code) · 22 rally stage (behind the lectern, empty field for crowd sprites, blank flex banner) · 23 counting centre (tables, steel ballot boxes, wire mesh, blank results board)

**E. Bulk**
24–35 villager portrait grids (12 × 4 = **48 portraits**; varied age, gender, work and dress; no appearance-to-bloc mapping) · 36–39 crowd back-view grids (4 × 4 = **16 sprites**, transparent) · 40–43 tileable textures (paper grain, newsprint, red cloth, wood)

## 3. How each image is made

1. Generate **one** image (`--variants 1`).
2. Self-review against the checklist (§4) at preview size, plus zoomed crops for leaves, text and faces.
3. Fail → fix the prompt (subject wording or the asset's `spec`), regenerate. **Max 3 attempts**; if all three fail, take the best and list it as a known issue.
4. Pass → mark picked. Transparent assets also get an automatic alpha check.
5. At the end: slice, optimize to `src/assets/`, build contact sheets, show the client.

Budget: ~43 images + ~30% retries ≈ 55 Flare calls ≈ 15 minutes of generation.

## 4. Quality checklist (an image must pass every line)

1. **Subject**: everything asked for is there; nothing extra that clutters a game zone.
2. **Style C**: thick dark-brown outlines, flat fills, cool indigo shadows, halftone and paper grain; indigo and green visible, not all ochre.
3. **Camera rule** (§1) and light from the top-left.
4. **No text**: no letters, numbers or signage (blank papers stay blank).
5. **Safety**: no party symbols or flag-colour combinations, no real people, no logos or watermarks.
6. **Leaves**: pinnate, no fan shapes, no leaf-silhouette shadows.
7. **People**: original, respectful, never a caricature; dress and markers varied; expressions read clearly; sheets have the same person in all four quadrants, in the right order, nothing crossing the midlines.
8. **Era**: present-day objects only.
9. **Game-ready**: clear zones for UI and live text, props separated, transparent where required.

## 5. Deliverables

- Picked masters in `tools/assets/output/` (git-ignored) and their manifest entries (committed).
- Game-ready WebP (1x + @2x), sliced portraits and sprite atlases in `src/assets/` (committed).
- `style-block.txt` (the locked style C) and `style-bible.md` (palette hex, rules, checklist).
- Contact sheets per category for the client review, plus a list of known issues.

## 6. Result (2026-11-11)

All 43 assets approved. **50 Flare calls**: 43 first attempts plus 7 retries (empty desk ×1, chai ×2,
donor, graduate, chaupal, newsprint). Two fixes were done in code at no API cost: the empty desk's
colour match to the master (`lib/colour-match.mjs`) and a mirror-tiled seamless wood texture.

Exported to `src/assets/`: 6 scenes, 10 props, 7 characters × 4 expressions, 48 villager portraits,
a 16-frame crowd sprite with atlas, and 4 textures (1x + @2x WebP, about 20 MB).

### Known issues (accepted for MVP)

1. Scenes are 2048 px wide, so @2x is short of 3840 px. Regenerate at `3840x2160` before launch if high-DPI screens matter.
2. The empty desk is an edit of the master: object positions may shift by a few pixels. Measure prop positions for `desk-layout.json` on the master image.
3. The donor has a moustache although the prompt said clean-shaven. Harmless, and he reads as distinct.
4. Two figures (a retired schoolmaster portrait and one crowd back view) wear plain white caps. They're common in villages and carry no party marks, but watch how they are used next to political content.
5. The counting-centre tally sheet has faint scribbles in its header cells (no readable text).
6. The phone screen has crack lines; live UI is drawn over them. Intentional character.
7. The wood texture is mirror-tiled, so symmetry may show if it is tiled over a very large area.
