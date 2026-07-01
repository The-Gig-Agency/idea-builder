// GET /api/v1/sessions — list the caller's sessions (history).
//
// Returns most-recent-first summaries so the mobile app can render a
// history screen and pick up an in-progress session. RLS scopes rows to
// the caller; no user_id filter needed on the query.

import { createFileRoute } from "@tanstack/react-router";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { HttpError, verifyBearer } from "./_auth";

export const Route = createFileRoute("/api/v1/sessions")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      GET: async ({ request }) => {
        try {
          const { supabase } = await verifyBearer(request);
          const url = new URL(request.url);
          const rawLimit = Number(url.searchParams.get("limit") ?? "20");
          const limit = Math.max(1, Math.min(100, Number.isFinite(rawLimit) ? rawLimit : 20));

          const { data, error } = await supabase
            .from("sessions")
            .select(
              "id, lane, lane_confidence, started_at, completed_at, is_public, share_token, archetype_id",
            )
            .order("started_at", { ascending: false })
            .limit(limit);
          if (error) return errorResponse("INTERNAL", error.message, 500);

          return jsonResponse({
            sessions: (data ?? []).map((s) => ({
              session_id: s.id,
              lane: s.lane,
              lane_confidence: s.lane_confidence,
              started_at: s.started_at,
              completed_at: s.completed_at,
              status: s.completed_at ? "completed" : "in_progress",
              is_public: s.is_public,
              share_token: s.share_token,
              archetype_id: s.archetype_id,
            })),
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
