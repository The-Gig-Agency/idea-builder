## Add `POST /api/v1/onboarding/opener` + document mobile signup flow

### Why

`/api/v1/session` requires the caller's `profiles` row to already have opening-song analysis (seed vector, primary lane, probe candidates). Today that's produced only by the web onboarding server fn (`analyzeOpenersImpl` in `src/lib/onboarding-openers.functions.ts`), which Flutter can't call. This adds the missing REST verb so a mobile client can complete onboarding end-to-end using only `/api/v1/*` + Supabase Auth.

Signup itself is NOT part of this route — Flutter uses `supabase_flutter` against Supabase Auth directly, same as web. This route runs *after* signup, using the fresh bearer.

### Scope

**New route** — `src/routes/api/v1/onboarding.opener.ts`
- `POST /api/v1/onboarding/opener`
- `OPTIONS` preflight (reuses `_cors.ts`)
- Auth: bearer via `verifyBearer` (reuses `_auth.ts`)
- Body (Zod-validated):
  ```json
  { "songs": ["Fake Empire - The National", "Dreams - Fleetwood Mac", "Space Song - Beach House"] }
  ```
  - `songs`: array of 3 strings, each 1–200 chars.
- Delegates to the existing `analyzeOpenersImpl` helper in `src/lib/onboarding-openers.functions.ts` (same code path web uses — no logic duplication).
- Response mirrors what web already gets back: `{ ok: true, lane, lane_confidence, seeded }` (final shape confirmed by reading the impl).
- Errors use the uniform envelope: `INVALID_INPUT` (400), `UNAUTHORIZED` (401), `UPSTREAM` (502) for LLM failures, `INTERNAL` (500).
- If `analyzeOpenersImpl` isn't already exported as a plain helper (only wrapped in a server fn), refactor it into an exported `Impl` function the same way `startSessionImpl` / `nextPairingImpl` are structured, and rewire the existing server fn to call it. No behavior change for web.

**No auth changes.** Signup, password reset, OAuth all stay on Supabase Auth's SDK — Flutter uses `supabase_flutter`, web uses `@supabase/supabase-js`. Nothing in `/api/v1/*` handles credentials.

**No DB changes.** Writes go to the existing `profiles` row via the user-scoped Supabase client (RLS enforced).

### Tests

- Extend `src/routes/api/v1/e2e.test.ts` with a second scenario that skips the harness `opener` action and instead:
  1. `POST /api/public/test/bearer` for a fresh persona (no priming)
  2. `POST /api/v1/onboarding/opener` with 3 songs — expect 200
  3. `POST /api/v1/session` — expect 200 and a valid `session_id`
  This proves the mobile signup → play path works over pure REST.
- Add a negative test: `POST /api/v1/onboarding/opener` with `songs: []` → 400 `INVALID_INPUT`.

### Docs

**Update `docs/musicdna/api-v1.md`:**
- Add `POST /api/v1/onboarding/opener` section with request/response/errors.
- Add a **"Mobile signup flow"** section spelling out the three-step sequence: `supabase_flutter.signUp()` → `POST /api/v1/onboarding/opener` → `POST /api/v1/session`. Make explicit that auth (signup, login, password reset, OAuth) lives in Supabase Auth's client SDKs, not in `/api/v1/*`.
- Note that `/api/v1/session` returns `INVALID_INPUT` / `CONFLICT` (whichever the impl already throws) if the caller hasn't completed the opener step yet.

**Update `docs/musicdna/engine-integration.md`** only if the impl gets refactored — one line noting `analyzeOpenersImpl` is now the shared helper.

### Out of scope

- Flutter code.
- Rate limiting on the opener route (LLM call — worth adding later, but the harness key + Supabase Auth signup rate limits give reasonable protection for now).
- Changing the opener song format (still free-text `"Title - Artist"`, resolved server-side).
- Any changes to `/share/:token`, `/session`, `/next`, `/choice`, `/reveal`.

### Deliverable

One new route file, one impl refactor if needed, two new e2e test cases, docs updated. Web path unchanged and still passing existing tests.