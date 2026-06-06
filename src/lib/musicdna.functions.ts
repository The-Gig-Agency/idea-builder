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

    // -------- Layer 5: Critic (AI narrative, constrained) --------
    const evidenceBlock = allowed_claims.length
      ? allowed_claims.map((c) =>
          `- ${c.tradeoff} (${c.supporting_choices}/${c.tested_total} relevant matchups, confidence ${c.confidence}). Examples: ${c.examples.map((e) => `${e.chosen} > ${e.rejected}`).join("; ") || "—"}`
        ).join("\n")
      : "- (no claims cleared the evidence threshold)";
    const counterBlock = counterarguments.length
      ? counterarguments.map((c) => `- ${c.claim} (${c.impact} impact — ${c.notes})`).join("\n")
      : "- (none)";
    const narrative = await ai([
      { role: "system", content: CRITIC_VOICE },
      {
        role: "user",
        content: `Write 3-4 sentences about this listener. Use ONLY the allowed claims below. \
Cite the evidence inline (e.g. "across 7 of 12 matchups"). If a strong counter-hypothesis exists, name it. \
If no claims cleared the threshold, say so plainly — do not invent.

ALLOWED CLAIMS:
${evidenceBlock}

COUNTER-HYPOTHESES TO ACKNOWLEDGE:
${counterBlock}

Archetype assigned by cosine match: ${best.name || "Unassigned"}.`,
      },
    ]);

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
    if (latest) {
      const { data: choices } = await supabase
        .from("choices")
        .select("created_at, ms_to_decide, chosen:chosen_song_id(title,artist), rejected:rejected_song_id(title,artist)")
        .eq("session_id", latest.id)
        .order("ms_to_decide", { ascending: true, nullsFirst: false })
        .limit(5);
      definingChoices = ((choices ?? []) as unknown as Array<{
        chosen: { title: string; artist: string } | null;
        rejected: { title: string; artist: string } | null;
      }>)
        .filter((c) => c.chosen && c.rejected)
        .map((c) => ({
          chosen: c.chosen!.title, chosenArtist: c.chosen!.artist,
          rejected: c.rejected!.title, rejectedArtist: c.rejected!.artist,
        }));
    }
    return { profile, sessions: sessions ?? [], definingChoices };
  });

