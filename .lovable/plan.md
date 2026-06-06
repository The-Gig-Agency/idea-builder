
## Goal

One canonical taste vocabulary — the 9 axes already in the `axes` table:
**movement, atmosphere, immersion, scale, community, perspective, confidence, tension, texture**.

Moods like *nostalgic*, *dreamy*, *dark*, *hopeful*, *romantic*, *energetic* stop being scored. They become **derived descriptors** — adjectives the critic earns from combinations of the 9. Same architecture Spotify uses: store the signal, derive the read.

## What changes

### 1. Schema (one migration)

`songs` table:
- **Drop 12 columns** (no longer scored anywhere): `groove`, `darkness`, `hope`, `nostalgia`, `transformation`, `complexity`, `melody`, `verbal_cleverness`, `authenticity`, `romanticism`, `energy`, `dreaminess`.
- **Keep 3** that map 1:1 to the canonical 9: `movement`, `atmosphere`, `community`.
- **Add 6 new** smallint columns (0–100, default null): `immersion`, `scale`, `perspective`, `confidence`, `tension`, `texture`.

`pairings` table:
- Reset every row's `tests` to `ARRAY[]::text[]` (the old tags reference dropped columns; empty array makes the engine fall back to the canonical 9 until pairings are re-tagged).

### 2. Code: `src/lib/musicdna.functions.ts` (the canonical rewrite)

Replace these in place — same file, same exports, no API change:

- **`DIMS`** → the 9 axis keys.
- **`DIM_LABEL`** → 9 entries with the DB's exact low/high poles (stillness↔forward motion, statement↔immersive mood, immediacy↔slow reveal, intimate↔vast, solitary↔communal, feeling↔witness, vulnerability↔command, release↔danger, rawness↔refinement).
- **`REVEAL`** (the per-axis "verdict + why" copy) → 9 entries, Rolling Stone voice, written fresh for the 6 new axes.
- **`BEAT`** (the per-axis thesis fragments + hook question) → 9 entries, same voice.
- **Two `SELECT` column lists** (lines 545, 720) → swap to the 9-axis projection.
- **Four LLM prompts** that enumerate dimensions (`CLASSIFIER_VOICE`, `REACT_VOICE`'s `suspected_dimensions`, `REFINE_VOICE`'s `candidate_dimensions`, the chat-turn `extractorVoice`) → list the 9, drop the 15.

### 3. New: `deriveDescriptors(vector)` — the mood layer

A small pure function added to `musicdna.functions.ts`. Takes a session vector keyed by the 9 axes, returns an array of earned adjectives. No LLM call, no stored field. Examples of the rules:

- **nostalgic** ← strong negative `immersion` (slow reveal) + low `tension` + low `scale`
- **dreamy** ← high `atmosphere` + high `immersion` + low `confidence`
- **dark** ← high `tension` + low `community` + high `texture` toward rawness
- **hopeful** ← positive `movement` + low `tension` + high `scale`
- **romantic** ← low `confidence` (vulnerability) + low `perspective` (feeling) + high `atmosphere`
- **kinetic** ← high `movement` + high `confidence` + high `tension`

The derived adjectives get passed into the **final synthesis prompt** as flavor ("you may call them *X* if the read supports it"), never as scored fields. The critic uses them; the database never sees them.

### 4. Backfill: rescore 412 songs on the 9 axes

New admin server fn `backfillSongAxes` (in a new `src/lib/admin.functions.ts`). Batches ~20 songs per LLM call, returns 9 integers (0–100) per song, writes to the new columns. Idempotent — only touches rows where the new axes are still null. Triggered once from the existing `/admin` page via a new button. ~25 LLM calls total.

`movement`, `atmosphere`, `community` keep their existing values; only the 6 net-new axes need scoring.

## What stays unchanged

- Session vector semantics, recordChoice math, finalize/synthesis pipeline structure.
- Lane logic, probes, within-lane invariant.
- All UI surfaces (onboarding transcript, /me, /admin). The vocabulary inside the prompts changes, the screens don't.

## Order of operations

1. Re-run the migration (last attempt failed on `pairings.tests` NOT NULL — fix is `ARRAY[]::text[]`).
2. Rewrite `musicdna.functions.ts` against the new schema.
3. Add `deriveDescriptors` and wire it into the final synthesis prompt.
4. Add `backfillSongAxes` + an admin button.
5. Run the backfill once.

## Out of scope (flag for later)

- Re-tagging pairings with new `tests` arrays. Empty `tests` works — the engine just uses the full 9 as the test set per pairing. Worth a follow-up pass to make pairings axis-specific again, but not blocking.
- Mood-derivation rules will need tuning once real sessions run. Treat the v1 rules above as a starting point, not a contract.
