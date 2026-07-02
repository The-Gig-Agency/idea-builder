# MusicDNA Ontology

## Product Thesis

MusicDNA uses music as the input layer for self-discovery. The diagnostic unit is not a song, genre, artist, playlist, or archetype. The diagnostic unit is a forced choice between two songs where the contrast reveals a latent preference.

We are not building a catalog of songs. We are building a catalog of revealing decisions.

## What We're Actually Measuring

Read this before touching the dimension set below.

MusicDNA dimensions are **latent listening preferences**, not human traits. They describe tendencies in how someone chooses music under constraint. They do not describe who the person is.

This is a small wording gap with a large consequence.

Don't say:

> You value hope.

Say:

> You consistently choose songs that build toward emotional release.

Don't say:

> You are a seeker.

Say:

> Your picks reward slow reveals over instant payoff.

The first form is a personality claim we cannot defend. The second form is a behavioral pattern the choices actually support. Every dimension in the table below should be read as "a tendency observable in this user's picks," never as a permanent property of the user.

**Claim discipline for every dimension:**
- describe the choice, not the chooser
- name what the songs did, not what the person is
- allow the reader to disagree with the read without feeling diagnosed

## Inverted Architecture

Most teams would start from songs and work upward. MusicDNA starts from identity and works downward:

```text
IDENTITY GRAPH
    ^
TASTE GRAPH
    ^
DIAGNOSTIC MATCHUP GRAPH
    ^
SONG VECTOR GRAPH
    ^
SONGS
```

Ask the questions in this order:

1. What are we trying to learn about a person?
2. Which dimensions reveal that?
3. Which matchup reveals those dimensions?
4. Which songs create that matchup?

## Core Rule

Every matchup must answer:

> What latent dimension are we testing?

If that question cannot be answered clearly, the matchup should not exist.

## Dimension Set

Each dimension captures a **listening-choice tendency**, expressed on a 0-100 scale. Low and high poles describe the kind of song a user's picks lean toward — not a verdict about the user. See "What We're Actually Measuring" above for the wording rules any surface reading these values must follow.

| Dimension | Low Means | High Means |
|---|---|---|
| movement | static, suspended, contemplative | forward-driving, propulsive, in motion |
| atmosphere | dry, direct, foregrounded | immersive, spatial, textural |
| groove | melody-led, rhythm secondary | pulse-led, bass/drum/body-led |
| darkness | bright, playful, light | ominous, shadowed, heavy |
| hope | resigned, bleak, closed | lift, release, possibility |
| nostalgia | present/future-facing | memory, ache, backward pull |
| transformation | arrival, statement, fixed identity | becoming, journey, rebirth, transition |
| complexity | simple, direct, single-state | layered, multi-part, structurally ambitious |
| melody | texture/rhythm/attitude-first | tune-first, singable, hook-led |
| verbal_cleverness | minimal, plainspoken, nonverbal | lyrical wit, language, phrasing, wordplay |
| authenticity | stylized, ironic, mediated | raw, sincere, lived-in |
| romanticism | cool, dry, anti-grand | yearning, grandeur, emotional sweep |
| energy | restrained, low attack | intensity, charge, bodily force |
| dreaminess | grounded, sharp-edged | haze, blur, float, dissociation |
| community | private, solitary, inward | anthemic, communal, singalong/social |

## Candidate Dimension Expansion

The next ontology pass should strongly consider adding these dimensions:

| Dimension | Low Means | High Means |
|---|---|---|
| immersion | immediacy, instant hook, instant payoff, radio-friendly | slow reveal, cumulative effect, rewards repeat listening |
| scale | intimate, small-room, human-scale | vast, widescreen, cathedral-sized, horizon-seeking |

`immersion` may be one of the most predictive MusicDNA dimensions. It captures a tradeoff that ordinary genre systems miss:

> Immediacy vs immersion.

Example:

```text
Breaking Into Heaven > She Bangs the Drums
```

This is not simply "Stone Roses preference." It may indicate:

- immersion over immediacy
- journey over anthem
- atmosphere over hook
- cumulative effect over instant payoff

Other high-immersion diagnostic anchors include:

- `Breaking Into Heaven`
- `Slow Down`
- `Fools Gold`
- `Blue`
- `Vapour Trail`
- `Born Slippy .NUXX`

Do not treat these as "better songs." Treat them as songs that reveal a user's willingness to wait, sink in, and trust cumulative motion.

## Graph Layers

### Identity Graph

The highest-order product asset: patterns that map aesthetic choices to identity-level interpretation.

### Taste Graph

The behavioral dataset created when users make choices under constraint.

### Diagnostic Matchup Graph

The first defensible asset. A curated network of song pairings where each edge has a hypothesis, tested dimensions, and explanatory copy.

### Song Vector Graph

The song catalog represented as multidimensional taste objects. This is the substrate that supports diagnostic pairing and inference.

### Songs

Raw materials. A great song is not automatically a useful MusicDNA song.

## Diagnostic Canon

A Song Canon asks:

> What are the best songs?

A Diagnostic Canon asks:

> Which songs reveal something?

MusicDNA needs the second. Some songs are culturally important but diagnostically weak. Some songs are not consensus classics but are incredibly revealing because they split listeners along meaningful latent dimensions.

The app is not learning songs. It is learning tradeoffs.

Examples:

| Choice | Possible Tradeoff |
|---|---|
| `Breaking Into Heaven` over `She Bangs the Drums` | immersion > immediacy, journey > anthem |
| `Fools Gold` over `There She Goes` | groove-state > melodic concision |
| `Slow Down` over a more immediate single | drift/drag > hook/payoff |
| `Ceremony` over `Dreaming of Me` | transformation > charm/nostalgia |

## Diagnostic Song Fields

Each song row should include:

```json
{
  "diagnostic_power": 94,
  "primary_dimensions": ["transformation", "hope"],
  "archetype_signals": ["forward_motion_romantic", "texture_astronaut"],
  "candidate_dimensions": {
    "immersion": 91,
    "scale": 88
  }
}
```

`diagnostic_power` is not a greatness score. It estimates how useful a song is as a probe in future pairings.

## Pairing Quality Standard

A strong pairing should be:

- close enough culturally that either choice feels plausible
- different enough on one to three dimensions to be diagnostic
- explainable in a single sentence
- emotionally fun to answer
- specific enough to produce a meaningful "why this mattered" reveal

## Pairing Anti-Patterns

- famous song vs famous song with no hypothesis
- obscure song vs obvious classic where the choice mostly measures familiarity
- genre shock pairings that reveal only broad genre preference
- pairings where one song dominates every dimension
- pairings that cannot generate interesting result copy
