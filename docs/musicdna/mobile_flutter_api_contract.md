# MusicDNA Mobile Flutter API Contract

This document defines the first-pass REST surface for a Flutter mobile
client. It is intentionally thin and engine-backed: Flutter owns auth UI,
onboarding UI, pairing UI, reveal UI, and session recovery UX, while the
backend owns MusicDNA inference, pairing selection, session progression,
and reveal synthesis.

## Principles

- Flutter must not reimplement MusicDNA engine logic client-side.
- Supabase auth may still be used directly by mobile for sign-in/session
  management, but MusicDNA gameplay and inference should flow through
  backend REST transports.
- REST responses should be typed and stable enough for Flutter BLoC/use
  case/repository layers.
- Errors should use one consistent envelope.

## Auth Boundary

Mobile auth is split:

- Supabase auth:
  - sign in
  - sign up
  - sign out
  - session restore
- MusicDNA backend REST:
  - opening analysis
  - session start
  - next pairing
  - submit choice
  - reveal
  - history / resume

The mobile client should send the authenticated bearer token on REST calls.

## Error Envelope

All REST endpoints should return this shape for handled failures:

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "five songs are required"
  }
}
```

Initial error codes:

- `NOT_FOUND`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `INVALID_INPUT`
- `CONFLICT`
- `UPSTREAM`
- `INTERNAL`

## Endpoint Set

### 1. Analyze Opening Songs

`POST /api/v1/mobile/musicdna/opening-analysis`

Purpose:

- Submit the user’s opening five songs
- Persist the opening hypothesis / lane analysis
- Return the analysis payload needed for onboarding UI

Request:

```json
{
  "songs": [
    "A Forest — The Cure",
    "Ceremony — New Order",
    "Fools Gold — The Stone Roses",
    "Blue Monday — New Order",
    "Born Slippy .NUXX — Underworld"
  ]
}
```

Response:

```json
{
  "lane": "alternative",
  "confidence": 0.82,
  "secondaryLanes": ["electronic"],
  "reasoning": ["You keep choosing propulsion over polish."],
  "hypothesis": "You trust songs that build pressure before they cash out. Let's see if that holds.",
  "candidateDimensions": {
    "movement": 62,
    "atmosphere": 48
  },
  "perSong": [
    {
      "input": "A Forest — The Cure",
      "lane": "alternative",
      "source": "catalog",
      "canonId": "..."
    }
  ]
}
```

### 2. Start Session

`POST /api/v1/mobile/musicdna/sessions`

Purpose:

- Create a new diagnostic session from current profile priors
- Return session metadata required to begin pairing flow

Request:

```json
{}
```

Response:

```json
{
  "sessionId": "uuid",
  "lane": "alternative",
  "laneConfidence": 0.82
}
```

### 3. Get Next Pairing

`POST /api/v1/mobile/musicdna/sessions/{sessionId}/next-pairing`

Purpose:

- Retrieve the next pairing for a session
- Tell mobile whether the session is complete

Request:

```json
{}
```

Response:

```json
{
  "done": false,
  "round": 4,
  "confidence": 0.64,
  "pairing": {
    "id": "uuid",
    "lane": "alternative",
    "diagnosticWeight": 73,
    "tests": ["movement", "immersion"],
    "songA": {
      "id": "uuid",
      "title": "A Forest",
      "artist": "The Cure",
      "year": 1980,
      "primaryLane": "alternative",
      "catalogLane": "goth_darkwave"
    },
    "songB": {
      "id": "uuid",
      "title": "The Killing Moon",
      "artist": "Echo & the Bunnymen",
      "year": 1984,
      "primaryLane": "alternative",
      "catalogLane": "post_punk_new_wave"
    }
  }
}
```

Completed response:

```json
{
  "done": true,
  "round": 20,
  "confidence": 0.81,
  "pairing": null
}
```

### 4. Submit Choice

`POST /api/v1/mobile/musicdna/sessions/{sessionId}/choices`

Purpose:

- Record a user choice
- Advance session state
- Return round insight needed for mobile mid-session UI

Request:

```json
{
  "pairingId": "uuid",
  "chosenSongId": "uuid"
}
```

Response:

```json
{
  "saved": true,
  "choiceId": "uuid",
  "insight": {
    "title": "Why that mattered",
    "body": "You chose the long ascent over the instant anthem."
  },
  "vectorUpdated": true
}
```

### 5. Get Reveal

`GET /api/v1/mobile/musicdna/sessions/{sessionId}/reveal`

Purpose:

- Return the session reveal / result payload for mobile results screens

Response:

```json
{
  "sessionId": "uuid",
  "archetype": {
    "id": "uuid",
    "name": "The Nocturnal Builder",
    "slug": "the-nocturnal-builder"
  },
  "headline": "You trust songs that build pressure before they break open.",
  "summary": "You keep choosing motion, atmosphere, and cumulative payoff over the instant hook.",
  "descriptors": ["propulsive", "immersive", "restless"],
  "evidence": [
    {
      "dimension": "immersion",
      "verdict": "slow reveal over immediacy",
      "why": "You reward songs that take their time before they pay out."
    }
  ],
  "share": {
    "publicUrl": "https://...",
    "shareText": "..."
  }
}
```

### 6. Resume Session / History

`GET /api/v1/mobile/musicdna/me/session`

Purpose:

- Return the user’s active in-progress session if one exists

Response:

```json
{
  "activeSession": {
    "sessionId": "uuid",
    "status": "in_progress",
    "round": 7
  }
}
```

`GET /api/v1/mobile/musicdna/me/history`

Purpose:

- Return prior sessions and reveal summaries for profile/history UI

## Flutter Integration Notes

Recommended mobile layering:

- data source:
  - raw HTTP requests to `/api/v1/mobile/musicdna/*`
- repository:
  - maps response DTOs to domain entities
  - maps error envelope to typed failures
- use cases:
  - analyze opening songs
  - start session
  - fetch next pairing
  - submit choice
  - fetch reveal
  - fetch resume/history
- bloc/state:
  - onboarding flow
  - live diagnostic session
  - reveal/results
  - resume/recovery

## Current Repo Gap

The current codebase already exposes MusicDNA logic via TanStack server
functions in [`src/lib/musicdna.functions.ts`](/Users/rastakit/tga-workspace/idea-builder/src/lib/musicdna.functions.ts),
but it does not yet expose this mobile-facing REST transport shape.

That means the next backend implementation step is:

1. extract or wrap stable service entrypoints around the current MusicDNA
   logic
2. expose them as `/api/v1/mobile/musicdna/*` routes
3. make the response DTOs and error envelope match this contract
