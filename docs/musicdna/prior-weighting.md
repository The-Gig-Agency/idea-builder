# Prior Weighting: Opener vs Pairings

## Intuition

The 3-song opener should shape the archetype, not just the lane. But it
shouldn't *be* the archetype — the pairings are the evidence the user
actually sweat over.

Target mix in the final archetype signal:

- **Priors ≈ 30%**
- **Pairings ≈ 70%**

## Implementation

`session.vector` is seeded at session creation from the opener's
`candidate_dimensions` (range −100..+100), scaled by `PRIOR_SEED_WEIGHT`:

```ts
// src/lib/musicdna.functions.ts
export const PRIOR_SEED_WEIGHT = 0.35;

seed_vector[dim] = round(candidate_dimensions[dim] * 0.35)
```

Then each pairing choice adds `(winner[dim] − loser[dim]) * (diagnostic_weight/100)`
to the running vector (typically ±15–35 per pairing on tested axes).

### Why 0.35

| Source                  | Typical magnitude on dominant axis |
|-------------------------|------------------------------------|
| Raw prior (×1.0)        | 60–90                              |
| **Seeded prior (×0.35)**| **20–32**                          |
| 6 pairings accumulated  | 90–200                             |

20–32 vs ~140 ≈ a ~30 / 70 mix — priors are a real nudge but get
overridden when the choices contradict them. Bump to ~0.5 if priors
should harder-anchor; drop to ~0.2 if pairings should dominate more.

## Where it's applied

- `startSessionImpl` — the quiz / test-harness path (`/api/public/test/next`
  creates the session via this function).
- `ensureChatSessionForUser` — the chat path that lazily creates a session
  from the opener.

Both go through `seedVectorFromPriors(candidate_dimensions)` so the
weighting stays in one place.

## What this does NOT touch

- Lane routing — still driven by `opening_lane` / `opening_lane_confidence`.
- Probe lanes — still seeded from `secondary_lanes`.
- Archetype matching itself — still cosine over `session.vector`
  (`finalizeSessionImpl`). Only the *starting point* of that vector changed.
