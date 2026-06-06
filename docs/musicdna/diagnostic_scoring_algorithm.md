# MusicDNA Diagnostic Scoring Algorithm

## Purpose

MusicDNA should be able to build new lanes across genre and decade without becoming a genre quiz.

The reusable unit is the diagnostic axis:

> What tradeoff does this song help reveal?

Genres, decades, and scenes are routing context. Diagnostic axes are the measurement system.

## Naming

Use these terms consistently:

- **Result archetype**: the user-facing identity outcome, such as `Forward Motion Romantic`.
- **Diagnostic axis**: a measurable preference tension, such as movement vs stillness or immersion vs immediacy.
- **Diagnostic song family**: songs that strongly expose one diagnostic axis across different lanes.
- **Lane**: the cultural routing universe, such as Alternative, Pop, Hip-Hop, Electronic, Classic Rock, or future Country.

Do not call diagnostic song families "archetypes" in code or schema. That word is already reserved for result identities.

## Axis-First Model

Start with the axis, then find lane-specific songs.

Example:

| Diagnostic Axis | Alternative | Hip-Hop | Pop | Country | Rock |
|---|---|---|---|---|---|
| movement | `Ceremony` | `Lose Yourself` | `Green Light` | `Friends in Low Places` | `Go Your Own Way` |
| atmosphere | `A Forest` | `Money Trees` | `Ocean Eyes` | `Blue Eyes Crying in the Rain` | `Wicked Game` |
| immersion | `Breaking Into Heaven` | `Devil in a New Dress` | `All Too Well (10 Minute Version)` | `Pancho and Lefty` | `Fools Gold` |
| scale | `Stars` | `Stan` | `Running Up That Hill` | `The Dance` | `Purple Rain` |
| community | `Mr. Brightside` | `Juicy` | `Hey Ya!` | `Friends in Low Places` | `Don't Stop Believin'` |

The goal is not to find the best song in each genre. The goal is to find the song that makes a choice meaningful.

## Song Scoring

Each song gets the active 0-100 MusicDNA dimension scores plus diagnostic metadata.

Current active dimensions:

- `movement`
- `atmosphere`
- `groove`
- `darkness`
- `hope`
- `nostalgia`
- `transformation`
- `complexity`
- `melody`
- `verbal_cleverness`
- `authenticity`
- `romanticism`
- `energy`
- `dreaminess`
- `community`

Candidate dimensions:

- `immersion`: immediacy vs slow reveal
- `scale`: intimate vs vast

Do not add candidate dimensions to active scoring until schema, charts, seed data, result matching, and pairing generation all move together.

### Diagnostic Power Score

Every song gets a `diagnostic_power` score from 0-100.

This does not ask:

> How good is this song?

It asks:

> How much does choosing this song teach us about the listener?

Curators score six components, then the app calculates the final Diagnostic Power Score.

| Component | Points | Question |
|---|---:|---|
| `polarization` | 0-25 | Does this song split knowledgeable listeners? |
| `tradeoff_richness` | 0-20 | How many meaningful dimensions does this song activate? |
| `pairing_density` | 0-15 | How many great matchups can this song create? |
| `identity_signaling` | 0-15 | If someone volunteers this song unprompted, do we learn something? |
| `longevity` | 0-10 | Does the song survive beyond its era? |
| `cross_genre_mapping` | 0-15 | Can this song connect to songs outside its genre emotionally or structurally? |

```text
diagnostic_power =
  polarization
+ tradeoff_richness
+ pairing_density
+ identity_signaling
+ longevity
+ cross_genre_mapping
```

The component maximums already encode the weighting:

- polarization: 25%
- tradeoff richness: 20%
- pairing density: 15%
- identity signaling: 15%
- longevity: 10%
- cross-genre mapping: 15%

#### Component Guidance

`polarization` is the most important factor.

Examples:

| Song | Polarization Direction |
|---|---|
| `Billie Jean` | low; almost everyone likes it |
| `Sweet Child O' Mine` | low-to-medium; broadly agreeable |
| `Ceremony` | high; creates camps |
| `Fools Gold` | elite; extremely revealing under constraint |
| `Slow Down` | elite; not obvious, but highly identity-laden |

`tradeoff_richness` measures how many meaningful dimensions the song activates. `Ceremony` can test movement, hope, transformation, and atmosphere. `Livin' on a Prayer` may mostly test energy and community.

`pairing_density` measures how many elite matchups the song can support. `Ceremony` can pair against `A Forest`, `Dreaming of Me`, `Temptation`, `She Bangs the Drums`, and `Never Let Me Down Again`. A random album cut may create only one weak matchup.

`identity_signaling` measures what we learn when the user volunteers the song in their top five. `Slow Down` and `Breaking Into Heaven` are huge signals. `Friends in Low Places` is a moderate-to-strong signal. `Hey Jude` is weaker because it is too broadly loved.

`longevity` measures whether the song still matters beyond its era. Avoid forgotten radio filler unless it creates an unusually sharp diagnostic choice.

`cross_genre_mapping` is the secret sauce. `Ceremony` can map emotionally to `Born Slippy`, `Runaway`, `Fast Car`, and `Teardrop`, even though those songs are not sonically identical.

Guidance:

- `90-100`: elite diagnostic anchor.
- `75-89`: useful diagnostic song.
- `55-74`: support/familiarity anchor.
- `<55`: famous or interesting, but weak as a probe.

Examples:

| Song | Polarization | Tradeoff Richness | Pairing Density | Identity Signaling | Longevity | Cross-Genre Mapping | DPS |
|---|---:|---:|---:|---:|---:|---:|---:|
| `Ceremony` | 22 | 18 | 15 | 14 | 10 | 14 | 93 |
| `Fools Gold` | 25 | 19 | 15 | 14 | 9 | 14 | 96 |
| `Slow Down` | 25 | 17 | 13 | 15 | 7 | 14 | 91 |
| `Billie Jean` | 5 | 12 | 12 | 5 | 10 | 14 | 58 |

`Billie Jean` is a fantastic song. Its DPS is lower because choosing it usually reveals less.

### Canon Score

Keep `canon_score` separate from `diagnostic_power`.

`canon_score` asks how culturally important the song is:

```text
canon_score =
  influence
+ popularity
+ critical_recognition
+ longevity
```

This lets MusicDNA distinguish four useful categories:

| Category | Diagnostic Power | Canon Score | Use |
|---|---:|---:|---|
| elite diagnostic canon | high | high | core launch anchors |
| hidden diagnostic weapon | high | medium/low | identity-revealing probes |
| familiarity anchor | medium/low | high | onboarding/search comfort, occasional contrast |
| weak catalog filler | low | low | avoid unless a specific matchup needs it |

Every song should eventually carry both values:

```json
{
  "diagnostic_power": 94,
  "canon_score": 88,
  "polarization": 22,
  "tradeoff_richness": 18,
  "pairing_density": 15,
  "identity_signaling": 14,
  "longevity": 10,
  "cross_genre_mapping": 15
}
```

## Pairing Scoring

Pairings are the highest-value IP. Score the pair, not just the songs.

```text
pairing_score =
  0.30 * target_axis_contrast
+ 0.20 * controlled_similarity
+ 0.20 * decision_tension
+ 0.15 * explanation_yield
+ 0.10 * lane_fit
+ 0.05 * data_value
- familiarity_imbalance_penalty
- dominance_penalty
- genre_shock_penalty
```

Where:

- `target_axis_contrast`: the pair differs clearly on one to three target axes.
- `controlled_similarity`: the pair is close enough culturally that the choice is not just genre preference.
- `decision_tension`: both songs are plausible winners for the intended audience.
- `explanation_yield`: the app can explain why the choice mattered in one sentence.
- `lane_fit`: the pairing belongs in the user's routed lane or in an intentional general lane.
- `data_value`: the answer reduces uncertainty about the user's taste vector.
- `familiarity_imbalance_penalty`: subtract when one song is far more known than the other.
- `dominance_penalty`: subtract when one song is obviously stronger across every relevant dimension.
- `genre_shock_penalty`: subtract when the choice mostly measures broad genre acceptance.

Guidance:

- `90-100`: launch-quality elite diagnostic pairing.
- `80-89`: useful MVP pairing.
- `65-79`: keep as candidate, needs human review.
- `<65`: reject or redesign.

## Pairing Generation Rule

Generate candidates by asking:

1. Which axis do we want to test?
2. Which lane is the user in?
3. Which two songs are close enough to make the choice fair?
4. Which one to three dimensions should diverge?
5. Can the reveal cite the tradeoff without sounding like a horoscope?

Good candidates:

- Close on cultural context.
- Different on one to three diagnostic axes.
- Both plausible choices.
- Explainable as a tradeoff.

Bad candidates:

- Great song vs weak song.
- Famous song vs obscure song unless familiarity is the test.
- Genre shock.
- Pairings where the explanation is only "you like rap more than pop."

## Axis Examples By Lane

### Hip-Hop

| Tradeoff | Pairing | Tests |
|---|---|---|
| atmosphere vs realism | `Money Trees` vs `N.Y. State of Mind` | atmosphere, authenticity, darkness |
| vulnerability vs confidence | `Runaway` vs `HUMBLE.` | authenticity, energy, transformation |
| story vs vibe | `Stan` vs `Juicy` | darkness, community, nostalgia |

### Pop

| Tradeoff | Pairing | Tests |
|---|---|---|
| intimacy vs spectacle | `All Too Well` vs `Rolling in the Deep` | authenticity, romanticism, energy |
| cool vs audacious | `Style` vs `Toxic` | groove, melody, energy |
| atmosphere vs hook | `Ocean Eyes` vs `Levitating` | atmosphere, dreaminess, community |

### Country

Country should become a future lane because it is rich diagnostically, especially for story, community, melancholy, defiance, and plainspoken authenticity.

| Tradeoff | Pairing | Tests |
|---|---|---|
| story vs anthem | `Pancho and Lefty` vs `Friends in Low Places` | authenticity, verbal_cleverness, community |
| melancholy vs defiance | `He Stopped Loving Her Today` vs `Copperhead Road` | darkness, authenticity, energy |
| intimacy vs community | `Blue Eyes Crying in the Rain` vs `Friends in Low Places` | romanticism, community, nostalgia |

### Rock

| Tradeoff | Pairing | Tests |
|---|---|---|
| scale vs tension | `Kashmir` vs `Gimme Shelter` | darkness, energy, romanticism |
| wonder vs catharsis | `Stars` vs `Mayonaise` | dreaminess, transformation, energy |
| precision vs chaos | `Tom Sawyer` vs `Where Is My Mind?` | complexity, energy, authenticity |

## Information Gain

Each matchup should reduce uncertainty about the user.

For MVP, approximate information gain with simple vector uncertainty:

```text
axis_need = 1 / (1 + abs(current_user_axis_score))
pair_information_gain = average(axis_need for pairing.tests) * pairing_score
```

This means early matchups can test broad high-value axes, while later matchups should target dimensions where the user remains uncertain.

Future ML can replace this with learned information gain from actual completion and retention data. The event schema should already log:

- pairing shown
- choice made
- reveal shown
- reveal expanded/shared
- session completed
- result shared
- user returned

## Minimum Acceptance Standard

A song is not ready for the diagnostic canon unless it has:

- `primary_lane`
- granular `lane`
- active dimension scores
- `diagnostic_power`
- `canon_score`
- component scores for `polarization`, `tradeoff_richness`, `pairing_density`, `identity_signaling`, `longevity`, and `cross_genre_mapping`
- one to three `primary_dimensions`
- at least one diagnostic song family or candidate-axis note
- one plausible same-lane opponent

A pairing is not ready unless it has:

- top-level `lane`
- two songs whose `primary_lane` matches that lane
- one to three `tests`
- a named tradeoff
- one-sentence `why_this_matters`
- `pairing_score` or `diagnostic_weight`

The sentence to keep taped above the scoring work:

> We are scoring songs by how well they create revealing decisions.
