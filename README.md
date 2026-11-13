# MANDATE

_Every vote has a price._ An AI-driven political career game set in India.

See [`CLAUDE.md`](./CLAUDE.md) for the full project brief, architecture rules and decisions log.

**New player?** Read [`docs/GUIDE.md`](docs/GUIDE.md), or open _How to play_ in the game.

## Getting started

Requires Node 22+.

```bash
npm install
cp .env.example .env   # then add your OPENAI_API_KEY
npm run play           # to PLAY: built game on :4173 + AI proxy on :8787
npm run dev            # to DEVELOP: Vite on :5173 (hot reload) + AI proxy on :8787
```

**Play with `npm run play`, not `npm run dev`.** The dev server reloads the page and restarts the AI
proxy whenever a source file changes (an editor save, a `git pull`), which drops what you were
doing. `play` builds once and serves the finished game: no watching, no reloads, faster loading.
Your game is autosaved in the browser, so _Continue_ on the title screen picks it up again; the
saves of `play` (:4173) and `dev` (:5173) are separate because they are different addresses.

With `OPENAI_API_KEY` set, the AI reads every statement (Decisions API) and writes Pintu's line and
villagers' quotes (Responses API). Without a key, or if a call fails, the game plays offline with
its keyword reader. Choose the model for each AI task under **Settings** on the title screen
(defaults: `gpt-6-luna`, `omni-moderation-latest`).

## Scripts

| Script              | What it does                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run play`      | Build, then serve the finished game (:4173) and the AI proxy, with no file watching: use this to play                                    |
| `npm run dev`       | Frontend (Vite, hot reload) and AI proxy server (restarts on change) together: use this to develop                                       |
| `npm test`          | Vitest: engine and server tests                                                                                                          |
| `npm run lint`      | ESLint (also enforces the engine purity rule)                                                                                            |
| `npm run typecheck` | TypeScript project build check                                                                                                           |
| `npm run build`     | Typecheck and production build to `dist/`                                                                                                |
| `npm run format`    | Prettier                                                                                                                                 |
| `npm run assets:*`  | Image pipeline: `generate` (dry run by default), `review`, `slice`, `optimize`. See [`tools/assets/README.md`](./tools/assets/README.md) |
| `npm run sim`       | Balance report: headless bots play many seeded games (`npm run sim -- 200 honest,idle`)                                                  |

## Layout

```
src/engine    pure game logic (no React, no fetch)
src/ai        Judge / Voice client wrappers + Zod schemas
src/ui        desk, scenes, shared components
src/data      region data, desk layout
src/assets    final art
server/       AI proxy: holds the OpenAI key
tools/assets  image generation pipeline
```
