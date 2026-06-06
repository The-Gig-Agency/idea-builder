import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { reactToOne, reactToThree, refineWithTwoMore, recordEvent } from "@/lib/musicdna.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Name your songs — MusicDNA" }] }),
  component: Onboarding,
});

const LANE_LABEL: Record<string, string> = {
  alternative: "Alternative",
  pop: "Pop",
  hip_hop: "Hip-Hop",
  electronic: "Electronic",
  classic_rock: "Classic Rock",
  general: "General",
};

// Evolving prompts. Each one asks for a different *facet* of taste.
const PROMPTS: string[] = [
  "Name a song you'd genuinely mourn if it disappeared tomorrow.",
  "What's one you've loved for years and still haven't outgrown?",
  "Give me one that's more about the feeling than the lyrics.",
  "What's a song you never skip — no matter the mood?",
  "Last one: a song you love that most people wouldn't expect.",
];

const PLACEHOLDERS: string[] = [
  "e.g. Ceremony — New Order",
  "e.g. Fool's Gold — The Stone Roses",
  "e.g. Untrue — Burial",
  "e.g. Bizarre Love Triangle — New Order",
  "e.g. Pyramid Song — Radiohead",
];

const NEXT_LABELS = ["Keep going →", "Next song →", "One more →", "Push me →", "Lock it in →"];

type TurnKind = "system" | "user" | "reaction" | "hypothesis" | "thinking";
type Turn = { kind: TurnKind; eyebrow?: string; text: string; italic?: boolean };

function Bubble({ turn }: { turn: Turn }) {
  const isUser = turn.kind === "user";
  const isThinking = turn.kind === "thinking";
  const eyebrow =
    turn.eyebrow ??
    (turn.kind === "user"
      ? "You"
      : turn.kind === "hypothesis"
        ? "Working hypothesis"
        : turn.kind === "thinking"
          ? "MusicDNA"
          : "MusicDNA");

  return (
    <div
      className={[
        "animate-in fade-in slide-in-from-bottom-1 duration-500",
        isUser ? "border-l-2 border-foreground/30 pl-5" : "border-l-2 border-primary/50 pl-5",
      ].join(" ")}
    >
      <p className="eyebrow mb-2">{eyebrow}</p>
      {isUser ? (
        <p className="font-mono text-base md:text-lg text-foreground">✓ {turn.text}</p>
      ) : isThinking ? (
        <p className="font-serif text-lg text-muted-foreground italic">
          <span className="inline-flex gap-1">
            <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
            <span className="animate-bounce" style={{ animationDelay: "120ms" }}>·</span>
            <span className="animate-bounce" style={{ animationDelay: "240ms" }}>·</span>
          </span>
          <span className="ml-2">{turn.text}</span>
        </p>
      ) : (
        <p
          className={`font-serif text-xl md:text-2xl leading-snug text-foreground ${
            turn.italic ? "italic" : ""
          }`}
        >
          {turn.text}
        </p>
      )}
    </div>
  );
}

function Onboarding() {
  const reactOneFn = useServerFn(reactToOne);
  const reactThreeFn = useServerFn(reactToThree);
  const refineFn = useServerFn(refineWithTwoMore);
  const logEvent = useServerFn(recordEvent);
  const navigate = useNavigate();

  const [turns, setTurns] = useState<Turn[]>([
    { kind: "system", text: "Let's read your taste." },
    { kind: "system", text: PROMPTS[0] },
  ]);
  const [songs, setSongs] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ lane: string; confidence: number; hypothesis: string } | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  // autoscroll on new turns
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, busy]);

  // keep the input focused
  useEffect(() => {
    if (!busy && !done) inputRef.current?.focus();
  }, [busy, done, turns.length]);

  const idx = songs.length; // 0..5 — which song we're about to collect
  const isFinalSong = idx === 4;
  const isPostThreeBeat = idx === 3; // after submitting #3 we pause for hypothesis
  const isLastBeforeRefine = idx === 5; // we've collected all 5

  async function handleSubmit() {
    const value = input.trim();
    if (value.length < 2 || busy || done) return;

    setBusy(true);
    const nextSongs = [...songs, value];
    setSongs(nextSongs);
    setInput("");

    // optimistic user turn + thinking placeholder
    setTurns((t) => [
      ...t,
      { kind: "user", text: value },
      { kind: "thinking", text: "reading…" },
    ]);

    try {
      if (nextSongs.length < 3) {
        // micro reaction, then next prompt
        const r = await reactOneFn({
          data: { song: value, index: nextSongs.length - 1, priorSongs: songs },
        });
        setTurns((t) => {
          const trimmed = t.filter((x) => x.kind !== "thinking");
          return [
            ...trimmed,
            { kind: "reaction", text: r.text },
            { kind: "system", text: PROMPTS[nextSongs.length] },
          ];
        });
      } else if (nextSongs.length === 3) {
        // first big beat — react to 3 + working hypothesis, THEN next prompt
        const r = await reactThreeFn({ data: { songs: nextSongs as [string, string, string] } });
        setTurns((t) => {
          const trimmed = t.filter((x) => x.kind !== "thinking");
          return [
            ...trimmed,
            { kind: "reaction", text: r.reaction },
            { kind: "hypothesis", text: `"${r.hypothesis_v1}"`, italic: true },
            { kind: "system", text: PROMPTS[3] },
          ];
        });
      } else if (nextSongs.length === 4) {
        // micro reaction then last prompt
        const r = await reactOneFn({
          data: { song: value, index: 3, priorSongs: songs },
        });
        setTurns((t) => {
          const trimmed = t.filter((x) => x.kind !== "thinking");
          return [
            ...trimmed,
            { kind: "reaction", text: r.text },
            { kind: "system", text: PROMPTS[4] },
          ];
        });
      } else {
        // nextSongs.length === 5 — final refine
        const r = await refineFn({
          data: {
            firstThree: nextSongs.slice(0, 3),
            twoMore: nextSongs.slice(3, 5),
          },
        } as never);
        const refined = r as {
          reaction?: string;
          hypothesis: string;
          lane: string;
          confidence: number;
          reasoning?: string[];
        };
        setTurns((t) => {
          const trimmed = t.filter((x) => x.kind !== "thinking");
          const extra: Turn[] = [];
          if (refined.reaction) extra.push({ kind: "reaction", text: refined.reaction });
          extra.push({
            kind: "hypothesis",
            eyebrow: "Refined hypothesis",
            text: `"${refined.hypothesis}"`,
            italic: true,
          });
          return [...trimmed, ...extra];
        });
        setDone({ lane: refined.lane, confidence: refined.confidence, hypothesis: refined.hypothesis });
        logEvent({
          data: {
            event_type: "onboarding_classified",
            props: { lane: refined.lane, confidence: refined.confidence, song_count: 5 },
          },
        } as never).catch(() => {});
      }
    } catch (e) {
      setTurns((t) => t.filter((x) => x.kind !== "thinking"));
      // rollback the song since we couldn't process it
      setSongs(songs);
      toast.error(e instanceof Error ? e.message : "Couldn't read that one.");
    } finally {
      setBusy(false);
    }
  }

  const nextLabel = busy
    ? "Listening…"
    : NEXT_LABELS[Math.min(idx, NEXT_LABELS.length - 1)];

  return (
    <main className="mx-auto max-w-2xl px-6 pt-12 pb-40 space-y-10">
      <header>
        <p className="eyebrow mb-3">MusicDNA</p>
        <h1 className="display text-3xl md:text-4xl">A short conversation.</h1>
      </header>

      <div className="space-y-7">
        {turns.map((t, i) => (
          <Bubble key={i} turn={t} />
        ))}
        <div ref={endRef} />
      </div>

      {/* Done — show lane + CTA */}
      {done && (
        <section className="space-y-5 border-l-2 border-primary/50 pl-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Lane</span>
            <span className="border hairline-strong rounded-sm px-3 py-1 text-sm font-medium">
              {LANE_LABEL[done.lane] ?? done.lane}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {Math.round(done.confidence * 100)}% confidence
            </span>
          </div>
          <div className="pt-2">
            <button
              onClick={() => navigate({ to: "/play" })}
              className="bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90"
            >
              Let's test that →
            </button>
          </div>
        </section>
      )}

      {/* Single input — the conversation's composer */}
      {!done && (
        <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-background via-background to-transparent pt-10 pb-6">
          <div className="mx-auto max-w-2xl px-6">
            <div className="flex items-center gap-3 border hairline-strong rounded-sm bg-surface px-4 py-2 focus-within:border-primary transition-colors">
              <span className="font-mono text-xs text-muted-foreground w-6">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <input
                ref={inputRef}
                value={input}
                disabled={busy}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={PLACEHOLDERS[Math.min(idx, PLACEHOLDERS.length - 1)]}
                className="flex-1 bg-transparent py-2 text-base font-serif placeholder:text-muted-foreground/50 placeholder:font-sans placeholder:text-sm focus:outline-none disabled:opacity-60"
                autoFocus
              />
              <button
                onClick={handleSubmit}
                disabled={busy || input.trim().length < 2}
                className="bg-primary text-primary-foreground rounded-sm px-4 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-40 whitespace-nowrap"
              >
                {nextLabel}
              </button>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mt-2 pl-9">
              {isLastBeforeRefine
                ? "Locking it in…"
                : isPostThreeBeat
                  ? "Two more — go somewhere different."
                  : isFinalSong
                    ? "One more after this."
                    : `Song ${idx + 1} of 5 · enter to send`}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
