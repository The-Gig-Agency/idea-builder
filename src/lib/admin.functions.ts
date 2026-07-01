import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN_TABLES = ["songs", "pairings", "archetypes"] as const;
type AdminTable = (typeof ADMIN_TABLES)[number];

// JSON value tree that TanStack's serializer accepts.
type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
type JsonRow = { [k: string]: Json };

async function assertAdminAndGetClient(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
  return supabaseAdmin;
}

export const adminCheck = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isAdmin: boolean; userId: string; reason?: string }> => {
    // Use the authed client — RLS lets users read their own user_roles rows.
    // Avoids requiring SUPABASE_SERVICE_ROLE_KEY just to render the nav.
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error) return { isAdmin: false, userId: context.userId, reason: `db: ${error.message}` };
    if (!data) return { isAdmin: false, userId: context.userId };
    return { isAdmin: true, userId: context.userId };
  });


export const adminList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      table: z.enum(ADMIN_TABLES),
      search: z.string().max(120).optional(),
      lane: z.string().max(40).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdminAndGetClient(context.userId);
    const table = data.table as AdminTable;

    // Build query dynamically; cast through any because table is a runtime union.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = (admin as any).from(table).select("*").limit(500);
    if (table === "songs") {
      q = q.order("artist", { ascending: true }).order("title", { ascending: true });
      if (data.search) {
        // Strip LIKE wildcards and PostgREST .or() syntax characters so user
        // input can't escape into another filter expression.
        const s = data.search.replace(/[%_,()."*\\]/g, "").trim();
        if (s) q = q.or(`title.ilike.%${s}%,artist.ilike.%${s}%`);
      }
      if (data.lane) q = q.eq("primary_lane", data.lane);
    } else if (table === "pairings") {
      q = q.order("diagnostic_weight", { ascending: false });
      if (data.lane) q = q.eq("lane", data.lane);
    } else {
      q = q.order("name", { ascending: true });
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as JsonRow[] };
  });

// Per-table input shape — accept arbitrary JSON, validate critical fields server-side.
const RowSchema = z.record(z.string(), z.unknown());

export const adminUpsert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      table: z.enum(ADMIN_TABLES),
      id: z.string().uuid().nullable().optional(),
      row: RowSchema,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdminAndGetClient(context.userId);
    const row = { ...data.row };

    // Strip system columns the caller shouldn't overwrite.
    delete row.id;
    delete row.created_at;
    delete row.updated_at;

    if (data.id) {
      const { error } = await admin
        .from(data.table)
        .update(row as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id, created: false as const };
    }
    const { data: ins, error } = await admin
      .from(data.table)
      .insert(row as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (ins as { id: string }).id, created: true as const };
  });

export const adminDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      table: z.enum(ADMIN_TABLES),
      id: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdminAndGetClient(context.userId);
    const { error } = await admin.from(data.table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Tiny helper for the diagnostic_weight inline editor on pairings.
export const adminSetDiagnosticWeight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      diagnostic_weight: z.number().int().min(0).max(100),
      active: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdminAndGetClient(context.userId);
    const patch: { diagnostic_weight: number; active?: boolean } = {
      diagnostic_weight: data.diagnostic_weight,
    };
    if (data.active !== undefined) patch.active = data.active;
    const { error } = await admin.from("pairings").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --------- Residual review queue ---------
// Sessions where the archetype match didn't clear the confidence bar.
// This is the "did any listener escape all current archetypes?" queue:
// - low_score: best cosine < floor (no archetype really fit)
// - ambiguous: top 2 within margin (the ontology can't distinguish them)
// - no_archetypes: catalog was empty
// Also returns a stats summary so the admin can watch the residual rate
// trend over time — new archetypes should be born from this, not vibes.
export const adminResidualQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      limit: z.number().int().min(1).max(200).default(50),
      reason: z.enum(["low_score", "ambiguous", "no_archetypes", "any"]).default("any"),
      lane: z.string().max(40).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdminAndGetClient(context.userId);

    // Totals for the residual rate — completed sessions vs flagged ones.
    const totalP = admin.from("sessions").select("id", { count: "exact", head: true })
      .not("completed_at", "is", null);
    const flaggedP = admin.from("sessions").select("id", { count: "exact", head: true })
      .eq("archetype_flagged", true);
    const [totalRes, flaggedRes] = await Promise.all([totalP, flaggedP]);
    if (totalRes.error) throw new Error(totalRes.error.message);
    if (flaggedRes.error) throw new Error(flaggedRes.error.message);

    // Per-reason counts.
    const reasons: Record<string, number> = { low_score: 0, ambiguous: 0, no_archetypes: 0 };
    for (const r of Object.keys(reasons)) {
      const { count, error } = await admin.from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("archetype_flagged", true)
        .eq("archetype_flag_reason", r);
      if (error) throw new Error(error.message);
      reasons[r] = count ?? 0;
    }

    let q = admin.from("sessions")
      .select("id, user_id, lane, lane_confidence, completed_at, archetype_top3, archetype_score, archetype_margin, archetype_flag_reason, share_token")
      .eq("archetype_flagged", true)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(data.limit);
    if (data.reason !== "any") q = q.eq("archetype_flag_reason", data.reason);
    if (data.lane) q = q.eq("lane", data.lane);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    return {
      total: totalRes.count ?? 0,
      flagged: flaggedRes.count ?? 0,
      reasons,
      rows: (rows ?? []) as JsonRow[],
    };
  });
