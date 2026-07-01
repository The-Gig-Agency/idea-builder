// POST /api/v1/session/:id/reveal — finalize a session and return the reveal.
//
// Delegates to finalizeSessionImpl, which now internally uses the engine's
// pure assignArchetype for scoring/margin/flagging. Same code path as web.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorResponse, jsonResponse, preflightResponse } from "../../_cors";
import { HttpError, verifyBearer } from "../../_auth";
import { finalizeSessionImpl } from "@/lib/musicdna.functions";

const UUID = z.string().uuid();

export const Route = createFileRoute("/api/v1/session/$id/reveal")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      POST: async ({ request, params }) => {
        try {
          const sid = UUID.safeParse(params.id);
          if (!sid.success) return errorResponse("INVALID_INPUT", "Invalid session id", 400);
          const { supabase, userId } = await verifyBearer(request);
          const result = await finalizeSessionImpl(supabase, userId, { sessionId: sid.data });
          return jsonResponse(result);
        } catch (e) {
          if (e instanceof HttpError) return errorResponse(e.code, e.message, e.status);
          const msg = e instanceof Error ? e.message : String(e);
          return errorResponse("INTERNAL", msg, 500);
        }
      },
    },
  },
});
