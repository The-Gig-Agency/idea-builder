## Problem

The visuals are ahead of the engine. After three songs the app is delivering novelist-grade verdicts, surfacing "Classic Rock · 85% confidence" off two pop artists, restating the same read twice, and pairing Bowie vs. Bowie. The fix is structural, not cosmetic: the app must observe, hypothesize, and *test* — and it must stop performing certainty it hasn't earned.

## Scope

Frontend + prompt/logic only. No schema changes. Touches:

- `src/lib/musicdna.functions.ts` — `reactToThree`, `refineWithTwoMore`, `nextPairing`, and the `microReactVoice` per-song reaction prompt.
- `src/routes/onboarding.tsx` — post-3 "synthesis" block and the lane/confidence chip.

`reactToOne` per-song reactions stay observational (the previous pass already softened these); we just enforce the no-double-commentary rule downstream. The final post-pairings `finalSynthesis`, archetypes, and DB writes are untouched.

## Fix 1 — Post-3 read: observation, observation, hypothesis (one synthesis only)

Rewrite `reactToThree`'s system prompt and JSON contract to force a three-beat structure with hedged language:

- `observation_1` — one short sentence, names a concrete pattern across the three picks ("Two of three lean on performers who turn presence into the show.").
- `observation_2` — second observation that doesn't restate the first (different angle: era, mood, instinct, scene).
- `hypothesis` — ONE hedged sentence: "I think…", "My guess…", "Maybe…". Ends with an invitation to disprove ("let's pressure-test it", "tell me I'm wrong").

Banned moves in the prompt: "You reward the performer who…", "You trust the moment when…", "secret becomes a spectacle"-style aphorisms, any verdict that doesn't reference the actual songs, and any second synthesis sentence. Keep the existing low-confidence voice rules; add "psychological interviewer, not literary critic — plain words, operational claims".

`refineWithTwoMore` (the 5-song commit step) keeps its current shape — that's where the critic is allowed to commit — but loses the "Let's see if matchups hold" double-beat and reuses the same hedged vocabulary so the post-3 and post-5 voices line up.

## Fix 2 — Hide single-lane confidence; show "possible lane, let's test it"

In `src/routes/onboarding.tsx`, the post-3 block currently renders:

```
Lane: Pop    85% confidence    now let's pressure-test it
```

Replace with:

```
Possible lane: Pop · let's pressure-test it
```

No percentage anywhere in the onboarding UI. `analyzeOpeningSongs` already returns secondary lanes; if the top lane's confidence is below ~0.7 we render the top two as "Pop or Classic Rock" instead of one. Confidence numbers still flow into the DB / events for analytics — only the visible chip changes.

## Fix 3 — Kill double commentary

Today the UI shows per-song reactions and then a synthesis that often paraphrases the last one. Rule: the post-3 block renders exactly *two observations + one hypothesis*, and `reactToThree`'s prompt explicitly forbids restating any per-song reaction text it was given. Per-song reactions remain one sentence each.

## Fix 4 — No same-artist diagnostic pairings

In `nextPairing`, after fetching the candidate pool, drop any pairing where `song_a.artist === song_b.artist` (case-insensitive, trimmed) for the entire onboarding/lane-validation phase. If the filter empties the pool, fall back to `general` (the existing fallback path) before relaxing the rule. A same-artist matchup is a micro-Bowie decision, not a lane decision.

## Fix 5 — Pairings should challenge the current hypothesis

Augment `nextPairing`'s scoring so it favors pairings that *discriminate* on dimensions the current hypothesis leans on, instead of pure diagnostic-weight × axis-need. Concretely: read `sessions.vector`, identify the 2–3 axes with the largest |value| (the working read), and boost the weight of pairings whose `tests` include at least one of those axes with an opposing pole present in either song's `primary_lane`/dimensions. No schema change — this is a re-weighting of the existing `scored` array. Result: after the user looks like "presence over mystery," the next matchup actually probes presence vs. mystery instead of any high-diagnostic-weight pair.

## Fix 6 — Voice cleanup pass

In the prompts for `reactToThree`, `refineWithTwoMore`, and the between-pairing aside (`MID_VOICE`), add a banned-phrase list: "the moment when", "the performer who", "survives their own", "refuses to blink", "becomes a spectacle", "you reward …", "you trust …" as sentence-openers. Allowed: "Two of three…", "So far you seem…", "If that's right, then…", "Let's test it." Keep Rolling Stone swagger in nouns/verbs, lose the aphorism habit.

## Technical notes

- `reactToThree` return type changes from `{ reaction, hypothesis_v1 }` to `{ observation_1, observation_2, hypothesis }`. Onboarding's slot-3 handler currently destructures `reaction` for the per-song reactions array — keep `reaction` populated by joining the two observations with a newline (or store `observation_1` only) so existing transcript rendering doesn't break. The `Refined` state shape on the route gains optional `observation_1/observation_2` fields; the displayed "hypothesis" sentence uses `hypothesis`.
- Lane chip: compute `showSecondary = refined.confidence < 0.7 && refined.secondary_lanes?.[0]`; render accordingly. Drop the `Math.round(refined.confidence * 100)%` span entirely.
- Same-artist filter belongs in `nextPairing` *before* the weighted pick, not after, so the weight distribution stays valid.
- Hypothesis-challenging boost: simple multiplicative bonus (e.g. `× 1.5`) for pairings whose `tests` intersect the top-|value| axes of `sessions.vector`. No new fields, no migration.
- No DB migrations; no changes to events, archetypes, or final synthesis.

## Out of scope

- Pairing seed data (Bowie vs. Bowie exists because the seed allows it; the runtime filter is the right place to stop it for now, but curating the seed is a follow-up).
- Cross-lane probes (still disabled per `mem://product/within-lane-only.md`).
- Result page copy.
