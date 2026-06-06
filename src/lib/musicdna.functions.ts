import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const DIMS = [
  "movement","atmosphere","groove","darkness","hope","nostalgia","transformation",
  "complexity","melody","verbal_cleverness","authenticity","romanticism","energy",
  "dreaminess","community",
] as const;

const VOICE = `You are MusicDNA's writer. Tone: specific, restrained, slightly uncomfortable. \
No platitudes. No genre labels. No "you like" — use "you reward", "you choose", "you trust". \
Editorial brevity. One observation per sentence. Never flatter.`;

async function ai(messages: Array<{ role: string; content: string }>) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`AI ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  return (json.choices?.[0]?.message?.content ?? "").trim();
}

// ============ Opening hypothesis ============
export const generateOpeningHypothesis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ songs: z.array(z.string().min(1).max(160)).length(5) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const text = await ai([
      { role: "system", content: VOICE },
      {
        role: "user",
        content: `Five songs the user named as ones they love:\n${data.songs.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nWrite ONE sentence (max 30 words) that names what these choices reveal about their taste — specific dimensions like movement, atmosphere, transformation, melody, verbal cleverness. End with a half-promise: "Let's see if that holds."`,
      },
    ]);
    await supabase
      .from("profiles")
      .update({ opening_songs: data.songs, opening_hypothesis: text })
      .eq("user_id", userId);
    return { hypothesis: text };
  });

// ============ Start session ============
export const startSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("sessions")
      .insert({ user_id: userId, vector: {} })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { sessionId: data.id };
  });

// ============ Next pairing ============
export const nextPairing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [usedRes, sessionRes, pairingsRes] = await Promise.all([
      supabase.from("choices").select("pairing_id").eq("session_id", data.sessionId),
      supabase.from("sessions").select("vector").eq("id", data.sessionId).single(),
      supabase
        .from("pairings")
        .select(`
          id, tests, hypothesis, why_good, diagnostic_weight,
          song_a:songs!pairings_song_a_id_fkey(id,title,artist,year,lane),
          song_b:songs!pairings_song_b_id_fkey(id,title,artist,year,lane)
        `)
        .eq("active", true),
    ]);
    if (pairingsRes.error) throw new Error(pairingsRes.error.message);
    const usedIds = new Set((usedRes.data ?? []).map((c) => c.pairing_id));
    const vector = (sessionRes.data?.vector ?? {}) as Record<string, number>;
    const round = usedIds.size;

    // confidence: fraction of 15 axes with |signal| >= 30
    const confidentAxes = (DIMS as readonly string[]).filter((d) => Math.abs(vector[d] ?? 0) >= 30).length;
    const confidence = confidentAxes / DIMS.length;
    const canStop = round >= 12 && confidence >= 0.6;

    const pool = (pairingsRes.data ?? []).filter((p) => !usedIds.has(p.id));
    if (!pool.length || canStop) {
      return { pairing: null, round, confidence, done: true as const };
    }

    // axis-aware: boost pairings testing axes with little signal so far.
    const need = (dim: string) => 1 / (1 + Math.abs(vector[dim] ?? 0));
    const scored = pool.map((p) => {
      const tests = ((p.tests as string[] | null) ?? (DIMS as readonly string[]).slice()) as string[];
      const axisNeed = tests.reduce((s, d) => s + need(d), 0) / Math.max(1, tests.length);
      const w = ((p.diagnostic_weight || 50) / 100) * (0.4 + 0.6 * axisNeed);
      return { p, w };
    });
    const total = scored.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total;
    const pick = scored.find((x) => (r -= x.w) <= 0) ?? scored[0];
    return { pairing: pick.p, round: round + 1, confidence, done: false as const };
  });

// ============ Record choice ============
export const recordChoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      sessionId: z.string().uuid(),
      pairingId: z.string().uuid(),
      chosenSongId: z.string().uuid(),
      msToDecide: z.number().int().nonnegative().max(600000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const songCols = "movement,atmosphere,groove,darkness,hope,nostalgia,transformation,complexity,melody,verbal_cleverness,authenticity,romanticism,energy,dreaminess,community";
    const [pairingRes, sessionRes] = await Promise.all([
      supabase
        .from("pairings")
        .select(`tests, diagnostic_weight, song_a_id, song_b_id, song_a:songs!pairings_song_a_id_fkey(${songCols}), song_b:songs!pairings_song_b_id_fkey(${songCols})`)
        .eq("id", data.pairingId).single(),
      supabase.from("sessions").select("vector,user_id").eq("id", data.sessionId).single(),
    ]);
    const pairing = pairingRes.data as unknown as {
      tests: string[] | null; diagnostic_weight: number; song_a_id: string; song_b_id: string;
      song_a: Record<string, number>; song_b: Record<string, number>;
    } | null;
    const session = sessionRes.data;
    if (pairingRes.error || !pairing) throw new Error(pairingRes.error?.message ?? "pairing not found");
    if (sessionRes.error || !session) throw new Error(sessionRes.error?.message ?? "session not found");
    if (session.user_id !== userId) throw new Error("forbidden");

    const chosenIsA = data.chosenSongId === pairing.song_a_id;
    const winner = chosenIsA ? pairing.song_a : pairing.song_b;
    const loser = chosenIsA ? pairing.song_b : pairing.song_a;
    const w = (pairing.diagnostic_weight || 50) / 100;
    const vec: Record<string, number> = { ...(session.vector as Record<string, number>) };
    const tests: string[] = pairing.tests?.length ? pairing.tests : (DIMS as readonly string[]).slice();
    for (const dim of tests) {
      const a = (winner as Record<string, number>)?.[dim] ?? 50;
      const b = (loser as Record<string, number>)?.[dim] ?? 50;
      vec[dim] = (vec[dim] ?? 0) + (a - b) * w;
    }

    const { error: cErr } = await supabase.from("choices").insert({
      session_id: data.sessionId,
      pairing_id: data.pairingId,
      chosen_song_id: data.chosenSongId,
      ms_to_decide: data.msToDecide ?? null,
    });
    if (cErr) throw new Error(cErr.message);
    const { error: uErr } = await supabase.from("sessions").update({ vector: vec }).eq("id", data.sessionId);
    if (uErr) throw new Error(uErr.message);
    return { vector: vec };
  });

// ============ Finalize session: pick archetype, write interpretation ============
export const finalizeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: session, error: sErr } = await supabase
      .from("sessions").select("vector,user_id").eq("id", data.sessionId).single();
    if (sErr || !session) throw new Error(sErr?.message ?? "session not found");
    if (session.user_id !== userId) throw new Error("forbidden");

    const vector = (session.vector ?? {}) as Record<string, number>;
    const { data: archetypes } = await supabase.from("archetypes").select("id,name,tagline,signature_axes");

    // cosine similarity vs each archetype's signature_axes
    let best = { id: null as string | null, name: "", score: -Infinity };
    for (const a of archetypes ?? []) {
      const axes = (a.signature_axes ?? {}) as Record<string, number>;
      const keys = Object.keys(axes);
      if (!keys.length) continue;
      let dot = 0, magA = 0, magB = 0;
      for (const k of keys) {
        const v = (vector[k] ?? 0) / 100;
        const u = axes[k] ?? 0;
        dot += v * u; magA += v * v; magB += u * u;
      }
      const denom = Math.sqrt(magA) * Math.sqrt(magB);
      const score = denom > 0 ? dot / denom : 0;
      if (score > best.score) best = { id: a.id, name: a.name, score };
    }

    const top = Object.entries(vector).sort((x, y) => y[1] - x[1]).slice(0, 4);
    const bottom = Object.entries(vector).sort((x, y) => x[1] - y[1]).slice(0, 2);
    const interpretation = await ai([
      { role: "system", content: VOICE },
      {
        role: "user",
        content: `Archetype: ${best.name || "Unassigned"}.\nTop dimensions (with magnitudes): ${top.map(([k, v]) => `${k} ${v.toFixed(1)}`).join(", ")}.\nLow dimensions: ${bottom.map(([k, v]) => `${k} ${v.toFixed(1)}`).join(", ")}.\n\nWrite a 3-sentence reading of this listener. Sentence 1: the central pattern (specific, not "you like X"). Sentence 2: what they consistently refuse. Sentence 3: the cost — what this taste closes off. No genre names, no compliments.`,
      },
    ]);

    await supabase.from("sessions").update({
      archetype_id: best.id,
      interpretation,
      completed_at: new Date().toISOString(),
    }).eq("id", data.sessionId);

    return { archetypeId: best.id, archetypeName: best.name, interpretation, vector };
  });

// ============ Get latest profile + session for /profile page ============
export const getMyResult = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: sessions }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("sessions")
        .select("id,started_at,completed_at,interpretation,vector,archetype:archetype_id(id,name,tagline,description)")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(20),
    ]);
    return { profile, sessions: sessions ?? [] };
  });
