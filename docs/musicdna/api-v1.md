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

### Planned (next iteration)

- `POST /api/v1/session` — start a session
- `POST /api/v1/choice` — submit a pairing choice, get next pairing + progress
- `GET /api/v1/session/:id` — snapshot of an in-progress session
- `POST /api/v1/reveal` — finalize + return archetype/commentary

These require moving the interactive loop out of
`src/lib/musicdna.functions.ts` and into `engine/{session,choice,pairing,critic}.ts`.
See `engine-migration.md` for the migration order.

## Versioning policy

- `/v1` is stable. Breaking changes ship as `/v2`.
- Additive fields are allowed on `/v1` responses at any time. Clients MUST
  ignore unknown fields.
- Removing fields, renaming fields, or changing types is a break — bump the
  version.
