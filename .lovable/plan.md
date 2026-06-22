## The shift

Stop showing the user our model. Show them attention.

The "fork ↔ axis" chip and the "if you pick X over Y, the fork lands on…" stakes line are ontology leaking into the UI. They make the system sound like it's grading itself out loud. Replace them with short, conversational observations that read like an interviewer noticing something — and then immediately get out of the way so the next pairing can land.

## What changes

### 1. Kill the fork chip and the stakes line in the UI

In `src/routes/onboarding.tsx`, remove rendering of:
- the fork chip ("Pop songwriting ↔ Mood & texture", etc.)
- the stakes sentence ("If #4 leans X, I had you wrong")
- any "The Fork" / axis-named language

Keep one short observation line above the next pairing. That's it. The pairing itself is the next question — it doesn't need a preface explaining what it tests.

Optional small touch: a quiet "Round N" counter above the matchup (replaces the chip's visual slot), no scoring talk.

### 2. Shorten the post-3 read drastically

New target shape, ~25–40 words, one short paragraph:

> Two dramatic choices in a row. You seem to like emotional honesty delivered through a strong artistic lens — not raw confession.

Rules for the model:
- Reference at least one song or artist by name.
- One observation, conversational, present tense.
- No axis names, no poles, no "fork", no "stakes", no "if #4…".
- No verdict aphorisms (banned openers stay banned).
- Max ~40 words. Hard cap enforced in prompt.

### 3. Same treatment for the mid-flow reads

`refineWithTwoMore` / `MID_VOICE` and any later "after 6" / "after 10" beats follow the same pattern. Cadence examples to match the user's note:

- After 3: "So far, you seem more interested in perspective than pure emotion."
- After 6: "You're surprisingly resistant to nostalgia."
- After 10: "You keep choosing atmosphere over immediacy."

Short. Observational. No mechanism talk.

### 4. JSON contract simplifies

`reactToThree` (and the mid reads) return just `{ observation }`. Drop `fork` and `stakes` from the contract and from the renderer. This also removes a class of "model forgot a field" failures.

### 5. Keep the engine smart, silently

`nextPairing` keeps the hypothesis-testing logic we added last round — it still picks pairings that discriminate between the user's leaning poles. The user just never sees the poles named. Engine and voice stop saying the same thing out loud; the engine does the work, the voice stays human.

Per-song reactions (`reactToOne`) keep the concrete-hook treatment from the prior round (year, producer, peer record when known) — those already feel like "someone paying attention" and the user called that out as working.

## Scope

- `src/lib/musicdna.functions.ts` — prompts for `reactToThree`, `refineWithTwoMore`, `MID_VOICE`; tighten word caps; drop `fork`/`stakes` from JSON contract; keep `nextPairing` logic as-is.
- `src/routes/onboarding.tsx` — remove fork chip and stakes line; render single observation; optional quiet round counter.
- `src/routes/_authenticated/1980.tsx` — same contract + UI change for the decade flow.

## Out of scope

- Per-song reaction shape (already good).
- Pairing selection logic (stays).
- Result page.
- Any data/schema changes.

## Voice rules (updated)

- Speak to the user, not about the model.
- Name songs/artists; never name axes or poles.
- One observation per beat. ~25–40 words max.
- Never preview what the next pick "tests."
- Banned: "fork", "axis", "lane", "stakes", "if #4…", "I had you wrong", "the moment when", "you reward…", "you trust…".
- Allowed: "Two of three…", "So far you seem…", "You keep choosing…", "Surprisingly…", "Closer to X than Y…" (as long as X/Y are songs or artists, not axes).
