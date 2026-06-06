# Conversational onboarding & interleaved insight pacing

Right now onboarding is a 5-input form → one hypothesis → done. Pairings are a flat sequence. We're going to make the whole arc feel like the original ChatGPT conversation: observation → interpretation → new hypothesis → better question → revelation.

## The new arc

```
Stage 1 — Conversation (onboarding)
  Step A: "Name 3 songs you love."        →  AI reacts + forms hypothesis v1
  Step B: "Now 2 more — go somewhere else." →  AI refines or breaks hypothesis → picks a lane
Stage 2 — Diagnostic pairings (10–15, not 50)
  - 3 pairings → micro-insight #1 ("you keep choosing songs that reward patience")
  - 3 pairings → micro-insight #2 (sometimes a challenge: "let's test that")
  - 3 pairings → micro-insight #3 (refinement)
  - final 2–3 pairings
Stage 3 — Final synthesis
  The big reveal. One specific, slightly uncomfortable observation.
  "I don't think you like dark music. I think you like music that starts in darkness and moves toward light."
```

## Onboarding — conversational two-step

Replace `src/routes/_authenticated/onboarding.tsx` with a chat-style flow:

1. **Step A (3 songs)** — single prompt, 3 inputs. Submits to a new server fn `reactToThree`:
   - returns `{ reaction, hypothesis_v1, suspected_dimensions, lane_guess, confidence }`
   - reaction is 1–2 sentences, Rolling Stone voice, names something specific ("Two of those start quiet and detonate. I'm watching the third.")
2. **Step B (2 more songs, "go somewhere else")** — prompts user to push the AI. Submits to `refineWithTwoMore`:
   - returns final `{ reaction, hypothesis_v2, lane, confidence, secondary_lanes, candidate_dimensions, per_song, canon_matches }`
   - this is what gets written to `profiles` (same fields as today)
3. CTA: "Begin the matchups →"

Visually: each AI reply renders as a card with eyebrow ("Observation" / "Hypothesis" / "Refinement"), serif quote, then the next input slides in below. Feels like a conversation, not a form.

## Pairings — interleaved micro-insights

In `nextPairing` (or a sibling fn), after rounds 3, 6, 9 return an `insight` payload alongside the pairing:

```
{ pairing, round, insight?: { kind: "observation"|"challenge"|"refinement", text: string } }
```

Insight text is generated server-side from the current vector + recent choices. Examples:
- observation: "You keep choosing the song that takes longer to arrive."
- challenge: "Let's test that — this next one's the opposite."
- refinement: "Not patience exactly. Patience that pays off."

UI in `play.tsx`: when an insight comes back, render it full-bleed for ~2.5s (or until user taps "continue"), then the pairing.

## Final synthesis

After the last round, instead of straight to `/profile`, route to a `/synthesis` reveal screen (or extend the existing reveal). New server fn `finalSynthesis(sessionId)` returns one paragraph: the big-reveal observation. Voice: "I don't think you like X. I think you like Y." Specific, slightly uncomfortable.

## Files

- `src/routes/_authenticated/onboarding.tsx` — rewrite as 2-step conversation
- `src/lib/musicdna.functions.ts` — add `reactToThree`, `refineWithTwoMore`, `finalSynthesis`; extend `nextPairing` return with optional `insight`
- `src/routes/_authenticated/play.tsx` — render insight cards between pairings; route to synthesis at the end
- `src/routes/_authenticated/synthesis.tsx` — new reveal screen
- migration: add `profiles.opening_step` (text) so we can resume mid-conversation, and `sessions.insights_shown` (jsonb) to avoid duplicates

## Out of scope (for this pass)

- No admin/rubric changes
- No new `diagnostic_families` table yet (separate request)
- Existing `analyzeOpeningSongs` stays as a back-compat alias

Ready to build this?
