# Multi-Lane Pairings Seed

This seed provides 20 diagnostic pairings for each non-Alternative MVP lane:

- `pop`
- `hip_hop`
- `electronic`
- `classic_rock`

Source data:

- `data/musicdna/multi_lane_pairings_seed.tsv`

## Curation Rules

- Pairings are diagnostic probes, not rankings.
- `tests` use only the current active 15 MusicDNA dimensions.
- `immersion` and `scale` remain candidate dimensions; when a pairing tests those ideas, represent the active scoring dimensions through `atmosphere`, `transformation`, `complexity`, `dreaminess`, `energy`, and `community`.
- Archetypes remain cross-lane.
- These pairings are draft elite candidates and should be human-reviewed before production seeding.

## Import Shape

Each row contains:

- `lane`
- `rank`
- `song_a_title`
- `song_a_artist`
- `song_b_title`
- `song_b_artist`
- `tests`
- `hypothesis`
- `why_this_matters`
- `diagnostic_weight`
- `curation_status`

`tests` is pipe-delimited so it can be converted directly into the `pairings.tests` text array.
