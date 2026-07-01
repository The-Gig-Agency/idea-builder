// POST /api/v1/session/:id/choice — record a pairing choice.
//
// Body: { pairing_id, chosen_song_id, ms_to_decide? }. Delegates to
// recordChoiceImpl which updates the session vector, probe state, etc.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { errorResponse, jsonResponse, preflightResponse } from "./_cors";
import { HttpError, verifyBearer } from "./_auth";
import { recordChoiceImpl } from "@/lib/musicdna.functions";

const BodySchema = z.object({
  pairing_id: z.string().uuid(),
  chosen_song_id: z.string().uuid(),
  ms_to_decide: z.number().int().nonnegative().max(600_000).optional(),
});

const UUID = z.string().uuid();

export const Route = createFileRoute("/api/v1/session/$id/choice")({
  server: {
    handlers: {
      OPTIONS: async () => preflightResponse(),
      POST: async ({ request, params }) => {
        try {
          const sid = UUID.safeParse(params.id);
          if (!sid.success) return errorResponse("INVALID_INPUT", "Invalid session id", 400);
          let raw: unknown;
          try {
            raw = await request.json();
          } catch {
            return errorResponse("INVALID_INPUT", "Invalid JSON body", 400);
          }
          const body = BodySchema.safeParse(raw);
          if (!body.success) {
            return errorResponse("INVALID_INPUT", body.error.message, 400);
          }
          const { supabase, userId } = await verifyBearer(request);
          const result = await recordChoiceImpl(supabase, userId, {
            sessionId: sid.data,
            pairingId: body.data.pairing_id,
            chosenSongId: body.data.chosen_song_id,
            msToDecide: body.data.ms_to_decide,
          });
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
