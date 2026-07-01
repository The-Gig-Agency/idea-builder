import { z } from "zod";

export const musicDnaMobileApiPaths = {
  openingAnalysis: "/api/v1/mobile/musicdna/opening-analysis",
  startSession: "/api/v1/mobile/musicdna/sessions",
  nextPairing: (sessionId: string) => `/api/v1/mobile/musicdna/sessions/${sessionId}/next-pairing`,
  submitChoice: (sessionId: string) => `/api/v1/mobile/musicdna/sessions/${sessionId}/choices`,
  reveal: (sessionId: string) => `/api/v1/mobile/musicdna/sessions/${sessionId}/reveal`,
  activeSession: "/api/v1/mobile/musicdna/me/session",
  history: "/api/v1/mobile/musicdna/me/history",
} as const;

export const musicDnaErrorCodeSchema = z.enum([
  "NOT_FOUND",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "INVALID_INPUT",
  "CONFLICT",
  "UPSTREAM",
  "INTERNAL",
]);

export const musicDnaErrorEnvelopeSchema = z.object({
  error: z.object({
    code: musicDnaErrorCodeSchema,
    message: z.string(),
  }),
});

export const openingAnalysisRequestSchema = z.object({
  songs: z.array(z.string().trim().min(1).max(200)).length(5),
});

export const openingAnalysisResponseSchema = z.object({
  lane: z.string(),
  confidence: z.number(),
  secondaryLanes: z.array(z.string()).default([]),
  reasoning: z.array(z.string()).default([]),
  hypothesis: z.string(),
  candidateDimensions: z.record(z.string(), z.number()).default({}),
  perSong: z
    .array(
      z.object({
        input: z.string(),
        lane: z.string(),
        source: z.enum(["llm", "catalog"]),
        canonId: z.string().optional(),
      }),
    )
    .default([]),
});

export const startSessionResponseSchema = z.object({
  sessionId: z.string().uuid(),
  lane: z.string(),
  laneConfidence: z.number(),
});

export const pairingSongSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  artist: z.string(),
  year: z.number().nullable().optional(),
  primaryLane: z.string(),
  catalogLane: z.string().nullable().optional(),
});

export const pairingDtoSchema = z.object({
  id: z.string().uuid(),
  lane: z.string(),
  diagnosticWeight: z.number(),
  tests: z.array(z.string()).default([]),
  songA: pairingSongSchema,
  songB: pairingSongSchema,
});

export const nextPairingResponseSchema = z.object({
  done: z.boolean(),
  round: z.number(),
  confidence: z.number(),
  pairing: pairingDtoSchema.nullable(),
});

export const submitChoiceRequestSchema = z.object({
  pairingId: z.string().uuid(),
  chosenSongId: z.string().uuid(),
});

export const submitChoiceResponseSchema = z.object({
  saved: z.boolean(),
  choiceId: z.string().uuid(),
  insight: z
    .object({
      title: z.string(),
      body: z.string(),
    })
    .optional(),
  vectorUpdated: z.boolean(),
});

export const revealEvidenceSchema = z.object({
  dimension: z.string(),
  verdict: z.string(),
  why: z.string(),
});

export const revealResponseSchema = z.object({
  sessionId: z.string().uuid(),
  archetype: z.object({
    id: z.string().uuid().optional(),
    name: z.string(),
    slug: z.string(),
  }),
  headline: z.string(),
  summary: z.string(),
  descriptors: z.array(z.string()).default([]),
  evidence: z.array(revealEvidenceSchema).default([]),
  share: z
    .object({
      publicUrl: z.string().url().optional(),
      shareText: z.string().optional(),
    })
    .optional(),
});

export const activeSessionResponseSchema = z.object({
  activeSession: z
    .object({
      sessionId: z.string().uuid(),
      status: z.string(),
      round: z.number(),
    })
    .nullable(),
});

export const historyItemSchema = z.object({
  sessionId: z.string().uuid(),
  archetypeName: z.string().optional(),
  archetypeSlug: z.string().optional(),
  completedAt: z.string().datetime().optional(),
  headline: z.string().optional(),
});

export const historyResponseSchema = z.object({
  items: z.array(historyItemSchema).default([]),
});

export type MusicDnaErrorEnvelope = z.infer<typeof musicDnaErrorEnvelopeSchema>;
export type OpeningAnalysisRequest = z.infer<typeof openingAnalysisRequestSchema>;
export type OpeningAnalysisResponse = z.infer<typeof openingAnalysisResponseSchema>;
export type StartSessionResponse = z.infer<typeof startSessionResponseSchema>;
export type NextPairingResponse = z.infer<typeof nextPairingResponseSchema>;
export type SubmitChoiceRequest = z.infer<typeof submitChoiceRequestSchema>;
export type SubmitChoiceResponse = z.infer<typeof submitChoiceResponseSchema>;
export type RevealResponse = z.infer<typeof revealResponseSchema>;
export type ActiveSessionResponse = z.infer<typeof activeSessionResponseSchema>;
export type HistoryResponse = z.infer<typeof historyResponseSchema>;
