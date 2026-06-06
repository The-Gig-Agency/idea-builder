import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { startSession, nextPairing, recordChoice, finalizeSession, recordEvent, roundInsight, finalSynthesis } from "@/lib/musicdna.functions";
import { toast } from "sonner";

const MAX_ROUNDS = 6;

export const Route = createFileRoute("/_authenticated/play")({
  head: () => ({ meta: [{ title: "Choose one — MusicDNA" }] }),
  component: Play,
});

type Song = { id: string; title: string; artist: string; year: number | null; lane: string };
type Pairing = {
  id: string; tests: string[]; hypothesis: string | null; why_good: string | null;
  diagnostic_weight: number; song_a: Song; song_b: Song;
};
type Insight = { kind: "observation" | "challenge" | "refinement"; text: string };

const INSIGHT_LABEL: Record<Insight["kind"], string> = {
  observation: "Observation",
  challenge: "Let's test that",
  refinement: "Refinement",
};

function Play() {
  const start = useServerFn(startSession);
  const next = useServerFn(nextPairing);
  const choose = useServerFn(recordChoice);
  const finalize = useServerFn(finalizeSession);
  const insightFn = useServerFn(roundInsight);
  const synthFn = useServerFn(finalSynthesis);
  const logEvent = useServerFn(recordEvent);
  const navigate = useNavigate();

  type EventInput = {
    event_type: "onboarding_classified" | "pairing_shown" | "choice_made" | "reveal_shown" | "reveal_continued" | "session_completed" | "result_viewed" | "result_shared" | "session_quit";
    session_id?: string | null;
    pairing_id?: string | null;
    choice_id?: string | null;
    response_time_ms?: number | null;
    props?: Record<string, unknown>;
  };
  const track = (event: EventInput) => {
    logEvent({ data: event } as never).catch(() => {});
  };

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [reveal, setReveal] = useState<{ verdict: string; why: string; hesitation: string | null } | null>(null);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [kept, setKept] = useState<Array<{ tradeoff: string; examples: string[]; supporting: number; tested: number }>>([]);
  const [counters, setCounters] = useState<Array<{ claim: string; notes: string }>>([]);
  const [finishing, setFinishing] = useState(false);
  const startedAt = useRef<number>(Date.now());
  const startedRef = useRef(false);
  const shownAt = useRef<number>(Date.now());

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const { sessionId } = await start({});
        setSessionId(sessionId);
        const { pairing, round } = await next({ data: { sessionId } });
        setPairing(pairing as unknown as Pairing | null);
        setRound(round);
        startedAt.current = Date.now();
        shownAt.current = Date.now();
        if (pairing) {
          track({
            event_type: "pairing_shown",
            session_id: sessionId,
            pairing_id: (pairing as unknown as Pairing).id,
            props: { round, tests: (pairing as unknown as Pairing).tests },
          });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not start.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pick(songId: string) {
    if (!pairing || !sessionId || busy) return;
    setBusy(true);
    const ms = Math.min(600000, Date.now() - startedAt.current);
    try {
      const { verdict, why, hesitation, dim, delta } = await choose({
        data: { sessionId, pairingId: pairing.id, chosenSongId: songId, msToDecide: ms },
      });
      const rejectedSongId = songId === pairing.song_a.id ? pairing.song_b.id : pairing.song_a.id;
      track({
        event_type: "choice_made",
        session_id: sessionId,
        pairing_id: pairing.id,
        response_time_ms: ms,
        props: { chosen_song_id: songId, rejected_song_id: rejectedSongId, top_dim: dim, delta, tests: pairing.tests },
      });
      setReveal({ verdict, why, hesitation });
      shownAt.current = Date.now();
      track({ event_type: "reveal_shown", session_id: sessionId, pairing_id: pairing.id, props: { dim, delta } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Choice failed.");
      setBusy(false);
    }
  }

  async function advance() {
    if (!sessionId || finishing) return;
    setFinishing(true);
    const dwellMs = Date.now() - shownAt.current;
    track({
      event_type: "reveal_continued",
      session_id: sessionId,
      pairing_id: pairing?.id ?? null,
      response_time_ms: dwellMs,
    });
    try {
      // After rounds 3, 6, 9 — try for an insight before the next pairing.
      if ([3, 6, 9].includes(round)) {
        try {
          const ins = await insightFn({ data: { sessionId, round } });
          if (ins) {
            setInsight(ins as Insight);
            setReveal(null);
            setFinishing(false);
            return;
          }
        } catch { /* silent */ }
      }
      await loadNextPairing();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load next.");
      setBusy(false);
      setFinishing(false);
    }
  }

  async function loadNextPairing() {
    if (!sessionId) return;
    const { pairing: nxt, round: nr, done } = await next({ data: { sessionId } });
    if (done || !nxt || nr > MAX_ROUNDS) {
      await finalize({ data: { sessionId } });
      track({ event_type: "session_completed", session_id: sessionId, props: { rounds: nr } });
      try {
        const { synthesis } = await synthFn({ data: { sessionId } });
        setSynthesis(synthesis);
      } catch { /* fall through */ }
      setDone(true);
      setBusy(false);
      setFinishing(false);
      return;
    }
    setPairing(nxt as unknown as Pairing);
    setRound(nr);
    setReveal(null);
    setInsight(null);
    startedAt.current = Date.now();
    shownAt.current = Date.now();
    track({
      event_type: "pairing_shown",
      session_id: sessionId,
      pairing_id: (nxt as unknown as Pairing).id,
      props: { round: nr, tests: (nxt as unknown as Pairing).tests },
    });
    setBusy(false);
    setFinishing(false);
  }

  async function dismissInsight() {
    setInsight(null);
    try { await loadNextPairing(); } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load next.");
      setBusy(false);
      setFinishing(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24">
        <p className="eyebrow mb-8">The payoff</p>
        <h1 className="display text-3xl md:text-4xl mb-10">Here's what I think.</h1>
        {synthesis ? (
          <p className="font-serif text-2xl md:text-3xl leading-snug text-foreground mb-12 border-l-2 border-primary/40 pl-6 italic">
            {synthesis}
          </p>
        ) : (
          <p className="text-muted-foreground mb-12">Reading complete.</p>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate({ to: "/me" })}
            className="bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90"
          >
            Keep talking to me →
          </button>
          <button
            onClick={() => navigate({ to: "/profile" })}
            className="border hairline-strong rounded-sm px-6 py-3 text-sm font-medium hover:bg-muted/40"
          >
            See your full reading
          </button>
        </div>

      </main>
    );
  }

  if (insight) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-32">
        <p className="eyebrow mb-8">{INSIGHT_LABEL[insight.kind]}</p>
        <p className="font-serif text-2xl md:text-3xl leading-snug text-foreground mb-12 border-l-2 border-primary/40 pl-6 italic">
          {insight.text}
        </p>
        <button
          onClick={dismissInsight}
          className="bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90"
        >
          Keep going →
        </button>
      </main>
    );
  }

  if (!pairing) {
    return <main className="mx-auto max-w-2xl px-6 py-32 text-center text-muted-foreground">Loading…</main>;
  }

  if (reveal) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-32 text-center">
        <p className="eyebrow mb-8">The verdict</p>
        <p className="font-serif text-2xl md:text-3xl leading-snug mb-10 text-foreground">{reveal.verdict}</p>
        {reveal.why && (
          <>
            <p className="eyebrow mb-4">Why that mattered</p>
            <p className="font-serif italic text-xl md:text-2xl leading-snug mb-8 text-muted-foreground">{reveal.why}</p>
          </>
        )}
        {reveal.hesitation && (
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-10">{reveal.hesitation}</p>
        )}
        <button
          onClick={advance} disabled={finishing}
          className="bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {finishing ? "…" : "Next →"}
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between mb-10">
        <p className="eyebrow">Round {String(round).padStart(2, "0")} / {MAX_ROUNDS}</p>
        <div className="h-px flex-1 mx-6 bg-border" />
        <p className="eyebrow">{pairing.tests?.join(" · ") || "—"}</p>
      </div>

      <p className="display text-2xl md:text-3xl text-center mb-12 text-muted-foreground">Choose one.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border rounded-sm overflow-hidden">
        {[pairing.song_a, pairing.song_b].map((song) => (
          <button
            key={song.id} disabled={busy} onClick={() => pick(song.id)}
            className="group bg-surface p-10 md:p-14 text-left hover:bg-background transition-colors disabled:opacity-40"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-4">
              {song.lane}{song.year ? ` · ${song.year}` : ""}
            </p>
            <p className="font-serif text-3xl md:text-4xl text-foreground leading-tight mb-3">{song.title}</p>
            <p className="text-sm text-muted-foreground">{song.artist}</p>
          </button>
        ))}
      </div>
    </main>
  );
}
