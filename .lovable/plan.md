## Goal

When the user submits song #1 (and later song #2), the next slot's label should reference something distinctive about the prior song(s) — decade, genre/scene, or mood — in the magazine-critic voice. E.g. "Now give me #2 from the 90s" or "Now the second-best grunge song you know."

## Approach

Extend the existing `reactToOne` server function (already called after each of the first two songs) to also return a short, voice-y label for the *next* slot. The frontend swaps that into the slot input header. If the model can't pin an angle, we fall back to today's generic label ("Now #2" / "And the third").

## Changes

**1. `src/lib/musicdna.functions.ts` — `reactToOne`**
- Switch its output from `{ text }` to `{ text, nextLabel }`.
- Update the prompt so the model also returns a one-line "next slot" prompt that riffs on whatever's most distinctive about the prior song(s) — decade, genre, scene, or mood — model's choice. Constraints in the prompt:
  - 3–8 words, sentence case, no quotes, no emojis.
  - Must start with "Now" or "Give me" or similar imperative.
  - Reference exactly one angle (era OR genre OR mood), not a laundry list.
  - Voice: Rolling Stone swagger (matches existing `microReactVoice`).
- Parse JSON output; on any failure or empty `nextLabel`, return `nextLabel: null`.
- Keep the existing reaction logic and fallbacks intact.

**2. `src/routes/onboarding.tsx`**
- Add state `nextLabels: (string | null)[]` alongside `reactions`.
- In `submitSlot`, when `rank < 3`, store `r.nextLabel` into `nextLabels`.
- Where the active `<RankedInput label={SLOT_LABELS[songs.length] ?? ""} />` renders, use `nextLabels[songs.length - 1] ?? SLOT_LABELS[songs.length]` so slot 2 and slot 3 pick up the personalized label when available.
- Slot 1's label stays the static "The one at the top".

**3. No DB / migration / schema changes.** Voice + fallbacks live entirely in the existing server function and route.

## Examples (illustrative, model-generated)

- Song #1 = "Smells Like Teen Spirit" → slot 2 label: "Now give me #2 from the 90s" or "Now the second-best grunge song."
- Song #1 = "Strobe" → slot 2 label: "Give me another 4am track."
- Song #1 = "Juicy" → slot 2 label: "Now your second-best 90s hip-hop pick."
- Unknown song → slot 2 label falls back to "Now #2".

## Out of scope

- No changes to `refineWithTwoMore`, `commitOpeningThree`, pairing logic, or DB events.
- No new event types; we keep `onboarding_slot_submitted` as-is.