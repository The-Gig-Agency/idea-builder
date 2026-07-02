## Goal

Absorb the CGPT feedback into the durable IP (docs) and produce an external-facing one-pager. No engine or prompt changes.

## 1. Update ontology + intelligence docs

**`docs/musicdna/ontology.md`**
- Add a new top section: **"What we're actually measuring"** — dimensions are *latent listening preferences*, not human traits. Include the guardrail:
  - Don't say: "You value hope."
  - Do say: "You consistently choose songs that build toward emotional release."
- Reword the dimension table intro from "latent preference" phrasing to "listening-choice tendency" phrasing. Table itself stays intact (the low/high poles are already behavioral).
- Add a short "Claim discipline" callout mirroring the same rule so it appears next to the dimensions themselves.

**`docs/musicdna/intelligence_layer.md`**
- In the Layer 5 (Narrative Generator) section, extend the Avoid/Prefer lists:
  - Add to Avoid: "you value X", "you are drawn to X", "deep down you…"
  - Add to Prefer: "you consistently choose songs that…", "your picks reward…", "you keep passing on…"
- Add one worked before/after example using "hope" so the rule is concrete.

**`docs/musicdna/project_learnings_v1.md`**
- Append a new "Major Discovery 13: Listening preferences, not human traits" section capturing the CGPT insight verbatim in our voice, so the reasoning is preserved for future readers.

## 2. Marketing one-pager

New file: **`docs/musicdna/positioning_one_pager.md`** — plain-English explainer for non-technical readers (investors, press, collaborators). Structure:

1. **The one sentence** — "We are not building a catalog of songs. We are building a catalog of revealing decisions."
2. **The problem with music personality tests** — they sound like horoscopes.
3. **What we do differently** — forced pairwise choices → observations → patterns → tentative reads with evidence.
4. **The inverted stack** — identity ↑ taste ↑ matchups ↑ songs (ASCII diagram).
5. **What the product feels like** — 2–3 short sample critic beats (from `critic.ts` voice, no code).
6. **What we're *not*** — not Spotify, not Myers-Briggs, not astrology, not a recommender.
7. **The moat** — the taste graph of millions of comparative decisions.
8. **Where we are** — MVP status, one honest paragraph.

Kept under ~1 page (~600 words). Voice: confident, edgy Rolling Stone, matching `mem://index.md` core.

Also produce a **downloadable `.docx` copy** at `/mnt/documents/musicdna-positioning.docx` (via docx skill) so it's easy to share outside the repo.

## 3. Out of scope (explicit)

- No changes to `critic.ts`, Analyst schema, or any engine code.
- No changes to the IP bundle zip (docs update can be re-bundled later on request).
- No admin UI work.

## Deliverables

- Edited: `docs/musicdna/ontology.md`, `docs/musicdna/intelligence_layer.md`, `docs/musicdna/project_learnings_v1.md`
- New: `docs/musicdna/positioning_one_pager.md`
- New download: `/mnt/documents/musicdna-positioning.docx`
