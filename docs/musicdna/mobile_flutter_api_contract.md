# MusicDNA Flutter API Contract

This document defines the Flutter-facing contract for MusicDNA using the
existing shared REST API. Flutter does not get a separate wrapper layer.
Web, Flutter, desktop, and tooling all call the same `/api/v1/*` endpoints.

The architecture boundary is:

- Flutter owns auth UI, session UI, reveal UI, loading states, retries, and
  recovery UX.
- The backend owns session creation, pairing selection, scoring, reveal
  generation, and public share shaping.
- The engine remains the single source of truth for MusicDNA logic.

## Principles

- Flutter must not reimplement MusicDNA engine logic client-side.
- Flutter should call the existing `/api/v1/*` routes directly over HTTP.
- Supabase auth is still handled client-side, but authenticated MusicDNA
  requests use the Supabase bearer token.
- Response shapes should be treated as stable DTOs for Flutter repository and
  BLoC layers.
- Clients must tolerate additive fields on `/v1` and ignore unknown keys.

## Auth Boundary

Mobile auth is split:

- Supabase auth:
  - sign in
  - sign up
  - sign out
  - session restore
- MusicDNA REST:
  - start session
  - fetch next pairing
  - submit choice
  - finalize reveal
  - fetch public share

Authenticated requests send:

```http
Authorization: Bearer <supabase_access_token>
```

The current public route is:

- `GET /api/v1/share/:token`

## CORS

The current `/api/v1/*` routes are already CORS-enabled and answer
`OPTIONS` preflight requests. Flutter can call them directly over HTTPS.

## Error Envelope

Handled failures use this shape:

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Session id must be a UUID"
  }
}
```

Current codes:

- `NOT_FOUND`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `INVALID_INPUT`
- `UPSTREAM`
- `INTERNAL`

## Endpoint Set

### 1. Start Session

`POST /api/v1/session`

Purpose:

- Start a new MusicDNA session for the authenticated user
- Seed the session from the user's saved opening songs/profile priors
- Return the session identity and initial lane

Request:

```json
{}
```

Response:

```json
{
  "session_id": "uuid",
  "lane": "alternative",
  "lane_confidence": 0.87
}
```

### 2. Get Next Pairing

`GET /api/v1/session/{sessionId}/next`

Purpose:

- Return the next pairing for the session
- Tell Flutter whether the session is complete
- Return current round/progress confidence

In-progress response example:

```json
{
  "done": false,
  "round": 4,
  "confidence": 0.64,
  "pairing": {
    "id": "uuid",
    "tests": ["movement", "immersion"],
    "hypothesis": "Slow-burn propulsion vs instant payoff",
    "why_good": "Helps resolve movement against immersion",
    "diagnostic_weight": 73,
    "lane": "alternative",
    "song_a": {
      "id": "uuid",
      "title": "A Forest",
      "artist": "The Cure",
      "year": 1980,
      "primary_lane": "alternative",
      "lane": "goth_darkwave"
    },
    "song_b": {
      "id": "uuid",
      "title": "The Killing Moon",
      "artist": "Echo & the Bunnymen",
      "year": 1984,
      "primary_lane": "alternative",
      "lane": "post_punk_new_wave"
    }
  }
}
```

Completed response example:

```json
{
  "done": true,
  "round": 12,
  "confidence": 0.81,
  "pairing": null
}
```

### 3. Submit Choice

`POST /api/v1/session/{sessionId}/choice`

Purpose:

- Record a user choice for the current pairing
- Update the session vector
- Return deterministic round feedback used by Flutter mid-session UI

Request:

```json
{
  "pairing_id": "uuid",
  "chosen_song_id": "uuid",
  "ms_to_decide": 4230
}
```

Response example:

```json
{
  "vector": {
    "movement": 42,
    "atmosphere": 18
  },
  "verdict": "You went with the song that keeps moving.",
  "why": "You reward build and pressure over instant release.",
  "hesitation": "Fast call.",
  "dim": "movement",
  "delta": 12.4
}
```

### 4. Finalize Reveal

`POST /api/v1/session/{sessionId}/reveal`

Purpose:

- Finalize the session
- Assign the archetype
- Generate the persisted reveal payload
- Return the share token and result data needed by Flutter results UI

Response example:

```json
{
  "archetypeId": "uuid",
  "archetypeName": "Architect",
  "interpretation": "Across 7 of 12 matchups, you repeatedly favored songs that build pressure before release.",
  "vector": {
    "movement": 42,
    "atmosphere": 18
  },
  "allowed_claims": [],
  "counterarguments": [],
  "share_token": "public-share-token"
}
```

### 5. Public Share

`GET /api/v1/share/{token}`

Purpose:

- Read a completed shared reveal without auth
- Support both explicit share tokens and public session UUID back-compat

Response example:

```json
{
  "session_id": "uuid",
  "share_token": "public-share-token",
  "completed_at": "2026-06-30T18:22:11Z",
  "lane": "Alternative",
  "interpretation": "You're an Architect…",
  "archetype": {
    "id": "uuid",
    "name": "Architect",
    "tagline": "Craftsmanship first.",
    "description": null
  },
  "defining_choices": [
    {
      "chosen": "A Forest",
      "chosenArtist": "The Cure",
      "rejected": "The Killing Moon",
      "rejectedArtist": "Echo & the Bunnymen"
    }
  ]
}
```

## Not Yet Exposed As REST

These flows still appear to live outside the current `/api/v1` surface:

- opening-song analysis submission
- session history / resume endpoints

Flutter should not assume those routes exist until they are added to the API
and documented in [`docs/musicdna/api-v1.md`](/Users/rastakit/tga-workspace/idea-builder/docs/musicdna/api-v1.md).

## Flutter Integration Notes

Recommended mobile layering:

- data source:
  - raw HTTP requests to `/api/v1/session*` and `/api/v1/share/*`
- repository:
  - maps response DTOs to domain entities
  - maps the shared error envelope to typed failures
- use cases:
  - start session
  - fetch next pairing
  - submit choice
  - finalize reveal
  - fetch public share
- bloc/state:
  - session start/loading
  - live diagnostic session
  - reveal/results
  - retry/recovery states

## Current Ticket Focus

`TGA-274` should align Flutter contract/types to the already-shipped REST API,
not introduce a second mobile-specific wrapper. If new endpoints are needed
later, they should extend the same `/api/v1` surface used by every client.
