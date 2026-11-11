# MANDATE

_Every vote has a price._ An AI-driven political career game set in India.

See [`CLAUDE.md`](./CLAUDE.md) for the full project brief, architecture rules and decisions log.

## Getting started

Requires Node 22+.

```bash
npm install
cp .env.example .env   # then add your OPENAI_API_KEY
npm run dev            # Vite on :5173 + AI proxy on :8787
```

## Scripts

| Script              | What it does                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`       | Frontend (Vite) and AI proxy server together                                                                                             |
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
