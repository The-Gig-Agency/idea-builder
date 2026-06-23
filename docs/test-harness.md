# MusicDNA Test Harness API

End-to-end HTTP endpoints that drive the same code paths the UI uses, so
an external agent (or script) can run full personas against the system
without going through the browser.

No real auth users. Each `persona_id` is a stable synthetic identity:
on first contact a row in `public.test_runs` is created with a generated
`user_id`, plus matching `profiles` and `user_roles` rows. Re-sending the
same `persona_id` resumes that persona; `reset: true` (or `/reset`) wipes
its sessions, choices, reasoning, and profile state.

All DB writes go through the service-role admin client. RLS is bypassed.
This is a **test harness only** — do not expose the secret publicly.

## Auth

Every request must include:

```
x-test-harness-secret: <AGENT_TEST_HARNESS_KEY>
```

The secret is stored as a project secret named `AGENT_TEST_HARNESS_KEY`.
Ask the project owner for the value — never commit it.

## Base URL

```
https://project--bf62bea5-34b0-497c-a8a5-6c41d3f35ed6.lovable.app/api/public/test
```

Use the `-dev` variant for the preview build:

```
https://project--bf62bea5-34b0-497c-a8a5-6c41d3f35ed6-dev.lovable.app/api/public/test
```

`/api/public/*` bypasses Lovable's published-site auth; the secret header is the only thing protecting these endpoints.

## persona_id

A short string the agent invents and keeps. Format: `^[a-zA-Z0-9_.\-:]{1,80}$`.
Examples: `alt-kid-2026-06-23`, `country-stoic-v1`, `sandbox:run-42`.

Different `persona_id` values = independent runs. Same `persona_id` =
resume / inspect the same run.

## Lifecycle

```
POST /opener      → analyze 3 starter songs (returns opener reveal)
POST /next        → fetch next pairing                 (repeat N times)
POST /choice      → record which song was chosen       (repeat N times)
POST /report      → finalize + synthesis + result
GET  /status      → inspect the current test_runs row at any time
POST /reset       → wipe this persona's history
```

`pairing_count` (default `6`, max `40`) is decided by the agent on the
opener call. The harness stops handing out pairings once that count is
reached, and `/next` will return `done: true`.

---

## POST `/opener`

Analyzes the three starter songs (the same call the UI makes when the user
commits song #3) and stores the critic's opening reveal on `profiles` plus
the harness `test_runs.opener_payload`.

**Request**

```json
{
  "persona_id": "alt-kid-2026-06-23",
  "songs": [
    "Black Hole Sun — Soundgarden",
    "Maps — Yeah Yeah Yeahs",
    "Idioteque — Radiohead"
  ],
  "pairing_count": 6,
  "reset": false
}
```

- `songs`: exactly 3 strings, free-form ("Title — Artist" works best).
- `pairing_count`: optional. `6` for the short run, `12`–`20` for the long
  run. Stored on `test_runs.pairing_count`; can be changed by sending again.
- `reset`: optional. If `true`, wipes prior state for this persona before
  running the opener.

**Response (excerpt)**

```json
{
  "ok": true,
  "persona_id": "alt-kid-2026-06-23",
  "user_id": "f9c3…",
  "pairing_count": 6,
  "opener": {
    "lane": "alternative",
    "confidence": 0.42,
    "secondary_lanes": ["electronic"],
    "hypothesis": "You keep choosing songs that…",
    "candidate_dimensions": { "movement": 18, "atmosphere": 24, … },
    "per_song": [ … ],
    "canon_matches": [ … ]
  }
}
```

---

## POST `/next`

Returns the next pairing the user should see. On the first call for a
persona it also creates the underlying `sessions` row.

**Request**

```json
{ "persona_id": "alt-kid-2026-06-23" }
```

**Response — pairing available**

```json
{
  "ok": true,
  "persona_id": "alt-kid-2026-06-23",
  "session_id": "…",
  "round": 1,
  "confidence": 0.12,
  "done": false,
  "pairings_used": 0,
  "pairing_count": 6,
  "pairing": {
    "pairing_id": "0a…",
    "tests": ["movement", "atmosphere"],
    "song_a": { "id": "…", "title": "…", "artist": "…", "year": 2003 },
    "song_b": { "id": "…", "title": "…", "artist": "…", "year": 2014 }
  }
}
```

**Response — done**

```json
{ "ok": true, "done": true, "pairing": null, "reason": "pairing_count reached" }
```

Stop polling `/next` when `done === true`. Move on to `/report`.

---

## POST `/choice`

Records the agent's pick for the most recently served pairing. Returns the
critic's per-axis "reveal" line that the UI would render.

**Request**

```json
{
  "persona_id": "alt-kid-2026-06-23",
  "pairing_id": "0a…",
  "chosen_song_id": "<song_a.id or song_b.id>",
  "ms_to_decide": 4200
}
```

- `chosen_song_id` MUST be one of the two song ids returned by `/next`.
- `ms_to_decide`: optional. The UI uses this to flavor the reveal ("snap call" / "you sat with that one"); pass realistic values to exercise that path.

**Response**

```json
{
  "ok": true,
  "pairings_used": 1,
  "pairing_count": 6,
  "reveal": {
    "vector": { "movement": 18, … },
    "verdict": "OK. Maps over Idioteque.\nThat's haze over clarity.",
    "why": "You keep picking the one that surrounds you. Mood as the whole point, maybe.",
    "hesitation": null,
    "dim": "atmosphere",
    "delta": 22
  }
}
```

---

## POST `/report`

Runs `finalizeSession` → `finalSynthesis` → `getMyResult` in sequence and
stores the full payload on `test_runs.report`. Idempotent — re-running
overwrites the stored report.

**Request**

```json
{ "persona_id": "alt-kid-2026-06-23" }
```

**Response (shape)**

```json
{
  "ok": true,
  "session_id": "…",
  "finalize": {
    "archetypeId": "…",
    "archetypeName": "The Atmosphere Builder",
    "interpretation": "…",
    "vector": { … },
    "allowed_claims": [ … ],
    "counterarguments": [ … ]
  },
  "synth": {
    "synthesis": "…",
    "kept_choosing": [ { "tradeoff": "…", "examples": [ … ] } ],
    "counter_reads": [ { "claim": "…", "impact": "medium", "notes": "…" } ]
  },
  "result": {
    "profile": { … },
    "sessions": [ … ],
    "definingChoices": [ … ],
    "reasoning": { "allowed_claims": [ … ], "blocked_claims": [ … ], … }
  }
}
```

---

## GET `/status`

Inspect the current state of a persona without changing anything.

```
GET /api/public/test/status?persona_id=alt-kid-2026-06-23
```

Returns the full `test_runs` row, including `opener_payload`,
`current_pairing_payload`, `choices_log`, `report`.

---

## POST `/reset`

Wipes everything for the persona: deletes sessions, choices,
session_reasoning, event_log, llm_calls; clears the profile's opening
fields; resets `test_runs` counters. The synthetic `user_id` is kept so
the persona resumes "fresh".

```json
{ "persona_id": "alt-kid-2026-06-23" }
```

---

## End-to-end agent script (curl)

```bash
SECRET="…"                                  # AGENT_TEST_HARNESS_KEY
BASE="https://project--bf62bea5-34b0-497c-a8a5-6c41d3f35ed6-dev.lovable.app/api/public/test"
P="alt-kid-$(date +%s)"

H=(-H "x-test-harness-secret: $SECRET" -H "content-type: application/json")

curl -s "$BASE/opener" "${H[@]}" -d "{
  \"persona_id\": \"$P\",
  \"songs\": [
    \"Black Hole Sun — Soundgarden\",
    \"Maps — Yeah Yeah Yeahs\",
    \"Idioteque — Radiohead\"
  ],
  \"pairing_count\": 6
}" | jq .

for i in $(seq 1 6); do
  PAIRING=$(curl -s "$BASE/next" "${H[@]}" -d "{\"persona_id\":\"$P\"}")
  echo "$PAIRING" | jq .
  DONE=$(echo "$PAIRING" | jq -r '.done')
  [ "$DONE" = "true" ] && break
  PID=$(echo "$PAIRING" | jq -r '.pairing.pairing_id')
  # Agent picks song_a every round in this example:
  SID=$(echo "$PAIRING" | jq -r '.pairing.song_a.id')
  curl -s "$BASE/choice" "${H[@]}" -d "{
    \"persona_id\": \"$P\",
    \"pairing_id\": \"$PID\",
    \"chosen_song_id\": \"$SID\",
    \"ms_to_decide\": 3500
  }" | jq '.reveal.verdict'
done

curl -s "$BASE/report" "${H[@]}" -d "{\"persona_id\":\"$P\"}" | jq '.synth.synthesis'
```

---

## Errors

All errors return JSON `{ "ok": false, "error": "<message>" }` with an
HTTP status:

| Status | When |
|-------:|------|
| `400`  | validation failure (`issues` field included for zod errors) |
| `401`  | missing/invalid `x-test-harness-secret` |
| `404`  | unknown `persona_id` or action |
| `500`  | unexpected server error (LLM gateway down, DB constraint, etc.) |

The LLM gateway is the most common 500 source. The harness already falls
back to deterministic copy inside `commitOpeningThree`, `finalizeSession`,
and `finalSynthesis`, so 500s from the AI are rare — but if you see one,
retry the same call.

---

## Internals (FYI)

- Implementation: `src/routes/api/public/test/$action.ts`.
- Calls the `*Impl` exports from `src/lib/musicdna.functions.ts` directly
  with a service-role Supabase client + the persona's synthetic `user_id`,
  bypassing the `requireSupabaseAuth` middleware.
- Persona state lives in `public.test_runs` (one row per `persona_id`).
- The harness honors the agent-chosen `pairing_count`; the underlying
  `nextPairing` selector still uses confidence-based stopping inside that
  budget.
