import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public read of a single completed session.
// No PII (no user_id, no email, no display_name surfaced).
// Uses supabaseAdmin to bypass RLS but the projection is explicit + scoped.
export const getPublicSession = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ sessionId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select(
        "id,started_at,completed_at,interpretation,vector,lane,archetype:archetype_id(id,name,tagline,description)",
      )
      .eq("id", data.sessionId)
      .not("completed_at", "is", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!session) throw new Error("Session not found");

    const { data: choices } = await supabaseAdmin
      .from("choices")
      .select(
        "ms_to_decide, chosen:chosen_song_id(title,artist), rejected:rejected_song_id(title,artist)",
      )
      .eq("session_id", session.id)
      .order("ms_to_decide", { ascending: true, nullsFirst: false })
      .limit(5);

    type SongLite = { title: string; artist: string } | null;
    const definingChoices = ((choices ?? []) as unknown as Array<{
      chosen: SongLite;
      rejected: SongLite;
    }>)
      .filter((c) => c.chosen && c.rejected)
      .map((c) => ({
        chosen: c.chosen!.title,
        chosenArtist: c.chosen!.artist,
        rejected: c.rejected!.title,
        rejectedArtist: c.rejected!.artist,
      }));

    return { session, definingChoices };
  });
