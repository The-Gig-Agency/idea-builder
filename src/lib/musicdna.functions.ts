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

// ============ Lane classifier ============
const LANES = ["alternative", "pop", "hip_hop", "electronic", "classic_rock", "general"] as const;
type Lane = (typeof LANES)[number];

// Map catalog sub-lanes (currently all alternative sub-genres) to top-level lanes.
function catalogLaneToTopLane(sub: string | null | undefined): Lane | null {
  if (!sub) return null;
  const s = sub.toLowerCase();
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

const CLASSIFIER_VOICE = `You are a music librarian routing songs to one of these lanes: \
alternative, pop, hip_hop, electronic, classic_rock. \
"alternative" = post-punk, indie, shoegaze, britpop, grunge, goth, college rock. \
"pop" = mainstream pop, contemporary chart pop, pop-rock (Swift, Eilish, Beyoncé pop work). \
"hip_hop" = rap, hip-hop, trap. \
"electronic" = techno, house, IDM, drum'n'bass, EDM. \
"classic_rock" = 60s-70s-80s mainstream rock (Stones, Zeppelin, Fleetwood Mac). \
Respond ONLY with valid JSON, no prose.`;

type OpeningAnalysis = {
  lane: Lane;
  confidence: number;
  secondary_lanes: Lane[];
  reasoning: string[];
  hypothesis: string;
  per_song: Array<{ input: string; lane: Lane | "unknown"; source: "catalog" | "llm" }>;
};

async function classifyLane(
  songs: string[],
  supabase: { from: (t: string) => { select: (c: string) => { ilike: (col: string, v: string) => { limit: (n: number) => Promise<{ data: Array<{ lane: string; title: string; artist: string }> | null }> } } } },
): Promise<OpeningAnalysis> {
  const perSong: OpeningAnalysis["per_song"] = [];
  const votes: Record<string, number> = {};
  const unresolved: string[] = [];

  for (const raw of songs) {
    const [titlePart, artistPart] = raw.split("—").map((s) => s.trim());
    const title = titlePart || raw;
    let matchedLane: Lane | null = null;
    if (title) {
      try {
        const { data } = await supabase.from("songs").select("lane,title,artist").ilike("title", title).limit(5);
        if (data && data.length) {
          const best = artistPart
            ? data.find((r) => r.artist?.toLowerCase().includes(artistPart.toLowerCase())) ?? data[0]
            : data[0];
          matchedLane = catalogLaneToTopLane(best.lane);
        }
      } catch { /* ignore catalog miss */ }
    }
    if (matchedLane) {
      perSong.push({ input: raw, lane: matchedLane, source: "catalog" });
      votes[matchedLane] = (votes[matchedLane] ?? 0) + 1;
    } else {
      unresolved.push(raw);
      perSong.push({ input: raw, lane: "unknown", source: "catalog" });
    }
  }

  if (unresolved.length) {
    try {
      const txt = await ai([
        { role: "system", content: CLASSIFIER_VOICE },
        {
          role: "user",
          content: `Classify each song into one lane. Return JSON: {"results":[{"input":"...","lane":"..."}]}.\n\nSongs:\n${unresolved.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
        },
      ]);
      const cleaned = txt.replace(/```json\s*|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as { results?: Array<{ input: string; lane: string }> };
      for (const r of parsed.results ?? []) {
        const lane = (LANES as readonly string[]).includes(r.lane) && r.lane !== "general"
          ? (r.lane as Lane)
          : null;
        const idx = perSong.findIndex((p) => p.input === r.input && p.lane === "unknown");
        if (idx >= 0) {
          perSong[idx] = { input: r.input, lane: lane ?? "unknown", source: "llm" };
          if (lane) votes[lane] = (votes[lane] ?? 0) + 1;
        }
      }
    } catch { /* swallow — falls through to general */ }
  }

  const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  const topVotes = sorted[0]?.[1] ?? 0;
  const lane: Lane = topVotes > 0 ? (sorted[0][0] as Lane) : "general";
  const confidence = Math.max(0, Math.min(1, topVotes / songs.length));
  const secondary = sorted.slice(1).filter((s) => s[1] >= 2).map((s) => s[0] as Lane);
  const finalLane: Lane = confidence < 0.6 ? "general" : lane;

  const reasoning: string[] = [];
  if (topVotes > 0) reasoning.push(`${topVotes} of ${songs.length} opening songs read as ${lane}.`);
  if (secondary.length) reasoning.push(`Secondary signal: ${secondary.join(", ")}.`);
  if (finalLane === "general" && lane !== "general") reasoning.push(`Low confidence (${confidence.toFixed(2)}); routing to general.`);
  if (finalLane === "general" && lane === "general") reasoning.push("No clear lane signal from the five songs.");

  let hypothesis = "Five songs is a sketch, not a portrait. Let's see if the matchups hold.";
  try {
    hypothesis = await ai([
      { role: "system", content: VOICE },
      {
        role: "user",
        content: `Five songs the user named as ones they love:\n${songs.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nWrite ONE sentence (max 30 words) that names what these choices reveal about their taste — specific dimensions like movement, atmosphere, transformation, melody, verbal cleverness. End with a half-promise: "Let's see if that holds."`,
      },
    ]);
  } catch { /* keep fallback */ }

  return { lane: finalLane, confidence, secondary_lanes: secondary, reasoning, hypothesis, per_song: perSong };
}

export const analyzeOpeningSongs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ songs: z.array(z.string().min(1).max(160)).length(5) }).parse(d),
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
export const startSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("opening_lane, opening_lane_confidence")
      .eq("user_id", userId)
      .maybeSingle();
    const lane = ((profile?.opening_lane as Lane | null) ?? "general") as Lane;
    const lane_confidence = Number(profile?.opening_lane_confidence ?? 0);
    const { data, error } = await supabase
      .from("sessions")
      .insert({ user_id: userId, vector: {}, lane, lane_confidence })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { sessionId: data.id, lane, lane_confidence };
  });

// ============ Next pairing ============
export const nextPairing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [usedRes, sessionRes] = await Promise.all([
      supabase.from("choices").select("pairing_id").eq("session_id", data.sessionId),
      supabase.from("sessions").select("vector, lane").eq("id", data.sessionId).single(),
    ]);
    const sessionLane = (sessionRes.data?.lane as Lane | null) ?? "general";

    const pairingSelect = `
      id, tests, hypothesis, why_good, diagnostic_weight, lane,
      song_a:songs!pairings_song_a_id_fkey(id,title,artist,year,lane),
      song_b:songs!pairings_song_b_id_fkey(id,title,artist,year,lane)
    `;

    // Primary fetch: lane-scoped (or all active when lane is 'general').
    let pairingsRes = sessionLane === "general"
      ? await supabase.from("pairings").select(pairingSelect).eq("active", true)
      : await supabase.from("pairings").select(pairingSelect).eq("active", true).eq("lane", sessionLane);
    if (pairingsRes.error) throw new Error(pairingsRes.error.message);

    const usedIds = new Set((usedRes.data ?? []).map((c) => c.pairing_id));
    let pool = (pairingsRes.data ?? []).filter((p) => !usedIds.has(p.id));

    // Fallback to general only if lane-scoped pool is exhausted and lane wasn't already general.
    if (!pool.length && sessionLane !== "general") {
      pairingsRes = await supabase.from("pairings").select(pairingSelect).eq("active", true).eq("lane", "general");
      if (pairingsRes.error) throw new Error(pairingsRes.error.message);
      pool = (pairingsRes.data ?? []).filter((p) => !usedIds.has(p.id));
    }

    const vector = (sessionRes.data?.vector ?? {}) as Record<string, number>;
    const round = usedIds.size;

    const confidentAxes = (DIMS as readonly string[]).filter((d) => Math.abs(vector[d] ?? 0) >= 30).length;
    const confidence = confidentAxes / DIMS.length;
    const canStop = round >= 12 && confidence >= 0.6;

    if (!pool.length || canStop) {
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
      supabase.from("sessions").select("vector,user_id").eq("id", data.sessionId).single(),
    ]);
    const pairing = pairingRes.data as unknown as {
      tests: string[] | null; diagnostic_weight: number; song_a_id: string; song_b_id: string;
      song_a: Record<string, number> & { id: string; title: string; artist: string };
      song_b: Record<string, number> & { id: string; title: string; artist: string };
    } | null;
    const session = sessionRes.data;
    if (pairingRes.error || !pairing) throw new Error(pairingRes.error?.message ?? "pairing not found");
    if (sessionRes.error || !session) throw new Error(sessionRes.error?.message ?? "session not found");
    if (session.user_id !== userId) throw new Error("forbidden");

    const chosenIsA = data.chosenSongId === pairing.song_a_id;
    const winner = chosenIsA ? pairing.song_a : pairing.song_b;
    const loser = chosenIsA ? pairing.song_b : pairing.song_a;
    const rejectedSongId = chosenIsA ? pairing.song_b_id : pairing.song_a_id;
    const w = (pairing.diagnostic_weight || 50) / 100;
    const vec: Record<string, number> = { ...(session.vector as Record<string, number>) };
    const tests: string[] = pairing.tests?.length ? pairing.tests : (DIMS as readonly string[]).slice();
    let topDim = tests[0] ?? "movement";
    let topDelta = 0;
    for (const dim of tests) {
      const a = (winner as Record<string, number>)?.[dim] ?? 50;
      const b = (loser as Record<string, number>)?.[dim] ?? 50;
      const delta = a - b;
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
    const { error: uErr } = await supabase.from("sessions").update({ vector: vec }).eq("id", data.sessionId);
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

const CRITIC_VOICE = `You are a music critic writing for an old, edgy Rolling Stone. \
You are not a therapist, astrologer, psychologist, or life coach. \
You are not diagnosing the user. You are identifying patterns in their choices. \
Voice: punchy, opinionated, music-literate. Sharp sentences, vivid verbs, \
slightly irreverent. One observation per sentence. Never flatter. \
Every claim must reference the evidence you were given. \
Acknowledge uncertainty where the evidence is thin. \
Do not invent claims that are not in the allowed_claims list. \
Banned words: ${BANNED_WORDS.join(", ")}. \
Prefer: "across these choices", "this suggests", "you repeatedly favored", \
"the strongest evidence is", "a weaker reading would be".`;

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

