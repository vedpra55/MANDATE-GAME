# server

The thin AI proxy. It holds `OPENAI_API_KEY` (from `.env`) and is the only code that calls OpenAI.
In dev, Vite forwards `/api/*` here (see `vite.config.ts`).

| Route             | Purpose                                                  |
| ----------------- | -------------------------------------------------------- |
| `GET /api/health` | Liveness check, plus whether an OpenAI key is configured |
