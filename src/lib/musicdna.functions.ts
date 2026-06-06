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

const DIM_LABEL: Record<string, { hi: string; lo: string }> = {
  movement: { hi: "movement", lo: "stillness" },
  atmosphere: { hi: "atmosphere", lo: "statement" },
  groove: { hi: "groove", lo: "arrangement" },
  darkness: { hi: "darkness", lo: "light" },
  hope: { hi: "hope", lo: "resignation" },
  nostalgia: { hi: "nostalgia", lo: "the present" },
  transformation: { hi: "transformation", lo: "arrival" },
  complexity: { hi: "complexity", lo: "directness" },
  melody: { hi: "melody", lo: "texture" },
  verbal_cleverness: { hi: "language", lo: "feeling" },
  authenticity: { hi: "rawness", lo: "polish" },
  romanticism: { hi: "romanticism", lo: "cool" },
  energy: { hi: "energy", lo: "restraint" },
  dreaminess: { hi: "dreaminess", lo: "clarity" },
  community: { hi: "communion", lo: "solitude" },
};


// ============ Shared persona ============
// Prepended to every system prompt so the model holds one consistent voice:
// cool, edgy, insightful — a music critic with taste and teeth.
const PERSONA = `You are the critic-in-residence for MusicDNA. Think old Rolling Stone in its mean years crossed with a late-night college DJ who actually reads.
You are cool the way good critics are cool: you've heard everything, you owe nobody a compliment, and you'd rather be interesting than nice.
You have a point of view. You take swings. You back them up. You never hedge into mush.
Edgy means honest, not mean — a little uncomfortable, never cruel, never edgelord.
Insight is the whole job. Every sentence earns its place by saying something the listener couldn't have said about themselves.
Hard rules: no platitudes, no horoscope language, no therapy-speak, no "music lover", no "vibes", no "journey", no genre labels as analysis, no "you like" — use "you reward", "you trust", "you keep choosing". One idea per sentence. Short sentences hit harder. Never flatter. Never apologize for the read.`;

const VOICE = `${PERSONA}
Mode: short editorial observation. Specific, restrained, slightly uncomfortable. One observation per sentence.`;

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

// ============ Lane classifier ============
const LANES = ["alternative", "pop", "hip_hop", "electronic", "classic_rock", "general"] as const;
type Lane = (typeof LANES)[number];

// Map catalog sub-lanes (currently all alternative sub-genres) to top-level lanes.
function catalogLaneToTopLane(sub: string | null | undefined): Lane | null {
  if (!sub) return null;
  const s = sub.toLowerCase();
  if ((LANES as readonly string[]).includes(s)) return s as Lane;
  if (
    s.includes("post_punk") || s.includes("post-punk") ||
    s.includes("shoegaze") || s.includes("dreampop") || s.includes("britpop") ||
    s.includes("indie") || s.includes("madchester") || s.includes("manchester") ||
    s.includes("grunge") || s.includes("alt-rock") || s.includes("altrock") ||
    s.includes("goth") || s.includes("darkwave") || s.includes("noise") ||
    s.includes("artrock") || s.includes("punk") || s.includes("sophistipop")
  ) return "alternative";
  if (s.includes("electronic")) return "electronic";
  return null;
}

const CLASSIFIER_VOICE = `${PERSONA}
Mode: taste-reader. You read five songs a user named as ones they love and produce a structured taste sketch. The reasoning and hypothesis fields carry the voice — keep them sharp, specific, and a little uncomfortable.

You return a JSON object with this exact shape:
{
  "lane": "alternative" | "pop" | "hip_hop" | "electronic" | "classic_rock" | "general",
  "confidence": 0.0-1.0,
  "secondary_lanes": [lane, ...],
  "candidate_dimensions": {
    "movement": -100..100, "atmosphere": -100..100, "groove": -100..100,
    "darkness": -100..100, "hope": -100..100, "nostalgia": -100..100,
    "transformation": -100..100, "complexity": -100..100, "melody": -100..100,
    "verbal_cleverness": -100..100, "authenticity": -100..100, "romanticism": -100..100,
    "energy": -100..100, "dreaminess": -100..100, "community": -100..100
  },
  "per_song": [{"input": "...", "lane": "alternative|pop|hip_hop|electronic|classic_rock|unknown"}],
  "reasoning": ["one short observation", "..."],
  "hypothesis": "ONE sentence, max 30 words, Rolling Stone voice. Name what these choices reveal — specific dimensions like movement, atmosphere, transformation, melody. End with 'Let's see if that holds.' or similar half-promise."
}

Lane rules: alternative = post-punk, indie, shoegaze, britpop, grunge, goth, college rock. pop = mainstream chart pop, pop-rock (Swift, Eilish, Beyoncé pop work). hip_hop = rap, trap. electronic = techno, house, IDM, drum'n'bass, EDM. classic_rock = 60s-80s mainstream rock (Stones, Zeppelin, Fleetwood Mac). Use "general" only when the five songs genuinely scatter across lanes with no center of gravity.

Confidence: 1.0 = all five point to one lane. 0.7-0.9 = strong majority. 0.4-0.6 = mixed but a leaning. <0.4 = scattered, use "general".

candidate_dimensions: read what the five songs collectively reward. Negative = the low pole (stillness, statement, light, etc.), positive = the high pole. Be opinionated — leave dimensions at 0 only when the songs are genuinely silent on that axis.

Voice for hypothesis: specific, restrained, slightly uncomfortable. No platitudes. No genre labels. Use "you reward", "you choose", "you trust" — never "you like".

Respond ONLY with valid JSON. No prose, no markdown fences.`;

type LlmDimensions = Partial<Record<(typeof DIMS)[number], number>>;

type OpeningAnalysis = {
  lane: Lane;
  confidence: number;
  secondary_lanes: Lane[];
  reasoning: string[];
  hypothesis: string;
  candidate_dimensions: LlmDimensions;
  per_song: Array<{ input: string; lane: Lane | "unknown"; source: "llm" | "catalog"; canon_id?: string }>;
  canon_matches: Array<{ input: string; song_id: string; title: string; artist: string; primary_lane: string }>;
};

const FALLBACK: OpeningAnalysis = {
  lane: "general",
  confidence: 0,
  secondary_lanes: [],
  reasoning: ["Couldn't read those five clearly. The matchups will do the work."],
  hypothesis: "Five songs is a sketch, not a portrait. Let's see if the matchups hold.",
  candidate_dimensions: {},
  per_song: [],
  canon_matches: [],
};

async function classifyLane(
  songs: string[],
  supabase: { from: (t: string) => { select: (c: string) => { ilike: (col: string, v: string) => { limit: (n: number) => Promise<{ data: Array<{ id: string; primary_lane?: string | null; lane: string; title: string; artist: string }> | null }> } } } },
): Promise<OpeningAnalysis> {
  // Step 1: LLM reads all five at once — lane, confidence, dimensions, hypothesis.
  let llm: OpeningAnalysis = { ...FALLBACK, per_song: songs.map((s) => ({ input: s, lane: "unknown", source: "llm" })) };
  try {
    const txt = await ai([
      { role: "system", content: CLASSIFIER_VOICE },
      { role: "user", content: `The user named these five songs as ones they love:\n${songs.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nReturn the JSON object now.` },
    ]);
    const cleaned = txt.replace(/```json\s*|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<OpeningAnalysis>;
    const lane = (LANES as readonly string[]).includes(parsed.lane as string) ? (parsed.lane as Lane) : "general";
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0)));
    const secondary = Array.isArray(parsed.secondary_lanes)
      ? parsed.secondary_lanes.filter((l): l is Lane => (LANES as readonly string[]).includes(l as string) && l !== lane && l !== "general")
      : [];
    const dims: LlmDimensions = {};
    if (parsed.candidate_dimensions && typeof parsed.candidate_dimensions === "object") {
      for (const d of DIMS) {
        const v = (parsed.candidate_dimensions as Record<string, unknown>)[d];
        if (typeof v === "number" && Number.isFinite(v)) dims[d] = Math.max(-100, Math.min(100, Math.round(v)));
      }
    }
    const perSong = songs.map((input) => {
      const match = Array.isArray(parsed.per_song) ? parsed.per_song.find((p) => p?.input === input) : null;
      const songLane = match && (LANES as readonly string[]).includes(match.lane as string) ? (match.lane as Lane) : "unknown";
      return { input, lane: songLane as Lane | "unknown", source: "llm" as const };
    });
    llm = {
      lane: confidence < 0.4 ? "general" : lane,
      confidence,
      secondary_lanes: secondary,
      reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning.slice(0, 4).map(String) : [],
      hypothesis: typeof parsed.hypothesis === "string" && parsed.hypothesis.trim() ? parsed.hypothesis.trim() : FALLBACK.hypothesis,
      candidate_dimensions: dims,
      per_song: perSong,
      canon_matches: [],
    };
  } catch { /* keep FALLBACK */ }

  // Step 2: Hidden canon enrichment — try to map each entry to a catalog song.
  // This is a free signal, never shown to the user. Failures are silent.
  for (let i = 0; i < songs.length; i++) {
    const raw = songs[i];
    const [titlePart, artistPart] = raw.split(/—|–|-/).map((s) => s.trim());
    const title = titlePart || raw;
    if (!title) continue;
    try {
      const { data } = await supabase.from("songs").select("id,primary_lane,lane,title,artist").ilike("title", title).limit(5);
      if (!data?.length) continue;
      const best = artistPart
        ? data.find((r) => r.artist?.toLowerCase().includes(artistPart.toLowerCase())) ?? data[0]
        : data[0];
      const topLane = catalogLaneToTopLane(best.primary_lane ?? best.lane);
      llm.canon_matches.push({
        input: raw,
        song_id: best.id,
        title: best.title,
        artist: best.artist,
        primary_lane: best.primary_lane ?? best.lane,
      });
      if (llm.per_song[i]) {
        llm.per_song[i] = { ...llm.per_song[i], source: "catalog", canon_id: best.id, lane: topLane ?? llm.per_song[i].lane };
      }
    } catch { /* swallow */ }
  }

  return llm;
}

export const analyzeOpeningSongs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ songs: z.array(z.string().trim().min(1).max(200)).length(5) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const analysis = await classifyLane(data.songs, supabase as never);
    await supabase
      .from("profiles")
      .update({
        opening_songs: data.songs,
        opening_hypothesis: analysis.hypothesis,
        opening_lane: analysis.lane,
        opening_lane_confidence: analysis.confidence,
        opening_analysis_json: JSON.parse(JSON.stringify(analysis)),
      })
      .eq("user_id", userId);
    return analysis;
  });

// Back-compat alias — old call sites keep working.
export const generateOpeningHypothesis = analyzeOpeningSongs;

// ============ Start session ============
const ALL_LANES: Lane[] = ["alternative", "pop", "hip_hop", "electronic", "classic_rock"];

export const startSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("opening_lane, opening_lane_confidence, opening_analysis_json")
      .eq("user_id", userId)
      .maybeSingle();
    const lane = ((profile?.opening_lane as Lane | null) ?? "general") as Lane;
    const lane_confidence = Number(profile?.opening_lane_confidence ?? 0);

    // Seed probe candidates: secondary lanes from opening analysis, then a wildcard.
    const analysis = (profile?.opening_analysis_json ?? {}) as { secondary_lanes?: string[] };
    const secondaries = (analysis.secondary_lanes ?? []).filter((l): l is Lane =>
      (ALL_LANES as readonly string[]).includes(l) && l !== lane,
    );
    const wildcardPool = ALL_LANES.filter((l) => l !== lane && !secondaries.includes(l));
    const wildcard = wildcardPool[Math.floor(Math.random() * wildcardPool.length)];
    const probe_candidate_lanes = Array.from(new Set([...secondaries, wildcard].filter(Boolean) as Lane[])).slice(0, 3);

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        user_id: userId,
        vector: {},
        lane,
        lane_confidence,
        probe_candidate_lanes,
        probe_state: { probes_shown: [], pending: {}, lane_alignment: {}, flips: [] },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { sessionId: data.id, lane, lane_confidence };
  });

// ============ Next pairing ============
// Probe schedule: at these rounds we silently inject a pairing from a
// candidate lane (not the user's current lane) to see if the user resonates.
const PROBE_ROUNDS = new Set([4, 9, 14]);

type ProbeState = {
  probes_shown: Array<{ round: number; pairing_id: string; lane: Lane }>;
  pending: Record<string, Lane>; // pairing_id → probe lane (not yet recorded)
  lane_alignment: Record<string, { wins: number; total: number; magnitude: number; cosine_sum: number }>;
  flips: Array<{ round: number; from: Lane; to: Lane; reason: string }>;
};

export const nextPairing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [usedRes, sessionRes] = await Promise.all([
      supabase.from("choices").select("pairing_id").eq("session_id", data.sessionId),
      supabase
        .from("sessions")
        .select("vector, lane, probe_candidate_lanes, probe_state")
        .eq("id", data.sessionId)
        .single(),
    ]);
    const sessionLane = (sessionRes.data?.lane as Lane | null) ?? "general";
    const probeCandidates = (sessionRes.data?.probe_candidate_lanes as Lane[] | null) ?? [];
    const probeState = (sessionRes.data?.probe_state ?? {}) as ProbeState;
    probeState.probes_shown = probeState.probes_shown ?? [];
    probeState.pending = probeState.pending ?? {};
    probeState.lane_alignment = probeState.lane_alignment ?? {};
    probeState.flips = probeState.flips ?? [];

    const pairingSelect = `
      id, tests, hypothesis, why_good, diagnostic_weight, lane,
      song_a:songs!pairings_song_a_id_fkey(id,title,artist,year,primary_lane,lane),
      song_b:songs!pairings_song_b_id_fkey(id,title,artist,year,primary_lane,lane)
    `;

    const usedIds = new Set((usedRes.data ?? []).map((c) => c.pairing_id));
    const round = usedIds.size;
    const vector = (sessionRes.data?.vector ?? {}) as Record<string, number>;
    const confidentAxes = (DIMS as readonly string[]).filter((d) => Math.abs(vector[d] ?? 0) >= 30).length;
    const confidence = confidentAxes / DIMS.length;
    const canStop = round >= 12 && confidence >= 0.6;
    if (canStop) {
      return { pairing: null, round, confidence, done: true as const };
    }

    // -------- Probe injection (silent) --------
    // At scheduled rounds, try a pairing from a candidate lane the user hasn't
    // been tested on yet. Skip lanes we already probed.
    const probedLanes = new Set(probeState.probes_shown.map((p) => p.lane));
    const probeLane = PROBE_ROUNDS.has(round)
      ? probeCandidates.find((l) => !probedLanes.has(l) && l !== sessionLane)
      : undefined;

    if (probeLane) {
      const probeRes = await supabase
        .from("pairings")
        .select(pairingSelect)
        .eq("active", true)
        .eq("lane", probeLane)
        .order("diagnostic_weight", { ascending: false })
        .limit(20);
      if (!probeRes.error) {
        const probePool = (probeRes.data ?? []).filter((p) => !usedIds.has(p.id));
        if (probePool.length) {
          const pick = probePool[Math.floor(Math.random() * Math.min(3, probePool.length))];
          probeState.pending[pick.id] = probeLane;
          await supabase.from("sessions").update({ probe_state: probeState as never }).eq("id", data.sessionId);
          return { pairing: pick, round: round + 1, confidence, done: false as const };
        }
      }
    }

    // -------- Normal lane-scoped fetch --------
    let pairingsRes = sessionLane === "general"
      ? await supabase.from("pairings").select(pairingSelect).eq("active", true)
      : await supabase.from("pairings").select(pairingSelect).eq("active", true).eq("lane", sessionLane);
    if (pairingsRes.error) throw new Error(pairingsRes.error.message);

    let pool = (pairingsRes.data ?? []).filter((p) => !usedIds.has(p.id));
    if (!pool.length && sessionLane !== "general") {
      pairingsRes = await supabase.from("pairings").select(pairingSelect).eq("active", true).eq("lane", "general");
      if (pairingsRes.error) throw new Error(pairingsRes.error.message);
      pool = (pairingsRes.data ?? []).filter((p) => !usedIds.has(p.id));
    }
    if (!pool.length) {
      return { pairing: null, round, confidence, done: true as const };
    }

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
// Each axis carries a short verdict ("immersion over immediacy") plus a
// Rolling Stone–voice "why that mattered" line. Keep them punchy, opinionated,
// one observation per sentence. No platitudes, no genre talk.
const REVEAL: Record<string, { hi: { verdict: string; why: string }; lo: { verdict: string; why: string } }> = {
  movement: {
    hi: { verdict: "movement over stillness", why: "You want the song to take you somewhere. Standing still is for other people." },
    lo: { verdict: "stillness over movement", why: "You'd rather the song sit you down than drag you forward. Patience as taste." },
  },
  atmosphere: {
    hi: { verdict: "atmosphere over statement", why: "You trust the room more than the lyric. The air around the song is the song." },
    lo: { verdict: "statement over atmosphere", why: "You want the song to mean something out loud. No hiding behind reverb." },
  },
  groove: {
    hi: { verdict: "groove over arrangement", why: "You're a body-first listener. The pocket is the point; the rest is decoration." },
    lo: { verdict: "arrangement over groove", why: "You hear the architecture before the pulse. The chart matters more than the kick drum." },
  },
  darkness: {
    hi: { verdict: "darkness over light", why: "You don't flinch. The shadow in the song is the part you came for." },
    lo: { verdict: "light over darkness", why: "You refuse the easy gloom. You want the song to leave a window open." },
  },
  hope: {
    hi: { verdict: "hope over resignation", why: "You pick the lift every time. Bleakness without a way out bores you." },
    lo: { verdict: "resignation over hope", why: "You don't need the song to fix anything. Sitting with it is enough." },
  },
  nostalgia: {
    hi: { verdict: "nostalgia over the present", why: "You listen with the rearview mirror on. The ache is half the pleasure." },
    lo: { verdict: "the present over nostalgia", why: "You don't trade in old feelings. The song has to land now or not at all." },
  },
  transformation: {
    hi: { verdict: "transformation over arrival", why: "You'd rather a song become something than be something. Becoming is the whole bet." },
    lo: { verdict: "arrival over transformation", why: "You want the song to know what it is from the first bar. No identity crises in your playlist." },
  },
  complexity: {
    hi: { verdict: "complexity over directness", why: "You like the songs that make you work. The third listen is when it starts paying you back." },
    lo: { verdict: "directness over complexity", why: "You don't need a footnote. A great song shouldn't need a guided tour." },
  },
  melody: {
    hi: { verdict: "melody over texture", why: "You want a tune you can carry home. Hum it or it didn't happen." },
    lo: { verdict: "texture over melody", why: "You listen to the surface, not the line. The grain of the thing is the thing." },
  },
  verbal_cleverness: {
    hi: { verdict: "language over feeling", why: "You came for the writing. A great line will outrun a great chorus." },
    lo: { verdict: "feeling over language", why: "Words can get out of the way. You're chasing what the song does, not what it says." },
  },
  authenticity: {
    hi: { verdict: "rawness over polish", why: "You'd take the cracked voice over the perfect take. Sincerity has a sound and you can hear it." },
    lo: { verdict: "polish over rawness", why: "You don't romanticize the mess. Craft is not the enemy of feeling — it's the delivery system." },
  },
  romanticism: {
    hi: { verdict: "romanticism over cool", why: "You let the big feelings in. Restraint is for people too embarrassed to want anything." },
    lo: { verdict: "cool over romanticism", why: "You don't trust the swoon. Keep your distance, keep the line dry." },
  },
  energy: {
    hi: { verdict: "energy over restraint", why: "You want the song to mean it physically. If it doesn't move the room, why bother." },
    lo: { verdict: "restraint over energy", why: "You like a song that holds back. The whisper hits harder than the shout." },
  },
  dreaminess: {
    hi: { verdict: "dreaminess over clarity", why: "You'd rather drift than land. The haze is doing more work than the lyric." },
    lo: { verdict: "clarity over dreaminess", why: "You want the edges sharp. No fog machine, no fog." },
  },
  community: {
    hi: { verdict: "communion over solitude", why: "You hear songs in rooms full of people. The singalong is the meaning." },
    lo: { verdict: "solitude over communion", why: "You listen alone, on headphones, on purpose. Crowds dilute the signal." },
  },
};



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
    const songCols = "id,title,artist,movement,atmosphere,groove,darkness,hope,nostalgia,transformation,complexity,melody,verbal_cleverness,authenticity,romanticism,energy,dreaminess,community";
    const [pairingRes, sessionRes] = await Promise.all([
      supabase
        .from("pairings")
        .select(`tests, diagnostic_weight, song_a_id, song_b_id, song_a:songs!pairings_song_a_id_fkey(${songCols}), song_b:songs!pairings_song_b_id_fkey(${songCols})`)
        .eq("id", data.pairingId).single(),
      supabase.from("sessions").select("vector,user_id,lane,probe_state").eq("id", data.sessionId).single(),
    ]);
    const pairing = pairingRes.data as unknown as {
      tests: string[] | null; diagnostic_weight: number; song_a_id: string; song_b_id: string;
      song_a: Record<string, number> & { id: string; title: string; artist: string };
      song_b: Record<string, number> & { id: string; title: string; artist: string };
    } | null;
    const session = sessionRes.data as { vector: Record<string, number>; user_id: string; lane: Lane; probe_state: ProbeState | null } | null;
    if (pairingRes.error || !pairing) throw new Error(pairingRes.error?.message ?? "pairing not found");
    if (sessionRes.error || !session) throw new Error(sessionRes.error?.message ?? "session not found");
    if (session.user_id !== userId) throw new Error("forbidden");

    const chosenIsA = data.chosenSongId === pairing.song_a_id;
    const winner = chosenIsA ? pairing.song_a : pairing.song_b;
    const loser = chosenIsA ? pairing.song_b : pairing.song_a;
    const rejectedSongId = chosenIsA ? pairing.song_b_id : pairing.song_a_id;
    const w = (pairing.diagnostic_weight || 50) / 100;
    const priorVec: Record<string, number> = { ...(session.vector as Record<string, number>) };
    const vec: Record<string, number> = { ...priorVec };
    const tests: string[] = pairing.tests?.length ? pairing.tests : (DIMS as readonly string[]).slice();
    let topDim = tests[0] ?? "movement";
    let topDelta = 0;
    const deltaVec: Record<string, number> = {};
    for (const dim of tests) {
      const a = (winner as Record<string, number>)?.[dim] ?? 50;
      const b = (loser as Record<string, number>)?.[dim] ?? 50;
      const delta = a - b;
      deltaVec[dim] = delta;
      vec[dim] = (vec[dim] ?? 0) + delta * w;
      if (Math.abs(delta) > Math.abs(topDelta)) { topDelta = delta; topDim = dim; }
    }

    const phrase = REVEAL[topDim];
    const direction = topDelta >= 0 ? phrase?.hi : phrase?.lo;
    const verdict = direction
      ? `You chose ${winner.title} over ${loser.title}. That's ${direction.verdict}.`
      : `You chose ${winner.title} over ${loser.title}.`;
    const why = direction?.why ?? "";
    const ms = data.msToDecide ?? null;
    const hesitation =
      ms == null ? null : ms < 2500 ? "Snap verdict." : ms > 12000 ? "You stared this one down." : null;

    const { error: cErr } = await supabase.from("choices").insert({
      session_id: data.sessionId,
      pairing_id: data.pairingId,
      chosen_song_id: data.chosenSongId,
      rejected_song_id: rejectedSongId,
      ms_to_decide: data.msToDecide ?? null,
    });
    if (cErr) throw new Error(cErr.message);

    // -------- Probe scoring & silent lane flip --------
    const probeState: ProbeState = {
      probes_shown: session.probe_state?.probes_shown ?? [],
      pending: session.probe_state?.pending ?? {},
      lane_alignment: session.probe_state?.lane_alignment ?? {},
      flips: session.probe_state?.flips ?? [],
    };
    let nextLane: Lane = session.lane;
    const probeLane = probeState.pending[data.pairingId];
    if (probeLane) {
      // Cosine alignment between this choice's delta and the user's running vector.
      // High positive cosine = the probe lane "rewards what you already reward".
      const keys = Object.keys(deltaVec);
      let dot = 0, magD = 0, magV = 0;
      for (const k of keys) {
        const d = deltaVec[k] ?? 0;
        const v = priorVec[k] ?? 0;
        dot += d * v; magD += d * d; magV += v * v;
      }
      const cosine = magD > 0 && magV > 0 ? dot / (Math.sqrt(magD) * Math.sqrt(magV)) : 0;
      const magnitude = tests.reduce((s, dim) => s + Math.abs(deltaVec[dim] ?? 0), 0);
      const win = cosine >= 0.2 ? 1 : 0;

      const prev = probeState.lane_alignment[probeLane] ?? { wins: 0, total: 0, magnitude: 0, cosine_sum: 0 };
      probeState.lane_alignment[probeLane] = {
        wins: prev.wins + win,
        total: prev.total + 1,
        magnitude: prev.magnitude + magnitude,
        cosine_sum: prev.cosine_sum + cosine,
      };
      probeState.probes_shown.push({ round: probeState.probes_shown.length + 1, pairing_id: data.pairingId, lane: probeLane });
      delete probeState.pending[data.pairingId];

      // Flip rule: ≥2 probes in this lane, win rate ≥ 0.75, avg cosine ≥ 0.3,
      // and current lane confidence isn't already overwhelming.
      const tally = probeState.lane_alignment[probeLane];
      const winRate = tally.total ? tally.wins / tally.total : 0;
      const avgCos = tally.total ? tally.cosine_sum / tally.total : 0;
      if (tally.total >= 2 && winRate >= 0.75 && avgCos >= 0.3 && !probeState.flips.find((f) => f.to === probeLane)) {
        const reason = `probe lane ${probeLane}: ${tally.wins}/${tally.total} wins, avg cosine ${avgCos.toFixed(2)}`;
        probeState.flips.push({
          round: probeState.probes_shown.length,
          from: session.lane,
          to: probeLane,
          reason,
        });
        nextLane = probeLane;
        // Fire-and-forget event log; never block the response.
        supabase.from("event_log").insert({
          user_id: userId,
          session_id: data.sessionId,
          event_type: "lane_flipped",
          pairing_id: data.pairingId,
          props: { from: session.lane, to: probeLane, win_rate: winRate, avg_cosine: avgCos } as never,
          client: "server",
        }).then(() => undefined, () => undefined);
      } else {
        supabase.from("event_log").insert({
          user_id: userId,
          session_id: data.sessionId,
          event_type: "lane_probed",
          pairing_id: data.pairingId,
          props: { lane: probeLane, cosine, magnitude, win } as never,
          client: "server",
        }).then(() => undefined, () => undefined);
      }
    }

    const { error: uErr } = await supabase
      .from("sessions")
      .update({ vector: vec, lane: nextLane, probe_state: probeState as never })
      .eq("id", data.sessionId);
    if (uErr) throw new Error(uErr.message);
    return { vector: vec, verdict, why, hesitation, dim: topDim, delta: topDelta };
  });




// ============================================================
// ANALYST (deterministic) + CRITIC (AI) pipeline.
// The Analyst builds observations, patterns, and counter-hypotheses from
// stored choices and song vectors. Only claims clearing the evidence
// threshold are handed to the Critic, who is told — in no uncertain terms —
// that he is a music critic, not a therapist.
// ============================================================

const BANNED_WORDS = [
  "dreamer","seeker","old soul","empath","creative spirit","destiny",
  "wound","soul","trauma","secretly","you are the kind of person who",
  "energy","aura","journey of self","authentic self","true self",
];

const CRITIC_VOICE = `${PERSONA}
Mode: long-form critic write-up. You are not a therapist, astrologer, psychologist, or life coach — you are reading patterns in choices, not diagnosing a person.
Every claim must reference the evidence you were given. Acknowledge uncertainty where the evidence is thin. Do not invent claims that are not in the allowed_claims list.
Banned words: ${BANNED_WORDS.join(", ")}.
Prefer: "across these choices", "this suggests", "you repeatedly favored", "the strongest evidence is", "a weaker reading would be".`;

export const finalizeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: session, error: sErr } = await supabase
      .from("sessions").select("vector,user_id").eq("id", data.sessionId).single();
    if (sErr || !session) throw new Error(sErr?.message ?? "session not found");
    if (session.user_id !== userId) throw new Error("forbidden");

    const songCols = "id,title,artist,year,lane,movement,atmosphere,groove,darkness,hope,nostalgia,transformation,complexity,melody,verbal_cleverness,authenticity,romanticism,energy,dreaminess,community";

    // -------- Pull raw evidence --------
    const [archRes, choicesRes] = await Promise.all([
      supabase.from("archetypes").select("id,name,tagline,signature_axes"),
      supabase
        .from("choices")
        .select(`
          ms_to_decide,
          pairing:pairing_id(tests, diagnostic_weight),
          chosen:chosen_song_id(${songCols}),
          rejected:rejected_song_id(${songCols})
        `)
        .eq("session_id", data.sessionId),
    ]);
    const archetypes = archRes.data ?? [];
    type SongRow = Record<string, number | string | null> & { id: string; title: string; artist: string; year: number | null; lane: string };
    type ChoiceRow = {
      ms_to_decide: number | null;
      pairing: { tests: string[] | null; diagnostic_weight: number | null } | null;
      chosen: SongRow | null;
      rejected: SongRow | null;
    };
    const choices = ((choicesRes.data ?? []) as unknown as ChoiceRow[]).filter((c) => c.chosen && c.rejected);

    // -------- Layer 1: Observations --------
    const observations = choices.map((c) => ({
      chosen: c.chosen!.title,
      chosen_artist: c.chosen!.artist,
      rejected: c.rejected!.title,
      rejected_artist: c.rejected!.artist,
      tested_dimensions: c.pairing?.tests ?? [],
      ms_to_decide: c.ms_to_decide,
    }));

    // -------- Layer 2: Patterns (per axis) --------
    type PatternAcc = {
      chosen_dir: number;      // +1 each time chosen side > rejected on this axis
      rejected_dir: number;    // +1 each time rejected side > chosen
      magnitude: number;       // sum of |delta|, weighted by diagnostic_weight
      supporting: number;      // count of choices where this axis was tested
      examples: Array<{ chosen: string; rejected: string; delta: number }>;
    };
    const acc: Record<string, PatternAcc> = {};
    for (const c of choices) {
      const tests = c.pairing?.tests?.length ? c.pairing.tests : (DIMS as readonly string[]).slice();
      const w = ((c.pairing?.diagnostic_weight ?? 50) / 100);
      for (const dim of tests) {
        const a = Number(c.chosen![dim] ?? 50);
        const b = Number(c.rejected![dim] ?? 50);
        const delta = a - b;
        if (!acc[dim]) acc[dim] = { chosen_dir: 0, rejected_dir: 0, magnitude: 0, supporting: 0, examples: [] };
        acc[dim].supporting += 1;
        acc[dim].magnitude += Math.abs(delta) * w;
        if (delta > 5) acc[dim].chosen_dir += 1;
        else if (delta < -5) acc[dim].rejected_dir += 1;
        if (Math.abs(delta) > 15 && acc[dim].examples.length < 3) {
          acc[dim].examples.push({ chosen: c.chosen!.title, rejected: c.rejected!.title, delta });
        }
      }
    }

    const patterns = Object.entries(acc).map(([dim, p]) => {
      const direction: "hi" | "lo" = p.chosen_dir >= p.rejected_dir ? "hi" : "lo";
      const supporting_choices = direction === "hi" ? p.chosen_dir : p.rejected_dir;
      const label = DIM_LABEL[dim];
      // confidence = directional consistency * magnitude factor
      const consistency = p.supporting > 0 ? supporting_choices / p.supporting : 0;
      const magnitudeFactor = Math.min(1, p.magnitude / (p.supporting * 30 || 1));
      const confidence = Number((consistency * 0.7 + magnitudeFactor * 0.3).toFixed(3));
      return {
        dimension: dim,
        preferred: direction === "hi" ? label?.hi : label?.lo,
        opposed: direction === "hi" ? label?.lo : label?.hi,
        supporting_choices,
        tested_total: p.supporting,
        confidence,
        examples: p.examples,
        tradeoff: `${direction === "hi" ? label?.hi : label?.lo} over ${direction === "hi" ? label?.lo : label?.hi}`,
      };
    }).sort((x, y) => y.confidence - x.confidence);

    // -------- Layer 3: Counter-hypotheses --------
    const counterarguments: Array<{ claim: string; impact: "low" | "medium" | "high"; notes: string }> = [];
    const artistCount: Record<string, number> = {};
    const eraCount: Record<string, number> = {};
    const laneCount: Record<string, number> = {};
    let fastPicks = 0;
    for (const c of choices) {
      const artist = c.chosen!.artist;
      artistCount[artist] = (artistCount[artist] ?? 0) + 1;
      const year = Number(c.chosen!.year);
      if (year) {
        const decade = `${Math.floor(year / 10) * 10}s`;
        eraCount[decade] = (eraCount[decade] ?? 0) + 1;
      }
      const lane = String(c.chosen!.lane ?? "");
      if (lane) laneCount[lane] = (laneCount[lane] ?? 0) + 1;
      if ((c.ms_to_decide ?? 99999) < 2000) fastPicks += 1;
    }
    for (const [artist, n] of Object.entries(artistCount)) {
      if (n >= 3) counterarguments.push({
        claim: `User may simply prefer ${artist}.`,
        impact: n >= 5 ? "high" : "medium",
        notes: `${n} of ${choices.length} winning songs are by ${artist}.`,
      });
    }
    for (const [decade, n] of Object.entries(eraCount)) {
      if (n >= Math.max(4, Math.ceil(choices.length * 0.5))) counterarguments.push({
        claim: `User may be selecting on era (${decade}) rather than the tested dimensions.`,
        impact: "medium",
        notes: `${n} winning songs come from the ${decade}.`,
      });
    }
    for (const [lane, n] of Object.entries(laneCount)) {
      if (n >= Math.max(4, Math.ceil(choices.length * 0.6))) counterarguments.push({
        claim: `User may be selecting on lane (${lane}) rather than diagnostic tradeoffs.`,
        impact: "medium",
        notes: `${n} winning songs share the ${lane} lane.`,
      });
    }
    if (choices.length >= 8 && fastPicks / choices.length >= 0.6) counterarguments.push({
      claim: "Many picks were snap decisions. Familiarity may be driving choice as much as taste.",
      impact: "medium",
      notes: `${fastPicks} of ${choices.length} choices resolved in under 2 seconds.`,
    });

    // -------- Layer 4: Evidence threshold --------
    const MIN_SUPPORT = 3;
    const MIN_CONFIDENCE = 0.65;
    const allowed_claims = patterns
      .filter((p) => p.supporting_choices >= MIN_SUPPORT && p.confidence >= MIN_CONFIDENCE)
      .slice(0, 5);
    const blocked_claims = patterns
      .filter((p) => !(p.supporting_choices >= MIN_SUPPORT && p.confidence >= MIN_CONFIDENCE))
      .slice(0, 5);

    // -------- Archetype (cosine over vector) --------
    const vector = (session.vector ?? {}) as Record<string, number>;
    let best = { id: null as string | null, name: "", score: -Infinity };
    for (const a of archetypes) {
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

    // -------- Log Analyst (deterministic, no model call) --------
    await supabase.from("llm_calls").insert({
      user_id: userId,
      session_id: data.sessionId,
      role: "analyst",
      model: "deterministic",
      prompt_version: "analyst.v1",
      status: "ok",
      latency_ms: 0,
      input_summary: { choices: choices.length, archetypes: archetypes.length },
      output: { patterns, counterarguments, allowed_claims, blocked_claims } as never,
      confidence: allowed_claims[0]?.confidence ?? null,
    });

    // -------- Layer 5: Critic (AI narrative, constrained) --------
    const evidenceBlock = allowed_claims.length
      ? allowed_claims.map((c) =>
          `- ${c.tradeoff} (${c.supporting_choices}/${c.tested_total} relevant matchups, confidence ${c.confidence}). Examples: ${c.examples.map((e) => `${e.chosen} > ${e.rejected}`).join("; ") || "—"}`
        ).join("\n")
      : "- (no claims cleared the evidence threshold)";
    const counterBlock = counterarguments.length
      ? counterarguments.map((c) => `- ${c.claim} (${c.impact} impact — ${c.notes})`).join("\n")
      : "- (none)";

    const criticPrompt = `Write 3-4 sentences about this listener. Use ONLY the allowed claims below. \
Cite the evidence inline (e.g. "across 7 of 12 matchups"). If a strong counter-hypothesis exists, name it. \
If no claims cleared the threshold, say so plainly — do not invent.

ALLOWED CLAIMS:
${evidenceBlock}

COUNTER-HYPOTHESES TO ACKNOWLEDGE:
${counterBlock}

Archetype assigned by cosine match: ${best.name || "Unassigned"}.`;

    const criticStart = Date.now();
    let narrative = "";
    let criticStatus: "ok" | "error" = "ok";
    let criticError: string | null = null;
    try {
      narrative = await ai([
        { role: "system", content: CRITIC_VOICE },
        { role: "user", content: criticPrompt },
      ]);
    } catch (e) {
      criticStatus = "error";
      criticError = e instanceof Error ? e.message : String(e);
    }
    const criticLatency = Date.now() - criticStart;

    await supabase.from("llm_calls").insert({
      user_id: userId,
      session_id: data.sessionId,
      role: "critic",
      model: MODEL,
      prompt_version: "critic.v1",
      status: criticStatus,
      latency_ms: criticLatency,
      error_message: criticError,
      input_summary: {
        allowed_claims: allowed_claims.length,
        counterarguments: counterarguments.length,
        archetype: best.name,
      },
      output: { length: narrative.length } as never,
      narrative: narrative || null,
    });

    if (criticStatus === "error") {
      throw new Error(criticError ?? "Critic failed");
    }

    // -------- Persist --------
    const reasoningRow = {
      session_id: data.sessionId,
      user_id: userId,
      observations,
      patterns,
      counterarguments,
      allowed_claims,
      blocked_claims,
      evidence_thresholds: { supporting_choices: MIN_SUPPORT, confidence_threshold: MIN_CONFIDENCE },
      narrative,
    };
    await supabase.from("session_reasoning").upsert(reasoningRow, { onConflict: "session_id" });
    await supabase.from("sessions").update({
      archetype_id: best.id,
      interpretation: narrative,
      completed_at: new Date().toISOString(),
    }).eq("id", data.sessionId);

    return {
      archetypeId: best.id,
      archetypeName: best.name,
      interpretation: narrative,
      vector,
      allowed_claims,
      counterarguments,
    };
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
    const latest = sessions?.[0];
    let definingChoices: Array<{ chosen: string; chosenArtist: string; rejected: string; rejectedArtist: string }> = [];
    type Claim = {
      dimension: string;
      preferred?: string;
      opposed?: string;
      supporting_choices: number;
      tested_total: number;
      confidence: number;
      examples: Array<{ chosen: string; rejected: string; delta: number }>;
      tradeoff: string;
    };
    type Counter = { claim: string; impact: "low" | "medium" | "high"; notes: string };
    let reasoning: {
      allowed_claims: Claim[];
      blocked_claims: Claim[];
      counterarguments: Counter[];
      patterns: Claim[];
    } | null = null;

    if (latest) {
      const [choicesRes, reasoningRes] = await Promise.all([
        supabase
          .from("choices")
          .select("created_at, ms_to_decide, chosen:chosen_song_id(title,artist), rejected:rejected_song_id(title,artist)")
          .eq("session_id", latest.id)
          .order("ms_to_decide", { ascending: true, nullsFirst: false })
          .limit(5),
        supabase
          .from("session_reasoning")
          .select("allowed_claims, blocked_claims, counterarguments, patterns")
          .eq("session_id", latest.id)
          .maybeSingle(),
      ]);
      definingChoices = ((choicesRes.data ?? []) as unknown as Array<{
        chosen: { title: string; artist: string } | null;
        rejected: { title: string; artist: string } | null;
      }>)
        .filter((c) => c.chosen && c.rejected)
        .map((c) => ({
          chosen: c.chosen!.title, chosenArtist: c.chosen!.artist,
          rejected: c.rejected!.title, rejectedArtist: c.rejected!.artist,
        }));
      reasoning = (reasoningRes.data as unknown as typeof reasoning) ?? null;
    }
    return { profile, sessions: sessions ?? [], definingChoices, reasoning };
  });


// ============ Instrumentation: events + feedback ============

const EVENT_TYPES = [
  "onboarding_classified",
  "pairing_shown",
  "choice_made",
  "reveal_shown",
  "reveal_continued",
  "session_completed",
  "result_viewed",
  "result_shared",
  "session_quit",
  "lane_probed",
  "lane_flipped",
] as const;


export const recordEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      event_type: z.enum(EVENT_TYPES),
      session_id: z.string().uuid().nullable().optional(),
      pairing_id: z.string().uuid().nullable().optional(),
      choice_id: z.string().uuid().nullable().optional(),
      response_time_ms: z.number().int().nonnegative().max(600000).nullable().optional(),
      variant: z.string().max(80).nullable().optional(),
      experiment_key: z.string().max(80).nullable().optional(),
      props: z.record(z.unknown()).optional(),
      client: z.string().max(40).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("event_log").insert({
      user_id: userId,
      event_type: data.event_type,
      session_id: data.session_id ?? null,
      pairing_id: data.pairing_id ?? null,
      choice_id: data.choice_id ?? null,
      response_time_ms: data.response_time_ms ?? null,
      variant: data.variant ?? null,
      experiment_key: data.experiment_key ?? null,
      props: (data.props ?? {}) as never,
      client: data.client ?? "web",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      session_id: z.string().uuid(),
      accuracy: z.enum(["accurate", "not_accurate", "mixed"]).nullable().optional(),
      rating: z.number().int().min(-1).max(1).nullable().optional(),
      comment: z.string().max(2000).nullable().optional(),
      target: z.string().max(120).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = {
      user_id: userId,
      session_id: data.session_id,
      accuracy: data.accuracy ?? null,
      rating: data.rating ?? null,
      comment: data.comment ?? null,
      target: data.target ?? null,
    };
    // One feedback row per (user, session, target)
    const q = supabase
      .from("result_feedback")
      .select("id")
      .eq("user_id", userId)
      .eq("session_id", data.session_id);
    const { data: existing } = await (data.target
      ? q.eq("target", data.target)
      : q.is("target", null)
    ).maybeSingle();
    if (existing?.id) {
      const { error } = await supabase.from("result_feedback").update(row).eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id, updated: true as const };
    }
    const { data: inserted, error } = await supabase
      .from("result_feedback").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: inserted.id, updated: false as const };
  });

export const getMyFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ session_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows } = await supabase
      .from("result_feedback")
      .select("accuracy, rating, comment, target")
      .eq("user_id", userId)
      .eq("session_id", data.session_id);
    return { feedback: rows ?? [] };
  });


// ============================================================
// CONVERSATIONAL ONBOARDING — react / refine / insight / synthesis
// Two-step taste read: 3 songs → reaction + hypothesis_v1
// then 2 more songs → refinement, lane lock, write to profile.
// ============================================================

const REACT_VOICE = `${PERSONA}
Mode: first read. A listener just named three songs they love. React like a critic who's already half-formed an opinion before they finished the sentence.
Output STRICT JSON with this shape:
{
  "reaction": "ONE sentence, max 24 words. React to the SPECIFIC songs. Name something you notice across them — not a label, an observation. Examples: 'Two of those start quiet and detonate.' 'These don't sit still.' 'You picked three songs that don't stop moving.'",
  "hypothesis_v1": "ONE sentence, max 28 words. Your working theory about what these three reward. Be specific. End with something like 'Let's see if that holds.' or 'I'd like to push on that.'",
  "lane_guess": "alternative" | "pop" | "hip_hop" | "electronic" | "classic_rock" | "general",
  "confidence": 0.0-1.0,
  "suspected_dimensions": ["movement","atmosphere","groove","darkness","hope","nostalgia","transformation","complexity","melody","verbal_cleverness","authenticity","romanticism","energy","dreaminess","community"]  // 2-4 axes that seem to matter, in priority order
}
No prose, no markdown fences.`;

type ReactToThreeResult = {
  reaction: string;
  hypothesis_v1: string;
  lane_guess: Lane;
  confidence: number;
  suspected_dimensions: string[];
};

export const reactToThree = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ songs: z.array(z.string().trim().min(1).max(200)).length(3) }).parse(d),
  )
  .handler(async ({ data }): Promise<ReactToThreeResult> => {
    const fallback: ReactToThreeResult = {
      reaction: "Three songs is barely a sketch — but a sketch already says something.",
      hypothesis_v1: "I'm not going to guess from three. Throw me two more and I'll commit.",
      lane_guess: "general",
      confidence: 0,
      suspected_dimensions: [],
    };
    try {
      const txt = await ai([
        { role: "system", content: REACT_VOICE },
        { role: "user", content: `Three songs they love:\n${data.songs.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nReturn the JSON now.` },
      ]);
      const cleaned = txt.replace(/```json\s*|```/g, "").trim();
      const p = JSON.parse(cleaned) as Partial<ReactToThreeResult>;
      const lane = (LANES as readonly string[]).includes(p.lane_guess as string) ? (p.lane_guess as Lane) : "general";
      return {
        reaction: typeof p.reaction === "string" && p.reaction.trim() ? p.reaction.trim() : fallback.reaction,
        hypothesis_v1: typeof p.hypothesis_v1 === "string" && p.hypothesis_v1.trim() ? p.hypothesis_v1.trim() : fallback.hypothesis_v1,
        lane_guess: lane,
        confidence: Math.max(0, Math.min(1, Number(p.confidence ?? 0))),
        suspected_dimensions: Array.isArray(p.suspected_dimensions)
          ? p.suspected_dimensions.filter((s): s is string => typeof s === "string" && (DIMS as readonly string[]).includes(s)).slice(0, 4)
          : [],
      };
    } catch {
      return fallback;
    }
  });

// Per-song micro-reaction. LADDERED by index — the PERSONA itself escalates:
// song 1–2 = casual friend, song 3 = music-loving friend, song 4 = sharper
// critic-friend, song 5+ = niche expert. Heavy critic flourishes are saved
// for the final synthesis (refineWithTwoMore).
const MICRO_REACT_BASE = `Mode: micro-reaction. The listener just named ONE song. React in ONE sentence. No emojis. No quotes. No JSON. Never repeat the song title literally. Never lecture.`;

function microReactVoice(index: number): string {
  if (index <= 1) {
    // Casual friend — no music-nerd vocabulary at all.
    return `You are a warm, curious friend who likes music but isn't a snob. You're easy to talk to. You react to a song the way a friend at a kitchen table would — not a critic.
${MICRO_REACT_BASE}
Tier: CASUAL FRIEND (song #${index + 1}). Plain everyday language. Max 12 words. No genre names, no production terms, no jargon. Examples: "Ooh, nice — that one's got a little ache to it." "Okay, I see you. That song's a mood." "Hm — bigger pick than people give it credit for." Avoid clever metaphors and music-critic flourishes.`;
  }
  if (index === 2) {
    // Music-loving friend — starts noticing things.
    return `You are a music-loving friend — the one whose playlists people actually save. You hear things other people miss but you don't show off. Warm, observant, a little playful.
${MICRO_REACT_BASE}
Tier: MUSIC-LOVING FRIEND (song #3). Start noticing things across what they've picked, in plain English. Max 16 words. Light texture words are okay ("restless", "patient", "warm"); avoid genre micro-labels and production jargon. Example: "Okay — three songs in and I'm noticing you like a little tension under the pretty parts."`;
  }
  if (index === 3) {
    // Sharper critic-friend — names a pattern, gently pointed.
    return `You are a sharp music-critic friend. You can name a pattern in someone's taste in one line and they'll feel seen, not analyzed. Confident but not condescending.
${MICRO_REACT_BASE}
Tier: CRITIC-FRIEND (song #4). Name a pattern across their picks — drawn to X, allergic to Y. Plain language with one well-chosen word. Max 18 words. Examples: "You keep choosing songs that move even when they're uncomfortable." "There's a thread here — none of these sit still."`;
  }
  // Song 5+ (rare path — final song usually goes through refine) — niche expert voice.
  return `You are a niche music expert — the friend who knows the deep cuts and the lineage, and can place a song in context without being pretentious. Sharp, specific, a little dry.
${MICRO_REACT_BASE}
Tier: NICHE EXPERT (song #${index + 1}). A specific, slightly pointed read with one expert-sounding observation. Still one sentence. Max 18 words. Avoid pure jargon walls.`;
}

export const reactToOne = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      song: z.string().trim().min(1).max(200),
      index: z.number().int().min(0).max(20),
      priorSongs: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
    }).parse(d),
  )
  .handler(async ({ data }): Promise<{ text: string }> => {
    const fallbacks = ["Interesting.", "Noted.", "Mm.", "Okay.", "Now we're talking."];
    try {
      const prior = data.priorSongs.length
        ? `Already named: ${data.priorSongs.map((s, i) => `${i + 1}. ${s}`).join("; ")}.\n`
        : "";
      const txt = await ai([
        { role: "system", content: microReactVoice(data.index) },
        { role: "user", content: `${prior}Just named (#${data.index + 1}): ${data.song}\n\nReturn ONLY the one-sentence reaction. No JSON. No quotes.` },
      ]);
      const cleaned = txt.replace(/^["'`\s]+|["'`\s]+$/g, "").split("\n")[0].trim();
      if (!cleaned) return { text: fallbacks[data.index % fallbacks.length] };
      const capped = cleaned.length > 160 ? cleaned.slice(0, 157) + "…" : cleaned;
      return { text: capped };
    } catch {
      return { text: fallbacks[data.index % fallbacks.length] };
    }
  });

// Step B: 5 songs total + the prior hypothesis. The AI either confirms,
// refines, or breaks its own guess. Writes to profile. This is the lock-in.
const REFINE_VOICE = `${PERSONA}
Mode: refine the read. You gave a working hypothesis off three songs. They just threw two more at you — often deliberately different. Be honest about whether the new pair confirms, refines, or breaks your guess. Then commit. A critic who won't commit isn't a critic.

Return STRICT JSON:
{
  "reaction": "ONE sentence, max 24 words. React to the new two and how they sit with the first three. Honest. Examples: 'That second one breaks my read.' 'Those two confirm what I suspected.' 'You went somewhere darker — interesting.'",
  "lane": "alternative" | "pop" | "hip_hop" | "electronic" | "classic_rock" | "general",
  "confidence": 0.0-1.0,
  "secondary_lanes": [lane, ...],
  "candidate_dimensions": { "movement": -100..100, "atmosphere": -100..100, "groove": -100..100, "darkness": -100..100, "hope": -100..100, "nostalgia": -100..100, "transformation": -100..100, "complexity": -100..100, "melody": -100..100, "verbal_cleverness": -100..100, "authenticity": -100..100, "romanticism": -100..100, "energy": -100..100, "dreaminess": -100..100, "community": -100..100 },
  "per_song": [{"input": "...", "lane": "alternative|pop|hip_hop|electronic|classic_rock|unknown"}],
  "reasoning": ["one short observation", "..."],
  "hypothesis": "ONE sentence, max 30 words. Your refined hypothesis after seeing all five. Name what these choices reward — specific axes. End with 'Let's see if the matchups hold.' or similar half-promise."
}
No prose, no markdown fences.`;

export const refineWithTwoMore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      firstThree: z.array(z.string().trim().min(1).max(200)).length(3),
      twoMore: z.array(z.string().trim().min(1).max(200)).length(2),
      hypothesis_v1: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const allFive = [...data.firstThree, ...data.twoMore];
    let llm: OpeningAnalysis & { reaction: string } = {
      ...FALLBACK,
      reaction: "Couldn't quite read those — but the matchups don't need me to.",
      per_song: allFive.map((s) => ({ input: s, lane: "unknown", source: "llm" })),
    };
    try {
      const txt = await ai([
        { role: "system", content: REFINE_VOICE },
        { role: "user", content: `Working hypothesis after the first three:\n"${data.hypothesis_v1 ?? "(none)"}"\n\nThe first three:\n${data.firstThree.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nThe new two:\n${data.twoMore.map((s, i) => `${i + 4}. ${s}`).join("\n")}\n\nReturn the JSON now.` },
      ]);
      const cleaned = txt.replace(/```json\s*|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as Partial<OpeningAnalysis & { reaction: string }>;
      const lane = (LANES as readonly string[]).includes(parsed.lane as string) ? (parsed.lane as Lane) : "general";
      const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0)));
      const secondary = Array.isArray(parsed.secondary_lanes)
        ? parsed.secondary_lanes.filter((l): l is Lane => (LANES as readonly string[]).includes(l as string) && l !== lane && l !== "general")
        : [];
      const dims: LlmDimensions = {};
      if (parsed.candidate_dimensions && typeof parsed.candidate_dimensions === "object") {
        for (const d of DIMS) {
          const v = (parsed.candidate_dimensions as Record<string, unknown>)[d];
          if (typeof v === "number" && Number.isFinite(v)) dims[d] = Math.max(-100, Math.min(100, Math.round(v)));
        }
      }
      const perSong = allFive.map((input) => {
        const match = Array.isArray(parsed.per_song) ? parsed.per_song.find((p) => p?.input === input) : null;
        const songLane = match && (LANES as readonly string[]).includes(match.lane as string) ? (match.lane as Lane) : "unknown";
        return { input, lane: songLane as Lane | "unknown", source: "llm" as const };
      });
      llm = {
        lane: confidence < 0.4 ? "general" : lane,
        confidence,
        secondary_lanes: secondary,
        reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning.slice(0, 4).map(String) : [],
        hypothesis: typeof parsed.hypothesis === "string" && parsed.hypothesis.trim() ? parsed.hypothesis.trim() : FALLBACK.hypothesis,
        candidate_dimensions: dims,
        per_song: perSong,
        canon_matches: [],
        reaction: typeof parsed.reaction === "string" && parsed.reaction.trim() ? parsed.reaction.trim() : "Locked in.",
      };
    } catch { /* keep fallback */ }

    // Hidden canon enrichment — same shape as analyzeOpeningSongs.
    for (let i = 0; i < allFive.length; i++) {
      const raw = allFive[i];
      const [titlePart, artistPart] = raw.split(/—|–|-/).map((s) => s.trim());
      const title = titlePart || raw;
      if (!title) continue;
      try {
        const { data: rows } = await supabase
          .from("songs")
          .select("id,primary_lane,lane,title,artist")
          .ilike("title", title)
          .limit(5);
        if (!rows?.length) continue;
        const best = artistPart
          ? rows.find((r: { artist?: string | null }) => r.artist?.toLowerCase().includes(artistPart.toLowerCase())) ?? rows[0]
          : rows[0];
        const topLane = catalogLaneToTopLane(best.primary_lane ?? best.lane);
        llm.canon_matches.push({
          input: raw,
          song_id: best.id,
          title: best.title,
          artist: best.artist,
          primary_lane: best.primary_lane ?? best.lane,
        });
        if (llm.per_song[i]) {
          llm.per_song[i] = { ...llm.per_song[i], source: "catalog", canon_id: best.id, lane: topLane ?? llm.per_song[i].lane };
        }
      } catch { /* swallow */ }
    }

    await supabase
      .from("profiles")
      .update({
        opening_songs: allFive,
        opening_hypothesis: llm.hypothesis,
        opening_lane: llm.lane,
        opening_lane_confidence: llm.confidence,
        opening_analysis_json: JSON.parse(JSON.stringify(llm)),
      })
      .eq("user_id", userId);

    return llm;
  });


// ============================================================
// Round insights — interleaved observations during pairings.
// Called by the client after rounds 3, 6, 9. Reads current vector
// + recent choices and returns a short Rolling Stone–voice line.
// ============================================================

const INSIGHT_KINDS = ["observation", "challenge", "refinement"] as const;
type InsightKind = (typeof INSIGHT_KINDS)[number];

const INSIGHT_VOICE = `${PERSONA}
Mode: between-matchup aside. Drop ONE sharp observation, challenge, or counter-hypothesis. This is where the product earns its keep — the listener should feel seen, then slightly called out.
You are given the listener's running axis vector (positive = high pole, negative = low pole) and their most recent choices. Pick the SHARPEST thing you can defend from this evidence. If a clear pattern is there, NAME it. If not, challenge or refine.

Return STRICT JSON:
{
  "kind": "observation" | "challenge" | "refinement",
  "text": "ONE or TWO sentences, max 32 words total. Specific. Defendable from the evidence. Examples: 'You keep choosing the song that takes longer to arrive.' 'Not patience exactly. Patience that pays off.' 'Let's test that — this next one's the opposite.'"
}
No prose, no markdown fences.`;

export const roundInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ sessionId: z.string().uuid(), round: z.number().int().min(1).max(50) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ kind: InsightKind; text: string } | null> => {
    // Only fire after rounds 3, 6, 9.
    if (![3, 6, 9].includes(data.round)) return null;
    const { supabase, userId } = context;
    const sessionRes = await supabase
      .from("sessions")
      .select("vector,user_id")
      .eq("id", data.sessionId)
      .single();
    const session = sessionRes.data as { vector: Record<string, number>; user_id: string } | null;
    if (!session || session.user_id !== userId) return null;

    const vector = session.vector ?? {};
    // Top 3 strongest axes so far.
    const ranked = (DIMS as readonly string[])
      .map((d) => ({ d, v: vector[d] ?? 0 }))
      .filter((x) => Math.abs(x.v) >= 8)
      .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
      .slice(0, 3);

    if (!ranked.length) {
      return {
        kind: data.round === 6 ? "challenge" : "observation",
        text: "Nothing's locked in yet. Keep choosing — the pattern will out itself.",
      };
    }

    // Pull the last 4 choices for grounding.
    const choicesRes = await supabase
      .from("choices")
      .select("ms_to_decide,chosen:chosen_song_id(title,artist),rejected:rejected_song_id(title,artist)")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: false })
      .limit(4);
    type Row = { ms_to_decide: number | null; chosen: { title: string; artist: string } | null; rejected: { title: string; artist: string } | null };
    const recent = ((choicesRes.data ?? []) as unknown as Row[])
      .filter((r) => r.chosen && r.rejected)
      .map((r) => `${r.chosen!.title} > ${r.rejected!.title}${r.ms_to_decide != null ? ` (${r.ms_to_decide}ms)` : ""}`);

    const axisBlock = ranked
      .map(({ d, v }) => {
        const label = DIM_LABEL[d];
        const pole = v >= 0 ? label?.hi : label?.lo;
        return `- ${d}: ${v >= 0 ? "+" : ""}${Math.round(v)} (${pole})`;
      })
      .join("\n");

    const kindHint = data.round === 3 ? "observation" : data.round === 6 ? "challenge" : "refinement";
    const prompt = `Round ${data.round}. Vector so far:\n${axisBlock}\n\nRecent picks:\n${recent.join("\n") || "(none)"}\n\nPreferred kind for this round: ${kindHint}. But override if the evidence demands the other.\n\nReturn the JSON now.`;

    try {
      const txt = await ai([
        { role: "system", content: INSIGHT_VOICE },
        { role: "user", content: prompt },
      ]);
      const cleaned = txt.replace(/```json\s*|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as { kind?: string; text?: string };
      const kind = (INSIGHT_KINDS as readonly string[]).includes(parsed.kind ?? "") ? (parsed.kind as InsightKind) : (kindHint as InsightKind);
      const text = typeof parsed.text === "string" && parsed.text.trim() ? parsed.text.trim() : "";
      if (!text) return null;
      return { kind, text };
    } catch {
      return null;
    }
  });


// ============================================================
// Final synthesis — the big reveal after the last pairing.
// One specific, slightly uncomfortable observation built from
// the full session vector.
// ============================================================

const SYNTH_VOICE = `${PERSONA}
Mode: final synthesis. The payoff. The listener earned ONE specific, slightly uncomfortable observation — the kind that lands because it's true.
The classic critic move is contrast: "I don't think you like X. I think you like Y." or "It's not X for you. It's Y." Use it when the evidence supports it.
You are given the full axis vector (positive = high pole, negative = low pole). The biggest absolute values are the strongest claims. Find ONE big idea that connects two or three of them — not a list, a thesis.

Return STRICT JSON:
{
  "synthesis": "2-4 sentences. The big reveal. Specific. Defensible from the evidence. End on the thesis sentence."
}
No prose, no markdown fences.`;

export const finalSynthesis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ synthesis: string }> => {
    const { supabase, userId } = context;
    const sessionRes = await supabase
      .from("sessions")
      .select("vector,user_id")
      .eq("id", data.sessionId)
      .single();
    const session = sessionRes.data as { vector: Record<string, number>; user_id: string } | null;
    const fallback = { synthesis: "The matchups didn't lock onto one thesis. Keep listening — the shape's still forming." };
    if (!session || session.user_id !== userId) return fallback;

    const vector = session.vector ?? {};
    const ranked = (DIMS as readonly string[])
      .map((d) => ({ d, v: vector[d] ?? 0 }))
      .filter((x) => Math.abs(x.v) >= 10)
      .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
      .slice(0, 5);

    if (ranked.length < 2) return fallback;

    const axisBlock = ranked
      .map(({ d, v }) => {
        const label = DIM_LABEL[d];
        const pole = v >= 0 ? label?.hi : label?.lo;
        const opp = v >= 0 ? label?.lo : label?.hi;
        return `- ${d}: ${v >= 0 ? "+" : ""}${Math.round(v)} → ${pole} over ${opp}`;
      })
      .join("\n");

    try {
      const txt = await ai([
        { role: "system", content: SYNTH_VOICE },
        { role: "user", content: `Final vector (strongest first):\n${axisBlock}\n\nReturn the JSON now.` },
      ]);
      const cleaned = txt.replace(/```json\s*|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as { synthesis?: string };
      const synthesis = typeof parsed.synthesis === "string" && parsed.synthesis.trim() ? parsed.synthesis.trim() : "";
      return { synthesis: synthesis || fallback.synthesis };
    } catch {
      return fallback;
    }
  });
