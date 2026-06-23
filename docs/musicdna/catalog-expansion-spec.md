# MusicDNA Catalog Expansion Spec (for ChatGPT)

## Context you need to know first

We run a forced-choice taste diagnostic. A user picks **3 opening songs** → we route them to a lane → we serve them ~12 head-to-head pairings within that lane → we infer their taste along 10 dimensions.

Your job: expand our song catalog and our pairing catalog so users get more variety and more accurate within-lane reads.

### Active lanes (top-level routing)

`alternative` | `pop` | `hip_hop` | `electronic` | `classic_rock` | `general` (fallback only — do not target)

### Active diagnostic dimensions (the only 10 we score)

All scored 0–100. Low pole / high pole:

| dim | low | high |
|---|---|---|
| movement | stillness | forward motion |
| atmosphere | statement | immersive mood |
| immersion | immediacy | slow reveal |
| scale | intimate | vast |
| community | solitary | communal |
| perspective | feeling (first-person, inside) | witness (narrator, outside) |
| confidence | vulnerability | command |
| tension | release | danger |
| texture | rawness | refinement |
| transformation | holds its shape | becomes something else |

Do not invent dimensions. Do not use `groove`, `darkness`, `hope`, `nostalgia`, etc. — they are legacy and not scored.

### Core rule

A song or pairing exists to **reveal** something, not to be famous. Diagnostic power > canon prestige. We want songs that split listeners along the 10 axes above. A song that everyone scores the same way on every axis is useless to us regardless of greatness.

### Why 3 openers matters for catalog design

The first 3 songs are **not enough to fully diagnose taste**; they only need to route the user into the right lane. The pairings do the real diagnostic work. That means:
- The catalog needs enough coverage that 3 named songs reliably hit known entries (or close artist matches) so lane routing succeeds.
- Sub-lane diversity inside each lane matters more, not less — the within-lane pairings carry the diagnostic load.
- Coverage breadth across artists beats deeper coverage of a few famous artists.

### Global constraints (apply to every song)

- **Known enough**: prefer songs with enough listener recognition to make fair pairings. Obscure songs are allowed only when diagnostic power is exceptional.
- **Artist cap**: max **3 songs per artist per lane** unless explicitly justified in the `rationale`.
- **Score direction**: higher score always means the **high pole** in the dimension table above. (e.g. `movement: 85` = forward motion; `movement: 15` = stillness.)
- **Stable IDs**: every song gets a `song_id` of the form `artist_slug__title_slug` (lowercase, non-alphanumerics → `_`, double underscore between artist and title). Pairings reference songs by `song_a_id` / `song_b_id`, not by title — titles collide.

---

## PASS 1 — Songs

### Targets per lane (deliver this many new songs, not counting what we already have)

- alternative: **150**
- pop: **75**
- hip_hop: **75**
- electronic: **50**
- classic_rock: **50**

### For each song, return this exact JSON shape

```json
{
  "title": "string",
  "artist": "string",
  "primary_lane": "alternative | pop | hip_hop | electronic | classic_rock",
  "sub_lane": "string — granular descriptor, e.g. 'shoegaze_dreampop', 'post_punk_new_wave', 'boom_bap', 'trap_soul', 'synth_pop', 'arena_rock', 'idm', 'house', 'g_funk'. Free-form but consistent.",
  "release_year": 1985,
  "movement": 0,
  "atmosphere": 0,
  "immersion": 0,
  "scale": 0,
  "community": 0,
  "perspective": 0,
  "confidence": 0,
  "tension": 0,
  "texture": 0,
  "transformation": 0,
  "canon_score": 0,
  "diagnostic_power": 0,
  "polarization": 0,
  "tradeoff_richness": 0,
  "identity_signaling": 0,
  "rationale": "1–2 sentences: what does choosing this song over a typical lane-mate teach us?"
}
```

### Scoring guidance

- 50 = neutral. Don't park everything at 50. We need spread.
- A song should have at least 3 axes outside the 35–65 band or it isn't pulling weight.
- `canon_score` = influence / recognition / longevity. "How known is it?"
- `diagnostic_power` = "If someone puts this in their top 3, what do we learn?" These are independent — a #1 Billboard hit can have low diagnostic power; an obscure B-side can have high diagnostic power.
- `polarization` = how strongly fans/non-fans disagree about it.
- `tradeoff_richness` = how many of the 10 axes the song meaningfully tests (not just 1–2).
- `identity_signaling` = how much picking this song says "this is who I am."

### Within-lane diversity requirements

For each lane, the set you deliver must include songs across all of these sub-lane buckets, roughly proportional to listener share:

- **alternative**: post-punk/new wave, shoegaze/dreampop, indie rock 90s, indie rock 2000s+, britpop, manchester/madchester, goth/darkwave, emo/midwest, art rock, slowcore, math rock, post-rock
- **pop**: synth-pop 80s, dance-pop, teen-pop, adult-contemporary, art-pop, bedroom-pop, k-pop crossover, country-pop crossover
- **hip_hop**: boom bap, g-funk, southern/trap, conscious/backpack, drill, alt/experimental, mainstream hits, soul-sampling
- **electronic**: house, techno, drum & bass, idm, ambient, downtempo, trance, dubstep, electroclash
- **classic_rock**: 60s british invasion, american 60s/70s, blues rock, prog, glam, southern rock, hard rock/proto-metal, 70s singer-songwriter, arena rock 80s

### What to avoid

- Don't dump the same five Radiohead albums into alternative. Spread across artists.
- Don't pick songs only because they're critically acclaimed. Pick songs that separate listeners.
- Don't pick songs that score near 50 on every dimension. They contribute nothing.
- Don't cross-lane: a hip-hop crossover hit goes in `hip_hop`, not `pop`, even if pop fans know it. Use `primary_lane` = where the diagnostic signal lives.

### Delivery format

One JSON array per lane, in code blocks. Lane name as the heading. Sorted by `diagnostic_power` descending.

---

## PASS 2 — Pairings

Do this only after Pass 1 is reviewed and song titles are locked. Pairings reference song titles, so they break if the song list shifts.

### Targets per lane

- alternative: **100** new pairings
- pop: **50**
- hip_hop: **50**
- electronic: **35**
- classic_rock: **35**

### For each pairing, return this exact JSON shape

```json
{
  "lane": "alternative | pop | hip_hop | electronic | classic_rock",
  "song_a_title": "string",
  "song_a_artist": "string",
  "song_b_title": "string",
  "song_b_artist": "string",
  "tests": ["movement", "atmosphere"],
  "hypothesis": "One sentence: what does choosing A over B reveal? e.g. 'Picking A signals immersion over immediacy and atmosphere over statement.'",
  "why_this_matters": "1–2 sentences on what we learn about the listener. Conversational, hedged, curious. Not certain.",
  "diagnostic_weight": 75,
  "expected_split": "55-45 | 60-40 | 70-30 — your honest guess at how the population will split. Avoid 90-10; that's not diagnostic, it's obvious."
}
```

### Pairing construction rules

- Both songs must share `primary_lane`. No cross-lane pairings. We want depth, not equivalence games.
- Different sub-lanes within the lane are good — e.g. a shoegaze vs post-punk pairing inside alternative is more diagnostic than two shoegaze songs.
- `tests` lists 1–3 axes the pairing meaningfully separates. Don't list axes where the two songs score similarly. Look at the Pass 1 vectors: a meaningful test = the two songs differ by ≥20 points on that axis.
- Every pairing must answer: "What latent dimension are we testing?" If you can't name it cleanly, drop the pairing.
- Avoid stacking pairings on the same axis. Across the set for a lane, distribute `tests` so every one of the 10 dimensions gets tested by at least 5 pairings.
- `diagnostic_weight` = your confidence the pairing genuinely separates people. 80+ = elite probe. 50 = decent. <40 = drop it.
- No obvious mismatches. Both songs should be defensible picks for a listener in that lane. "Beloved canonical track vs unknown deep cut" is not a pairing, it's a popularity test.
- No two pairings using the same two songs (any order).

### Voice for `why_this_matters`

- Smart, conversational, a little hedged ("early read", "maybe", "tell me if I'm wrong").
- Music-critic swagger but never certain — we're getting to know the user.
- Never genre-talk as analysis ("they're an indie kid"). Talk about what they **reward**.

Examples of tone:

- ✅ "Picking Vapour Trail over Just Like Heaven probably means you'd rather sink in than be grabbed. Patience as taste."
- ❌ "Vapour Trail is a shoegaze classic and you must love the genre."

### Delivery format

One JSON array per lane, code blocks, lane name as heading. Sorted by `diagnostic_weight` desc.

---

## Self-check before sending output

- Every song scored on all 10 dimensions, no nulls.
- No song parked at 50 across the board.
- Every pairing's `tests` axes show ≥20 point difference between A and B in the Pass 1 vectors.
- Every lane has roughly even axis coverage across pairings.
- Sub-lane diversity inside each lane.
- No legacy dimensions (`groove`, `darkness`, `hope`, `nostalgia`, etc.) referenced anywhere.
- Lane routing works from a **3-song** fingerprint — coverage breadth beats artist depth.
