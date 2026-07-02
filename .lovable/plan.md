## Goal

Get song titles/artists visible alongside pairings — in the admin UI and in any CSV export — without denormalizing data onto the `pairings` table. This unblocks a CGPT review of lane assignments before we touch the June 6 backfill.

## Steps

### 1. Create a read-only view `public.pairings_with_songs`

Migration adds a view that joins `pairings` → `songs` twice (once per side). All original `pairings` columns pass through unchanged, plus:

- `song_a_title`, `song_a_artist`, `song_a_primary_lane`, `song_a_year`
- `song_b_title`, `song_b_artist`, `song_b_primary_lane`, `song_b_year`

Grants:
- `GRANT SELECT ON public.pairings_with_songs TO authenticated, service_role;`
- No `anon` grant (admin-only surface).

View inherits the underlying tables' RLS. Since only admins currently read pairings via `adminList` (service-role client), this is effectively admin-only.

No changes to the `pairings` table itself. No triggers, no new columns. If a song title changes in `songs`, the view reflects it on next query — zero drift risk.

### 2. Update admin UI list query

In `src/lib/admin.functions.ts`, `adminList` handler, the `pairings` branch:

- Change `admin.from("pairings").select("*")` → `admin.from("pairings_with_songs").select("*")`.
- Keep existing `.order("diagnostic_weight", { ascending: false })` and optional `.eq("lane", data.lane)` filter — both columns exist on the view.

`adminUpsert`, `adminDelete`, and `adminSetDiagnosticWeight` continue to write against the base `pairings` table (views aren't writable here, and we don't want writes hitting a join anyway). Only the read path changes.

The admin table renderer already renders whatever columns come back, so the new `song_a_title` / `song_b_title` / etc. columns will just appear. No UI component changes needed.

### 3. Verify

- Reload `/admin` → Pairings tab → confirm titles/artists render next to the IDs.
- Export path: once this lands, a joined CSV for CGPT is `select * from pairings_with_songs` (I can produce it in a follow-up turn).

## Explicitly out of scope (saved for the next round)

- Backfilling the June 6 `lane='alternative'` damage.
- Guardrail trigger rejecting `lane='unassigned'`.
- `docs/musicdna/product_gotchas.md` note about DEFAULT choices on lane/genre columns.

We'll tackle those after you've reviewed the exported pairings with CGPT and confirmed which rows actually need re-laning.

## Technical notes

- View definition uses `LEFT JOIN` on both sides so a pairing with a dangling `song_a_id`/`song_b_id` still shows up (with nulls) rather than silently disappearing — matters for the CGPT review.
- Types regenerate after the migration runs; `adminList` returns `JsonRow[]` so the TS surface doesn't need updating.
- `src/integrations/supabase/types.ts` will pick up `pairings_with_songs` as a Views entry automatically.