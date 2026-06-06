import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { startSession, nextPairing, recordChoice, finalizeSession, recordEvent } from "@/lib/musicdna.functions";
import { toast } from "sonner";

const MAX_ROUNDS = 20;

export const Route = createFileRoute("/_authenticated/play")({
  head: () => ({ meta: [{ title: "Choose one — MusicDNA" }] }),
  component: Play,
});

type Song = { id: string; title: string; artist: string; year: number | null; lane: string };
type Pairing = {
  id: string; tests: string[]; hypothesis: string | null; why_good: string | null;
  diagnostic_weight: number; song_a: Song; song_b: Song;
};

function Play() {
  const start = useServerFn(startSession);
  const next = useServerFn(nextPairing);
  const choose = useServerFn(recordChoice);
  const finalize = useServerFn(finalizeSession);
  const logEvent = useServerFn(recordEvent);
  const navigate = useNavigate();

  // Fire-and-forget logger — never blocks UX
  type EventInput = {
    event_type: "onboarding_classified" | "pairing_shown" | "choice_made" | "reveal_shown" | "reveal_continued" | "session_completed" | "result_viewed" | "result_shared" | "session_quit";
    session_id?: string | null;
    pairing_id?: string | null;
    choice_id?: string | null;
    response_time_ms?: number | null;
    props?: Record<string, unknown>;
  };
  const track = (event: EventInput) => {
    logEvent({ data: event } as never).catch(() => { /* swallow */ });
  };

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [reveal, setReveal] = useState<{ verdict: string; why: string; hesitation: string | null } | null>(null);
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
      const { pairing: nxt, round: nr, done } = await next({ data: { sessionId } });
      if (done || !nxt || nr > MAX_ROUNDS) {
        await finalize({ data: { sessionId } });
        track({ event_type: "session_completed", session_id: sessionId, props: { rounds: nr } });
        setDone(true);
        return;
      }
      setPairing(nxt as unknown as Pairing);
      setRound(nr);
      setReveal(null);
      startedAt.current = Date.now();
      shownAt.current = Date.now();
      track({
        event_type: "pairing_shown",
        session_id: sessionId,
        pairing_id: (nxt as unknown as Pairing).id,
        props: { round: nr, tests: (nxt as unknown as Pairing).tests },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load next.");
    } finally {
      setBusy(false);
      setFinishing(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-32 text-center">
        <p className="eyebrow mb-8">Reading complete</p>
        <h1 className="display text-4xl md:text-5xl mb-10">Your MusicDNA is ready.</h1>
        <button
          onClick={() => navigate({ to: "/profile" })}
          className="bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90"
        >
          See your reading →
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

