import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  startSession,
  nextPairing,
  recordChoice,
  finalizeSession,
  recordEvent,
  finalSynthesis,
  currentRead,
} from "@/lib/musicdna.functions";
import { toast } from "sonner";

const MAX_ROUNDS = 6;

export const Route = createFileRoute("/_authenticated/play")({
  head: () => ({ meta: [{ title: "MusicDNA — Interview" }] }),
  component: Play,
});

type Song = { id: string; title: string; artist: string; year: number | null; lane: string };
type Pairing = {
  id: string; tests: string[]; hypothesis: string | null; why_good: string | null;
  diagnostic_weight: number; song_a: Song; song_b: Song;
};

type Entry = {
  round: number;
  pairing: Pairing;
  chosenSongId: string;
  reaction: string;     // verdict + why merged, conversational
  thesis: string;       // running hypothesis after this pick
  direction: "forming" | "holding" | "revising";
  topDim: string | null;
};

const DIR_GLYPH: Record<Entry["direction"], string> = {
  forming: "↑",
  holding: "→",
  revising: "↻",
};
const DIR_LABEL: Record<Entry["direction"], string> = {
  forming: "first read",
  holding: "holding",
  revising: "revising",
};

function Play() {
  const start = useServerFn(startSession);
  const next = useServerFn(nextPairing);
  const choose = useServerFn(recordChoice);
  const finalize = useServerFn(finalizeSession);
  const synthFn = useServerFn(finalSynthesis);
  const readFn = useServerFn(currentRead);
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
  const track = (event: EventInput) => { logEvent({ data: event } as never).catch(() => {}); };

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [kept, setKept] = useState<Array<{ tradeoff: string; examples: string[]; supporting: number; tested: number }>>([]);
  const [counters, setCounters] = useState<Array<{ claim: string; notes: string }>>([]);
  const startedAt = useRef<number>(Date.now());
  const startedRef = useRef(false);
  const pairingAnchorRef = useRef<HTMLDivElement | null>(null);
  const prevTopDim = useRef<string | null>(null);

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

  // Auto-scroll the new pairing into view when one is appended.
  useEffect(() => {
    if (pairingAnchorRef.current) {
      pairingAnchorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [pairing?.id, done]);

  async function pick(songId: string) {
    if (!pairing || !sessionId || busy) return;
    setBusy(true);
    const ms = Math.min(600000, Date.now() - startedAt.current);
    const currentPairing = pairing;
    const currentRound = round;
    try {
      const { verdict, why, dim, delta } = await choose({
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

      // Running hypothesis line.
      let thesis = "Reading you now.";
      let topDim: string | null = null;
      try {
        const r = await readFn({ data: { sessionId } });
        thesis = r.thesis;
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

      const reaction = why ? `${verdict} ${why}` : verdict;

      const entry: Entry = {
        round: currentRound,
        pairing: currentPairing,
        chosenSongId: songId,
        reaction,
        thesis,
        direction,
        topDim,
      };
      setEntries((prev) => [...prev, entry]);
      setPairing(null);

      // Load next pairing or finalize.
      const { pairing: nxt, round: nr, done: isDone } = await next({ data: { sessionId } });
      if (isDone || !nxt || nr > MAX_ROUNDS) {
        await finalize({ data: { sessionId } });
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
        setDone(true);
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

  // ---------------- DONE / report ----------------
  if (done) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20 space-y-14">
        <header className="space-y-3">
          <p className="eyebrow">the read</p>
          <h1 className="display text-3xl md:text-4xl leading-tight">What you kept choosing.</h1>
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
      </main>
    );
  }

  // ---------------- TRANSCRIPT ----------------
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-10">
      <header className="space-y-2">
        <p className="eyebrow">the interview</p>
        <h1 className="display text-2xl md:text-3xl leading-tight">
          {entries.length === 0 ? "Let's start." : "Keep going."}
        </h1>
      </header>

      {/* Past rounds */}
      <div className="space-y-10">
        {entries.map((e) => {
          const chosen = e.pairing.song_a.id === e.chosenSongId ? e.pairing.song_a : e.pairing.song_b;
          const rejected = e.pairing.song_a.id === e.chosenSongId ? e.pairing.song_b : e.pairing.song_a;
          return (
            <article key={e.round} className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Round {String(e.round).padStart(2, "0")} · {chosen.title} vs. {rejected.title} — you picked <span className="text-foreground">{chosen.title}</span>
              </p>
              <p className="font-serif text-lg md:text-xl leading-snug text-foreground">
                {e.reaction}
              </p>
              <div className="border-l-2 border-primary/40 pl-4 py-1 space-y-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  my read so far · {DIR_LABEL[e.direction]} {DIR_GLYPH[e.direction]}
                </p>
                <p className="font-serif italic text-base md:text-lg text-foreground/90 leading-snug">
                  {e.thesis}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      {/* Current pairing */}
      {pairing && (
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

      {busy && !pairing && (
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Thinking…
        </p>
      )}
    </main>
  );
}
