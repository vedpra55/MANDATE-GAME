# tools/assets: the image pipeline

`manifest.json` → **generate** → **review** (pick) → **slice** (character sheets) → **optimize** → `src/assets/`

> **Ask the owner before any run that spends image credits.** `generate.mjs` is a dry run unless you
> pass `--yes`, refuses while `style-block.txt` is still a placeholder, and stops past `--max-images`
> (default 12).

## Commands

| Command                                                      | What it does                                                                                                |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `npm run assets:generate`                                    | Dry run: prints every prompt and the image count for `todo` assets. Spends nothing.                         |
| `npm run assets:generate -- --only scene.village-desk --yes` | Really generates (4 variants by default) into `output/<id>/v<N>.png`                                        |
| `npm run assets:review`                                      | Local review page at http://localhost:5180: pick the best variant, write notes, mark for redo               |
| `npm run assets:slice`                                       | Cuts picked 2×2 character sheets into `neutral / pleased / angry / suspicious`                              |
| `npm run assets:optimize`                                    | Picked variants → WebP 1x + @2x in `src/assets/<category>/`, sprite sheets + atlas JSON; marks them `final` |

Useful `generate` flags: `--only id,id` · `--status todo,generated` · `--variants N` · `--model ID` ·
`--quality low|medium|high|xhigh|max` · `--max-images N` · `--concurrency N` (max 4).

## The manifest

```jsonc
{
  "version": 1,
  "defaults": {
    "model": "gpt-image-2.6-flare",
    "quality": "medium",
    "variants": 4,
    "styleBlockFile": "style-block.txt",
    "references": ["references"],
  },
  "assets": [
    {
      "id": "prop.phone", // lowercase, dots and dashes
      "category": "props", // scenes | props | characters | crowd | ui | textures
      "kind": "image", // or "character-sheet" (2×2 expressions)
      "description": "What to draw…", // style + technical spec are added automatically
      "size": "1024x1024", // validated against the API's size rules
      "background": "transparent", // opaque | transparent | auto
      "displayWidth": 220, // CSS px at 1920×1080; optimize writes 1x and 2x of this
      "references": ["references", "@picked:scene.village-desk"],
      "model": "gpt-image-2.6-sunburst",
      "sprite": "crowd", // optional: pack into one sprite sheet
      "spec": "extra technical notes", // optional
      "status": "todo", // todo → generated → picked → final
      "picked": 2,
      "notes": "…", // written by the review page
    },
  ],
}
```

Any generation setting can be set per asset to override `defaults`.

**References.** `"references"` means every image in `references/` (the golden images; empty until
Phase 0 is done). `"@picked:<id>"` attaches another asset's picked variant. This is the "generate
the scene, then rebuild it in layers" technique: props reference the master desk scene. When any
reference is present the edits endpoint is used; otherwise plain generation.

**Prompt template** (never changes): `STYLE` (from `style-block.txt`, `#` lines are comments) +
`SUBJECT` (the asset description) + `TECHNICAL` (built from kind, background and size, always
including the banned-elements line: no real politicians, no party symbols or flag colours).

## Models and sizes (checked 2026-11-11)

- `gpt-image-2.6-flare`: fast, for exploration. `gpt-image-2.6-sunburst`: precise, for props that must match the master scene.
- Sizes: `WIDTHxHEIGHT`, multiples of 16, aspect 1:3 to 3:1, edges ≤ 3840, 655,360–8,294,400 pixels total.
- Transparent backgrounds need PNG/WebP output; the tool always saves PNG masters.
- A 2048-wide scene gives only a 2048px @2x for a 1920px display. Generate finals at `3840x2160` for crisp 2x.

## Files

- `output/` (git-ignored): raw variants plus `runs.json` (exact prompt, model and references per run). Nothing is overwritten; new runs continue numbering.
- `references/`: 3–5 golden images, attached to every generation once chosen.
- `style-block.txt`: the shared style wording (written in Phase 0).
- `style-bible.md`: palette, line weight, light direction, banned elements (written in Phase 0).
