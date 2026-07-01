// MusicDNA Engine — port interfaces.
//
// The engine depends on these interfaces, NOT on concrete Supabase / LLM
// clients. Adapters in src/musicdna/adapters/* implement them for prod;
// in-memory fakes in tests implement them for regression checks.
//
// Rule: never import @/integrations/supabase/* from src/musicdna/engine/*.

import type { Vector, Lane, Pairing, SongLite } from "./types";

export interface Clock {
  now(): Date;
}

export interface Rng {
  // Returns a float in [0, 1). Injectable so tests are deterministic.
  next(): number;
}

// Narrow surface over Supabase that the engine actually needs. Grows as
// concerns migrate; do NOT re-export the raw SupabaseClient here.
export interface SupabaseGateway {
  getSession(sessionId: string): Promise<{
    id: string;
    user_id: string;
    lane: Lane;
    vector: Vector;
    completed_at: string | null;
    archetype_id: string | null;
  } | null>;

  getSongs(ids: string[]): Promise<SongLite[]>;

  getPairing(pairingId: string): Promise<Pairing | null>;
}

export interface LLMGateway {
  // Generic chat call routed through Lovable AI Gateway.
  complete(args: {
    model: string;
    system?: string;
    prompt: string;
    temperature?: number;
    max_tokens?: number;
    // Structured tracing hook — adapter writes to llm_calls; engine stays pure.
    trace?: { session_id?: string; kind: string };
  }): Promise<{ text: string; usage?: { input_tokens?: number; output_tokens?: number } }>;
}

export interface EngineDeps {
  db: SupabaseGateway;
  llm: LLMGateway;
  clock: Clock;
  rng: Rng;
}
