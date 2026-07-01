// MusicDNA Engine — in-memory test doubles.
//
// InMemorySupabaseGateway + ScriptedLLMGateway back golden-fixture tests
// that drive the engine end-to-end with zero network / zero DB. Keep this
// file in the engine folder so tests import one thing.

import type { LLMGateway, SupabaseGateway } from "./ports";
import type { Lane, Pairing, SongLite, Vector } from "./types";

export type InMemorySessionRow = {
  id: string;
  user_id: string;
  lane: Lane;
  vector: Vector;
  completed_at: string | null;
  archetype_id: string | null;
};

export type InMemoryStore = {
  sessions: Record<string, InMemorySessionRow>;
  songs: Record<string, SongLite>;
  pairings: Record<string, Pairing>;
};

export function emptyStore(): InMemoryStore {
  return { sessions: {}, songs: {}, pairings: {} };
}

export function createInMemorySupabaseGateway(store: InMemoryStore): SupabaseGateway {
  return {
    async getSession(id) {
      return store.sessions[id] ?? null;
    },
    async getSongs(ids) {
      return ids.map((id) => store.songs[id]).filter((s): s is SongLite => Boolean(s));
    },
    async getPairing(id) {
      return store.pairings[id] ?? null;
    },
  };
}

export type ScriptedReply = { match?: RegExp | string; text: string };

export function createScriptedLLMGateway(replies: ScriptedReply[]): LLMGateway & { calls: number } {
  let i = 0;
  const gw = {
    calls: 0,
    async complete(args: Parameters<LLMGateway["complete"]>[0]) {
      gw.calls++;
      // If a matcher exists, pick the first reply whose match hits the prompt.
      const matched = replies.find((r) =>
        r.match instanceof RegExp
          ? r.match.test(args.prompt)
          : typeof r.match === "string"
            ? args.prompt.includes(r.match)
            : false,
      );
      const reply = matched ?? replies[i++ % Math.max(1, replies.length)];
      return { text: reply?.text ?? "" };
    },
  } satisfies LLMGateway & { calls: number };
  return gw;
}
