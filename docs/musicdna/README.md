# MusicDNA

Local working folder for the MusicDNA product thesis, ontology, diagnostic canon, and future pairing graph.

## Principle

We are not building a catalog of songs. We are building a catalog of revealing decisions.

The pairing is the IP. MusicDNA should not begin by generating thousands of mediocre pairings. It should begin by building a strong ontology, a focused diagnostic anchor set, and a smaller set of highly revealing matchups.

## Current Structure

- `docs/musicdna/ontology.md`: 15-dimension taste ontology and pairing standards.
- `docs/musicdna/canon_workflow.md`: step-by-step curation process.
- `tools/musicdna/generate_alternative_canon.cjs`: deterministic seed-canon generator.
- `tools/musicdna/validate_canon.cjs`: CSV-aware canon validator.
- `data/musicdna/alternative_diagnostic_canon_seed.csv`: generated Alternative/Post-Punk diagnostic canon seed.

## Next Step

After the diagnostic canon is reviewed, generate candidate pairings and curate down to the first elite matchup graph.
