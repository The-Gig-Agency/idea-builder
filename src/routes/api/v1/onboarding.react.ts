// POST /api/v1/onboarding/react — per-song conversational reaction.
//
// Called after each of the first N-1 opening songs to get the critic's
// running reaction plus a personalized label/prompt for the next slot.
// Web onboarding uses the same `reactToOneImpl` — one implementation,
// many transports. After the final song, the client calls
// POST /api/v1/onboarding/opener to lock in the classification.

import { createFileRoute } from "@tanstack/react-router";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { HttpError, verifyBearer } from "./_auth";
import { ReactToOneInput, reactToOneImpl } from "@/lib/musicdna.functions";

export const Route = createFileRoute("/api/v1/onboarding/react")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      POST: async ({ request }) => {
        try {
          let raw: unknown;
          try {
            raw = await request.json();
          } catch {
            return errorResponse("INVALID_INPUT", "Invalid JSON body", 400);
          }
          const body = ReactToOneInput.safeParse(raw);
          if (!body.success) {
            return errorResponse("INVALID_INPUT", body.error.message, 400);
          }
          const { supabase } = await verifyBearer(request);
          const result = await reactToOneImpl(supabase, body.data);
          return jsonResponse({
            ok: true,
            reaction: result.text,
            next_label: result.nextLabel,
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
