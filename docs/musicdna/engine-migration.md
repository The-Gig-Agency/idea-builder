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
    archetypes.ts ✅ migrated — assignment, margin, flag reasons, tier
    reveal.ts     ✅ migrated (public share) — buildPublicReveal DTO
    critic.ts       TODO — prompt builder + LLM orchestration
    pairing.ts      TODO — selectNextPairing
    session.ts      TODO — startSession / getSession
    choice.ts       TODO — submitChoice (probe alignment, lane flips, vector update)
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
2. ✅ `archetypes.ts` + tests — pure assignment, margin, flag reasons.
3. ✅ `reveal.ts` (public share) + tests, and `GET /api/v1/share/:token`
   REST endpoint using the same helper `src/lib/share.functions.ts` will be
   switched to in the next pass.
4. **Next**: switch `share.functions.ts` and the finalize server fn to import
   `assignArchetype` / `buildPublicReveal` from the engine (thin wrappers),
   so web and REST share one code path.
5. `critic.ts` — prompt building + LLM invocation behind `LLMGateway`.
6. `pairing.ts` + `session.ts` + `choice.ts` — the interactive loop. Add
   `POST /api/v1/session`, `POST /api/v1/choice`, `GET /api/v1/session/:id`,
   `POST /api/v1/reveal`.
7. Golden-fixture regression tests over historical sessions.

## Testing

`bun test` runs the engine test suite. Engine tests use in-memory
`SupabaseGateway` and scripted `LLMGateway` fakes — no network, no DB.

