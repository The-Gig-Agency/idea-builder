// GET /api/v1/share/:token
//
// Public read of a completed session by its opaque share token. This is the
// v1 REST surface for the same data src/lib/share.functions.ts serves the
// web via createServerFn — both paths call the same pure buildPublicReveal
// helper in the engine, so there is one implementation to change.
//
// Backwards compatible with old links: a token that looks like a UUID is
// treated as a session id and only honored when the session is is_public.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  buildPublicReveal,
  type PublicRevealInput,
} from "@/musicdna/engine/reveal";
import {
  errorResponse,
  jsonResponse,
  preflightResponse,
} from "../_cors";

const TokenSchema = z.string().min(8).max(64);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/v1/share/$token")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      GET: async ({ params }) => {
        const parsed = TokenSchema.safeParse(params.token);
        if (!parsed.success) {
          return errorResponse("INVALID_INPUT", "Invalid token", 400);
        }
        const token = parsed.data;
        const isUuid = UUID_RE.test(token);

        // Route files are client-reachable — load the admin client inside the
        // handler to keep it out of the client bundle graph.
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        let query = supabaseAdmin
          .from("sessions")
          .select(
            "id,share_token,is_public,started_at,completed_at,interpretation,vector,lane,archetype:archetype_id(id,name,tagline,description)",
          )
          .not("completed_at", "is", null);

        query = isUuid
          ? query.eq("id", token).eq("is_public", true)
          : query.eq("share_token", token);

        const { data: session, error } = await query.maybeSingle();
        if (error) return errorResponse("UPSTREAM", error.message, 502);
        if (!session) return errorResponse("NOT_FOUND", "Session not found", 404);

        const songCols = "title,artist";
        const { data: choices, error: cErr } = await supabaseAdmin
          .from("choices")
          .select(
            `ms_to_decide, chosen:chosen_song_id(${songCols}), rejected:rejected_song_id(${songCols})`,
          )
          .eq("session_id", session.id)
          .order("ms_to_decide", { ascending: true, nullsFirst: false })
          .limit(5);
        if (cErr) return errorResponse("UPSTREAM", cErr.message, 502);

        type SongLite = { title: string; artist: string } | null;
        const definingChoices = ((choices ?? []) as unknown as Array<{
          chosen: SongLite;
          rejected: SongLite;
        }>)
          .filter((c) => c.chosen && c.rejected)
          .map((c) => ({
            chosen_title: c.chosen!.title,
            chosen_artist: c.chosen!.artist,
            rejected_title: c.rejected!.title,
            rejected_artist: c.rejected!.artist,
          }));

        const reveal = buildPublicReveal({
          session: session as PublicRevealInput["session"],
          definingChoices,
        });

        return jsonResponse(reveal);
      },
    },
  },
});
