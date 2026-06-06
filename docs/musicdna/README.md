# MusicDNA

Local working folder for the MusicDNA product thesis, ontology, diagnostic canon, and future pairing graph.

## Principle

We are not building a catalog of songs. We are building a catalog of revealing decisions.

The pairing is the IP. MusicDNA should not begin by generating thousands of mediocre pairings. It should begin by building a strong ontology, a focused diagnostic anchor set, and a smaller set of highly revealing matchups.

The app is not learning songs. It is learning tradeoffs.

The current strongest candidate dimension expansion is `immersion`: immediacy vs slow reveal. Example: choosing `Breaking Into Heaven` over `She Bangs the Drums` may reveal immersion over immediacy, journey over anthem, and atmosphere over hook.

## Current Structure

- `docs/musicdna/ontology.md`: 15-dimension taste ontology, candidate dimension expansion, and pairing standards.
- `docs/musicdna/canon_workflow.md`: step-by-step curation process.
- `docs/musicdna/lovable_product_notes.md`: Lovable-facing notes for diagnostic tradeoff implementation.
- `tools/musicdna/generate_alternative_canon.cjs`: deterministic seed-canon generator.
- `tools/musicdna/validate_canon.cjs`: CSV-aware canon validator.
- `data/musicdna/alternative_diagnostic_canon_seed.csv`: generated Alternative/Post-Punk diagnostic canon seed.

## Next Step

After the diagnostic canon is reviewed, generate candidate pairings and curate down to the first elite matchup graph.
