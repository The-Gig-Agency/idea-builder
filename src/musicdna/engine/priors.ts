// MusicDNA Engine — prior weighting.
//
// Pure math for turning the user's opening-3-songs analysis into a seed
// vector for their session. Kept out of musicdna.functions.ts so both the
// live server-fn path and any future callers (regression tests, admin
// tooling, batch scoring) get the same behavior.
//
// Docs: docs/musicdna/prior-weighting.md — priors ≈ 30% of final signal,
// pairings ≈ 70%. 0.35 keeps priors as a real but overrideable nudge
// against pairing deltas that accumulate ~90–200 on the dominant axis.

import type { Vector } from "./types";

export const PRIOR_SEED_WEIGHT = 0.35;

export function seedVectorFromPriors(
  candidateDimensions: Record<string, unknown> | null | undefined,
  weight: number = PRIOR_SEED_WEIGHT,
): Vector {
  const out: Vector = {};
  if (!candidateDimensions) return out;
  for (const [k, v] of Object.entries(candidateDimensions)) {
    if (typeof v === "number" && Number.isFinite(v)) {
      out[k] = Math.round(v * weight);
    }
  }
  return out;
}
