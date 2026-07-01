# MusicDNA Engine — Service Extraction & /api/v1

You're right on every point. The move isn't "make Flutter work" — it's **separate the domain from the transport**. One engine, many clients (web today, Flutter next, tests always). Below is the concrete refactor.

## Target shape

```text
src/musicdna/engine/            ← the IP. Pure TS. Knows nothing about HTTP or React.
  session.ts        startSession, getSession
  pairing.ts        selectNextPairing
  choice.ts         submitChoice
  scoring.ts        cosine, vector math
  archetypes.ts     archetype assignment + confidence ladder
  critic.ts         Critic prompt builder + LLM call
  reveal.ts         buildReveal, buildShareCard
  types.ts          shared DTOs (Session, Pairing, Choice, Reveal, …)
  ports.ts          interfaces: SupabaseGateway, LLMGateway, Clock, Rng
  index.ts          MusicDNAEngine factory: (deps) => { startSession, submitChoice, … }

src/musicdna/adapters/
  supabase.ts       SupabaseGateway impl (uses admin OR user client, injected)
  llm.ts            LLMGateway impl (Lovable AI Gateway)

src/lib/musicdna.functions.ts   ← thin. createServerFn → engine.submitChoice(...)
src/routes/api/v1/session.ts             POST /api/v1/session
src/routes/api/v1/session.$id.ts         GET  /api/v1/session/:id
src/routes/api/v1/choice.ts              POST /api/v1/choice
src/routes/api/v1/reveal.ts              POST /api/v1/reveal
src/routes/api/v1/share.$token.ts        GET  /api/v1/share/:token
```

Engine takes gateways as constructor deps → same code runs in a server fn, a REST route, or a test with in-memory fakes. No duplicate implementation, ever.

## Verb-based v1 contract

The client drives the game; it never computes scoring/archetypes/vectors/commentary.

```text
POST /api/v1/session              → { session_id, first_pairing, progress }
POST /api/v1/choice               body: { session_id, pairing_id, chosen_song_id, ms_to_decide }
                                  → { next_pairing | null, progress, confidence, commentary? }
GET  /api/v1/session/:id          → { session, pairings_so_far, progress, confidence }
POST /api/v1/reveal               body: { session_id }
                                  → { archetype, tagline, commentary, confidence, defining_choices, share_token }
GET  /api/v1/share/:token         → public read (existing share.functions.ts logic, moved to engine)
```

Auth: everything except `/share/:token` requires a Supabase bearer token — verified in the route handler with the same helper the auth middleware uses, then the engine is called with a user-scoped SupabaseGateway. `/api/public/*` is reserved for webhooks; `/api/v1/*` is the authenticated client API.

CORS: `OPTIONS` handler + `Access-Control-Allow-*` on every response (including errors) so Flutter and future clients work cross-origin.

## Refactor plan (incremental, no big-bang)

1. **Create the engine skeleton** — `src/musicdna/engine/*` with types, ports, and empty function stubs. No behavior change yet.
2. **Move logic out of `musicdna.functions.ts`** into `engine/*`, one concern at a time (scoring → archetypes → critic → pairing → session/choice → reveal). Each server fn becomes a 3-line wrapper: build gateways from `context`, call engine, return DTO. Web keeps working the whole time.
3. **Do the same for `share.functions.ts`** — move logic into `engine/reveal.ts`, keep the server fn as a thin wrapper.
4. **Add `/api/v1/*` server routes** — each route: verify bearer, build gateways, call the same engine method the server fn calls. Zod-validate input. Uniform error envelope `{ error: { code, message } }`.
5. **Add engine tests** — `src/musicdna/engine/__tests__/*` using in-memory SupabaseGateway + a scripted LLMGateway. Golden fixtures: "user with these 8 choices → Architect at 80% confidence." This is the regression net for cosine/archetype tweaks.
6. **Document** — `docs/musicdna/engine.md` (ports, DTOs, invariants) and `docs/musicdna/api-v1.md` (endpoints, request/response, auth, errors, versioning policy). Flutter reads only these.

## What stays out of scope for this pass

- Rate limiting, API keys for non-Supabase clients, OpenAPI spec generation — worth doing, but after the engine boundary exists.
- Flutter code itself.
- Renaming `/v1` later: the whole point of shipping `v1` now is we never have to.

## Deliverable of step 1 (this next turn, if you approve)

Just the engine skeleton + ports + DTOs + one migrated concern (`scoring.ts`, since it's pure and easy to test) with a passing test. Web unchanged. Then we iterate concern-by-concern.

Approve and I'll start with step 1.