## Context

You flagged four calibration issues after playing the metal lane:

1. **Overcommits too early** — round 3–4 already sounds certain.
2. **Copy re-states the axis instead of the choice** — "You want the song to become something" is the same sentence as "songs that go somewhere."
3. **"You sat with that one" repeats** — hesitation copy has one line, used three times.
4. **A few opaque lines leak internal vocabulary** ("a singer who isn't asking") and some observations over-leap ("communal → rooms full of people").

None of this touches the pairing engine, the vector math, or the analyst/critic split. It's all voice, pacing, and vocabulary breadth. That's the lens for this plan.

## What we'll change

### 1. Confidence-by-round pacing

Introduce a per-round hedge ladder that wraps the verdict line. Rounds 1–2 stay curious; certainty grows.

```text
1  Interesting.
2  I think I see a pattern...
3  Early read...
4  Starting to believe...
5  Fairly confident...
6+ I'm convinced...
```

Applied in `recordChoice` (the `verdict` builder around line 850) and in the beat/hook generator. Also gate the running-thesis language ("Wide keeps winning", "Conviction over becoming") behind round ≥ 5 AND ≥ 3 supporting choices on that dimension. Before that threshold the beat is descriptive of the single pick, not the pattern.

### 2. Comment archetypes (8–12 variants per pole)

Today `REVEAL[dim].hi/lo` has 3 verdict/why variants. Two problems:
- The "verdict" is the axis name ("forward motion over stillness") and the "why" often just re-phrases it.
- 3 variants is not enough — repeats are visible inside a 10-round session.

Restructure each pole into two layers:

```ts
type PoleCopy = {
  axis_label: string;          // used ONCE per session per pole, if at all
  observations: string[];      // 8–12 short lines, each a *different angle*
  hedges_by_round: [...];      // ladder above
};
```

Each `observations` array covers different flavors of the same tradeoff (borrowing your Becoming > Snapshot list). The reveal builder picks by `(session_id + round + dim + direction)` hash so the same session never repeats a line and consecutive rounds don't reuse a flavor.

Also: rotate the "verdict/axis" line out entirely after the first time we've named that axis in the session. Once we've said "songs that go somewhere over songs that hold their shape," subsequent hits on `transformation.hi` skip the axis restatement and go straight to a fresh observation ("You reward ambition over efficiency.", "You don't need the chorus in the first minute.", etc.).

### 3. Hesitation library tied to timing

Replace the two hard-coded strings ("Snap call. No hesitation." / "You sat with that one.") with a timing-bucketed library:

```text
< 500ms    Instinct.
500–1200   Immediate.
1200–2500  No debate.
2500–5000  Had to think.
5000–8000  That was a battle.
8000+      You really wrestled with that one.
```

Each bucket gets 6–10 variants; pick by hash of (pairing_id + round) so no session repeats a line. Persist the bucket on `choices.metadata` so it's available for the final synthesis ("the two you fought hardest for were X and Y").

### 4. Kill opaque lines, soften leaps

- Audit every `why` string for internal-vocabulary phrases. Specifically fix: "a singer who isn't asking", "posture as music", "cathedral over kitchen" without setup, and any line that names a dimension the user hasn't been shown ("becoming", "witness"). Rule: if a smart friend at a bar wouldn't nod, cut it.
- Soften pole → identity leaps. Rewrite lines like "You hear songs in rooms full of people" as "Early read: you're drawn toward songs that invite people in rather than shutting the world out." Add hedges when observation → identity distance is large (community, perspective, confidence).
- Add a lightweight lint (dev-only console warn in `recordChoice`) that flags any reveal string containing tokens from a small forbidden list (`becoming`, `witness`, `posture`, `axis`, `dimension`) so we catch regressions.

### 5. Lean into the good voice

You called out the "front and center, not a background hum" line as the target voice. Rewrite the archetype libraries in that register — punchy, specific, a little irreverent, no therapy-speak. This is a copy pass, done alongside step 2.

## Files touched

- `src/lib/musicdna.functions.ts` — `REVEAL`, `BEAT`, `recordChoice` (verdict/speedBeat builder around 843–856), plus a small `hedgeForRound(round)` helper and `pickObservation(dim, direction, session, round)` selector.
- No schema changes. Hesitation bucket can go into the existing `choices` row via a nullable JSON column if we already have one; otherwise skipped from persistence and only used in copy (I'll confirm during build).
- No changes to analyst/critic, pairing selection, lane logic, or scoring.

## What we're explicitly NOT doing

- No new dimensions, no changes to lane routing or metal seeds.
- No AI rewrite of reveal copy — deterministic library only. The critic stays where it is (final synthesis).
- No changes to the pairing engine or evidence thresholds in the analyst.

## Ticket for later (out of scope)

The lanes-still-missing doc at `docs/musicdna/missing-lanes.md` — no changes here, just noting it's separate.

## Rollout / verification

After the edit: run a metal session end-to-end in the preview, confirm (a) rounds 1–2 don't make identity claims, (b) no reveal line repeats verbatim in 10 rounds, (c) no line uses the forbidden vocabulary, (d) hesitation copy varies with timing bucket.
