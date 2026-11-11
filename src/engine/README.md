# engine

Pure game logic: state, rules, effects, events, elections. **Code keeps the score.**

- No React, no `fetch`, no browser APIs (enforced by ESLint).
- Functions take state and return new state; never mutate.
- Every rule has a Vitest test next to it (`*.test.ts`).
