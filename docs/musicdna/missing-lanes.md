# Missing Lanes — Ticket Backlog

Today the taxonomy is fixed at six values in `src/lib/musicdna.functions.ts`:

```ts
const LANES = ["alternative", "pop", "hip_hop", "electronic", "classic_rock", "general"];
```

That's enough to ship, but it leaks every time a user's opener doesn't
fit. Below is the list of lanes we should add, with examples of artists
that currently get jammed into a bucket they don't really belong in.

## Current temporary mapping

Until each lane below exists as a real top-level lane, we route them into
the closest existing one via `LANE_RULES` (LLM prompt) and
`catalogLaneToTopLane()` (catalog enrichment). See `src/lib/musicdna.functions.ts`.

| Temporary home | Actually contains today |
|----------------|--------------------------------------------------|
| classic_rock | hard rock, metal, prog, arena rock, glam, southern rock |
| alternative | emo, post-rock, math rock, screamo |
| hip_hop | R&B, neo-soul, modern soul |
| pop | country-pop, latin-pop, K-pop |
| electronic | ambient, dub, drone, modular / experimental |

## Lanes to add (priority order)

### 1. `metal` (highest priority — keeps showing up)
- Sabbath, Metallica, Iron Maiden, Slayer, Tool, Mastodon, Deftones, Korn, Gojira, Pantera.
- Distinct from classic_rock: weight is in rhythm guitar, scream/clean vocals, longer-form structures.
- Pairing dimensions worth carving out: brutality vs melody, technicality vs immediacy, catharsis vs precision.

### 2. `country`
- Cash, Hank Williams, Willie Nelson, Sturgill Simpson, Kacey Musgraves, Zach Bryan, Chris Stapleton.
- Currently no home at all — gets shoved into classic_rock or pop. Both are wrong.

### 3. `r_and_b` / `soul`
- Marvin Gaye, Stevie Wonder, D'Angelo, Frank Ocean, SZA, The Weeknd, Solange.
- Currently routes to hip_hop or pop. Different dimensional center of gravity
 (groove vs hook, restraint vs catharsis).

### 4. `jazz`
- Coltrane, Miles, Mingus, Robert Glasper, Kamasi Washington, BadBadNotGood.
- Will need its own scoring axes (improvisation, ensemble vs solo, mode vs changes).

### 5. `folk` / `singer_songwriter`
- Joni Mitchell, Nick Drake, Elliott Smith, Phoebe Bridgers, Sufjan Stevens, Big Thief, Bon Iver.
- Currently splinters between alternative and pop. Loses the "lyric-as-instrument" thread.

### 6. `prog` (split from metal/classic_rock)
- Rush, Yes, King Crimson, Pink Floyd, Tool (overlaps with metal), Porcupine Tree.
- Tradeoffs are very specific: composition vs feel, suite vs song, virtuosity vs restraint.

### 7. `world` / `latin` / `afrobeats`
- Fela, Bad Bunny, Rosalía, Burna Boy, Buena Vista Social Club.
- Massive blind spot today.

### 8. `ambient` / `experimental`
- Brian Eno, Tim Hecker, Grouper, William Basinski, Stars of the Lid.
- Currently routes to electronic. Diagnostic axes ("immersion", "scale") are
  almost the *only* axes that matter — different shape than dance electronic.

### 9. `classical` / `score`
- Hard mode; needs its own canon and probably its own scoring axes.

## What "adding a lane" actually involves

For each new lane, the work is:

1. Add the string to `LANES` and the `Lane` type.
2. Add a clause to `LANE_RULES` (LLM prompt).
3. Add sub-genre matchers to `catalogLaneToTopLane`.
4. Seed a canon of songs in the `songs` table with `primary_lane = <new lane>`.
5. Seed at least ~12 within-lane pairings in `pairings` with `lane = <new lane>`,
   so `pickNextPairing` has something to serve when the user lands there.
6. Add the lane to the `LANE_LABEL` display map wherever it appears in the UI.
7. Add a Tailwind / display color if lanes are color-coded.

Until the canon + pairings exist, adding a lane only hurts — the engine will
classify users into a lane it can't actually run.

## Fallback behavior (today)

When `confidence < 0.4`, instead of dumping to `general` (which fishes across the whole pairings catalog), we now call `dominantPerSongLane(per_song)` and route to the most common lane among the user's individual songs. So a user who lists Subdivisions + Paranoid + One — even if the LLM is unsure overall — will at least land in `classic_rock` pairings instead of getting served Kendrick.
