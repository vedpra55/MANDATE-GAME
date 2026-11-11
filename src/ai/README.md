# ai

Client wrappers for the **Judge** (structured, schema-validated) and **Voice** (short dialogue) calls.
The browser never talks to OpenAI directly; it calls `/api/*` on the server.

Every call has a Zod schema (validated again on receipt) and a deterministic fallback.
