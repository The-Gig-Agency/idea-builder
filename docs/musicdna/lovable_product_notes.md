# Lovable Product Notes: Diagnostic Tradeoffs

## Core Instruction

MusicDNA is not learning songs. MusicDNA is learning tradeoffs.

Do not optimize the MVP around "great songs" or "famous songs." Optimize around decisions that reveal a user preference under constraint.

## New Insight

`Breaking Into Heaven` is a diagnostic song.

A traditional app sees:

> User likes The Stone Roses.

MusicDNA should see:

```text
Breaking Into Heaven > She Bangs the Drums
```

And infer:

- immersion over immediacy
- journey over anthem
- atmosphere over hook
- cumulative effect over instant payoff

That is the product.

## Candidate Dimensions

Add these as candidate dimensions for the next schema/scoring pass:

| Dimension | Low Means | High Means |
|---|---|---|
| immersion | instant hook, instant payoff, radio-friendly | slow reveal, cumulative effect, rewards repeat listening |
| scale | intimate, small-room, human-scale | vast, widescreen, cathedral-sized |

Do not migrate the schema automatically unless the implementation is ready to update:

- song vectors
- pairings
- scoring
- archetypes
- result chart
- seed/import scripts

## Priority Product Moment

After a user chooses, show the tradeoff immediately.

Example:

```text
You chose Breaking Into Heaven over She Bangs the Drums.

Why that mattered:
You trusted immersion over immediacy. You chose the long ascent over the instant anthem.
```

This moment matters more than a large result page.

## Seed Priorities

Make sure the diagnostic canon includes:

- `Breaking Into Heaven`
- `Slow Down`
- `Fools Gold`
- `Blue`
- `Ceremony`
- `Vapour Trail`
- `Born Slippy .NUXX`
- `Stars`

These are not merely favorites. They are probes.

## MVP Guidance

Before adding hundreds of pairings, build a small set of elite decisions around clear tradeoffs:

| Pairing | Tradeoff |
|---|---|
| `Breaking Into Heaven` vs `She Bangs the Drums` | immersion vs immediacy |
| `Fools Gold` vs `There She Goes` | groove-state vs melodic concision |
| `Ceremony` vs `Dreaming of Me` | transformation vs charm/nostalgia |
| `A Forest` vs `The Killing Moon` | propulsion vs cinematic romance |
| `Born Slippy .NUXX` vs `Teardrop` | bodily catharsis vs suspended atmosphere |

If the app cannot explain the tradeoff in one sentence, the pairing is not ready.
