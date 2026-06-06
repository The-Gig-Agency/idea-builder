import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const searchSongs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ q: z.string().trim().min(1).max(80) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const q = data.q.replace(/[%_]/g, "");
    const { data: rows, error } = await supabase
      .from("songs")
      .select("id,title,artist,year,lane")
      .or(`title.ilike.%${q}%,artist.ilike.%${q}%`)
      .eq("active", true)
      .order("diagnostic_power", { ascending: false })
      .limit(8);
    if (error) throw new Error(error.message);
    return { songs: rows ?? [] };
  });
