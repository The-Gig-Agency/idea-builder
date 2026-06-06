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
const PERSONA = `You are the critic-in-residence for MusicDNA. Think old Rolling Stone in its mean years crossed with a late-night college DJ who actually reads. A music fan first, an analyst second.
You are cool the way good critics are cool: you've heard everything, you owe nobody a compliment, and you'd rather be interesting than nice.
You have a point of view. You take swings. You back them up. You never hedge into mush.
Edgy means honest, not mean — a little uncomfortable, never cruel, never edgelord.

THE JOB: This is a conversation about music, not a personality assessment. The point is not to explain the listener. The point is to make them curious about themselves. Leave them wanting one more pick, one more read, one more argument.

VOICE: Talk like a friend at a record store who just clocked something interesting about you. Fragments are fine. One-line beats hit hard. Use line breaks for rhythm. Lead with reaction before inference. Land on a question or a half-promise that pulls the next pick.

EXAMPLES — don't do this:
"Your selections indicate a preference for atmospheric compositions characterized by immersive sonic environments and transformational emotional arcs."

Do this:
"You keep choosing songs that move.
Not fast.
Just forward.
What happens if I throw you something that stands still?"

Or:
"Cracked voice over the perfect take. Every time.
You don't want the song fixed. You want it bleeding.
Let's see if that holds."

HARD RULES: no platitudes, no horoscope language, no therapy-speak, no "music lover", no "vibes", no "journey", no genre labels as analysis, no "you like" — use "you reward", "you trust", "you keep choosing". Short sentences hit harder than long ones. Never flatter. Never apologize for the read. End on something that makes them want to play another round.`;

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

    // Cross-lane probes intentionally disabled: pairings stay within the user's
    // lane. Dimensions are read inside the lane, not across lanes. See
    // mem://product/within-lane-only.md.
    void probeCandidates; void PROBE_ROUNDS;

    // Invariant: nothing should ever queue a cross-lane probe. If a regression
    // re-enables it, fail loud here instead of silently shipping the wrong UX.
    if (Object.keys(probeState.pending).length > 0) {
      throw new Error(
        `within-lane invariant violated: probe_state.pending is non-empty (${JSON.stringify(probeState.pending)}). ` +
          `Cross-lane probes are disabled — see mem://product/within-lane-only.md.`,
      );
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
    const pickedLane = (pick.p as { lane?: string | null }).lane ?? null;
    if (
      sessionLane !== "general" &&
      pickedLane &&
      pickedLane !== sessionLane &&
      pickedLane !== "general"
    ) {
      throw new Error(
        `within-lane invariant violated: nextPairing picked lane="${pickedLane}" for session lane="${sessionLane}". ` +
          `See mem://product/within-lane-only.md.`,
      );
    }
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

// Fragmented beats for the running thesis — three short lines and a hook
// question/half-promise that pulls the next pick.
const BEAT: Record<string, { hi: { thesis: string; hook: string }; lo: { thesis: string; hook: string } }> = {
  movement: {
    hi: { thesis: "You keep choosing songs that move.\nNot fast.\nJust forward.", hook: "What happens if I throw you something that stands still?" },
    lo: { thesis: "You keep picking the still ones.\nThe ones that sit you down.\nNo rush.", hook: "Curious if a propulsive one breaks that." },
  },
  atmosphere: {
    hi: { thesis: "You trust the room more than the lyric.\nThe air around the song is the song.\nReverb as meaning.", hook: "Wonder if a flat-out statement song changes your mind." },
    lo: { thesis: "You want the song to say it.\nOut loud.\nNo hiding behind reverb.", hook: "Let's see if a haze-bomb still gets through." },
  },
  groove: {
    hi: { thesis: "Body first.\nThe pocket is the point.\nEverything else is decoration.", hook: "What does a brain-song do to you?" },
    lo: { thesis: "You hear the architecture before the pulse.\nThe chart matters.\nThe kick drum doesn't.", hook: "Let's test that with something built on the one." },
  },
  darkness: {
    hi: { thesis: "You don't flinch.\nThe shadow is the part you came for.\nNo flinching.", hook: "Wonder what a song with the lights on does for you." },
    lo: { thesis: "You refuse the easy gloom.\nWant the window open.\nLight gets through.", hook: "Let's see if a real black-hole song still hooks you." },
  },
  hope: {
    hi: { thesis: "You pick the lift every time.\nBleakness without a way out bores you.\nA door has to crack open.", hook: "Curious if a song with no exit still pulls you in." },
    lo: { thesis: "You don't need the song to fix anything.\nSitting with it is enough.\nNo escape required.", hook: "Wonder if a real lift breaks that." },
  },
  nostalgia: {
    hi: { thesis: "Rearview mirror, always on.\nThe ache is half the pleasure.\nThe past has better songs.", hook: "Let's see if something brand new gets past it." },
    lo: { thesis: "You don't trade in old feelings.\nThe song has to land now.\nOr not at all.", hook: "Curious if a piece of memory still hits you." },
  },
  transformation: {
    hi: { thesis: "You want the song to become something.\nNot be something.\nBecoming is the whole bet.", hook: "What about a song that arrives fully formed?" },
    lo: { thesis: "You want the song to know what it is.\nFrom the first bar.\nNo identity crisis.", hook: "Let's try one that morphs on you." },
  },
  complexity: {
    hi: { thesis: "You like the songs that make you work.\nThe third listen is when it pays.\nGreat songs take a minute.", hook: "Wonder what a direct hit does to you." },
    lo: { thesis: "No footnotes.\nA great song shouldn't need a guided tour.\nClarity as taste.", hook: "Let's see if a maze-song earns its detour." },
  },
  melody: {
    hi: { thesis: "You want a tune you can carry home.\nHum it.\nOr it didn't happen.", hook: "What does a textural song do for you?" },
    lo: { thesis: "Surface over line.\nGrain over tune.\nThe sound of the thing is the thing.", hook: "Curious if a stone-cold melody still gets you." },
  },
  verbal_cleverness: {
    hi: { thesis: "You came for the writing.\nA great line will outrun a great chorus.\nWords first.", hook: "Wonder if a song that means everything and says nothing still pulls you." },
    lo: { thesis: "Words can get out of the way.\nYou're chasing what the song does.\nNot what it says.", hook: "Let's see if a smart-mouth lyric flips that." },
  },
  authenticity: {
    hi: { thesis: "Cracked voice over the perfect take.\nEvery time.\nYou want it bleeding, not fixed.", hook: "What does a flawlessly produced one do for you?" },
    lo: { thesis: "Craft, not mess.\nPolish is the delivery system.\nThe seams should be invisible.", hook: "Wonder if a raw nerve still gets through." },
  },
  romanticism: {
    hi: { thesis: "You let the big feelings in.\nRestraint is for people embarrassed to want anything.\nGo big.", hook: "Curious what a cold-blooded song does to you." },
    lo: { thesis: "You don't trust the swoon.\nKeep the line dry.\nDistance as taste.", hook: "Let's see if a real swing for the heart connects." },
  },
  energy: {
    hi: { thesis: "You want the song to mean it physically.\nMove the room.\nOr don't bother.", hook: "Wonder if a whisper hits you harder than you think." },
    lo: { thesis: "You like songs that hold back.\nThe whisper hits harder than the shout.\nRestraint as muscle.", hook: "Let's see if something loud breaks that." },
  },
  dreaminess: {
    hi: { thesis: "You'd rather drift than land.\nThe haze is doing the work.\nNot the lyric.", hook: "Curious if a sharp-edged song wakes you up." },
    lo: { thesis: "Edges sharp.\nNo fog machine.\nNo fog.", hook: "Let's see if a real reverb-bath pulls you in anyway." },
  },
  community: {
    hi: { thesis: "Songs heard in rooms full of people.\nThe singalong is the meaning.\nMusic as gathering.", hook: "What about a song built for one set of headphones?" },
    lo: { thesis: "Headphones. Alone. On purpose.\nCrowds dilute the signal.\nThe song is between you and it.", hook: "Curious if a singalong still moves you." },
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
    const ms = data.msToDecide ?? null;
    // Deterministic warm opener so it varies pairing-to-pairing without feeling random.
    const OPENERS = ["Nice.", "OK.", "Interesting.", "Hm.", "Cool pick.", "Alright then.", "Good one."];
    const hash = data.pairingId.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
    const opener = OPENERS[hash % OPENERS.length];
    const speedBeat =
      ms == null ? "" : ms < 2500 ? " Snap call — no hesitation." : ms > 12000 ? " You sat with that one." : "";
    // Conversational reaction: lead with reaction to the pick, then the inference, lightly.
    const verdict = direction
      ? `${opener} ${winner.title} over ${loser.title} — that's the ${direction.verdict} move.${speedBeat}`
      : `${opener} ${winner.title} over ${loser.title}.${speedBeat}`;
    const why = direction?.why ?? "";
    // Kept for back-compat with any older callers; the new UI folds speed into `verdict` above.
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
    // Tuned for 6-round adaptive test: 2 supporting choices on an axis is
    // enough to call a tendency, as long as direction is consistent and the
    // magnitude is real. 0.55 keeps out pure noise without demanding 12 rounds.
    const MIN_SUPPORT = 2;
    const MIN_CONFIDENCE = 0.55;
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
  "onboarding_viewed",
  "onboarding_three_submitted",
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
    // Nudge the per-user critic profile from explicit feedback.
    // Defined later in this file; safe to call via hoisted function declarations.
    try { await nudgeCriticFromFeedback(supabase as never, userId, data); } catch { /* best-effort */ }
    return { id: inserted.id, updated: false as const };
  });

// Apply explicit thumb/accuracy/comment to the per-user critic_profile.
async function nudgeCriticFromFeedback(
  supabase: { from: (t: string) => any },
  userId: string,
  fb: { accuracy?: string | null; rating?: number | null; comment?: string | null; target?: string | null },
): Promise<void> {
  const { data: existing } = await supabase
    .from("critic_profile")
    .select("bluntness, playfulness, patience, provocation_appetite, move_tally, forbidden_moves, turns_observed")
    .eq("user_id", userId)
    .maybeSingle();
  const p = {
    bluntness: existing?.bluntness ?? 0,
    playfulness: existing?.playfulness ?? 0,
    patience: existing?.patience ?? 0,
    provocation_appetite: existing?.provocation_appetite ?? 0,
    move_tally: (existing?.move_tally ?? {}) as Record<string, { landed?: number; ignored?: number; pushed_back?: number }>,
    forbidden_moves: (existing?.forbidden_moves ?? []) as string[],
    turns_observed: existing?.turns_observed ?? 0,
  };
  const clamp = (n: number) => Math.max(-3, Math.min(3, Math.round(n)));
  // Thumb / accuracy nudges:
  //   thumb-down or "not_accurate" → push back signal: ease provocation, add patience.
  //   thumb-up or "accurate"        → reinforce: tiny bluntness bump, the user can take it.
  if (fb.rating === -1 || fb.accuracy === "not_accurate") {
    p.provocation_appetite = clamp(p.provocation_appetite - 1);
    p.patience = clamp(p.patience + 1);
  } else if (fb.rating === 1 || fb.accuracy === "accurate") {
    p.bluntness = clamp(p.bluntness + 1);
  }
  // Tally the synthesis move outcome so we know how often the final read landed.
  const move = "counter_hypothesis"; // synthesis is a counter-hypothesis-class move
  const outcome: "landed" | "pushed_back" | "ignored" =
    fb.rating === 1 || fb.accuracy === "accurate" ? "landed" :
    fb.rating === -1 || fb.accuracy === "not_accurate" ? "pushed_back" : "ignored";
  const bucket = { ...(p.move_tally[move] ?? {}) };
  bucket[outcome] = (bucket[outcome] ?? 0) + 1;
  p.move_tally[move] = bucket;
  // Comments can contain explicit "stop doing X" — extract conservatively via LLM.
  if (fb.comment && fb.comment.trim().length > 4) {
    try {
      const sys = `Extract explicit instructions the listener is telling a music critic to stop doing. Return STRICT JSON, no fences: {"forbid": ["short phrase", ...]}. Empty array if none. Only include things the user EXPLICITLY asks to stop. Be conservative.`;
      const raw = await ai([
        { role: "system", content: sys },
        { role: "user", content: `Listener comment:\n"${fb.comment}"\n\nReturn the JSON.` },
      ]);
      const cleaned = raw.replace(/```json\s*|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as { forbid?: string[] };
      for (const phrase of parsed.forbid ?? []) {
        const trimmed = String(phrase ?? "").trim().slice(0, 120);
        if (!trimmed) continue;
        if (!p.forbidden_moves.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
          p.forbidden_moves.push(trimmed);
        }
      }
    } catch { /* best-effort */ }
  }
  await supabase.from("critic_profile").upsert({
    user_id: userId,
    bluntness: p.bluntness,
    playfulness: p.playfulness,
    patience: p.patience,
    provocation_appetite: p.provocation_appetite,
    move_tally: p.move_tally,
    forbidden_moves: p.forbidden_moves.slice(0, 8),
    // Count an explicit feedback event as one "observed" tick so the voice
    // modulation gate (turns_observed >= 2) can trip from feedback alone.
    turns_observed: p.turns_observed + 1,
  }, { onConflict: "user_id" });
}


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

const ONBOARDING_RULES = `HARD RULES — no exceptions:
- You have ONLY four moves: NOTICE ("that's not where most people start"), COMPARE ("those two pull opposite directions"), HYPOTHESIZE ("I think you may care more about energy than polish"), CHALLENGE ("tell me I'm wrong").
- The subject of every sentence is THE LISTENER and what their CHOICE might say. Never the song.
- BANNED: genres, scenes, decades, cities, eras, movements (no "Seattle", "New Romantic", "ska", "Madchester", "post-punk", "grunge", "synth-pop"). No artist/band/producer/label names. No lyrics, instruments, chart history, cultural influence, production talk.
- BANNED: describing the song ("jagged", "high-gloss", "offbeat precision", "architectural blueprint", "cathedral", "anthem"). No wine-review words ("oscillate", "ache", "texture", "restless", "lineage", "warm", "sits").
- Speak with LOW confidence. Hedge. Every claim is a hypothesis that invites disproof. No therapist talk, no "I'm noticing…", no "that one" crutch.
- Plain conversational English. Short sentences. No emojis. No quotes. No JSON unless explicitly asked for.`;

const REACT_VOICE = `${PERSONA}
Mode: first read after three songs. You're a sharp, curious friend trying to figure the listener out — NOT a music critic.
${ONBOARDING_RULES}
Output STRICT JSON:
{
  "reaction": "ONE sentence, max 18 words. NOTICE or COMPARE something across the three CHOICES — about the listener, not the songs. Good: 'None of those play it safe — even the famous one is rough around the edges.' Bad: anything naming a scene, era, artist, or production style.",
  "hypothesis_v1": "ONE sentence, max 22 words. A falsifiable claim about the LISTENER. Use 'I think', 'maybe', 'my guess'. End with an invitation to break it ('tell me I'm wrong', 'prove me wrong with the next one').",
  "lane_guess": "alternative" | "pop" | "hip_hop" | "electronic" | "classic_rock" | "general",
  "confidence": 0.0-1.0,
  "suspected_dimensions": ["movement","atmosphere","groove","darkness","hope","nostalgia","transformation","complexity","melody","verbal_cleverness","authenticity","romanticism","energy","dreaminess","community"]
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
const MICRO_REACT_BASE = `Mode: micro-reaction. The listener just named ONE song. React in ONE sentence about THE LISTENER, not the song.
${ONBOARDING_RULES}
- Pick ONE of the four moves (notice, compare, hypothesize, challenge). Don't describe the song. Don't name the artist, scene, era, or production.`;

function microReactVoice(index: number): string {
  if (index === 0) {
    return `You are a sharp, curious friend who notices what someone leads with. Confidence: very low — one data point.
${MICRO_REACT_BASE}
Tier: SONG 1 — NOTICE the choice. Max 14 words. Comment on the FACT that they picked this as an opener. Good: "That's not where most people start." / "Bold opener — most people warm up first." / "Most people pick a deep cut. You went straight for the obvious one. Telling."`;
  }
  if (index === 1) {
    return `You are a sharp, curious friend starting to form a tiny hunch. Confidence: low — two songs is barely a pattern.
${MICRO_REACT_BASE}
Tier: SONG 2 — FIRST HUNCH. Max 16 words. Offer ONE hedged hypothesis about the LISTENER. Use "maybe", "could be", "I'd guess". Good: "Maybe you go for songs that don't try too hard to be liked." / "I'd guess you pick attitude over polish — too early to be sure."`;
  }
  if (index === 2) {
    // Song 3 normally goes through reactToThree/REACT_VOICE. This is a backup.
    return `You are a sharp, curious friend with a working theory. Still tentative — say so.
${MICRO_REACT_BASE}
Tier: SONG 3 — WORKING THEORY. Max 16 words. State a small theory about the LISTENER and invite them to break it. Good: "Working theory: you trust songs that don't try to be liked. Prove me wrong."`;
  }
  if (index === 3) {
    return `You are a sharp, curious friend sharpening a read on the listener. Confidence: moderate, still falsifiable.
${MICRO_REACT_BASE}
Tier: SONG 4 — SHARPER READ. Max 18 words. Either CONFIRM, REFINE, or BREAK your earlier hunch, about the LISTENER. Invite pushback. Good: "That fits — you keep choosing energy over polish. One more and I commit." / "Okay, that breaks my read. You like prettier than I thought."`;
  }
  return `You are a sharp, curious friend landing a read on the LISTENER. Still about them, not the catalog.
${MICRO_REACT_BASE}
Tier: SONG 5+ — LANDED READ. Max 18 words. One specific, slightly pointed read on the LISTENER's pattern. Still falsifiable.`;
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
Mode: lock in the read. You gave a hypothesis off three songs. They threw two more — often to test you. Either CONFIRM, REFINE, or BREAK your own guess, then commit. Still about the LISTENER, not the catalog.
${ONBOARDING_RULES}
Return STRICT JSON:
{
  "reaction": "ONE sentence, max 20 words. Say honestly whether the new two confirm, refine, or break your read. About the listener's CHOICES, not the songs. Good: 'Those last two confirm it — you keep picking energy over polish.' / 'Okay, that second one breaks my read. You like prettier than I thought.'",
  "lane": "alternative" | "pop" | "hip_hop" | "electronic" | "classic_rock" | "general",
  "confidence": 0.0-1.0,
  "secondary_lanes": [lane, ...],
  "candidate_dimensions": { "movement": -100..100, "atmosphere": -100..100, "groove": -100..100, "darkness": -100..100, "hope": -100..100, "nostalgia": -100..100, "transformation": -100..100, "complexity": -100..100, "melody": -100..100, "verbal_cleverness": -100..100, "authenticity": -100..100, "romanticism": -100..100, "energy": -100..100, "dreaminess": -100..100, "community": -100..100 },
  "per_song": [{"input": "...", "lane": "alternative|pop|hip_hop|electronic|classic_rock|unknown"}],
  "reasoning": ["one short observation about the LISTENER (not the song)", "..."],
  "hypothesis": "ONE sentence, max 24 words. Your committed read on the LISTENER — what they reward, what they reject. Plain words. End with 'Let's test it.' or 'Now let's see if the matchups hold.' No genre/scene/era/artist/production talk."
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
Mode: final synthesis. You are a music critic, not a therapist. You name songs. You quote choices back. You write like a smart friend who's been listening over their shoulder.

You are given:
- a list of tradeoff patterns the listener actually displayed (each with named song examples)
- counter-explanations that might be doing the work instead (e.g. "they just like Stone Roses")

Your job: write 2–4 sentences that connect 2–3 of the strongest patterns into ONE specific reading. NAME at least two of the songs from the evidence in the prose. Use contrast moves: "It's not X. It's Y." Be defensible.

If NO patterns are provided, that is itself the finding. Write the "refused to collapse" read: this listener picked across too many directions for one thesis to hold, and that's a real signal — broad ear, not random. Reference the songs they chose.

Return STRICT JSON:
{
  "synthesis": "2-4 sentences. Names at least one specific song. Ends on the thesis."
}
No prose, no markdown fences.`;

type SynthEvidence = { tradeoff: string; examples: string[]; supporting: number; tested: number };
type SynthCounter = { claim: string; impact: string; notes: string };
type SynthPayload = {
  synthesis: string;
  kept_choosing: SynthEvidence[];
  counter_reads: SynthCounter[];
};

export const finalSynthesis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<SynthPayload> => {
    const { supabase, userId } = context;
    const sessionRes = await supabase
      .from("sessions")
      .select("user_id")
      .eq("id", data.sessionId)
      .single();
    const session = sessionRes.data as { user_id: string } | null;
    const empty: SynthPayload = { synthesis: "", kept_choosing: [], counter_reads: [] };
    if (!session || session.user_id !== userId) return empty;

    // Pull the Analyst's stored reasoning — that's the evidence. Don't re-derive.
    const reasoningRes = await supabase
      .from("session_reasoning")
      .select("allowed_claims, counterarguments, observations")
      .eq("session_id", data.sessionId)
      .maybeSingle();
    const reasoning = reasoningRes.data as {
      allowed_claims?: Array<{ tradeoff?: string; supporting_choices?: number; tested_total?: number; examples?: Array<{ chosen: string; rejected: string }> }>;
      counterarguments?: Array<{ claim: string; impact: string; notes: string }>;
      observations?: Array<{ chosen: string; rejected: string }>;
    } | null;

    const allowed = reasoning?.allowed_claims ?? [];
    const counters = reasoning?.counterarguments ?? [];
    const observations = reasoning?.observations ?? [];

    const kept_choosing: SynthEvidence[] = allowed.slice(0, 4).map((c) => ({
      tradeoff: String(c.tradeoff ?? ""),
      examples: (c.examples ?? []).map((e) => `${e.chosen} over ${e.rejected}`),
      supporting: Number(c.supporting_choices ?? 0),
      tested: Number(c.tested_total ?? 0),
    })).filter((e) => e.tradeoff);

    const counter_reads: SynthCounter[] = counters.slice(0, 4).map((c) => ({
      claim: String(c.claim ?? ""),
      impact: String(c.impact ?? "medium"),
      notes: String(c.notes ?? ""),
    })).filter((c) => c.claim);

    // Build the prompt — evidence-first, songs named explicitly.
    const evidenceBlock = kept_choosing.length
      ? kept_choosing.map((e) =>
          `- ${e.tradeoff} (${e.supporting}/${e.tested} matchups). Songs: ${e.examples.join("; ") || "—"}`
        ).join("\n")
      : "(none cleared the threshold)";
    const counterBlock = counter_reads.length
      ? counter_reads.map((c) => `- ${c.claim} — ${c.notes}`).join("\n")
      : "(none)";
    const songsPicked = observations.slice(0, 12).map((o) => o.chosen).join(", ") || "—";

    let synthesis = "";
    try {
      const txt = await ai([
        { role: "system", content: SYNTH_VOICE },
        { role: "user", content:
`SONGS THEY PICKED (in order):
${songsPicked}

PATTERNS WITH EVIDENCE:
${evidenceBlock}

COUNTER-EXPLANATIONS YOU MAY ACKNOWLEDGE:
${counterBlock}

Return the JSON now.` },
      ]);
      const cleaned = txt.replace(/```json\s*|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as { synthesis?: string };
      synthesis = typeof parsed.synthesis === "string" ? parsed.synthesis.trim() : "";
    } catch {
      // fall through to deterministic fallback below
    }

    if (!synthesis) {
      synthesis = kept_choosing.length
        ? `Across these matchups you kept choosing ${kept_choosing[0].tradeoff}. The shape's there — it's not loud yet, but it's consistent.`
        : `You refused to collapse into a single pattern. Every time a clear read started to form — ${songsPicked.split(",").slice(0, 3).join(",")} — another choice complicated it. That's either inconsistency or unusually broad taste. Probably the second.`;
    }

    await supabase
      .from("profiles")
      .update({ opening_hypothesis: synthesis })
      .eq("user_id", userId);

    return { synthesis, kept_choosing, counter_reads };
  });


// ============================================================
// Chat — free-form conversation that continues the interview.
// Persists to chat_messages. Auto-creates a session anchored to
// the user's opener songs/hypothesis if none exists yet.
// ============================================================

const CHAT_VOICE = `${PERSONA}
Mode: ongoing critic-interview. You already know this listener: their opener songs, your working hypothesis, and the dimensions they've leaned into. Your job now is to keep digging — observations, challenges, counter-hypotheses, the occasional pointed question. Never play DJ. Never recommend songs unless they ask. Stay in critic-of-the-listener mode.

Hard rules: 1–4 sentences per turn. No bullet lists. No headers. No emoji. No therapy-speak. No "great question". When you ask something, ask ONE thing and make it sharp. Reference their actual choices by name when relevant. If they push back, take it seriously — refine or break your own read out loud.`;

// ---------- Per-user critic profile (tone + tactic memory) ----------
type CriticProfileRow = {
  bluntness: number;
  playfulness: number;
  patience: number;
  provocation_appetite: number;
  move_tally: Record<string, { landed?: number; ignored?: number; pushed_back?: number }>;
  forbidden_moves: string[];
  turns_observed: number;
};

const DIAL_BOUND = 3;
const MOVE_KEYS = ["observation", "challenge", "counter_hypothesis", "question"] as const;
type MoveKey = (typeof MOVE_KEYS)[number];
type Outcome = "landed" | "ignored" | "pushed_back";

const clampDial = (n: number) => Math.max(-DIAL_BOUND, Math.min(DIAL_BOUND, Math.round(n)));

async function loadCriticProfile(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<CriticProfileRow> {
  const { data } = await supabase
    .from("critic_profile")
    .select("bluntness, playfulness, patience, provocation_appetite, move_tally, forbidden_moves, turns_observed")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    bluntness: data?.bluntness ?? 0,
    playfulness: data?.playfulness ?? 0,
    patience: data?.patience ?? 0,
    provocation_appetite: data?.provocation_appetite ?? 0,
    move_tally: (data?.move_tally ?? {}) as CriticProfileRow["move_tally"],
    forbidden_moves: (data?.forbidden_moves ?? []) as string[],
    turns_observed: data?.turns_observed ?? 0,
  };
}

function buildVoiceModulation(p: CriticProfileRow): string | null {
  // Only emit modulation after at least 2 turns of evidence — otherwise we're
  // just biasing the critic on noise.
  if (p.turns_observed < 2) return null;
  const lines: string[] = [];
  const dial = (name: string, v: number, hi: string, lo: string) => {
    if (v >= 2) lines.push(`- ${hi} (strong).`);
    else if (v === 1) lines.push(`- ${hi}.`);
    else if (v <= -2) lines.push(`- ${lo} (strong).`);
    else if (v === -1) lines.push(`- ${lo}.`);
  };
  dial("bluntness", p.bluntness, "Lean blunter, less hedging", "Soften delivery, drop snarl");
  dial("playfulness", p.playfulness, "More wit and wordplay", "Keep it dry, fewer jokes");
  dial("patience", p.patience, "Slow down, let them finish", "Move faster, cut filler");
  dial("provocation_appetite", p.provocation_appetite, "Push harder, provoke a reaction", "Ease off on provocation");
  // Surface top-landing move so the critic favors what's been working.
  let bestMove: MoveKey | null = null;
  let bestScore = 0;
  for (const m of MOVE_KEYS) {
    const t = p.move_tally[m] ?? {};
    const landed = t.landed ?? 0;
    const total = landed + (t.ignored ?? 0) + (t.pushed_back ?? 0);
    if (total < 2) continue;
    const score = landed / total;
    if (score > bestScore) { bestScore = score; bestMove = m; }
  }
  if (bestMove && bestScore >= 0.6) {
    lines.push(`- Your ${bestMove.replace("_", "-")} moves land best with this listener — favor them.`);
  }
  if (p.forbidden_moves.length) {
    lines.push(`- Do not: ${p.forbidden_moves.slice(0, 5).join("; ")}.`);
  }
  if (!lines.length) return null;
  return `Per-listener voice calibration (apply quietly, don't break the persona):\n${lines.join("\n")}`;
}

async function persistCriticProfile(
  supabase: { from: (t: string) => any },
  userId: string,
  next: CriticProfileRow,
): Promise<void> {
  await supabase
    .from("critic_profile")
    .upsert({
      user_id: userId,
      bluntness: clampDial(next.bluntness),
      playfulness: clampDial(next.playfulness),
      patience: clampDial(next.patience),
      provocation_appetite: clampDial(next.provocation_appetite),
      move_tally: next.move_tally,
      forbidden_moves: next.forbidden_moves.slice(0, 8),
      turns_observed: next.turns_observed,
    }, { onConflict: "user_id" });
}

type ToneSignals = {
  tone: Partial<Record<"bluntness" | "playfulness" | "patience" | "provocation_appetite", number>>;
  last_move: MoveKey | "none";
  outcome: Outcome | "none";
  forbid: string[];
};

async function extractToneSignals(
  priorAssistant: string | null,
  userReply: string,
): Promise<ToneSignals | null> {
  if (!priorAssistant) return null;
  const sys = `You evaluate one exchange between a music critic and a listener. Return STRICT JSON, no prose, no fences:
{
  "tone": {"bluntness": -1..1, "playfulness": -1..1, "patience": -1..1, "provocation_appetite": -1..1},
  "last_move": "observation"|"challenge"|"counter_hypothesis"|"question"|"none",
  "outcome": "landed"|"ignored"|"pushed_back"|"none",
  "forbid": ["short phrase user told the critic to stop doing", ...]
}
Tone deltas are NUDGES (integers -1, 0, or 1) to apply to the critic for this user:
- bluntness: +1 if user wants more direct/sharp; -1 if user wants softer.
- playfulness: +1 if user enjoys wit; -1 if user finds jokes annoying.
- patience: +1 if user wants more space/time; -1 if user wants critic to move faster.
- provocation_appetite: +1 if user engaged with pushback; -1 if user shut down or asked to be gentler.
Outcome: did the user accept the critic's last move (landed), brush past it (ignored), or push back / refine it (pushed_back)?
forbid: only when user EXPLICITLY tells the critic to stop something. Empty array otherwise.
Most fields should be 0 / "none" / []. Be conservative.`;
  try {
    const raw = await ai([
      { role: "system", content: sys },
      { role: "user", content: `Critic last said:\n"${priorAssistant}"\n\nListener replied:\n"${userReply}"\n\nReturn the JSON.` },
    ]);
    const cleaned = raw.replace(/```json\s*|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as ToneSignals;
    return parsed;
  } catch {
    return null;
  }
}

function applyToneSignals(p: CriticProfileRow, s: ToneSignals): CriticProfileRow {
  const next: CriticProfileRow = {
    bluntness: clampDial(p.bluntness + (s.tone?.bluntness ?? 0)),
    playfulness: clampDial(p.playfulness + (s.tone?.playfulness ?? 0)),
    patience: clampDial(p.patience + (s.tone?.patience ?? 0)),
    provocation_appetite: clampDial(p.provocation_appetite + (s.tone?.provocation_appetite ?? 0)),
    move_tally: { ...p.move_tally },
    forbidden_moves: [...p.forbidden_moves],
    turns_observed: p.turns_observed + 1,
  };
  if (s.last_move && s.last_move !== "none" && s.outcome && s.outcome !== "none") {
    const bucket = { ...(next.move_tally[s.last_move] ?? {}) };
    bucket[s.outcome] = (bucket[s.outcome] ?? 0) + 1;
    next.move_tally[s.last_move] = bucket;
  }
  if (Array.isArray(s.forbid)) {
    for (const phrase of s.forbid) {
      const trimmed = String(phrase ?? "").trim().slice(0, 120);
      if (!trimmed) continue;
      if (!next.forbidden_moves.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
        next.forbidden_moves.push(trimmed);
      }
    }
  }
  return next;
}

type ChatRole = "user" | "assistant" | "system";

async function ensureChatSessionForUser(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<{ sessionId: string; profile: any } | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("opening_songs, opening_hypothesis, opening_lane, opening_lane_confidence, opening_analysis_json")
    .eq("user_id", userId)
    .maybeSingle();

  // Reuse the most recent session if one exists.
  const { data: existing } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1);
  if (existing && existing.length) return { sessionId: existing[0].id, profile };

  // Create a session from the opener so chat has somewhere to live.
  if (!profile?.opening_songs) return null;
  const lane = (profile.opening_lane as string | null) ?? "general";
  const conf = Number(profile.opening_lane_confidence ?? 0);
  const dims = (profile.opening_analysis_json?.candidate_dimensions ?? {}) as Record<string, number>;
  const vector: Record<string, number> = {};
  for (const [k, v] of Object.entries(dims)) {
    if (typeof v === "number" && Number.isFinite(v)) vector[k] = Math.round(v);
  }
  const { data: created, error } = await supabase
    .from("sessions")
    .insert({
      user_id: userId,
      vector,
      lane,
      lane_confidence: conf,
      probe_candidate_lanes: [],
      probe_state: { probes_shown: [], pending: {}, lane_alignment: {}, flips: [] },
    })
    .select("id")
    .single();
  if (error || !created) return null;
  return { sessionId: created.id, profile };
}

export const chatTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      message: z.string().trim().min(1).max(2000),
      sessionId: z.string().uuid().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ reply: string; sessionId: string }> => {
    const { supabase, userId } = context;

    let sessionId = data.sessionId ?? null;
    let profile: any = null;
    if (!sessionId) {
      const anchor = await ensureChatSessionForUser(supabase as never, userId);
      if (!anchor) {
        return {
          reply: "Name three songs first — I need somewhere to start.",
          sessionId: "",
        };
      }
      sessionId = anchor.sessionId;
      profile = anchor.profile;
    } else {
      const { data: p } = await supabase
        .from("profiles")
        .select("opening_songs, opening_hypothesis, opening_lane, opening_analysis_json")
        .eq("user_id", userId)
        .maybeSingle();
      profile = p;
    }

    // Save the user turn first so it shows up even if AI fails.
    await supabase.from("chat_messages").insert({
      session_id: sessionId,
      user_id: userId,
      role: "user",
      content: data.message,
    });

    // Pull recent history (last 20 messages) for context.
    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(40);

    // Pull session vector for current lean.
    const { data: sessionRow } = await supabase
      .from("sessions")
      .select("vector, lane")
      .eq("id", sessionId)
      .maybeSingle();
    let vector = (sessionRow?.vector ?? {}) as Record<string, number>;

    // -------- Chat-driven dimension extraction --------
    // The user's reply is evidence too. Run a tight LLM pass to pull signed
    // deltas per dimension from the latest user turn (with brief recent
    // history for context). Cap per-turn movement so pairings stay primary.
    const PER_TURN_CAP = 10;          // max |delta| applied to any one axis per turn
    const VECTOR_BOUND = 200;         // overall clamp on |vector[axis]|
    // Skip the extractor pass on short / trivial replies ("ok", "yeah", "lol").
    // Saves an LLM call and avoids feeding noise into the vector.
    const EXTRACTOR_MIN_CHARS = 12;
    const trimmedMsg = data.message.trim();
    const recentTurns = (history ?? [])
      .slice(-8)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");
    const extractorVoice = `You read a listener's chat reply and score it along 15 taste dimensions: ${(DIMS as readonly string[]).join(", ")}.
Return STRICT JSON: {"deltas": {"<dimension>": <integer between -10 and 10>, ...}}.
Only include dimensions the message clearly speaks to. Positive = high pole, negative = low pole, using these poles:
${(DIMS as readonly string[]).map((d) => `- ${d}: +${DIM_LABEL[d]?.hi} / -${DIM_LABEL[d]?.lo}`).join("\n")}
Rules: at most 5 dimensions per reply. Skip dimensions the reply doesn't actually address. If the reply is empty, hostile filler, or off-topic, return {"deltas": {}}.
No prose, no markdown fences.`;
    if (trimmedMsg.length >= EXTRACTOR_MIN_CHARS) try {
      const extractTxt = await ai([
        { role: "system", content: extractorVoice },
        { role: "user", content: `Recent turns:\n${recentTurns || "(none)"}\n\nLatest user reply:\n${data.message}\n\nReturn the JSON now.` },
      ]);
      const cleaned = extractTxt.replace(/```json\s*|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as { deltas?: Record<string, unknown> };
      const deltas = parsed?.deltas ?? {};
      const applied: Record<string, number> = {};
      for (const dim of DIMS as readonly string[]) {
        const raw = deltas[dim];
        if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
        const capped = Math.max(-PER_TURN_CAP, Math.min(PER_TURN_CAP, Math.round(raw)));
        if (capped === 0) continue;
        const next = Math.max(-VECTOR_BOUND, Math.min(VECTOR_BOUND, (vector[dim] ?? 0) + capped));
        if (next !== (vector[dim] ?? 0)) applied[dim] = capped;
        vector[dim] = next;
      }
      if (Object.keys(applied).length) {
        await supabase.from("sessions").update({ vector }).eq("id", sessionId);
        // Fire-and-forget event log; never block the reply.
        supabase.from("event_log").insert({
          user_id: userId,
          session_id: sessionId,
          event_type: "chat_vector_update",
          props: { deltas: applied } as never,
          client: "server",
        }).then(() => undefined, () => undefined);
      }
    } catch {
      // Extraction is best-effort; chat continues with the prior vector.
    }

    const topAxes = (DIMS as readonly string[])
      .map((d) => ({ d, v: vector[d] ?? 0 }))
      .filter((x) => Math.abs(x.v) >= 8)
      .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
      .slice(0, 5);


    const ctxLines: string[] = [];
    if (profile?.opening_songs?.length) {
      ctxLines.push(`Opener songs (ranked):\n${(profile.opening_songs as string[]).map((s, i) => `${i + 1}. ${s}`).join("\n")}`);
    }
    if (profile?.opening_hypothesis) {
      ctxLines.push(`Working hypothesis: "${profile.opening_hypothesis}"`);
    }
    if (profile?.opening_lane) {
      ctxLines.push(`Lane: ${profile.opening_lane}`);
    }
    if (topAxes.length) {
      ctxLines.push(
        `Strongest leans so far:\n${topAxes
          .map(({ d, v }) => {
            const lbl = DIM_LABEL[d];
            return `- ${d}: ${v >= 0 ? "+" : ""}${Math.round(v)} (${v >= 0 ? lbl?.hi : lbl?.lo})`;
          })
          .join("\n")}`,
      );
    }
    const contextBlock = ctxLines.length ? `Listener context:\n${ctxLines.join("\n\n")}` : "No prior context yet.";

    const criticProfile = await loadCriticProfile(supabase as never, userId);
    const voiceMod = buildVoiceModulation(criticProfile);

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: CHAT_VOICE },
      ...(voiceMod ? [{ role: "system" as const, content: voiceMod }] : []),
      { role: "system", content: contextBlock },
    ];
    for (const m of history ?? []) {
      if (m.role === "user" || m.role === "assistant") {
        messages.push({ role: m.role, content: m.content });
      }
    }

    let reply = "";
    try {
      reply = await ai(messages);
    } catch {
      reply = "I lost the thread for a second. Say that again?";
    }
    reply = (reply || "").trim() || "Mm. Keep going.";
    if (reply.length > 1200) reply = reply.slice(0, 1197) + "…";

    await supabase.from("chat_messages").insert({
      session_id: sessionId,
      user_id: userId,
      role: "assistant",
      content: reply,
    });

    // -------- Update critic profile from this exchange --------
    // The user's reply is feedback on the critic's PRIOR assistant turn (the
    // one before this new reply). Note: `history` was fetched AFTER we inserted
    // the new user message but BEFORE the new assistant reply, so the last
    // assistant entry in it is correctly the one the user just reacted to —
    // don't reorder those statements.
    // Skip on short / trivial replies — no real signal, just LLM spend.
    if (trimmedMsg.length >= EXTRACTOR_MIN_CHARS) try {
      const priorAssistant = [...(history ?? [])]
        .reverse()
        .find((m) => m.role === "assistant")?.content as string | undefined;
      const signals = await extractToneSignals(priorAssistant ?? null, data.message);
      if (signals) {
        const next = applyToneSignals(criticProfile, signals);
        await persistCriticProfile(supabase as never, userId, next);
      }
    } catch {
      // Profile update is best-effort.
    }

    return { reply, sessionId };
  });

export const listChat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ sessionId: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let sessionId = data.sessionId ?? null;
    if (!sessionId) {
      const { data: existing } = await supabase
        .from("sessions")
        .select("id")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(1);
      sessionId = existing?.[0]?.id ?? null;
    }
    if (!sessionId) return { sessionId: null, messages: [] as Array<{ role: ChatRole; content: string; created_at: string }> };
    const { data: rows } = await supabase
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(200);
    return {
      sessionId,
      messages: ((rows ?? []) as Array<{ role: string; content: string; created_at: string }>).map((r) => ({
        role: r.role as ChatRole,
        content: r.content,
        created_at: r.created_at,
      })),
    };
  });


// ============================================================
// Per-round running hypothesis — the "detective board" line.
// Templated (no LLM): reads the session vector, returns the
// strongest axis as a one-liner. Client compares topDim across
// rounds to render forming / holding / revising.
// ============================================================
export const currentRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ sessionId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ thesis: string; topDim: string | null; strength: number }> => {
    const { supabase, userId } = context;
    const { data: session } = await supabase
      .from("sessions")
      .select("vector,user_id")
      .eq("id", data.sessionId)
      .single();
    const s = session as { vector: Record<string, number>; user_id: string } | null;
    if (!s || s.user_id !== userId) return { thesis: "Still listening.", topDim: null, strength: 0 };
    const vector = s.vector ?? {};
    const ranked = (DIMS as readonly string[])
      .map((d) => ({ d, v: vector[d] ?? 0 }))
      .sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    const top = ranked[0];
    if (!top || Math.abs(top.v) < 4) {
      return { thesis: "Too early to call. Keep picking.", topDim: null, strength: 0 };
    }
    const phrase = REVEAL[top.d];
    const pole = top.v >= 0 ? phrase?.hi : phrase?.lo;
    const thesis = pole
      ? `You keep choosing ${pole.verdict}.`
      : `Leaning ${top.d}.`;
    return { thesis, topDim: top.d, strength: Math.abs(top.v) };
  });
