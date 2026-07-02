# Subcultures — Controlled Vocabulary

Subcultures describe **where a song comes from musically** — the movement, scene, or cultural neighborhood it belongs to. They are descriptive metadata, never used for routing and never used as diagnostic dimensions.

## The three separations (do not collapse)

| Concept | Field | Purpose | Example (Ceremony, New Order) |
|---|---|---|---|
| Routing | `primary_lane` | Which pairing pool the song participates in | `alternative` |
| Musical identity | `subculture[]` | What movement it comes from | `["post_punk","new_wave"]` |
| Diagnostic dimensions | `diagnostic{}` | What choosing it reveals | `{ movement: 94, immersion: 95, ... }` |

If we ever overwrite `subculture` with `primary_lane`, we have destroyed information. This has already happened once and is the reason this document exists.

## Rules

1. `subculture` is `text[]`, max **3** tags per song (DB `CHECK` constraint).
2. Values MUST come from the vocabulary below. New tags require adding a row to the `subcultures` reference table.
3. Slugs are lowercase, snake_case. No hyphens, no spaces. `post_punk`, never `post-punk` or `postpunk`.
4. One tag is the common case. Two tags means genuine hybrid (Ceremony is both post-punk and new wave). Three is the ceiling, used sparingly.
5. Do not use subculture to encode routing (`alternative`, `pop`, `hip_hop`), era (`1980s`), region (`manchester`, `uk`), or diagnostic traits (`immersive`, `hypnotic`). Those belong in other fields.

## Vocabulary (v1)

Curated for the 1980s MVP and the currently seeded catalog. Additions are welcome; deletions are not — retiring a tag orphans data.

### Post-punk / new wave family
| slug | label | notes |
|---|---|---|
| `post_punk` | Post-punk | Angular, austere, art-school aftermath of punk. Joy Division, Wire. |
| `new_wave` | New wave | Pop-adjacent post-punk. Blondie, Talking Heads, early New Order. |
| `goth` | Goth | Bauhaus, Sisters of Mercy, early Cure. |
| `darkwave` | Darkwave | Synth-forward gothic; Clan of Xymox, Cocteau Twins' darker edge. |
| `industrial` | Industrial | Nine Inch Nails, Ministry, Skinny Puppy. |

### Guitar / alternative family
| slug | label | notes |
|---|---|---|
| `shoegaze` | Shoegaze | Wall-of-guitar, buried vocals. My Bloody Valentine, Ride. |
| `dream_pop` | Dream pop | Melodic, gauzy, less abrasive than shoegaze. Cocteau Twins, Mazzy Star. |
| `noise_pop` | Noise pop | Melody under distortion. Jesus and Mary Chain. |
| `britpop` | Britpop | Oasis, Blur, Pulp. Mid-90s UK guitar pop. |
| `indie_pop` | Indie pop | Smiths lineage, jangly, small-label sensibility. |
| `indie_pop` | Indie pop | Smiths lineage, jangly, small-label sensibility. |
| `college_rock` | College rock | US 80s alternative before "alternative" was a format. R.E.M., early Pixies. |
| `grunge` | Grunge | Nirvana, Soundgarden, Mudhoney. |
| `alternative_rock` | Alternative rock | 90s mainstream alt when nothing more specific fits. |
| `punk` | Punk | Ramones, Clash, Sex Pistols era + descendants. |
| `hardcore` | Hardcore | Faster, harder, more disciplined than punk. Minor Threat, Black Flag, Fugazi. |
| `no_wave` | No wave | Late-70s NYC anti-rock. DNA, Teenage Jesus, Lydia Lunch. |
| `post_rock` | Post-rock | Guitars used for texture, not riffs. Slint, Mogwai, Godspeed You! Black Emperor. |
| `art_rock` | Art rock | Roxy Music, Bowie's Berlin trilogy, Talk Talk. |

Cut from v1 draft: bare `indie` (too vague — use `indie_pop`, `indie_dance`, or `indie_rock` if we add it) and `experimental` (a descriptor, not a scene — no journalist writes "this experimental song from the experimental scene").


### Dance / electronic family
| slug | label | notes |
|---|---|---|
| `electronica` | Electronica | Umbrella for electronic music that isn't strictly club-targeted. |
| `club` | Club | Made for the floor. House, techno, garage in a DJ context. |
| `dance` | Dance | Pop-facing dance music. Pet Shop Boys, early Madonna, Erasure. |
| `madchester` | Madchester | Stone Roses, Happy Mondays. Guitars meet the acid house floor. |
| `indie_dance` | Indie dance | Post-Madchester crossover. Primal Scream *Screamadelica*. |
| `trip_hop` | Trip-hop | Portishead, Massive Attack, Tricky. |
| `synth_pop` | Synth-pop | Depeche Mode, OMD, Human League. |

### Pop / soul / adjacent
| slug | label | notes |
|---|---|---|
| `sophisti_pop` | Sophisti-pop | Prefab Sprout, Style Council, Sade. Jazz-inflected 80s pop. |
| `crossover` | Crossover | Song deliberately straddles two scenes; pair with a second tag that names the second scene. |

## Backfill mapping (one-time, from legacy `lane`)

Applied by the split migration. Preserved here so we can reconstruct intent if the migration ever needs to be re-run.

| Legacy `lane` | `subculture[]` |
|---|---|
| `post_punk_new_wave` | `["post_punk","new_wave"]` |
| `shoegaze_dreampop` | `["shoegaze","dream_pop"]` |
| `goth_darkwave` | `["goth","darkwave"]` |
| `britpop_indiepop` | `["britpop","indie_pop"]` |
| `grunge_altrock` | `["grunge","alternative_rock"]` |
| `manchester_indie_dance` | `["madchester","indie_dance"]` |
| `electronic_crossover` | `["electronica","club"]` |
| `artrock_experimental` | `["art_rock","experimental"]` |
| `sophistipop_lyric_indie` | `["sophisti_pop","indie"]` |
| `punk_noise_edge` | `["punk","noise_pop"]` |
| `post-punk` | `["post_punk"]` |
| `madchester` | `["madchester"]` |
| `alt-rock` | `["alternative_rock"]` |
| `pop`, `hip_hop`, `electronic`, `classic_rock`, `country`, `metal`, `r_and_b` | `[]` (routing values that leaked into `lane` — nothing to preserve) |

## Adding a new subculture

1. Propose the slug, label, and one-sentence notes in a PR against this file.
2. Add a row to the `subcultures` reference table in a migration.
3. Only after the reference row exists can songs be tagged with it (FK / CHECK enforced).

## Anti-patterns

- Using `subculture` to route pairings. Routing is `primary_lane`.
- Using `subculture` to describe how a song feels (`immersive`, `hypnotic`). That's `listening_mode` (future) or `diagnostic{}`.
- Free-text subculture values in the admin UI. Always a controlled multi-select.
- Silently coercing `post-punk` → `post_punk` at write time. Reject the write instead; drift starts with tolerance.
