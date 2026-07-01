# MusicDNA Engine — Integration Guide

How to wire `createEngine(deps)` into a new transport (server-fn, REST
route, background job, admin CLI) and how to build a new adapter for a
port. If you find yourself importing Supabase or the Lovable AI Gateway
from anywhere under `src/musicdna/engine/*`, stop — you're bypassing the
service boundary.

## Mental model

```
┌────────────────────┐   ┌────────────────────┐   ┌──────────────────┐
│ transport          │──▶│ createEngine(deps) │──▶│ pure engine      │
│ server-fn / route  │   │  (src/musicdna/    │   │ modules          │
│ / job / CLI        │   │   engine/index)    │   │ (session,        │
│                    │◀──│                    │◀──│  pairing, …)     │
└────────────────────┘   └────────────────────┘   └──────────────────┘
        ▲                        │   ▲
        │                        ▼   │
        │              ┌──────────────────────┐
        └──────────────│ adapters/*           │
                       │  supabase.ts (DB)    │
                       │  llm-gateway.ts (AI) │
                       └──────────────────────┘
```

The engine only sees **ports**: `SupabaseGateway`, `LLMGateway`,
`Clock`, `Rng`. Adapters implement ports. Transports build deps and call
methods on the returned `MusicDNAEngine`.

## Ports

Defined in `src/musicdna/engine/ports.ts`. Keep the surface narrow — grow
each port only when a new engine module actually needs the new call.

| Port              | Responsibility                                         | Prod adapter                                | Test double                                     |
| ----------------- | ------------------------------------------------------ | ------------------------------------------- | ----------------------------------------------- |
| `SupabaseGateway` | Reads sessions, songs, pairings for the engine.        | `createSupabaseGateway(client)`             | `createInMemorySupabaseGateway(store)`          |
| `LLMGateway`      | `complete({ model, system, prompt, ... })` chat call.  | `createLovableLlmGateway({ apiKey })`       | `createScriptedLLMGateway(replies)`             |
| `Clock`           | `now(): Date`. All timestamps flow through it.         | `systemClock()`                             | `fixedClock("2026-01-01T00:00:00Z")`            |
| `Rng`             | `next(): number` in `[0, 1)`. All randomness flows in. | `mathRng()`                                 | `seededRng(42)`                                 |

Ports live in the engine folder; adapters live in
`src/musicdna/adapters/` and are the **only** files allowed to import
`@supabase/supabase-js`, `@/integrations/supabase/*`, or hit the AI
gateway URL.

## Building an engine instance

Prod call site (server-fn or REST route):

```ts
import { createEngine, systemClock, mathRng } from "@/musicdna/engine";
import { createSupabaseGateway } from "@/musicdna/adapters/supabase";
import { createLovableLlmGateway } from "@/musicdna/adapters/llm-gateway";

export function buildEngine(supabase) {
  return createEngine({
    db: createSupabaseGateway(supabase),
    llm: createLovableLlmGateway(),   // reads process.env.LOVABLE_API_KEY
    clock: systemClock(),
    rng: mathRng(),
  });
}
```

Deterministic call site (tests / golden fixtures):

```ts
import {
  createEngine,
  fixedClock,
  seededRng,
} from "@/musicdna/engine";
import {
  createInMemorySupabaseGateway,
  createScriptedLLMGateway,
  emptyStore,
} from "@/musicdna/engine/testing";

const store = emptyStore();
// seed store.sessions / store.songs / store.pairings…

const engine = createEngine({
  db: createInMemorySupabaseGateway(store),
  llm: createScriptedLLMGateway([{ match: /archetype/i, text: "…" }]),
  clock: fixedClock("2026-01-01T00:00:00Z"),
  rng: seededRng(42),
});
```

## What `MusicDNAEngine` gives you

`createEngine(deps)` returns bound methods that compose the pure modules
and pre-inject `deps.rng` where relevant. Call these instead of the
underlying module functions so transports never re-plumb randomness or
gateway wiring.

| Method                        | Backed by                    | Notes                                                          |
| ----------------------------- | ---------------------------- | -------------------------------------------------------------- |
| `buildStartSessionSeed(i)`    | `session.ts`                 | Lane + confidence + opening probes + seed vector.              |
| `selectPairing(i)`            | `pairing.ts`                 | Fork filter + weighted pick; `rng` pre-bound.                  |
| `shouldStop`, `assertWithinLane` | `pairing.ts`              | Pass-throughs; pure helpers.                                   |
| `applyChoice(i)`              | `choice.ts`                  | Vector math after a user picks A/B.                            |
| `evaluateProbe(i)`            | `choice.ts`                  | Cosine + lane-flip decision on opening probes.                 |
| `assignArchetype(v, catalog)` | `archetypes.ts`              | Best-match + margin + flags.                                   |
| `buildPublicReveal(i)`        | `reveal.ts`                  | Share-page DTO. No PII.                                        |
| `seedVectorFromPriors`        | `priors.ts`                  | Opening-3 seeding weights.                                     |
| `deriveDescriptors`           | `descriptors.ts`             | Mood read off axes.                                            |
| `deps`                        | —                            | Escape hatch when a transport genuinely needs the raw gateway. |

Engine methods NEVER take a Supabase client, an API key, a `Date`, or
`Math.random()` as arguments. If you're tempted to add one, add a port
method instead.

## Errors and the HTTP envelope

Expected failures inside the engine throw `EngineErrorException(code,
message)` with codes from `EngineError["code"]`
(`NOT_FOUND | UNAUTHORIZED | FORBIDDEN | INVALID_INPUT | CONFLICT |
UPSTREAM | INTERNAL`). Transports translate:

```ts
import { EngineErrorException, engineErrorStatus } from "@/musicdna/engine";

try {
  const out = await engine.selectPairing(input);
  return Response.json(out);
} catch (e) {
  if (e instanceof EngineErrorException) {
    return Response.json(
      { error: { code: e.code, message: e.message } },
      { status: engineErrorStatus(e.code) },
    );
  }
  throw e; // unexpected → 500 from the framework
}
```

Existing REST routes under `src/routes/api/v1/*` already do this — copy
the pattern instead of inventing a new envelope.

## Adding a new adapter

1. Add the minimum method(s) you need to `ports.ts`. Keep the surface
   narrow; return DTOs from `engine/types.ts`, never raw PostgREST rows
   or SDK objects.
2. Create `src/musicdna/adapters/<name>.ts` exporting a factory
   `createXxxGateway(config): XxxGateway`. The factory is the **only**
   place that touches the underlying SDK / URL / API key. No top-level
   `process.env` reads outside the factory body — read env inside the
   returned methods (or accept them as `config`) so the module is
   import-safe during SSR/prerender.
3. Add an in-memory / scripted equivalent to
   `src/musicdna/engine/testing.ts` so golden-fixture tests can exercise
   the new code path without network.
4. Wire the new gateway into `createEngine` deps at every transport
   entry point (server-fn factory, `/api/v1` route composition, jobs).

## Adding a new engine method

1. Put deterministic logic in a pure module under
   `src/musicdna/engine/` (no Supabase / LLM / React / `process.env` /
   `Date.now()` / `Math.random()` — inject via ports).
2. Add unit tests colocated as `<module>.test.ts`.
3. Expose it on `MusicDNAEngine` in `engine/index.ts`, pre-binding
   `deps.rng` / `deps.clock` if it needs them.
4. Extend the golden-fixture test in `engine/index.test.ts` so the full
   loop still passes end-to-end with the in-memory doubles.
5. Call it from the transport — never re-import the underlying module
   directly from a route or server-fn.

## Anti-patterns

- Importing `@/integrations/supabase/*` or the AI gateway URL from
  anywhere under `src/musicdna/engine/`.
- Passing a `SupabaseClient` into an engine method instead of into an
  adapter factory.
- Reading `process.env.*` at engine module scope (undefined during
  SSR/prerender and leaks server config into the client graph).
- Calling `Math.random()` or `new Date()` inside an engine module — use
  `deps.rng` and `deps.clock`.
- Duplicating engine logic in a route handler "just for this one
  endpoint". The whole point of the boundary is that web, REST, and
  future clients share one implementation.
