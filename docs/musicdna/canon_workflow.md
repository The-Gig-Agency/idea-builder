# Alternative Diagnostic Canon Workflow

## Goal

Create the first proprietary MusicDNA asset for the Alternative/Post-Punk lane:

1. a 250-song diagnostic anchor set
2. draft vectors across 15 dimensions
3. diagnostic metadata for each song
4. 500 AI-generated candidate pairings
5. 150-250 human-approved diagnostic pairings

The goal is not to collect the best songs.

The goal is to collect songs that reveal something when placed under constraint.

## Current Local Assets

- `data/musicdna/alternative_diagnostic_canon_seed.csv`: generated 250-song draft diagnostic canon with dimension scores and diagnostic metadata.
- `tools/musicdna/generate_alternative_canon.cjs`: deterministic generator used to create the seed CSV.
- `tools/musicdna/validate_canon.cjs`: validates row count, score ranges, duplicate songs, and lane balance.
- `docs/musicdna/ontology.md`: dimension definitions and pairing quality standard.

## Curation Stages

### Stage 1: Diagnostic Review

Review whether each song reveals something useful in the Alternative/Post-Punk lane.

Use these labels in future review columns:

- `keep`
- `replace`
- `needs_debate`
- `too_obscure`
- `too_obvious_but_useful`
- `great_but_low_signal`
- `high_signal_not_canonical`
- `wrong_lane`

### Stage 2: Diagnostic Metadata Review

Review:

- `diagnostic_power`
- `primary_dimensions`
- `archetype_signals`

High `diagnostic_power` songs should be good at splitting users along meaningful dimensions. Low `diagnostic_power` songs may still be famous, beloved, or useful as familiarity anchors.

### Stage 3: Vector Review

The current scores are draft baseline scores derived from lane profiles with deterministic per-song variation. They are useful for bootstrapping pairing generation, but not final truth.

Human review should focus first on songs that will appear in high-impact pairings:

- `Ceremony`
- `Temptation`
- `A Forest`
- `The Killing Moon`
- `Fools Gold`
- `Born Slippy .NUXX`
- `Vapour Trail`
- `This Charming Man`
- `Never Let Me Down Again`
- `Teardrop`

### Stage 4: Candidate Pairing Generation

Generate candidate pairings using these rules:

- cultural distance should usually be low or medium
- total vector distance should be moderate
- one to three target dimensions should have strong contrast
- all other dimensions should be reasonably close
- at least one side should usually have strong diagnostic power

Candidate pairings should include:

- `song_a`
- `song_b`
- `tested_dimensions`
- `hypothesis`
- `why_this_matters`
- `expected_information_gain`
- `curator_status`

### Stage 5: Elite Pairing Selection

Keep only pairings where the explanation is interesting.

Working target:

- Generate 500 candidates.
- Human-review them.
- Keep 150-250 elite pairings for V1.

## V0 Target

For the first prototype, use:

- 20-40 songs
- 20-30 pairings
- 3 archetypes
- conversational onboarding
- per-choice reveal copy

The V0 question is not "Can we model music taste perfectly?"

The V0 question is:

> Do users feel weirdly understood after a small number of choices?
