# MusicDNA Intelligence Layer

## Core Principle

Encode the process, not the prose.

MusicDNA should not ask an AI to explain a person. It should ask the system to explain the user's choices.

The insight should emerge as a side effect of disciplined evidence handling.

## Two-AI Architecture

### AI #1: The Analyst

The Analyst is structured, boring, and evidence-first.

It outputs durable reasoning artifacts:

```json
{
  "observations": [],
  "patterns": [],
  "confidence": [],
  "counterarguments": []
}
```

The Analyst should not write personality copy.

### AI #2: The Critic

The Critic turns the Analyst output into readable prose.

It may be elegant, specific, and music-literate, but it may not invent claims that are not present in the Analyst output.

The Critic is a great music journalist who has been paying attention, not a psychologist, therapist, astrologer, or life coach.

## Five-Layer Reasoning Pipeline

### Layer 1: Observation Engine

Output only concrete choice facts.

Example:

```yaml
observations:
  - user chose Ceremony over Dreaming of Me
  - user chose Temptation over This Charming Man
  - user chose A Forest over The Killing Moon
```

No conclusions yet.

### Layer 2: Pattern Engine

Translate observations into tradeoff patterns.

Example:

```yaml
patterns:
  - movement preferred over melody
  - transformation preferred over nostalgia
  - immersion preferred over immediacy
```

Still no personality claims.

### Layer 3: Counter-Hypothesis Engine

Require alternative explanations.

Example:

```yaml
alternative_explanations:
  - user may simply prefer New Order
  - user may prefer early 80s production
  - user may be influenced by nostalgia
```

This layer prevents horoscope drift.

### Layer 4: Evidence Threshold

A conclusion cannot be stated unless it clears an evidence threshold.

Minimum rule:

```yaml
supporting_choices: 3
confidence_threshold: 0.65
```

Bad:

> You value transformation.

Good:

> Across 7 relevant matchups, you chose songs associated with transformation over songs associated with nostalgia.

The conclusion must carry its evidence with it.

### Layer 5: Narrative Generator

Only after the first four layers may the system produce prose.

Prompt posture:

```text
You are a music critic, not a therapist.

You are not diagnosing the user.
You are identifying patterns in their choices.
Every observation must reference evidence.
Describe tendencies.
Acknowledge uncertainty.
```

Avoid:

- dreamer
- seeker
- old soul
- empath
- creative spirit
- destiny
- wound
- soul
- trauma
- secretly
- you are the kind of person who

Prefer:

- across these choices
- this suggests
- this may indicate
- you repeatedly favored
- the evidence is strongest around
- a weaker alternative explanation is
- this reading should remain tentative because

## Durable Storage

Do not store only the final narrative.

Store the reasoning:

```json
{
  "session_id": "...",
  "observations": [
    {
      "choice_id": "...",
      "chosen": "Ceremony",
      "rejected": "Dreaming of Me",
      "tested_dimensions": ["transformation", "nostalgia"],
      "tradeoff": "transformation over nostalgia"
    }
  ],
  "patterns": [
    {
      "dimension": "transformation",
      "opposed_dimension": "nostalgia",
      "supporting_choices": 7,
      "confidence": 0.78
    }
  ],
  "counterarguments": [
    {
      "claim": "user may simply prefer New Order",
      "impact": "medium",
      "notes": "Two of the strongest supporting choices involve New Order."
    }
  ],
  "narrative": "..."
}
```

The LLM can change. The prose can change. The durable reasoning should survive.

## Output Contract

The Analyst output should be valid structured data.

Required fields:

- `observations`
- `patterns`
- `counterarguments`
- `evidence_thresholds`
- `allowed_claims`
- `blocked_claims`

The Critic may only use `allowed_claims`.

## MVP Implementation Guidance

For V0, this can be deterministic:

1. Build observations from stored choices.
2. Use pairing `tests` and song vectors to produce pattern deltas.
3. Count supporting choices per pattern.
4. Generate counterarguments from repeated artists, eras, lanes, or familiarity signals.
5. Allow narrative only for claims above threshold.

The AI layer should polish the reading, not decide what is true.
