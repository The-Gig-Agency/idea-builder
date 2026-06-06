Got it. This is no longer "onboarding" — it's a continuous interview. The product is the conversation; the report is just a checkpoint. Below is the plan to build that arc end-to-end, with auth showing up only when the user is invested enough to want history.

## The arc

```text
RANK 3  →  REACT  →  RANK 2 MORE  →  REFINE  →  VOTE (3–4 pairs)  →  REFINE  →  CHAT  →  [REPORT anytime]
                                                                                   ↓
                                                                       SAVE-TO-CONTINUE prompt
                                                                                   ↓
                                                                       MORE VOTES / NEW DIMENSIONS / MORE CHAT
                                                                              (forever)
```

The user is never "done." After the first chat exchange we surface a **"Save your read — keep exploring"** moment that converts anon → full account.

## Routes

- **`/`** (renamed from `/onboarding`) — the interview. One route, multiple stages, all in-place transitions. No URL changes between stages.
- **`/1980`** — kept, but rewritten as a marketing/landing variant: same interview, decade-scoped framing, social-share-ready meta. Same backend.
- **`/me`** (new, replaces `/profile`) — the living report. Hypothesis, dimensions, evidence, "explore more" CTAs that pull the user back into the interview.
- **`/play`** — fold into `/` as the "vote" stage. Don't keep a separate game.
- **`/s/:sessionId`** — already exists for share; keep.

## Anonymous-first auth (the key unlock)

Today everything is behind `_authenticated`. Switch to **Supabase anonymous sign-ins**:

- On first visit to `/`, if no session, call `supabase.auth.signInAnonymously()`. This mints a real `auth.users` row with `is_anonymous = true`, so all existing RLS / `user_id` FKs keep working unchanged.
- The interview saves to `sessions`, `choices`, `event_log` etc. as that anon user.
- After the first chat message (or whenever they hit the "save your read" CTA), prompt for email+password. Use `supabase.auth.updateUser({ email, password })` to **link the anon account to a real account** — same `user_id`, all data follows. No migration, no flush.
- Move `/` and `/me` out from under `_authenticated/`. Keep `/admin` authenticated and role-gated.
- Supabase setting required: enable anonymous sign-ins (Auth → Providers → Anonymous). User-facing one-click.

This is the single biggest piece. It's what makes "never done onboarding" actually work — no friction wall, but everything persists.

## Stage by stage

### Stage 1 — Rank 3 (the entry)

Three numbered slots. Slot label = the signal:

```text
#1   The one you'd save first  →  [____________________]
#2   The one right after        →  [____________________]
#3   And one more               →  [____________________]
```

- All three required. No advance until all filled.
- On submit: call `reactToThree` (already exists) but pass rank explicitly. Update the prompt so the AI can reference rank: *"Your #1 is X but your #3 is Y — that's the gap I want to understand."*

### Stage 2 — React + Rank 2 more

- Show the reaction + hypothesis_v1 from `reactToThree`.
- Below: *"Throw me two more — try to break my read."* Two more numbered slots (#4, #5).
- On submit: call `refineWithTwoMore` (exists), still rank-aware.

### Stage 3 — Vote (side-by-side pairings)

This is the existing `/play` engine folded inline.

- Pick 3–4 pairings from `pairings` table, prioritized by the dimensions the AI flagged as `suspected_dimensions` and the current `lane`. Use the existing scoring code; don't rebuild.
- After each vote: a one-sentence micro-reaction (new server fn `reactToVote`) — same 4-moves rule set as the onboarding LLM (notice / compare / hypothesize / challenge).
- After the batch: call a new `refineAfterVotes` server fn — takes prior hypothesis + the votes + dimension deltas, returns a sharpened hypothesis and an updated dimension vector to write into `sessions.vector`.

### Stage 4 — Chat (free-form)

- AI SDK `useChat` against a new server route `src/routes/api/chat.ts`.
- System prompt is composed from: the listener's 5 songs (with ranks), every vote, current hypothesis, current dimension vector, and the same 4-moves rules.
- Each user message also gets persisted to a new `chat_messages` table tied to `session_id`.
- After the first user message: surface the **save-your-read** modal (email + password, calls `updateUser`). Non-blocking — they can dismiss and keep chatting, but the prompt comes back.

### Stage 5 — Report (`/me`)

- Renders hypothesis, dimensions (with confidence), evidence (songs ranked, votes won/lost by dimension), and three CTAs:
  - **"Vote on a few more"** → back to Stage 3 with a fresh pairing batch (different dimensions to explore).
  - **"Push me on this"** → back to Stage 4 chat with a seeded prompt.
  - **"Share my read"** → existing `/s/:sessionId`.

The report is a view of state, not an exit screen.

## Data model changes

Two migrations:

1. **`session_choices` rank column** — add `rank smallint` to whatever table stores the 5 opener songs (currently writes go through `refineWithTwoMore` into `sessions`/`choices`; check and either add `rank` to `choices` or store ordered array in `sessions.probe_state`).
2. **`chat_messages`** — new table: `id`, `session_id` (fk), `user_id` (fk), `role` ('user' | 'assistant'), `content text`, `created_at`. RLS scoped to `auth.uid()`. Standard grants. Indexed on `(session_id, created_at)`.

No changes to `pairings`, `songs`, `song_axes`, `axes`, `archetypes`.

## Server functions (new + changed)

- **`reactToThree`** — add `ranks: number[]` to input; update prompt to reference rank.
- **`refineWithTwoMore`** — same.
- **`reactToVote`** (new) — input: `pairing_id`, `chosen_song_id`, `rejected_song_id`, current hypothesis. Output: one-sentence reaction, same rules.
- **`refineAfterVotes`** (new) — input: prior hypothesis, votes, dimension deltas. Output: new hypothesis, updated dimension vector. Writes to `sessions.vector` and `sessions.interpretation`.
- **Chat server route** `src/routes/api/chat.ts` — AI SDK `streamText` against Lovable AI Gateway (`google/gemini-3-flash-preview`). Persists user + assistant messages on `onFinish`.

All LLM prompts inherit the `ONBOARDING_RULES` block (4 moves, no genre/scene/era/artist/production talk, listener-as-subject) — already in `musicdna.functions.ts`.

## UI principles

- Single route, stage-machine in component state. Each stage transitions in place with the same eyebrow/counter/serif language the current onboarding has.
- The chat stage uses AI Elements (`Conversation`, `Message`, `MessageResponse`, `PromptInput`) — assistant has no bubble background, user bubble uses `primary` / `primary-foreground`.
- The save-your-read prompt is a small inline card, not a blocking modal — *"Want to keep this and pick it up later? Email + password and we'll save your read."*

## What stays out of this pass

- No new pairings, no new songs, no new dimensions — the engine is already there.
- No notifications / email digests / "we have a new question for you" — that's the next phase once retention is real.
- No multi-decade comparison or cross-lane logic (still within-lane per memory).
- Admin UI unchanged.

## Open question I want your call on before I build

**Where does the save-your-read prompt fire?** Three reasonable triggers:
1. After the first vote batch (highest engagement, before chat).
2. After the first chat message (most invested moment).
3. Whenever the user tries to leave / refresh (annoying but converts).

My default is **2**, with a soft inline CTA already visible on the report. If you want a different trigger, say so and I'll wire it.