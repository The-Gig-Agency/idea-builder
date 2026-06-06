## Goal

Make the play loop feel like a chat with a curious critic, not a quiz with verdicts. Shipping Option A as an experiment first: one route, no backend changes, swap the centered card-flip flow for a stacked transcript where every pick adds a reaction *and* an evolving hypothesis line. If this lands, we collapse `/onboarding` and `/play` into one continuous transcript (Option B) next.

## What changes (Option A — this pass)

### 1. `/play` becomes a transcript, not a card stack
Today: pairing → reveal screen ("THE VERDICT" / "WHY THAT MATTERED") → next pairing, each one replacing the last.

New: a single scrolling column. Each round appends three blocks and stays on screen:

```text
Round 01 — Ceremony vs. Fool's Gold        [you picked Ceremony]
"Nice — cracked voice over the perfect take.
 Tells me you trust friction more than polish."

▸ My read so far: you reward atmosphere over immediacy.   (confidence ↑)

[ next pairing renders below ]
```

The current pairing renders at the bottom of the transcript. After a pick, the pairing's two buttons collapse into a "you picked X" line, the reaction streams in beneath it, the hypothesis line updates, and the next pairing appears below. The page auto-scrolls to the new pairing. No full-screen reveal interstitial.

### 2. Conversational reveal copy
Kill the "The verdict / Why that mattered / Hesitation" labels. The reveal becomes one short paragraph in the critic's voice, no headers:

> "Very cool — you took the cracked voice over the perfect take. Says you'd rather hear someone mean it than nail it. Let's see if that holds."

Server-side: tweak the `recordChoice` reveal prompt in `musicdna.functions.ts` so the model returns a single 1–2 sentence reaction string instead of the structured `{ verdict, why, hesitation }`. Keep the field names for compatibility but collapse them into one `reaction` string in the response (verdict + why merged, hesitation dropped or folded in only when it adds something). Same persona, shorter, warmer, leads with reaction to the pick before the inference.

### 3. Evolving hypothesis line (the detective board)
After each pick, render a one-liner showing the model's current read and whether it's firming or shifting:

- Round 1: *"First guess: you value atmosphere over immediacy."*
- Round 2: *"Holding. Atmosphere still leads."*
- Round 3: *"Revising — this might be propulsion, not atmosphere."*

Add a tiny server fn `currentRead(sessionId)` (or extend `roundInsight`) that returns `{ thesis: string, direction: "forming" | "holding" | "revising" }` based on the running dimension vector and the delta from the previous round. Called after every pick, not just round 3. Cheap prompt, one sentence out.

The mid-test full-screen `roundInsight` interstitial goes away — its job is now done by the inline hypothesis line on every round.

### 4. Round count + final report
Keep at 6 rounds. Keep the existing flipped report (evidence → thesis → counter-reads) — it already matches the new voice. The "Choose one." centered headline and the round counter chrome stay, but render inline at the top of the next pairing card, not as a separate header bar.

## What does NOT change this pass

- `/onboarding` route untouched. The user goes through onboarding → `/play` as today. Merging into one continuous route is Option B, next pass.
- No schema changes. No new tables. No new pairings.
- `recordChoice`, `nextPairing`, `finalSynthesis` signatures stay the same. Only the reveal prompt's output shape narrows (still returns the existing fields, just shorter / merged).
- Persona block (`PERSONA` / `VOICE` in `musicdna.functions.ts`) stays — we just dial the reveal prompt toward warmer, shorter, lead-with-reaction.

## Files touched

- `src/routes/_authenticated/play.tsx` — rewrite the render layer. Replace the three discrete screens (pairing / reveal / insight) with a single transcript that accumulates `RoundEntry` items in state. Remove the reveal-as-page block. Keep the `done` report screen as-is.
- `src/lib/musicdna.functions.ts` — rewrite the reveal prompt inside `recordChoice` to return one short conversational reaction. Add (or extend) a function that returns the current hypothesis one-liner + direction after every pick. Loosen the round-3-only gate on `roundInsight` or replace its call site with the new per-round fn.

## Technical notes

- Transcript state: `entries: Array<{ round, pairing, chosenSongId, reaction, hypothesis, direction }>`. Append on each pick. Render in order.
- Auto-scroll: `useEffect` on `entries.length`, scroll the newest pairing into view (`scrollIntoView({ block: "center", behavior: "smooth" })`).
- Hypothesis pill styling: small monospace eyebrow ("my read so far") + one-line serif italic + a subtle ↑ / → / ↻ glyph for forming / holding / revising. Reuse existing tokens (`eyebrow`, `font-serif`, `text-muted-foreground`, `border-l-2 border-primary/40`).
- Past pairings collapse to a compact one-line summary ("Ceremony vs. Fool's Gold — you picked Ceremony") so the transcript stays scannable as it grows.
- No new dependencies.

## Why this order

Option A is one file's worth of UI rewrite plus a prompt tweak. It directly tests the user's hypothesis ("if they can watch the model think after every pick, does the burden disappear?") with near-zero engineering risk. If it lands, we know merging `/onboarding` and `/play` into one continuous transcript (Option B) is worth the route-restructure work. If it doesn't, we've learned that cheaply.

## Open question

After this ships and we feel it, do we go straight to Option B (collapse `/onboarding` into the same transcript so the rank-3 reveal, rank-2 refine, and vote rounds are all one scroll), or do we sit with A for a beat and gather reactions first?