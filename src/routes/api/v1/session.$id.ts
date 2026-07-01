// GET /api/v1/session/:id — resume a session.
//
// Returns the current state so the mobile app can drop the user back where
// they left off (in-progress → keep looping /next+/choice; completed →
// jump to reveal/share). RLS enforces ownership.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { HttpError, verifyBearer } from "./_auth";

const UUID = z.string().uuid();

export const Route = createFileRoute("/api/v1/session/$id")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      GET: async ({ request, params }) => {
        try {
          const parsed = UUID.safeParse(params.id);
          if (!parsed.success) {
            return errorResponse("INVALID_INPUT", "Invalid session id", 400);
          }
          const { supabase } = await verifyBearer(request);

          const { data: session, error } = await supabase
            .from("sessions")
            .select(
              "id, lane, lane_confidence, vector, started_at, completed_at, is_public, share_token, archetype_id, interpretation",
            )
            .eq("id", parsed.data)
            .maybeSingle();
          if (error) return errorResponse("INTERNAL", error.message, 500);
          if (!session) return errorResponse("NOT_FOUND", "Session not found", 404);

          const { count: roundsCompleted } = await supabase
            .from("choices")
            .select("id", { count: "exact", head: true })
            .eq("session_id", parsed.data);

          return jsonResponse({
            session_id: session.id,
            status: session.completed_at ? "completed" : "in_progress",
            lane: session.lane,
            lane_confidence: session.lane_confidence,
            vector: session.vector,
            rounds_completed: roundsCompleted ?? 0,
            started_at: session.started_at,
            completed_at: session.completed_at,
            is_public: session.is_public,
            share_token: session.share_token,
            archetype_id: session.archetype_id,
            interpretation: session.interpretation,
          });
        } catch (e) {
          if (e instanceof HttpError) return errorResponse(e.code, e.message, e.status);
          const msg = e instanceof Error ? e.message : String(e);
          return errorResponse("INTERNAL", msg, 500);
        }
      },
    },
  },
});
