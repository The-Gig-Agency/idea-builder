import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  reactToThree,
  refineWithTwoMore,
  recordEvent,
  startSession,
  nextPairing,
  recordChoice,
  finalizeSession,
  finalSynthesis,
  currentRead,
} from "@/lib/musicdna.functions";
import { getOnboardingOpener, type OnboardingOpener } from "@/lib/onboarding-openers.functions";
import { ensureAnonSession } from "@/lib/anon-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({ meta: [{ title: "MusicDNA — Interview" }] }),
  component: Onboarding,
});

const MAX_ROUNDS = 6;

const LANE_LABEL: Record<string, string> = {
  alternative: "Alternative",
  pop: "Pop",
  hip_hop: "Hip-Hop",
  electronic: "Electronic",
  classic_rock: "Classic Rock",
  general: "General",
};

const SLOT1_LABELS = ["The one you'd save first", "The one right after", "And one more"];
const SLOT2_LABELS = ["Try to break my read", "And one more — go"];
const PLACEHOLDERS = [
  "Ceremony — New Order",
  "Fool's Gold — The Stone Roses",
  "Untrue — Burial",
  "Bizarre Love Triangle — New Order",
  "Pyramid Song — Radiohead",
];

type Phase = "ranking3" | "ranking2" | "playing" | "done";
type ThreeReact = { reaction: string; hypothesis_v1: string };
type Refined = { reaction?: string; hypothesis: string; lane: string; confidence: number };
type Song = { id: string; title: string; artist: string; year: number | null; lane: string };
type Pairing = {
  id: string; tests: string[]; hypothesis: string | null; why_good: string | null;
  diagnostic_weight: number; song_a: Song; song_b: Song;
};
type Entry = {
  round: number;
  pairing: Pairing;
  chosenSongId: string;
  reaction: string;
  thesis: string;
  hook: string;
  direction: "forming" | "holding" | "revising";
  topDim: string | null;
};

const DIR_GLYPH: Record<Entry["direction"], string> = { forming: "↑", holding: "→", revising: "↻" };
const DIR_LABEL: Record<Entry["direction"], string> = { forming: "first read", holding: "holding", revising: "revising" };

function Onboarding() {
  // server fns
  const reactThreeFn = useServerFn(reactToThree);
  const refineFn = useServerFn(refineWithTwoMore);
  const logEvent = useServerFn(recordEvent);
  const getOpenerFn = useServerFn(getOnboardingOpener);
  const startFn = useServerFn(startSession);
  const nextFn = useServerFn(nextPairing);
  const chooseFn = useServerFn(recordChoice);
  const finalizeFn = useServerFn(finalizeSession);
  const synthFn = useServerFn(finalSynthesis);
  const readFn = useServerFn(currentRead);
  const navigate = useNavigate();

  type EventInput = {
    event_type:
      | "onboarding_viewed" | "onboarding_three_submitted" | "onboarding_classified"
      | "pairing_shown" | "choice_made" | "reveal_shown" | "reveal_continued"
      | "session_completed" | "result_viewed" | "result_shared" | "session_quit";
    session_id?: string | null;
    pairing_id?: string | null;
    choice_id?: string | null;
    response_time_ms?: number | null;
    props?: Record<string, unknown>;
    variant?: string;
  };
  const track = (e: EventInput) => { logEvent({ data: e } as never).catch(() => {}); };

  // phase + ranking state
  const [phase, setPhase] = useState<Phase>("ranking3");
  const [three, setThree] = useState<[string, string, string]>(["", "", ""]);
  const [two, setTwo] = useState<[string, string]>(["", ""]);
  const [busy, setBusy] = useState(false);
  const [threeRead, setThreeRead] = useState<ThreeReact | null>(null);
  const [refined, setRefined] = useState<Refined | null>(null);
  const [r3Step, setR3Step] = useState<0 | 1 | 2>(0);
  const [r5Step, setR5Step] = useState<0 | 1 | 2>(0);
  const [opener, setOpener] = useState<OnboardingOpener | null>(null);

  // play state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [round, setRound] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [kept, setKept] = useState<Array<{ tradeoff: string; examples: string[]; supporting: number; tested: number }>>([]);
  const [counters, setCounters] = useState<Array<{ claim: string; notes: string }>>([]);
  const startedAt = useRef<number>(Date.now());
  const playStartedRef = useRef(false);
  const prevTopDim = useRef<string | null>(null);
  const rank2Ref = useRef<HTMLDivElement | null>(null);
  const pairingAnchorRef = useRef<HTMLDivElement | null>(null);
  const doneAnchorRef = useRef<HTMLDivElement | null>(null);

  // boot
  const [bootError, setBootError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureAnonSession();
        const o = (await getOpenerFn()) as OnboardingOpener;
        if (cancelled) return;
        setOpener(o);
        track({ event_type: "onboarding_viewed", variant: o.variant_key });
      } catch (e) {
        setBootError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reveal-3 choreography
  useEffect(() => {
    if (!threeRead) return;
    setR3Step(0);
    const t1 = setTimeout(() => setR3Step(1), 350);
    const t2 = setTimeout(() => setR3Step(2), 1100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [threeRead]);

  // After reveal-3, surface the rank2 form and scroll to it
  useEffect(() => {
    if (r3Step === 2 && phase === "ranking2") {
      setTimeout(() => rank2Ref.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 200);
    }
  }, [r3Step, phase]);

  // reveal-5 choreography
  useEffect(() => {
    if (!refined) return;
    setR5Step(0);
    const t1 = setTimeout(() => setR5Step(1), 350);
    const t2 = setTimeout(() => setR5Step(2), 1100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [refined]);

  // After reveal-5 lands, auto-start the side-by-sides — no handoff button
  useEffect(() => {
    if (r5Step !== 2 || phase !== "playing" || playStartedRef.current) return;
    playStartedRef.current = true;
    (async () => {
      try {
        const { sessionId } = await startFn({});
        setSessionId(sessionId);
        const { pairing, round } = await nextFn({ data: { sessionId } });
        setPairing(pairing as unknown as Pairing | null);
        setRound(round);
        startedAt.current = Date.now();
        if (pairing) {
          track({
            event_type: "pairing_shown",
            session_id: sessionId,
            pairing_id: (pairing as unknown as Pairing).id,
            props: { round, tests: (pairing as unknown as Pairing).tests },
          });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not start the side-by-sides.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r5Step, phase]);

  // scroll new pairing into view
  useEffect(() => {
    if (pairing && pairingAnchorRef.current) {
      pairingAnchorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [pairing?.id]);

  // scroll to report when finished
  useEffect(() => {
    if (phase === "done" && doneAnchorRef.current) {
      doneAnchorRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [phase]);

  async function submitThree() {
    if (busy) return;
    const cleaned = three.map((s) => s.trim()) as [string, string, string];
    if (cleaned.some((s) => s.length < 2)) {
      toast.error("Fill in all three — rank matters.");
      return;
    }
    setBusy(true);
    try {
      await ensureAnonSession();
      const r = (await reactThreeFn({ data: { songs: cleaned } } as never)) as ThreeReact;
      setThree(cleaned);
      setThreeRead(r);
      setPhase("ranking2");
      track({
        event_type: "onboarding_three_submitted",
        variant: opener?.variant_key ?? "fallback",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read those.");
    } finally {
      setBusy(false);
    }
  }

  async function submitTwoMore() {
    if (busy) return;
    const cleaned = two.map((s) => s.trim()) as [string, string];
    if (cleaned.some((s) => s.length < 2)) {
      toast.error("Two more — try to break my read.");
      return;
    }
    setBusy(true);
    try {
      await ensureAnonSession();
      const r = (await refineFn({
        data: { firstThree: three, twoMore: cleaned },
      } as never)) as Refined;
      setTwo(cleaned);
      setRefined(r);
      setPhase("playing"); // reveal5 then auto-start side-by-sides
      track({
        event_type: "onboarding_classified",
        props: { lane: r.lane, confidence: r.confidence, song_count: 5 },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't refine.");
    } finally {
      setBusy(false);
    }
  }

  async function pick(songId: string) {
    if (!pairing || !sessionId || busy) return;
    setBusy(true);
    const ms = Math.min(600000, Date.now() - startedAt.current);
    const currentPairing = pairing;
    const currentRound = round;
    try {
      const { verdict, why, dim, delta } = await chooseFn({
        data: { sessionId, pairingId: currentPairing.id, chosenSongId: songId, msToDecide: ms },
      });
      const rejectedSongId = songId === currentPairing.song_a.id ? currentPairing.song_b.id : currentPairing.song_a.id;
      track({
        event_type: "choice_made",
        session_id: sessionId,
        pairing_id: currentPairing.id,
        response_time_ms: ms,
        props: { chosen_song_id: songId, rejected_song_id: rejectedSongId, top_dim: dim, delta, tests: currentPairing.tests },
      });

      let thesis = "Reading you now.";
      let hook = "";
      let topDim: string | null = null;
      try {
        const r = await readFn({ data: { sessionId } });
        thesis = r.thesis;
        hook = r.hook ?? "";
        topDim = r.topDim;
      } catch { /* keep default */ }

      const direction: Entry["direction"] =
        currentRound <= 1 || !prevTopDim.current
          ? "forming"
          : topDim && topDim === prevTopDim.current
            ? "holding"
            : topDim && topDim !== prevTopDim.current
              ? "revising"
              : "holding";
      prevTopDim.current = topDim ?? prevTopDim.current;

      const reaction = why ? `${verdict}\n${why}` : verdict;
      const entry: Entry = {
        round: currentRound, pairing: currentPairing, chosenSongId: songId,
        reaction, thesis, hook, direction, topDim,
      };
      setEntries((prev) => [...prev, entry]);
      setPairing(null);

      const { pairing: nxt, round: nr, done: isDone } = await nextFn({ data: { sessionId } });
      if (isDone || !nxt || nr > MAX_ROUNDS) {
        await finalizeFn({ data: { sessionId } });
        track({ event_type: "session_completed", session_id: sessionId, props: { rounds: nr } });
        try {
          const r = await synthFn({ data: { sessionId } }) as {
            synthesis: string;
            kept_choosing: Array<{ tradeoff: string; examples: string[]; supporting: number; tested: number }>;
            counter_reads: Array<{ claim: string; notes: string }>;
          };
          setSynthesis(r.synthesis);
          setKept(r.kept_choosing ?? []);
          setCounters((r.counter_reads ?? []).map((c) => ({ claim: c.claim, notes: c.notes })));
        } catch { /* fall through */ }
        setPhase("done");
        setBusy(false);
        return;
      }
      setPairing(nxt as unknown as Pairing);
      setRound(nr);
      startedAt.current = Date.now();
      track({
        event_type: "pairing_shown",
        session_id: sessionId,
        pairing_id: (nxt as unknown as Pairing).id,
        props: { round: nr, tests: (nxt as unknown as Pairing).tests },
      });
      setBusy(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Choice failed.");
      setBusy(false);
    }
  }

  if (bootError) {
    return (
      <main className="mx-auto max-w-2xl px-6 pt-24 text-center space-y-4">
        <p className="eyebrow">can't start a session</p>
        <p className="font-serif text-xl text-muted-foreground">{bootError}</p>
      </main>
    );
  }

  // INITIAL: rank-three prompt only
  if (phase === "ranking3") {
    return (
      <main className="mx-auto max-w-2xl px-6 pt-16 pb-24 min-h-screen flex flex-col">
        <section className="space-y-10 animate-in fade-in duration-500">
          <header className="space-y-3">
            <p className="eyebrow">{opener?.eyebrow ?? "three songs · ranked"}</p>
            <h1 className="display text-4xl md:text-5xl leading-[1.05] tracking-tight whitespace-pre-line">
              {opener ? renderHeadline(opener.headline) : (
                <>
                  Name three songs you love.
                  <br />
                  <span className="italic text-muted-foreground">Rank them.</span>
                </>
              )}
            </h1>
            <p className="text-sm text-muted-foreground max-w-md">
              {opener?.sub ?? "The order matters. Your #1 says more than you think."}
            </p>
          </header>

          <div className="space-y-6">
            {[0, 1, 2].map((i) => (
              <RankedInput
                key={i}
                rank={i + 1}
                label={(opener?.slot_labels?.[i]) ?? SLOT1_LABELS[i]}
                value={three[i]}
                placeholder={PLACEHOLDERS[i]}
                onChange={(v) => {
                  const next = [...three] as [string, string, string];
                  next[i] = v;
                  setThree(next);
                }}
                autoFocus={i === 0}
                onEnter={i === 2 ? submitThree : undefined}
              />
            ))}
          </div>

          <div>
            <button
              onClick={submitThree}
              disabled={busy || three.some((s) => s.trim().length < 2)}
              className="bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Reading…" : (opener?.cta ?? "See what I think →")}
            </button>
          </div>
        </section>
      </main>
    );
  }

  // TRANSCRIPT: ranking2 → playing → done all in one continuous scroll
  return (
    <main className="mx-auto max-w-3xl px-6 pt-12 pb-24 space-y-12">
      <header className="space-y-2">
        <p className="eyebrow">the interview</p>
      </header>

      {/* Block 1: the first three + reaction */}
      {threeRead && (
        <section className="space-y-6 animate-in fade-in duration-500">
          <RankedChecklist songs={three} startRank={1} muted={!!refined} />
          {r3Step >= 1 && !refined && (
            <p className="font-serif italic text-3xl md:text-4xl text-primary animate-in fade-in slide-in-from-bottom-2 duration-500">
              Interesting…
            </p>
          )}
          {r3Step >= 2 && (
            <>
              <p className="font-serif text-2xl md:text-3xl leading-snug text-foreground animate-in fade-in slide-in-from-bottom-2 duration-700">
                {threeRead.reaction}
              </p>
              <div className="border-l-2 border-primary/60 pl-4 py-1 animate-in fade-in duration-700">
                <p className="eyebrow mb-1">working hypothesis</p>
                <p className="font-serif text-lg italic">"{threeRead.hypothesis_v1}"</p>
              </div>
            </>
          )}
        </section>
      )}

      {/* Block 2: rank two more — inline, no page break */}
      {phase === "ranking2" && r3Step >= 2 && (
        <section ref={rank2Ref} className="space-y-8 animate-in fade-in duration-500">
          <header className="space-y-3">
            <p className="eyebrow">two more · still ranked</p>
            <h2 className="display text-3xl md:text-4xl leading-[1.05] tracking-tight">
              Throw me two more.
              <br />
              <span className="italic text-muted-foreground">Try to break my read.</span>
            </h2>
          </header>
          <div className="space-y-6">
            {[0, 1].map((i) => (
              <RankedInput
                key={i}
                rank={i + 4}
                label={SLOT2_LABELS[i]}
                value={two[i]}
                placeholder={PLACEHOLDERS[i + 3]}
                onChange={(v) => {
                  const next = [...two] as [string, string];
                  next[i] = v;
                  setTwo(next);
                }}
                autoFocus={i === 0}
                onEnter={i === 1 ? submitTwoMore : undefined}
              />
            ))}
          </div>
          <div>
            <button
              onClick={submitTwoMore}
              disabled={busy || two.some((s) => s.trim().length < 2)}
              className="bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Refining…" : "Refine your read →"}
            </button>
          </div>
        </section>
      )}

      {/* Block 3: refined read on all five */}
      {refined && (
        <section className="space-y-6 animate-in fade-in duration-500">
          <RankedChecklist songs={[...three, ...two]} startRank={1} />
          {r5Step >= 1 && refined.reaction && (
            <p className="font-serif text-2xl md:text-3xl leading-snug animate-in fade-in duration-500">
              {refined.reaction}
            </p>
          )}
          {r5Step >= 2 && (
            <>
              <p className="display text-3xl md:text-4xl leading-[1.1] italic text-primary animate-in fade-in duration-700">
                "{refined.hypothesis}"
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1 animate-in fade-in duration-700">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Lane</span>
                <span className="border hairline-strong rounded-sm px-3 py-1 text-sm font-medium">
                  {LANE_LABEL[refined.lane] ?? refined.lane}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  {Math.round(refined.confidence * 100)}% confidence
                </span>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground pt-2">
                now let's pressure-test it — side by side
              </p>
            </>
          )}
        </section>
      )}

      {/* Block 4: play transcript */}
      {entries.length > 0 && (
        <div className="space-y-10">
          {entries.map((e) => {
            const chosen = e.pairing.song_a.id === e.chosenSongId ? e.pairing.song_a : e.pairing.song_b;
            const rejected = e.pairing.song_a.id === e.chosenSongId ? e.pairing.song_b : e.pairing.song_a;
            return (
              <article key={e.round} className="space-y-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Round {String(e.round).padStart(2, "0")} · {chosen.title} vs. {rejected.title} — you picked <span className="text-foreground">{chosen.title}</span>
                </p>
                <p className="font-serif text-lg md:text-xl leading-snug text-foreground whitespace-pre-line">
                  {e.reaction}
                </p>
                <div className="border-l-2 border-primary/40 pl-4 py-1 space-y-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    my read so far · {DIR_LABEL[e.direction]} {DIR_GLYPH[e.direction]}
                  </p>
                  <p className="font-serif italic text-base md:text-lg text-foreground/90 leading-snug whitespace-pre-line">
                    {e.thesis}
                  </p>
                  {e.hook && (
                    <p className="font-serif text-sm md:text-base text-muted-foreground leading-snug pt-1">
                      {e.hook}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Block 5: current pairing */}
      {pairing && phase === "playing" && (
        <section ref={pairingAnchorRef} className="space-y-6 pt-2">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Round {String(round).padStart(2, "0")} / {MAX_ROUNDS}</p>
            <div className="h-px flex-1 mx-6 bg-border" />
            <p className="eyebrow">{pairing.tests?.join(" · ") || "—"}</p>
          </div>
          <p className="font-serif text-xl md:text-2xl text-muted-foreground">
            {entries.length === 0 ? "Pick one. Don't overthink it." : "Next one — go with your gut."}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border rounded-sm overflow-hidden">
            {[pairing.song_a, pairing.song_b].map((song) => (
              <button
                key={song.id} disabled={busy} onClick={() => pick(song.id)}
                className="group bg-surface p-8 md:p-12 text-left hover:bg-background transition-colors disabled:opacity-40"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">
                  {song.lane}{song.year ? ` · ${song.year}` : ""}
                </p>
                <p className="font-serif text-2xl md:text-3xl text-foreground leading-tight mb-2">{song.title}</p>
                <p className="text-sm text-muted-foreground">{song.artist}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {busy && !pairing && phase === "playing" && (
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Thinking…
        </p>
      )}

      {/* Block 6: final report */}
      {phase === "done" && (
        <section ref={doneAnchorRef} className="space-y-14 pt-6 animate-in fade-in duration-700">
          <header className="space-y-3">
            <p className="eyebrow">the read</p>
            <h2 className="display text-3xl md:text-4xl leading-tight">What you kept choosing.</h2>
          </header>

          {kept.length > 0 ? (
            <section className="space-y-5">
              <p className="eyebrow">evidence</p>
              <ul className="space-y-4">
                {kept.map((k, i) => (
                  <li key={i} className="border-l-2 border-primary/40 pl-5 space-y-2">
                    <p className="font-serif text-xl md:text-2xl leading-snug">
                      You repeatedly favored <span className="italic">{k.tradeoff}</span>.
                    </p>
                    {k.examples.length > 0 && (
                      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                        {k.examples.join(" · ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section className="space-y-3">
              <p className="eyebrow">the finding</p>
              <p className="font-serif text-xl md:text-2xl italic text-muted-foreground leading-snug">
                You refused to collapse into a single pattern. Every time a clear read started to form, another pick complicated it. Broad ear — not random.
              </p>
            </section>
          )}

          {synthesis && (
            <section className="space-y-3">
              <p className="eyebrow">what this might mean</p>
              <p className="font-serif text-2xl md:text-3xl leading-snug border-l-2 border-primary pl-6 italic">
                {synthesis}
              </p>
            </section>
          )}

          {counters.length > 0 && (
            <section className="space-y-3">
              <p className="eyebrow">other possible explanations</p>
              <ul className="space-y-2">
                {counters.map((c, i) => (
                  <li key={i} className="text-sm md:text-base text-muted-foreground">
                    <span className="font-serif italic text-foreground">{c.claim}</span>
                    {c.notes && <span className="block font-mono text-[11px] uppercase tracking-[0.22em] mt-1">{c.notes}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              onClick={() => navigate({ to: "/me" })}
              className="bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90"
            >
              Push back on this →
            </button>
            <button
              onClick={() => navigate({ to: "/profile" })}
              className="border hairline-strong rounded-sm px-6 py-3 text-sm font-medium hover:bg-muted/40"
            >
              See your full reading
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function RankedInput({
  rank, label, value, placeholder, onChange, onEnter, autoFocus,
}: {
  rank: number; label: string; value: string; placeholder: string;
  onChange: (v: string) => void; onEnter?: () => void; autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  return (
    <div className="grid grid-cols-[3rem_1fr] gap-4 items-baseline">
      <div className="text-right">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">#{rank}</p>
      </div>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-1">{label}</p>
        <div className="border-b-2 hairline-strong focus-within:border-primary transition-colors pb-1">
          <input
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && onEnter) { e.preventDefault(); onEnter(); }
            }}
            placeholder={placeholder}
            className="w-full bg-transparent text-xl md:text-2xl font-serif italic py-2 placeholder:text-muted-foreground/40 placeholder:not-italic placeholder:font-serif focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}

function RankedChecklist({ songs, startRank, muted }: { songs: string[]; startRank: number; muted?: boolean; }) {
  return (
    <ul className="space-y-2">
      {songs.map((s, i) => (
        <li key={i} className={`grid grid-cols-[3rem_1fr] gap-4 items-baseline ${muted ? "opacity-50" : ""}`}>
          <span className="text-right font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            #{startRank + i}
          </span>
          <span className="font-mono text-base md:text-lg text-foreground">✓ {s}</span>
        </li>
      ))}
    </ul>
  );
}

function renderHeadline(headline: string) {
  const lines = headline.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <span key={i} className="block">
          {i === lines.length - 1 && lines.length > 1 ? (
            <span className="italic text-muted-foreground">{line}</span>
          ) : (
            line
          )}
        </span>
      ))}
    </>
  );
}
