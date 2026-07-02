## Goal

Bundle the MusicDNA IP into one zip for external (ChatGPT/reviewer) reading. No credentials, no URLs, no anything that could touch our system.

## Output

`/mnt/documents/musicdna-ip-2026-07-02.zip` — served back via `<presentation-artifact>` for download.

## Contents

```text
musicdna-ip/
├─ README.md                    ← generated tour + provenance + "what's excluded" note
├─ engine/                      ← src/musicdna/engine/*.ts  (skip *.test.ts)
├─ docs/musicdna/               ← all *.md
├─ data/musicdna/               ← all *.tsv, *.csv
└─ schema.sql                   ← songs / pairings / archetypes / subcultures /
                                   user_roles DDL only, extracted from
                                   supabase/migrations/*.sql, hand-reviewed
```

`README.md` reading order: archetype-bible → ontology → subcultures → prior-weighting → diagnostic_scoring_algorithm → engine/scoring.ts → priors.ts → pairing.ts → archetypes.ts → critic.ts/voice.ts/reveal.ts.

## Hard exclusions (verified before zipping)

- `.env`, `.env.*`, any `*.env*` file
- `node_modules/`, `.next/`, `dist/`, `.vercel/`, `.wrangler/`, `.output/`, `.cache/`
- `supabase/.temp/`, `supabase/.branches/`, `supabase/functions/` (edge fn code isn't part of the ask)
- `src/integrations/supabase/` (client config, project ID, publishable keys — even publishable ones are URLs into our project)
- Anything under `src/` except the engine folder
- Full migration files (contain `GRANT`, RLS policies referencing `auth.uid()`, and seed rows). Instead: extract only `CREATE TABLE` / `CREATE TYPE` statements for the 5 tables above, strip any `INSERT INTO` seed rows, strip `service_role` grants, strip policy bodies. Keep column names + types + comments only.
- Any file matching `service_role`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `LOVABLE_API_KEY`, `sb-`, `sbp_`, `sk_`, `pk_`, `Bearer`, `.lovable.app`, `.lovable.cloud`, `.supabase.co`
- User/session/PII: any `users`, `sessions`, `choices`, `profiles` row data
- Logs, screenshots, `.git/`, `.vscode/`, `bun.lockb`, `package-lock.json`
- `.lovable/`, `.workspace/`, `.agents/`, `.claude/`, `apps/mobile/` (out of scope for algorithm review)
- Test files (`*.test.ts`) — skipped to keep the bundle tight; can add on request

## Safety net

Before writing the zip, grep the staged directory for the forbidden-string list above. If any hit, abort and show what matched. Only zip after a clean grep. Print a manifest (file + size + line count) so you can eyeball what shipped.

## Provenance in README

- Commit-agnostic date stamp
- One-line description of each top-level folder
- Explicit "what was excluded and why" section so a reviewer knows the bundle is intentionally scoped to algorithm + ontology, not runtime

## Out of scope

- Admin UI cleanup (previous plan) — parked; this is a separate deliverable.
- Any code changes to the project itself. This is a read-only export into `/mnt/documents/`.
