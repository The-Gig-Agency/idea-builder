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
  .handler(async ({ context }) => {
    try {
      await assertAdminAndGetClient(context.userId);
      return { isAdmin: true };
    } catch {
      return { isAdmin: false };
    }
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
      if (data.search) q = q.or(`title.ilike.%${data.search}%,artist.ilike.%${data.search}%`);
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
