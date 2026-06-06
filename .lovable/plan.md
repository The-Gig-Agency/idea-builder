## Goal

Replace the current "type all 3, then 2 more" onboarding with a **three-song, one-at-a-time ranked interview**. Each pick gets a short, pithy critic reaction before the next slot opens. No "best/coolest/favorite" language — the ranking itself is the instruction. After song #3, hand off to pairings (no separate "refine with 2 more" step).

## Conversational shape

**Cold open** — one screen, one input slot, one line:
- Eyebrow: `three songs · ranked`
- Headline: `Three songs. Ranked.` / italic: `That's all I need.`
- Sub: `Start with #1 — the one at the top.`
- Single input (#1) + Enter / `→` button.

**After #1 submits** — short reaction (≤ ~12 words), then slot #2 reveals inline:
- Reaction beat lands fast (350ms). Voice: pithy, intrigued, no flattery.
  - Examples (LLM-generated, not templated): `"Bold opener."` · `"Not where I expected to start. Keep going."` · `"OK. That tells me something."`
- Slot #2 appears below with prompt: `Now #2.`
- Goal of this reaction: **make the user feel the conversation is interesting**, not classify them yet.

**After #2 submits** — second reaction, slightly more relational (still short, ≤ ~20 words):
- The critic now reacts to #2 **in light of #1**: contrast, confirm, or call out tension.
  - Examples: `"After [#1], that's a swerve. Interesting swerve."` · `"OK, you're staying in one room. Tighter than I thought."`
- Slot #3 reveals: `And the third.`

**After #3 submits** — synthesis beat (longer, ~1–2 sentences) + working hypothesis + lane lock:
- One opinionated read of the trio, then the working hypothesis quote, then auto-handoff to pairings.
- No "refine your read →" button; pairings start on a short timer once the hypothesis is rendered (matches current `r5Step === 2` auto-start).

**Unknown songs**: the critic still reacts — even with surprise (`"Don't know that one. Tell me with #2."`). Never bail.

**Edits**: once submitted, a slot is locked. The user can repeat or refine intent later through pairings/chat. No edit-#1 affordance.

## Background work

- **#1**: react off the typed string alone (LLM + critic voice). No DB resolve required for the reaction.
- **#2 + #3**: while the user reads each reaction, kick off a background `resolveSong` for the just-submitted title so by #3's reaction we have era/lane/tags for at least #1 and probably #2. Reactions still degrade gracefully if resolve hasn't returned — they're text-only.
- After #3: same `startSession` / `nextPairing` chain as today; pairings begin auto-scrolled into view.

## Server changes

Replace the two-call shape (`reactToThree` + `refineWithTwoMore`) with a single per-slot endpoint:

- `reactToSong({ rank: 1|2|3, songs: string[] })` — returns `{ reaction: string, hypothesis?: string, lane?: string, confidence?: number }`.
  - `rank=1`: returns only `reaction` (short, ≤ ~12 words).
  - `rank=2`: returns `reaction` (relational, ≤ ~20 words).
  - `rank=3`: returns `reaction` (1–2 sentences) + `hypothesis` + `lane` + `confidence`. This is what currently comes back from `refineWithTwoMore` but on 3 songs instead of 5.
- System prompt enforces: no superlatives ("best", "coolest", "favorite", "amazing"), no genre-naming flattery, no questions back. Reactions are observations, not interviews of the user.
- Token caps in the route handler enforce length; if the model overshoots, hard-truncate at the last sentence boundary.
- Background `resolveSong({ title })` already exists in spirit via `searchSongs` — reuse it; if not, add a thin server fn that returns `{ id, lane, year } | null` and is called fire-and-forget from the client after each submit.

Profile fields that currently store `opening_songs` of length 5 become length 3. Existing rows are not migrated (read code already tolerates variable length); new sessions will simply store 3.

## Client changes (`src/routes/onboarding.tsx`)

- Collapse `Phase` from `ranking3 | ranking2 | playing | done` to `slot1 | slot2 | slot3 | playing | done`.
- Replace `three: [string, string, string]` + `two: [string, string]` with `songs: string[]` (length 0→3).
- Replace `threeRead` / `refined` with `reactions: Array<{ rank: number, reaction: string }>` plus a single `finalRead: { reaction, hypothesis, lane, confidence } | null` after #3.
- Render is a continuous vertical transcript:
  1. Locked rank chip + song (for each submitted slot).
  2. Reaction line under each (fade-in 350ms, then settle).
  3. Active slot input at the bottom, autofocused.
- Remove `SLOT2_LABELS` and the entire "two more · still ranked" block.
- Keep the `r5Step`-style choreography for the final synthesis (eyebrow → reaction → hypothesis → auto-start pairings on `step === 2`), now triggered off `finalRead`.
- Auto-scroll the next slot input into view after each reaction settles.
- Track existing events but rename payloads: `onboarding_three_submitted` → fired once after slot #3; add per-slot `onboarding_slot_submitted` with `{ rank }`.

## Voice / copy rules (for system prompts and any UI strings)

- No "best", "coolest", "favorite", "greatest", "amazing", "perfect".
- No "tell me about yourself", no "what's your vibe", no genre naming as flattery.
- Use observation verbs: `signals`, `says`, `tells me`, `reads as`, `bets on`.
- Reactions punch; one beat per reaction. Em-dashes and short sentences are fine. Avoid emoji.

## Out of scope for this change

- Pairings logic, finalization, synthesis page — untouched.
- Profile schema — no migration; just shorter `opening_songs` going forward.
- Chat flow on `/me` — untouched.

## Acceptance check

- Opening screen shows one input slot, not three.
- After #1, a short reaction appears in < ~1s, then slot #2 reveals beneath it.
- After #2, a second reaction appears that references #1 textually (contrast/confirm), then slot #3 reveals.
- After #3, the synthesis + hypothesis renders and pairings auto-start with no extra button.
- Submitting an unrecognizable song still produces a reaction (no error toast, no bail).
- No "best/coolest/favorite" copy anywhere in headlines, slot labels, or LLM reactions.
- Submitted slots are not editable; the input below stays focused after each submit.
