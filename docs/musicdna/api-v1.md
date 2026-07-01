# MusicDNA API v1

Versioned client API. Every current and future client — web, Flutter,
desktop, admin tooling — calls the same endpoints, and every endpoint calls
the same engine (`src/musicdna/engine/*`). There is one implementation of
scoring, archetype assignment, and reveal shaping. Ever.

Base URL: `https://<your-app>.lovable.app/api/v1`

## Auth

- Public endpoints (currently `GET /share/:token`) require nothing.
- All other endpoints require a Supabase bearer token:
  `Authorization: Bearer <supabase_access_token>`

CORS: every response includes `Access-Control-Allow-*` headers; all routes
respond to `OPTIONS` preflight. Safe to call from any origin.

## Error envelope

```json
{ "error": { "code": "NOT_FOUND", "message": "Session not found" } }
```

Codes: `NOT_FOUND` (404), `UNAUTHORIZED` (401), `FORBIDDEN` (403),
`INVALID_INPUT` (400), `UPSTREAM` (502), `INTERNAL` (500).

## Endpoints

### `POST /api/v1/onboarding/opener`

Post-signup opening analysis. Call this once, immediately after the user
signs up, with the 3 songs they picked. Runs the LLM analysis (lane guess,
seed vector, secondary lanes) and persists it to the caller's `profiles`
row. `POST /api/v1/session` requires this to have completed at least once.

Body:

```json
{ "songs": ["Fake Empire - The National", "Dreams - Fleetwood Mac", "Space Song - Beach House"] }
```

- `songs`: exactly 3 free-text strings, each 1–200 chars. Format
  `"Title - Artist"` is preferred but not required; catalog resolution is
  server-side.

Response:

```json
{
  "ok": true,
  "lane": "alternative",
  "lane_confidence": 0.62,
  "hypothesis": "Three songs in — already a shape, not a portrait…",
  "secondary_lanes": ["indie", "folk"]
}
```

### `POST /api/v1/session`

Start a new MusicDNA session for the authenticated user. Uses the user's
opening 3 songs (stored on `profiles`) to seed the session vector, pick the
primary lane, and choose probe candidate lanes.

Response:

```json
{ "session_id": "…", "lane": "alternative", "lane_confidence": 0.87 }
```

### `GET /api/v1/session/:id/next`

Return the next pairing (or `null` when the session is out of pairings).
Also returns progress + probe state so the client can render round X of Y.
Session ownership is enforced by RLS on the caller's token.

### `POST /api/v1/session/:id/choice`

Body:

```json
{ "pairing_id": "…", "chosen_song_id": "…", "ms_to_decide": 4230 }
```

Records the choice, updates the session vector, and returns whatever
`recordChoiceImpl` returns (updated progress, lane flip signals, etc.).

### `POST /api/v1/session/:id/reveal`

Finalize the session. Runs the pure engine `assignArchetype` over the
current vector, generates the Analyst reasoning artifacts, calls the Critic
LLM under the evidence-threshold constraints, and persists the reveal.

Response:

```json
{
  "archetypeId": "…",
  "archetypeName": "Architect",
  "interpretation": "Across 7 of 12 matchups…",
  "vector": { "movement": 42, "…": 0 },
  "allowed_claims": [ … ],
  "counterarguments": [ … ]
}
```

### `GET /api/v1/share/:token`

Public read of a completed, shared session. Accepts either the opaque
`share_token` or — for back-compat — a session UUID that has `is_public =
true`.

Response:

```json
{
  "session_id": "…",
  "share_token": "…",
  "completed_at": "2026-06-30T18:22:11Z",
  "lane": "Alternative",
  "interpretation": "You're an Architect…",
  "archetype": {
    "id": "…",
    "name": "Architect",
    "tagline": "Craftsmanship first.",
    "description": null
  },
  "defining_choices": [
    { "chosen": "…", "chosenArtist": "…", "rejected": "…", "rejectedArtist": "…" }
  ]
}
```

## Mobile / Flutter signup flow

Authentication itself is not part of `/api/v1/*`. Clients talk to Supabase
Auth directly with the appropriate SDK (`supabase_flutter` on mobile,
`@supabase/supabase-js` on web) for signup, sign-in, password reset, and
OAuth. Once the SDK returns a session, the client passes its `access_token`
as `Authorization: Bearer …` to every `/api/v1/*` call.

End-to-end mobile onboarding is three REST calls:

1. `supabase_flutter.signUp(email, password)` — returns a session.
2. `POST /api/v1/onboarding/opener` with the 3 opening songs — persists the
   opening analysis to `profiles`.
3. `POST /api/v1/session` — seeds a session from the profile and returns a
   `session_id`; the client then loops `next → choice → reveal` and finally
   reads `GET /api/v1/share/:token` for the public reveal.

`POST /api/v1/session` will error with `INVALID_INPUT` if step 2 has not
completed for the current user. Rerun the opener with 3 songs and retry.

## Versioning policy

- `/v1` is stable. Breaking changes ship as `/v2`.
- Additive fields are allowed on `/v1` responses at any time. Clients MUST
  ignore unknown fields.
- Removing fields, renaming fields, or changing types is a break — bump the
  version.

## End-to-end tests

`src/routes/api/v1/e2e.test.ts` drives the full REST loop
(`session → next → choice × N → reveal → share`) through the real routes
over HTTP. It self-skips unless both env vars are set:

```bash
MUSICDNA_E2E_BASE_URL=http://localhost:8080 \
AGENT_TEST_HARNESS_KEY=<same value as the server secret> \
bunx vitest run src/routes/api/v1/e2e.test.ts
```

How it works:
1. `POST /api/public/test/opener` — bootstraps a synthetic Supabase user +
   opening analysis (auth-bypassing harness gated by
   `AGENT_TEST_HARNESS_KEY`).
2. `POST /api/public/test/bearer` — resets that user's password and returns a
   fresh access token so the test can hit the real bearer-protected routes.
3. The test then walks `/api/v1/session`, `/next`, `/choice`, `/reveal`, and
   the public `/share/:token` end-to-end and asserts the auth boundary,
   CORS preflight, and the typed error envelope.

Point `MUSICDNA_E2E_BASE_URL` at `http://localhost:8080` for a local dev
server or at the preview URL to smoke-test a deployed build.
