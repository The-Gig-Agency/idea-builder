import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { reactToOne, reactToThree, refineWithTwoMore, recordEvent } from "@/lib/musicdna.functions";
import { getActiveDecadePrompt } from "@/lib/decade-prompts.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "MusicDNA" }] }),
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

// Short, momentum-building prompts. The first one carries the weight,
// the rest get tighter as the conversation finds its rhythm.
const PROMPTS: string[] = [
  "What song would you genuinely mourn?",
  "What song never gets old?",
  "What one feels bigger than itself?",
  "What's your sleeper pick?",
  "What song explains you best?",
];

const PLACEHOLDERS: string[] = [
  "Ceremony — New Order",
  "Fool's Gold — The Stone Roses",
  "Untrue — Burial",
  "Bizarre Love Triangle — New Order",
  "Pyramid Song — Radiohead",
];

type Exchange = {
  prompt: string;
  song: string;
  reaction?: string;
  hypothesis?: string; // shown only after song #3
};

function Onboarding() {
  const reactOneFn = useServerFn(reactToOne);
  const reactThreeFn = useServerFn(reactToThree);
  const refineFn = useServerFn(refineWithTwoMore);
  const logEvent = useServerFn(recordEvent);
  const navigate = useNavigate();

  const [history, setHistory] = useState<Exchange[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [reactingTo, setReactingTo] = useState<string | null>(null); // shown live above input while LLM responds
  const [done, setDone] = useState<{
    lane: string;
    confidence: number;
    hypothesis: string;
    reaction?: string;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const idx = history.length; // 0..5 — which song we're collecting next

  // keep input focused
  useEffect(() => {
    if (!busy && !done) inputRef.current?.focus();
  }, [busy, done, idx]);

  async function handleSubmit() {
    const value = input.trim();
    if (value.length < 2 || busy || done) return;

    const currentIdx = idx;
    const currentPrompt = PROMPTS[currentIdx];
    setBusy(true);
    setReactingTo(value);
    setInput("");

    try {
      let reaction = "";
      let hypothesis: string | undefined;

      if (currentIdx < 2) {
        const r = await reactOneFn({
          data: {
            song: value,
            index: currentIdx,
            priorSongs: history.map((h) => h.song),
          },
        });
        reaction = r.text;
      } else if (currentIdx === 2) {
        // first big beat — react to all 3 and form working hypothesis
        const songs = [...history.map((h) => h.song), value] as [string, string, string];
        const r = await reactThreeFn({ data: { songs } });
        reaction = r.reaction;
        hypothesis = r.hypothesis_v1;
      } else if (currentIdx === 3) {
        const r = await reactOneFn({
          data: { song: value, index: 3, priorSongs: history.map((h) => h.song) },
        });
        reaction = r.text;
      } else {
        // currentIdx === 4 — final refine, lock in
        const allSongs = [...history.map((h) => h.song), value];
        const r = await refineFn({
          data: {
            firstThree: allSongs.slice(0, 3),
            twoMore: allSongs.slice(3, 5),
          },
        } as never);
        const refined = r as {
          reaction?: string;
          hypothesis: string;
          lane: string;
          confidence: number;
        };
        reaction = refined.reaction ?? "That's enough. I've got a read.";

        setHistory((h) => [...h, { prompt: currentPrompt, song: value, reaction }]);
        setReactingTo(null);
        setDone({
          lane: refined.lane,
          confidence: refined.confidence,
          hypothesis: refined.hypothesis,
          reaction: refined.reaction,
        });
        logEvent({
          data: {
            event_type: "onboarding_classified",
            props: { lane: refined.lane, confidence: refined.confidence, song_count: 5 },
          },
        } as never).catch(() => {});
        return;
      }

      setHistory((h) => [...h, { prompt: currentPrompt, song: value, reaction, hypothesis }]);
      setReactingTo(null);
    } catch (e) {
      setReactingTo(null);
      setInput(value); // put it back so the user doesn't lose it
      toast.error(e instanceof Error ? e.message : "Couldn't read that one.");
    } finally {
      setBusy(false);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────
  // Top of the page = the live moment (current question + input + reaction-in-flight).
  // Below = the conversation log, most-recent-first, fading as it ages.

  const activePrompt = done ? null : PROMPTS[idx];
  const counter = `${String(Math.min(idx + 1, 5)).padStart(2, "0")} / 05`;

  return (
    <main className="mx-auto max-w-2xl px-6 pt-16 pb-24 min-h-screen flex flex-col">
      {/* ACTIVE MOMENT — pinned at the top of the visual field */}
      {activePrompt && (
        <section className="space-y-6 animate-in fade-in duration-700">
          <div className="flex items-baseline justify-between">
            <p className="eyebrow">{counter}</p>
            {history.length > 0 && (
              <p className="eyebrow text-muted-foreground">listening</p>
            )}
          </div>

          {/* The question — big, serif, no avatar, no header. It's just there. */}
          <h1
            key={idx}
            className="display text-4xl md:text-5xl leading-[1.05] tracking-tight animate-in fade-in slide-in-from-bottom-1 duration-500"
          >
            {activePrompt}
          </h1>

          {/* Input directly under the question — short trip for the eye */}
          <div className="border-b-2 hairline-strong focus-within:border-primary transition-colors pb-1">
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
              className="w-full bg-transparent text-2xl md:text-3xl font-serif italic py-2 placeholder:text-muted-foreground/40 placeholder:not-italic placeholder:font-serif focus:outline-none disabled:opacity-50"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <p className="font-mono uppercase tracking-[0.22em] text-muted-foreground">
              {busy
                ? "thinking…"
                : input.trim().length >= 2
                  ? "press enter"
                  : idx === 0
                    ? "start anywhere"
                    : "keep going"}
            </p>
            {busy && (
              <span className="inline-flex gap-1 text-primary">
                <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: "120ms" }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: "240ms" }}>·</span>
              </span>
            )}
          </div>

          {/* Reaction-in-flight: the song the user just submitted, with thinking dots */}
          {reactingTo && (
            <div className="pt-2 animate-in fade-in slide-in-from-bottom-1 duration-300">
              <p className="font-mono text-sm text-foreground/70">✓ {reactingTo}</p>
            </div>
          )}
        </section>
      )}

      {/* FINAL BEAT */}
      {done && (
        <section className="space-y-8 animate-in fade-in duration-700">
          <p className="eyebrow">that's enough</p>
          {done.reaction && (
            <p className="font-serif text-2xl md:text-3xl leading-snug">{done.reaction}</p>
          )}
          <p className="display text-3xl md:text-4xl leading-[1.1] italic text-primary">
            "{done.hypothesis}"
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Lane
            </span>
            <span className="border hairline-strong rounded-sm px-3 py-1 text-sm font-medium">
              {LANE_LABEL[done.lane] ?? done.lane}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {Math.round(done.confidence * 100)}% confidence
            </span>
          </div>
          <div className="pt-4">
            <button
              onClick={() => navigate({ to: "/play" })}
              className="bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90"
            >
              Let's test that →
            </button>
          </div>
        </section>
      )}

      {/* CONVERSATION LOG — newest first, fading as it ages */}
      {history.length > 0 && (
        <section className="mt-16 pt-10 border-t hairline space-y-10">
          {[...history].reverse().map((h, revIdx) => {
            const age = revIdx; // 0 = most recent
            // fade older entries so the eye stays at the top
            const opacity = Math.max(0.35, 1 - age * 0.18);
            return (
              <article
                key={history.length - 1 - revIdx}
                style={{ opacity }}
                className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-500"
              >
                <p className="eyebrow text-muted-foreground">
                  {String(history.length - revIdx).padStart(2, "0")} · {h.prompt}
                </p>
                <p className="font-mono text-base md:text-lg text-foreground">✓ {h.song}</p>
                {h.reaction && (
                  <p className="font-serif text-xl md:text-2xl leading-snug italic text-primary/90">
                    {h.reaction}
                  </p>
                )}
                {h.hypothesis && (
                  <div className="mt-3 border-l-2 border-primary/60 pl-4 py-1">
                    <p className="eyebrow mb-1">working hypothesis</p>
                    <p className="font-serif text-lg italic">"{h.hypothesis}"</p>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
