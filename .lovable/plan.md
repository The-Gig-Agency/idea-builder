
# MusicDNA V0 — Build Plan (v2)

> **We are not building a catalog of songs. We are building a catalog of revealing decisions.**

## The architectural inversion

We build top-down, not bottom-up:

```
IDENTITY GRAPH                ← what we ultimately learn about a person
       ↑
TASTE GRAPH                   ← cross-user patterns
       ↑
DIAGNOSTIC MATCHUP GRAPH      ← which questions reveal which dimensions
       ↑
SONG VECTOR GRAPH             ← 15-dim coordinates per song
       ↑
SONGS                         ← raw material, ranked by diagnostic_power not "greatness"
```

Songs in the catalog are admitted by their power to *split audiences*, not their cultural prestige. Wonderwall is out. Dreaming of Me is in.

---

## What we're building (V0)

A web app where signed-in users go through a short ritual of forced choices, and the system surfaces what those choices reveal. Three layers:

1. **Conversational onboarding** — user names five songs they love. An AI writes one sharp hypothesis sentence in your voice.
2. **Diagnostic matchups** — ~20 forced choices, each drawn from a curated 150-pair diagnostic canon. Selection weighted by `diagnostic_power` and remaining uncertainty in the user's vector (V0: weighted random; V2: full information-gain).
3. **Interpretation** — profile page with 15-dim radar, matched archetype (1 of 6), and a written read in your voice. Specific. Slightly uncomfortable.

Users sign up, results persist, returning users see their MusicDNA evolve with each session.

---

## Visual direction — "Midnight Intelligence"

Design tokens go straight into `src/styles.css` (oklch):

- Background `#111315` charcoal, surface `#0A0C0D` near-black
- Text `#EAE7E1` warm off-white, secondary `#A7ADB3` muted silver
- Accent 1 `#4A7BFF` electric blue, Accent 2 `#7868FF` soft violet, Accent 3 `#FF766B` dusty coral (sparing — profile highlights, "annoyingly accurate" callouts)

Type: editorial serif display (Instrument Serif or similar) for headlines and section dividers; clean grotesque (Inter) for body. Tight tracking on headlines. Generous whitespace. Hairline borders, no shadows. Factory Records sleeve meets Linear settings panel. Restrained crossfades on matchup transitions — no springs, no confetti.

---

## Information architecture

```
/                    Landing — thesis + "Begin your MusicDNA"
/auth                Sign in / sign up (email+password + Google)
/_authenticated/
  onboarding         Five-songs chat → AI hypothesis
  play               Matchup duel — 20 rounds
  profile            Archetype, 15-axis radar, written interpretation, history
  archive            Past sessions
/admin               Role-gated CRUD for songs, pairings, archetypes
```

Admin uses the standard separate `user_roles` + `has_role()` security-definer pattern.

---

## Data model (Supabase, public schema, RLS on, grants explicit)

### `songs` — the diagnostic canon
```
id, title, artist, year, lane,
movement, atmosphere, groove, darkness, hope, nostalgia,
transformation, complexity, melody, verbal_cleverness,
authenticity, romanticism, energy, dreaminess, community,   -- all int 0–100
diagnostic_power int 0–100,
primary_dimensions text[],                                  -- the 2–3 axes the song most strongly expresses
archetype_signals text[],                                   -- short codes a song "votes" for
active boolean
```
`diagnostic_power` is the explicit admission criterion. Low scores get filtered from pairing generation.

### `pairings` — the diagnostic matchup graph
```
id, song_a_id, song_b_id,
tests text[],                  -- dimensions this matchup probes
hypothesis text,               -- one-sentence read of what the choice means
why_good text,                 -- curator note: why this pair is revealing
diagnostic_weight int 0–100,   -- derived: how much information this pair yields
active boolean
```
`diagnostic_weight` is computed from the two songs' `diagnostic_power` and the magnitude of their delta on `tests`.

### `archetypes`
```
id, name, tagline, description,
signature_axes jsonb,          -- {transformation: 0.9, hope: 0.7, ...}
signature_signals text[]       -- which archetype_signals this archetype owns
```

### Per-user
```
profiles      user_id PK, display_name, opening_songs jsonb, opening_hypothesis text
sessions      id, user_id, started_at, completed_at, archetype_id, vector jsonb, interpretation text
choices       id, session_id, pairing_id, chosen_song_id, ms_to_decide
user_roles    id, user_id, role (enum 'admin'|'user')
```

RLS:
- `songs`/`pairings`/`archetypes` — SELECT for authenticated; writes only via `has_role('admin')`.
- `profiles`/`sessions`/`choices` — owner-only.
- `user_roles` — SELECT self; writes service-role only.

Trigger auto-creates `profiles` row + default `user` role on signup. Explicit GRANTs on every table.

---

## Scoring math

On each choice in a pairing testing `[movement, melody]`:

```
for dim in pairing.tests:
  delta = song_a[dim] - song_b[dim]
  weight = pairing.diagnostic_weight / 100
  user.vector[dim] += sign * delta * weight
```

Archetype match: cosine similarity of user vector against each `archetype.signature_axes`. Top match wins.

`archetype_signals` are a parallel discrete tally — votes accumulate across chosen songs and break ties when the cosine match is close. They're also the substrate for V1+ explanations ("your signal pattern: forward_motion_romantic, texture_astronaut").

V0 matchup selection: weighted random by `diagnostic_weight`, with light variety enforcement across lanes. V2 will swap to information-gain (entropy reduction on the vector posterior).

---

## AI calls (Lovable AI Gateway, server-functions only)

1. `generateOpeningHypothesis(fiveSongs)` — one sharp line in your voice, stored on `profiles`.
2. `generateInterpretation(vector, top_axes, archetype, signals)` — 2–3 sentences. Saved on `sessions`. System prompt enforces voice: specific, no platitudes, no genre labels, slightly uncomfortable.

Both system prompts live in the repo for easy iteration. Model: `google/gemini-3-flash-preview`.

---

## Seed pipeline — building the Diagnostic Canon (not the Song Canon)

I'll generate the V0 canon during build as a one-time seed, output to `seed.json`, inserted via the Supabase tool:

1. **Curate ~220 songs** across your 10 lanes, admitted by *splitting potential* not prestige. Hand-pick the backbone; fill via AI suggestions filtered against an explicit "don't include consensus anthems" rule.
2. **Score 15 axes** per song via batched AI with dimension definitions in the system prompt. Spot-check + adjust outliers.
3. **Score `diagnostic_power`** per song — the AI rates "how much does choosing this song over a same-lane neighbor reveal?" Songs below ~60 get dropped.
4. **Compute `primary_dimensions`** as each song's top-3 z-scored axes vs its lane.
5. **Tag `archetype_signals`** from clusters in the song vector space.
6. **Generate pairing candidates** programmatically: same-lane neighbors with meaningful divergence on 1–3 dimensions, both songs `diagnostic_power >= 70`.
7. **AI-write `hypothesis` + `why_good`** for each candidate; cull to ~150 by the rule *"if the explanation isn't interesting, the pairing isn't interesting."*
8. **Draft 6 archetypes** from cluster centroids + signal patterns. Working names: The Atmospherist, The Kinetic, The Romantic, The Transformer, The Architect, The Anthemist — finals written during build in your voice.

Everything editable in `/admin` post-seed.

---

## Build sequence

1. Supabase connect — you'll paste URL + publishable key + service role key via the secrets prompt.
2. Schema migration — tables, RLS, grants, `has_role`, signup trigger.
3. Design tokens — Midnight Intelligence into `src/styles.css`.
4. Auth — `/auth` (email+password + Google via Lovable broker), `_authenticated` layout, root `onAuthStateChange`, sign-out hygiene.
5. Seed pipeline — run offline, commit `seed.json`, insert.
6. Onboarding chat → opening hypothesis.
7. Matchup engine — server fn picks weighted-random pairing, records choice, updates session vector.
8. Profile / results — radar, archetype card, interpretation, history.
9. Admin CRUD — songs / pairings / archetypes / diagnostic_power editor.
10. Landing — thesis copy, single CTA.

---

## Out of V0 (intentionally)

- Audio previews / Spotify (text-first; V1).
- Full information-gain matchup selection (V2 — V0 uses `diagnostic_weight` as a proxy).
- Share cards + challenge-a-friend (V1).
- Cross-user Taste Graph + Identity Graph rollups (V3).
- MovieDNA / BookDNA / ArchitectureDNA — same engine, different `content_type` column on songs/pairings later. The schema is built so adding a second content domain is a migration, not a rewrite.

---

## Technical notes

- TanStack Start `createServerFn` for all reads/writes; protected ones use `requireSupabaseAuth`.
- AI calls live inside server fns only (key stays server-side).
- Service-role admin client only inside server fns via `await import("@/integrations/supabase/client.server")`.
- `_authenticated/route.tsx` is the integration-managed `ssr: false` gate.
- Recharts for the 15-axis radar.

---

## To start, I need

1. **Confirm**: connect to your existing Supabase project (you'll get a secure secrets prompt for URL + keys).
2. **Confirm**: I generate the V0 Diagnostic Canon (~220 songs, ~150 pairings, 6 archetypes) during build. Everything editable in `/admin` after.
3. Anything to lock for archetype names or copy voice before I draft? (Otherwise I draft from the thesis and you tune via admin.)

Approve and I'll start with the Supabase connection and schema migration.
