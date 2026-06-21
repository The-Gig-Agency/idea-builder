## What "helpful, insightful, fun, engaging" actually means here

The I Feel Love essay is engaging because it does four things the app currently doesn't:

1. **Evidence before verdict.** It earns "sounds like 1987" by listing what 1977 pop relied on. Then names the fork. Our app jumps straight to "you reward the performer who…" with no evidence the user can see.
2. **Names a fork.** I Feel Love vs Being Boiled = dance future vs alternative-electronic future. Forks make a read feel like *discovery*, not horoscope. Our app gives single-axis verdicts ("Pop, 85%") with nothing to push against.
3. **Tells the user something they didn't already know.** "Eno told Bowie he'd heard the future." A small fact, a vivid quote, a lineage. Our app's reactions are abstract and could apply to anyone.
4. **The pick reveals something.** "Preferring Being Boiled over Don't You Want Me signals you value electronic as mood, not pop songwriting." That's the payoff sentence. Our app doesn't have a payoff sentence — it has aphorisms.

I'm not going to force the essay's structure. I'm going to fix the four things that make the current flow feel generic and slow, in priority order.

## Fix 1 — Per-song reactions get a concrete hook

Right now `reactToOne` produces lines like "the moment when a secret becomes a spectacle." Replace with reactions that reference *something specific*: the artist's lineage, the year, a known fact, the production, a peer record. One sentence, no verdict.

Examples of the target shape:
- "Billie Jean — Quincy Jones famously fought MJ to cut it. Lost. Good call."
- "True — Spandau in their Aladdin Sane-meets-Sade phase. Bold pick."
- "Little Red Corvette — Prince's first song to crack the white rock stations. He knew."

`reactToOne` already has decade/scene context available. We add a small "what's interesting about this record" beat to the prompt, and ban the abstract-aphorism opener list.

## Fix 2 — Post-3 read names the fork

Instead of "observation, observation, hypothesis" (which we shipped last round but is still too templatey), the post-3 read does:

- **One concrete observation** referencing at least two of the three songs by name.
- **The fork the picks suggest** — "You're hovering between [thing A] and [thing B]." Two named poles, not a single lane.
- **What the next pick will tell us** — "If #4 is closer to X, you're really an A. If it leans Y, I had you wrong."

That last beat is the engagement hook. It tells the user the *next question matters* and previews what's being tested. It's the opposite of premature certainty — it stakes a hypothesis on the next pick.

JSON contract becomes `{ observation, fork, stakes }`. Onboarding renders all three.

## Fix 3 — The lane chip becomes a fork chip

Drop "Possible lane: Pop" entirely. Replace with the fork itself: "Pop songwriting ↔ Mood & texture" or "Hook-led ↔ Atmosphere-led" — derived from the top-two-axes of the working vector, not from `primary_lane`. Lane is a destination; the fork is the *interesting question*. This is what makes the user lean in for #4.

## Fix 4 — Pairings test the named fork

Last round we added a 1.5x boost for pairings that hit the user's top-|value| axes. Tighten this: when the post-3 read commits to a named fork (e.g. atmosphere vs statement), `nextPairing` *must* pick from pairings whose `tests` include that axis with both poles represented. If none qualify, fall back to top-axis boost. Result: the next matchup visibly tests the fork the critic just named — the engine and the voice are saying the same thing.

Plus the previous round's same-artist filter stays.

## Fix 5 — Surface what we know, sparingly

The data files have year, primary_lane, diagnostic notes, peer records, scene tags. The reactions barely use any of it. Add a tiny server-side lookup in `reactToOne` and `reactToThree`: if the song matches (or fuzzy-matches) a row in the canon/scoring TSVs, pass the year/scene/curator note into the prompt as "context the critic happens to know." Don't quote it verbatim — let the model weave it in. This is what makes a reaction feel like it came from someone who *knows music* rather than someone improvising.

When there's no match, the critic stays evidence-light and leans on tone. No hallucinated facts.

## Voice rules (apply everywhere)

- Reference the actual song or artist by name when possible.
- One concrete detail per reaction (year, producer, peer, scene, production choice) when known.
- Name forks, not lanes. Two poles, not one verdict.
- Hedge the read; commit to the *stakes* of the next pick.
- Banned openers stay banned: "the moment when", "the performer who", "you reward…", "you trust…".
- Allowed moves: "Two of three…", "Closer to X than Y…", "If #4 leans…", "Tell me I'm wrong."

## Scope

- `src/lib/musicdna.functions.ts` — prompts for `reactToOne`, `reactToThree`, `refineWithTwoMore`, `MID_VOICE`; new `{observation, fork, stakes}` contract on `reactToThree`; song-context lookup helper; tightened `nextPairing` fork-testing logic.
- `src/routes/onboarding.tsx` — render `fork` and `stakes` from the new contract; replace lane chip with fork chip.
- `src/routes/_authenticated/1980.tsx` — same contract change for the decade flow.
- No DB schema changes. No new tables. Existing TSVs in `data/musicdna/` are the lookup source for Fix 5.

## Out of scope

- Result page copy.
- Cross-lane probes (stays disabled per `mem://product/within-lane-only.md`).
- Curating the pairing seed (same-artist filter at runtime is enough for now).
- Persisting the critic's "context I happen to know" — it's prompt-time only.
