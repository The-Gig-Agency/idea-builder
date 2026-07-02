# Evidence-First Onboarding — Trimmed MVP

**Filter for every change in this ticket:**
Every architectural change must improve one sentence the user reads. If we can't point to the exact sentence that gets better, cut it.

## What we're keeping

1. **Structured output** for per-song reactions. Model returns reasoning fields; we render the small ones.
2. **Evidence rule** — no trait claim unless ≥3 supporting choices AND 0 strong contradictions. No confidence thresholds, no `.65` magic number.
3. **Competing explanations** — every hypothesis carries alternatives (artist bias, era bias, "three choices isn't enough yet").
4. **Kill forced four-axis final read** — max one claim ships. If none clear, we show the "still learning" state.
5. **Claim status labels** instead of percentages. UI renders one of: `tentative` → "Working theory…", `strengthening` → "Starting to think…", `stable` → "Pretty confident…". No `%` anywhere in the user-facing copy.
6. **Cheap reasoning log** — persist the structured artifact in a `reasoning` jsonb column, but nothing in the app depends on it yet. Pure optionality for later.

## What we're explicitly NOT doing this pass

- No swap to `gemini-2.5-pro` for the Critic. Flash everywhere. We haven't proven Flash is the bottleneck; the prompt contract probably is.
- No two-pass Detective/Critic split. One structured call per turn.
- No confidence percentages in the UI.
- No "Convince me" button.
- No pairings/songs/admin changes.
- No voice rewrite in `critic.ts` beyond tightening the "curious not clever" defaults.

## Per-song contract (songs 1–4)

`reactToOne` and `reactToThree` in `src/lib/musicdna.functions.ts` switch to structured output via AI SDK `Output.object`. Model stays `google/gemini-3-flash-preview`.

Returned + persisted per turn:

```
{
  observation: string,
  supports: string[],
  contradicts: string[],
  competing_explanations: string[],
  hypothesis: string | null,       // only allowed from song 3
  status: "tentative" | "strengthening" | "stable",
  public_line: string              // ≤18 words, curious not diagnostic
}
```

Rules enforced in the prompt AND clamped in code after the call:

- **Song 1:** no `hypothesis`, no trait claim in `public_line`. Bias toward "Noted." / "Interesting place to start." / "Still listening."
- **Song 2:** no `hypothesis`. Still no trait claims.
- **Song 3:** `hypothesis` allowed only if `supports.length ≥ 3` across turns AND `competing_explanations.length ≥ 1`. Status starts at `tentative`.
- **Song 4:** hypothesis may strengthen (`strengthening`) or flip. If it flips, `public_line` acknowledges it.

## Final read (song 5)

`refineWithTwoMore` — single structured call on Flash. Returns the same ledger shape aggregated across all 5 songs. Threshold check in code, not in the model:

- Ship a claim only when `supporting_choices.length ≥ 3` AND `contradicting_choices.length === 0`.
- Ship **at most one** claim.
- If zero clear, return `{ claims: [], stillLearning: true }`.
- Lane is still returned for downstream use.

## UI changes (presentation only)

`src/routes/_authenticated/1980.tsx` and `src/routes/onboarding.tsx`:

- "Working hypothesis" block only appears from song 3 onward, only when server returns one, and shows the status label ("Working theory…" / "Starting to think…" / "Pretty confident…") — no percentages.
- Final payoff renders **one claim or the still-learning state**. Removes the hardcoded 4-axis layout. Keeps the lane chip. Removes the `%` confidence readout.
- Copy defaults tightened toward "Still listening." between turns.

## Storage

Add a `reasoning` jsonb column (migration) to whatever table `recordEvent` writes to, and persist the full structured artifact per turn. Nothing else reads it yet — this is cheap optionality for the "Convince me" flow and admin review later.

## The sentences that should measurably improve

Before shipping, we should be able to point at these and say "this is the sentence that got better":

1. **Song 1 reveal** — from "Starting with the ultimate bridge between two eras…" → "Interesting place to start. Still listening."
2. **Song 3 reveal** — from a confident trait claim → "Working theory: you keep picking songs that ask for patience. Or you just really like The Cure. Let's see."
3. **Final read (thin evidence run)** — from four forced axes → "Today I only trust one thing: you reward songs that unfold. Everything else I'm still learning."

If any of the three above doesn't clearly improve after the change, we back it out.

## Verification before shipping

1. Run the 80s flow with 5 known picks. Confirm songs 1–2 never produce a trait claim and no `%` appears in the UI.
2. Force a thin-evidence run (5 songs by the same artist). Confirm the final read shows the still-learning state, not a forced claim.
3. Confirm every stored `hypothesis` in the `reasoning` payload has ≥1 competing explanation.
