// POST /api/v1/session — start a new MusicDNA session for the caller.
//
// Thin transport: verify the caller's Supabase bearer, then call the same
// startSessionImpl helper the web `startSession` server fn uses. Web,
// Flutter, and future clients share one implementation.

import { createFileRoute } from "@tanstack/react-router";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { HttpError, verifyBearer } from "./_auth";
import { startSessionImpl } from "@/lib/musicdna.functions";

export const Route = createFileRoute("/api/v1/session")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      POST: async ({ request }) => {
        try {
          const { supabase, userId } = await verifyBearer(request);
          const result = await startSessionImpl(supabase, userId);
          return jsonResponse({
            session_id: result.sessionId,
            lane: result.lane,
            lane_confidence: result.lane_confidence,
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
