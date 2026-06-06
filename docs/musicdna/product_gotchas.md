# MusicDNA Product Gotchas

Use this document as a standing check before adding major features, data, scoring systems, or result copy.

The point is not to talk ourselves out of MusicDNA. The point is to keep the product honest while it grows.

## 1. Conversation May Be More Magical Than The App

The original spark came from conversation: riffing, remembering, arguing, adjusting, and noticing patterns in real time.

A static quiz may feel flatter.

Risk:

- The app loses the "smart friend who is paying attention" feeling.
- Pairings become mechanical instead of alive.
- The product becomes a quiz when the magic was closer to a conversation.

Check:

- Does this feature make the app feel more responsive to the user's actual choices?
- Does the product create moments of recognition, not just screens of output?
- Are we testing whether users enjoy the loop, not just whether the concept sounds good?

## 2. The Data May Be Pseudo-Science

`Ceremony` over `Dreaming of Me` implying transformation over nostalgia is plausible. It is not proven.

Risk:

- The app creates elegant bullshit.
- Users enjoy the story once, then stop trusting it.
- We mistake persuasive prose for validated inference.

Check:

- Does every claim cite actual choices?
- Are confidence thresholds enforced?
- Are counter-hypotheses stored alongside conclusions?
- Are we validating inferences against repeat behavior, retention, or user feedback?

## 3. Curation Does Not Scale Cleanly

The best pairings require taste, judgment, cultural context, and restraint.

AI can generate volume. It cannot automatically generate taste.

Risk:

- We build a giant pile of mediocre questions.
- The graph becomes large but weak.
- Human curation remains the bottleneck forever.

Check:

- Can a curator explain the tradeoff in one sentence?
- Does the pairing have real decision tension?
- Are we rewarding diagnostic quality over catalog size?
- Are AI-generated pairings treated as candidates, not truth?

## 4. Cross-Genre Mapping May Break

A country fan choosing `Friends in Low Places` and an alt fan choosing `Fools Gold` may not map to the same `community` dimension in a clean, universal way.

Risk:

- We force universality onto culturally specific signals.
- Cross-lane archetypes become too abstract.
- The app flattens culture into fake equivalence.

Check:

- Are cross-lane mappings validated with real choices?
- Does result copy reference the user's actual lane and evidence?
- Are dimensions allowed to behave differently by lane?
- Are we preserving cultural specificity instead of pretending every signal means the same thing everywhere?

## 5. Top-Five Song Input Is Messy

People type wrong titles, joke songs, wedding songs, guilty pleasures, current obsessions, songs their kid played yesterday, or songs they think make them look interesting.

Risk:

- Onboarding over-weights noisy signals.
- Lane classification becomes brittle.
- The first hypothesis feels wrong before the game starts.

Check:

- Does onboarding handle aliases, typos, and ambiguous songs?
- Does the app treat the opening hypothesis as a sketch, not a verdict?
- Is low-confidence routing explicit?
- Can the matchup flow recover from noisy onboarding?

## 6. Users May Not Know Enough Songs

Music nerds love impossible matchups. Normal users may hit "I don't know either" repeatedly and bounce.

Risk:

- The MVP delights the niche audience but excludes everyone else.
- Pairing selection overestimates user familiarity.
- Unknown-song friction kills the session.

Check:

- Are there enough familiarity anchors in each lane?
- Can users skip without punishment?
- Are pairings sequenced from more recognizable to more specialized?
- Do we measure unknown/skipped pairings as data quality signals?

## 7. Results Can Become Horoscope-Adjacent

Even evidence-based results can drift into seductive vagueness.

Risk:

- The app sounds like a personality quiz with better music references.
- Phrases like "you value authenticity" erode trust.
- The result flatters instead of observes.

Check:

- Does every insight cite choices and tradeoffs?
- Are forbidden vague labels enforced?
- Does the voice sound like a music critic, not a therapist or astrologer?
- Is uncertainty acknowledged when evidence is thin?

## 8. Diagnostic Power Score Can Become False Rigor

A `91` versus `84` score can look scientific while mostly encoding curator bias.

Risk:

- Scoring becomes spreadsheet theater.
- Curators over-trust precise numbers.
- DPS hardens before it is calibrated against behavior.

Check:

- Are DPS components visible and auditable?
- Is `diagnostic_power` separated from `canon_score`?
- Do we compare scores against user behavior over time?
- Are scores treated as useful priors, not objective truth?

## 9. The First Audience May Be Too Niche

Post-punk and alt obsessives are perfect for discovery. They may not represent the mass opportunity.

Risk:

- The MVP overfits to us.
- The product becomes "a clever post-punk quiz."
- Cross-lane claims remain unproven.

Check:

- Are Pop, Hip-Hop, Electronic, Classic Rock, and future Country lanes tested early?
- Do non-alt users complete sessions?
- Do cross-lane archetypes still feel specific?
- Are we measuring which audiences actually retain?

## 10. The Moat May Be Weaker Than We Think

If the UI works, larger platforms or quiz companies can copy the surface quickly.

Risk:

- The broad concept is copied before the graph becomes defensible.
- The app has style but no durable data advantage.
- The matchup graph is not deep enough to matter.

Check:

- Are we accumulating proprietary choice-under-constraint data?
- Are observations, patterns, confidence, and counterarguments stored, not just final prose?
- Are elite pairings curated and versioned as IP?
- Does the product get smarter from use?

## 11. Sharing May Not Happen

Spotify Wrapped works because it has social proof, ritual timing, and a huge installed base.

MusicDNA results may feel too personal, too try-hard, or too niche.

Risk:

- Share cards look good but do not spread.
- Users like results privately but do not post them.
- Virality assumptions distort the MVP.

Check:

- Do share assets feel specific and self-expressive without being embarrassing?
- Are there friend challenges or comparison loops beyond static cards?
- Are we measuring shares, clicks, and completed invited sessions?
- Does the product work without virality?

## 12. One Great Session May Not Become A Habit

People may enjoy one deep taste reading and never need another.

Risk:

- The app solves a discussion problem, not a recurring product problem.
- Retention is weak after the first result.
- The product needs events, challenges, new lanes, or seasonal rituals to return.

Check:

- What brings a user back after the first result?
- Can the graph evolve as their taste changes?
- Are there new modes beyond retaking the same quiz?
- Are we measuring week-one and month-one retention, not just completion?

## Operating Rule

Before shipping a significant feature, answer:

1. Which gotcha does this reduce?
2. Which gotcha might this worsen?
3. What event, metric, or user behavior will tell us if we were wrong?

The core warning:

> MusicDNA is not trying to sound profound. It is trying to be observably attentive.
