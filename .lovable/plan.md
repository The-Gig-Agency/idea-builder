## Test Harness Endpoints

Four public endpoints under `/api/public/test/*` that let an agent drive a full MusicDNA session end-to-end without UI or auth. All keyed by a caller-supplied `persona_id` (free-form string) so the same agent can run multiple personas in parallel.

### Endpoints

**1. `POST /api/public/test/open`** — start a run
```json
// request
{ "persona_id": "skeptic_v1", "songs": ["robyn__dancing_on_my_own", "..."], "pairing_count": 6 }
// response
{ "run_id": "uuid", "persona_id": "skeptic_v1", "lane": "pop", "sub_lane_mix": {...}, "hypothesis": "…critic intro text…", "pairings_remaining": 6 }
```
- `songs` = exactly 3 song_ids from the catalog
- `pairing_count` = 6 or 20 (defaults to 6)
- Creates a fresh row in a new `test_runs` table (no Supabase auth user created)
- Calls the same lane/hypothesis logic the UI uses after the 3-song opener

**2. `POST /api/public/test/pairing`** — fetch the next pairing
```json
// request
{ "run_id": "uuid" }
// response
{
  "pairing_id": "uuid",
  "index": 1,
  "total": 6,
  "prompt": "…critic question text…",
  "dimension": "polarization",
  "song_a": { "song_id": "...", "title": "...", "artist": "..." },
  "song_b": { "song_id": "...", "title": "...", "artist": "..." }
}
```
- Picks the next within-lane pairing using existing selection logic
- Returns 409 if a pairing is already open and unanswered (idempotent: returns the same one)
- Returns 410 + `{ done: true }` when all pairings used

**3. `POST /api/public/test/choice`** — submit pick
```json
// request
{ "run_id": "uuid", "pairing_id": "uuid", "choice": "A" }     // or "B", or "song_id": "..."
// response
{ "ok": true, "pairings_remaining": 5, "running_insight": "…short critic reaction…" }
```
- Validates `pairing_id` matches the currently open pairing for this run
- Stores the choice; advances counter

**4. `GET /api/public/test/report?run_id=uuid`** — final report
```json
{
  "run_id": "uuid",
  "persona_id": "skeptic_v1",
  "complete": true,
  "lane": "pop",
  "archetype": "...",
  "synthesis": "…final critic write-up…",
  "evidence": [ { "pairing_id": "...", "dimension": "...", "chose": "song_id", "rationale": "..." }, … ]
}
```
- Returns `complete: false` with progress info if pairings still remain

### Data model

New table `test_runs` (separate from real `sessions` so we don't pollute production data):

```text
id uuid pk
persona_id text not null
lane text
sub_lane_mix jsonb
hypothesis text
opener_song_ids text[]           -- the 3 starters
pairing_count int                -- 6 or 20
current_pairing_id uuid          -- open pairing awaiting a choice
pairings_used int default 0
report jsonb                     -- populated on finalize
created_at, updated_at timestamptz
```

Pairings/choices for test runs are stored inline in `test_runs.pairings jsonb[]` rather than in `pairings`/`choices` so reports stay self-contained and the production tables stay clean.

RLS: enable, no policies for anon/authenticated. All access goes through `supabaseAdmin` from within the route handlers (loaded inside the handler, never at module scope).

### Security

- All four routes live under `/api/public/*` (auth-bypass prefix).
- Protected by a shared header: `x-test-harness-secret: <TEST_HARNESS_SECRET>`. Timing-safe compare. Returns 401 otherwise.
- I'll add `TEST_HARNESS_SECRET` via `add_secret` before wiring the handlers.
- Input validated with Zod; song_ids cross-checked against `songs` table.

### Logic reuse

The four handlers call shared helpers extracted from the existing `musicdna.functions.ts` flow:
- `computeOpenerLaneAndHypothesis(songs)` 
- `pickNextPairing(run)`
- `applyChoice(run, pairing_id, choice)`
- `finalizeReport(run)`

No changes to existing user-facing flow — only refactor to expose pure functions the handlers can call.

### Files

- `supabase/migrations/<ts>_test_runs.sql` — new `test_runs` table + grants + RLS
- `src/lib/musicdna-core.server.ts` — extracted pure helpers (server-only)
- `src/routes/api/public/test/open.ts`
- `src/routes/api/public/test/pairing.ts`
- `src/routes/api/public/test/choice.ts`
- `src/routes/api/public/test/report.ts`

### Agent usage example

```bash
H="x-test-harness-secret: $SECRET"
curl -XPOST .../api/public/test/open -H "$H" -d '{"persona_id":"p1","songs":[...],"pairing_count":6}'
# → run_id
curl -XPOST .../api/public/test/pairing -H "$H" -d '{"run_id":"..."}'
# → pairing_id + song A/B
curl -XPOST .../api/public/test/choice -H "$H" -d '{"run_id":"...","pairing_id":"...","choice":"A"}'
# repeat 6x, then:
curl ".../api/public/test/report?run_id=..." -H "$H"
```
