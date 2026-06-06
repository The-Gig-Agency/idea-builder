You're right. The ceiling isn't the UI — it's that the model is allowed to *classify*, and classification is boring. The song-3 line ("jagged abrasion of Seattle… high-gloss New Romantic… foundational ska") came out of `REACT_VOICE`, which today only loosely tells the model to "react to the specific songs." It didn't ban music-journalism mode, so the model defaulted to it.

The fix is to give every prompt one rule set with no escape hatches.

## The new rule (applies to every onboarding LLM call)

The model has only four allowed moves:

1. **Notice** — "That's not where most people start."
2. **Compare** — "Those last two pull in opposite directions."
3. **Hypothesize** — "I think you may care more about energy than polish."
4. **Challenge** — "Let's see if that holds. Tell me I'm wrong."

Hard bans (no exceptions, including the "smart" final synthesis):
- No genres, scenes, decades, cities, eras, movements ("Seattle", "New Romantic", "ska", "Madchester", "post-punk").
- No artist names, bands, producers, labels, lyrics, instruments, chart history, cultural influence.
- No song description ("jagged", "high-gloss", "offbeat precision", "architectural blueprint").
- No critic-prose vocabulary ("oscillate", "definitive cultural snap", "lineage", "ache", "texture", "restless").
- Every sentence's subject is **the listener**, not the song.
- Speak with low confidence. Every claim is a hypothesis inviting disproof.

## Files to change

**`src/lib/musicdna.functions.ts`** — three prompts, same rule set, different tiers of confidence:

1. `MICRO_REACT_BASE` (songs 1, 2, 4) — tighten the bans, add an explicit "4 moves only" list, and require either a *notice* or a *hypothesis*, never a description. Strip remaining loopholes ("a tell that…" can still drift; replace examples with cleaner ones).

2. `REACT_VOICE` (song 3 — the offender in the screenshot) — rewrite so `reaction` must be a **notice or comparison across the three songs as choices**, and `hypothesis_v1` must be a **falsifiable claim about the listener**, ending with an invitation to break it. Add the same hard bans. Cap reaction at ~18 words, hypothesis at ~22.
   - Good shape: "None of these are polished. Even the famous one is rough. That can't be a coincidence." → "I think you choose energy over polish. Throw me something that proves me wrong."
   - Bad shape (current): "You oscillate between the jagged abrasion of Seattle…"

3. `REFINE_VOICE` (final synthesis) — same bans. The final hypothesis is allowed to be sharper and more committed, but still about the listener and still framed as testable ("Let's see if the matchups hold"). Remove the implicit license to do music criticism in the lock-in.

No UI changes. No schema changes. Same JSON shapes, same lane/confidence/dimension fields — just stricter voice contracts in the system prompts plus tightened examples and word caps.

## How we'll know it worked

Re-run with the same three songs (Smells Like Teen Spirit / True / Guns of Navarone). Acceptable:

> "Big songs, but none of them are polite. I'd guess you pick energy over polish — prove me wrong with the next one."

Unacceptable (current):

> "You oscillate between the jagged abrasion of Seattle, high-gloss New Romantic longing, and the rigid offbeat precision of foundational ska."

If the model still names a scene, decade, or production trait, the prompt isn't strict enough and we tighten again.

## Out of scope for this pass

- No changes to the pairings engine, scoring, or the result page.
- No changes to question copy or the auto-advance pacing.
- Not moving Q2–Q5 into the database (separate decision still open).
