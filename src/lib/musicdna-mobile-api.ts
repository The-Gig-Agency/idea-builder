import { z } from "zod";

export const musicDnaApiV1Paths = {
  startSession: "/api/v1/session",
  nextPairing: (sessionId: string) => `/api/v1/session/${sessionId}/next`,
  submitChoice: (sessionId: string) => `/api/v1/session/${sessionId}/choice`,
  reveal: (sessionId: string) => `/api/v1/session/${sessionId}/reveal`,
  share: (token: string) => `/api/v1/share/${token}`,
} as const;

export const musicDnaErrorCodeSchema = z.enum([
  "NOT_FOUND",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "INVALID_INPUT",
  "UPSTREAM",
  "INTERNAL",
]);

export const musicDnaErrorEnvelopeSchema = z.object({
  error: z.object({
    code: musicDnaErrorCodeSchema,
    message: z.string(),
  }),
});

export const startSessionRequestSchema = z.object({}).strict();

export const startSessionResponseSchema = z.object({
  session_id: z.string().uuid(),
  lane: z.string(),
  lane_confidence: z.number(),
});

export const pairingSongSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  artist: z.string(),
  year: z.number().nullable(),
  primary_lane: z.string(),
  lane: z.string().nullable().optional(),
});

export const pairingSchema = z.object({
  id: z.string().uuid(),
  tests: z.array(z.string()).default([]),
  hypothesis: z.string().nullable().optional(),
  why_good: z.string().nullable().optional(),
  diagnostic_weight: z.number(),
  lane: z.string().nullable().optional(),
  song_a: pairingSongSchema,
  song_b: pairingSongSchema,
});

export const nextPairingResponseSchema = z.object({
  done: z.boolean(),
  round: z.number(),
  confidence: z.number(),
  pairing: pairingSchema.nullable(),
});

export const submitChoiceRequestSchema = z.object({
  pairing_id: z.string().uuid(),
  chosen_song_id: z.string().uuid(),
  ms_to_decide: z.number().int().nonnegative().max(600000).optional(),
});

export const vectorSchema = z.record(z.string(), z.number());

export const submitChoiceResponseSchema = z.object({
  vector: vectorSchema,
  verdict: z.string(),
  why: z.string(),
  hesitation: z.string().nullable(),
  dim: z.string(),
  delta: z.number(),
});

export const counterargumentSchema = z.object({
  claim: z.string(),
  impact: z.enum(["low", "medium", "high"]),
  notes: z.string(),
});

export const revealClaimExampleSchema = z.object({
  dimension: z.string(),
  preferred: z.string(),
  opposed: z.string(),
  supporting_choices: z.number(),
  tested_total: z.number(),
  confidence: z.number(),
  examples: z.array(
    z.object({
      chosen: z.string(),
      rejected: z.string(),
      delta: z.number(),
    }),
  ),
  tradeoff: z.string(),
});

export const revealResponseSchema = z.object({
  archetypeId: z.string().uuid().nullable().optional(),
  archetypeName: z.string().nullable().optional(),
  interpretation: z.string(),
  vector: vectorSchema,
  allowed_claims: z.array(revealClaimExampleSchema).default([]),
  counterarguments: z.array(counterargumentSchema).default([]),
  share_token: z.string(),
});

export const publicArchetypeSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string(),
  tagline: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export const definingChoiceSchema = z.object({
  chosen: z.string(),
  chosenArtist: z.string(),
  rejected: z.string(),
  rejectedArtist: z.string(),
});

export const shareResponseSchema = z.object({
  session_id: z.string().uuid(),
  share_token: z.string(),
  completed_at: z.string(),
  lane: z.string().nullable().optional(),
  interpretation: z.string(),
  archetype: publicArchetypeSchema,
  defining_choices: z.array(definingChoiceSchema).default([]),
});

export type MusicDnaErrorEnvelope = z.infer<typeof musicDnaErrorEnvelopeSchema>;
export type StartSessionRequest = z.infer<typeof startSessionRequestSchema>;
export type StartSessionResponse = z.infer<typeof startSessionResponseSchema>;
export type NextPairingResponse = z.infer<typeof nextPairingResponseSchema>;
export type SubmitChoiceRequest = z.infer<typeof submitChoiceRequestSchema>;
export type SubmitChoiceResponse = z.infer<typeof submitChoiceResponseSchema>;
export type RevealResponse = z.infer<typeof revealResponseSchema>;
export type ShareResponse = z.infer<typeof shareResponseSchema>;
