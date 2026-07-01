# MusicDNA Engine — Migration Plan

The engine is being extracted from `src/lib/musicdna.functions.ts` into a
transport-agnostic service under `src/musicdna/engine/`. Web (via
`createServerFn`), the upcoming `/api/v1/*` REST layer (for Flutter and any
future client), and tests all call the **same** engine. No duplicate
implementations, ever.

## Layout

```
src/musicdna/
  engine/        pure domain — no Supabase/LLM/React imports
    types.ts     DTOs shared with adapters, routes, and clients
    ports.ts     SupabaseGateway, LLMGateway, Clock, Rng interfaces
    scoring.ts   ✅ migrated — pure vector math (dot, cosine, tiers)
    archetypes.ts   TODO — assignment + confidence ladder
    critic.ts       TODO — prompt builder + LLM orchestration
    pairing.ts      TODO — selectNextPairing
    session.ts      TODO — startSession / getSession
    choice.ts       TODO — submitChoice (probe alignment, lane flips, vector update)
    reveal.ts       TODO — buildReveal / share cards
    index.ts        TODO — MusicDNAEngine factory: (deps) => { ... }
  adapters/
    supabase.ts     TODO — SupabaseGateway impl (user- or admin-scoped)
    llm.ts          TODO — LLMGateway impl over Lovable AI Gateway
```

## Rules for engine code

- No `import ... from "@/integrations/supabase/..."`.
- No `import ... from "@tanstack/react-start"`.
- No React, no DOM, no `process.env` reads.
- All I/O goes through a port. All time comes from `Clock`. All randomness
  comes from `Rng`.
- Failures are typed (`EngineError`); routes/server-fns translate them to
  HTTP or thrown `Error`s.

## Migration order (each step keeps web working)

1. ✅ Engine skeleton + `scoring.ts` + tests.
2. `archetypes.ts` — pull assignment logic out of the reveal server fn,
   wrap the existing call site.
3. `critic.ts` — prompt building + LLM invocation behind `LLMGateway`.
4. `pairing.ts` + `session.ts` + `choice.ts` — the interactive loop.
5. `reveal.ts` + share cards (absorbs `share.functions.ts`).
6. Add `/api/v1/*` server routes calling the same engine methods.
7. Golden-fixture regression tests over historical sessions.

## Testing

`bun x vitest run` runs the engine test suite. Engine tests use in-memory
`SupabaseGateway` and scripted `LLMGateway` fakes — no network, no DB.
