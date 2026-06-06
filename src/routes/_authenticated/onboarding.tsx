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

// Short, momentum-building prompts. Song #1 is decade-specific (loaded from
// the decade_opening_prompts table, admin-editable). #2–#5 stay constant.
// MVP decade = 80s. Other decades will plug in via subdomains later.
const ONBOARDING_DECADE = "80s" as const;
const FOLLOWUP_PROMPTS: string[] = [
  "What song never gets old?",
  "What one feels bigger than itself?",
  "What's your sleeper pick?",
  "What song explains you best?",
];
const FALLBACK_OPENER = "What song still sounds like the future?";

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
  const fetchOpener = useServerFn(getActiveDecadePrompt);
  const navigate = useNavigate();

  // Decade-specific opening question (admin-editable). Falls back to a known-good prompt.
  const openerQuery = useQuery({
    queryKey: ["decade-prompt", ONBOARDING_DECADE],
    queryFn: () => fetchOpener({ data: { decade: ONBOARDING_DECADE } }),
    staleTime: 5 * 60_000,
  });
  const opener = openerQuery.data?.text || FALLBACK_OPENER;
  const PROMPTS: string[] = [opener, ...FOLLOWUP_PROMPTS];

  const [history, setHistory] = useState<Exchange[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  // After a submit we enter a multi-beat REVEAL phase. The question is hidden;
  // we show ✓ song → "Interesting…" → the observation → a Next button.
  // The eye stays put. The reaction IS the reward.
  type RevealStage = "thinking" | "preamble" | "observation";
  type Pending = {
    prompt: string;
    song: string;
    reaction?: string;
    hypothesis?: string;
    stage: RevealStage;
    // If this submit closes the run, we hold the final payload until user clicks "See it".
    final?: { lane: string; confidence: number; hypothesis: string; reaction?: string };
  };
  const [pending, setPending] = useState<Pending | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const idx = history.length; // 0..5 — which song we're collecting next

  // keep input focused when a question is showing
  useEffect(() => {
    if (!busy && !pending) inputRef.current?.focus();
  }, [busy, pending, idx]);

  // Reveal choreography: once the reaction is in, walk through preamble → observation
  useEffect(() => {
    if (!pending) return;
    if (pending.stage === "thinking" && pending.reaction) {
      const t1 = setTimeout(() => setPending((p) => (p ? { ...p, stage: "preamble" } : p)), 350);
      return () => clearTimeout(t1);
    }
    if (pending.stage === "preamble") {
      const t2 = setTimeout(() => setPending((p) => (p ? { ...p, stage: "observation" } : p)), 750);
      return () => clearTimeout(t2);
    }
  }, [pending]);

  async function handleSubmit() {
    const value = input.trim();
    if (value.length < 2 || busy || pending) return;

    const currentIdx = idx;
    const currentPrompt = PROMPTS[currentIdx];
    setBusy(true);
    setInput("");
    // immediately enter reveal — show ✓ song while we wait on the LLM
    setPending({ prompt: currentPrompt, song: value, stage: "thinking" });

    try {
      if (currentIdx < 2) {
        const r = await reactOneFn({
          data: { song: value, index: currentIdx, priorSongs: history.map((h) => h.song) },
        });
        setPending((p) => (p ? { ...p, reaction: r.text } : p));
      } else if (currentIdx === 2) {
        const songs = [...history.map((h) => h.song), value] as [string, string, string];
        const r = await reactThreeFn({ data: { songs } });
        setPending((p) => (p ? { ...p, reaction: r.reaction, hypothesis: r.hypothesis_v1 } : p));
      } else if (currentIdx === 3) {
        const r = await reactOneFn({
          data: { song: value, index: 3, priorSongs: history.map((h) => h.song) },
        });
        setPending((p) => (p ? { ...p, reaction: r.text } : p));
      } else {
        // final — refine + lock
        const allSongs = [...history.map((h) => h.song), value];
        const r = (await refineFn({
          data: {
            firstThree: allSongs.slice(0, 3),
            twoMore: allSongs.slice(3, 5),
          },
        } as never)) as { reaction?: string; hypothesis: string; lane: string; confidence: number };
        const reaction = r.reaction ?? "That's enough. I've got a read.";
        setPending((p) =>
          p ? { ...p, reaction, final: { lane: r.lane, confidence: r.confidence, hypothesis: r.hypothesis, reaction: r.reaction } } : p,
        );
        logEvent({
          data: {
            event_type: "onboarding_classified",
            props: { lane: r.lane, confidence: r.confidence, song_count: 5 },
          },
        } as never).catch(() => {});
      }
    } catch (e) {
      setPending(null);
      setInput(value);
      toast.error(e instanceof Error ? e.message : "Couldn't read that one.");
    } finally {
      setBusy(false);
    }
  }

  function commitAndAdvance() {
    if (!pending || !pending.reaction) return;
    if (pending.final) {
      // last beat — push to history then show payoff
      setHistory((h) => [
        ...h,
        { prompt: pending.prompt, song: pending.song, reaction: pending.reaction },
      ]);
      setDone(pending.final);
      setPending(null);
      return;
    }
    setHistory((h) => [
      ...h,
      {
        prompt: pending.prompt,
        song: pending.song,
        reaction: pending.reaction,
        hypothesis: pending.hypothesis,
      },
    ]);
    setPending(null);
  }

  const [done, setDone] = useState<{
    lane: string;
    confidence: number;
    hypothesis: string;
    reaction?: string;
  } | null>(null);

  // ──────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────

  const showingQuestion = !done && !pending;
  const activePrompt = showingQuestion ? PROMPTS[idx] : null;
  const counter = `${String(Math.min(idx + 1, 5)).padStart(2, "0")} / 05`;
  const isFinalPending = pending?.final != null;
  const nextLabel = isFinalPending ? "See what I think →" : idx + 1 >= 5 ? "Finish →" : "Next question →";

  return (
    <main className="mx-auto max-w-2xl px-6 pt-16 pb-24 min-h-screen flex flex-col">
      {/* CONVERSATION LOG — oldest first, fading as it ages */}
      {history.length > 0 && !done && (
        <section className="space-y-10 mb-12">
          {history.map((h, i) => {
            const age = history.length - 1 - i;
            const opacity = Math.max(0.35, 1 - age * 0.18);
            return (
              <article
                key={i}
                style={{ opacity }}
                className="space-y-2 animate-in fade-in slide-in-from-bottom-1 duration-500"
              >
                <p className="eyebrow text-muted-foreground">
                  {String(i + 1).padStart(2, "0")} · {h.prompt}
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

      {/* ACTIVE QUESTION */}
      {activePrompt && (
        <section className="space-y-6 animate-in fade-in duration-700">
          <div className="flex items-baseline justify-between">
            <p className="eyebrow">{counter}</p>
            {history.length > 0 && (
              <p className="eyebrow text-muted-foreground">listening</p>
            )}
          </div>

          <h1
            key={idx}
            className="display text-4xl md:text-5xl leading-[1.05] tracking-tight animate-in fade-in slide-in-from-bottom-1 duration-500"
          >
            {activePrompt}
          </h1>

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

          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            {input.trim().length >= 2 ? "press enter" : idx === 0 ? "start anywhere" : "keep going"}
          </p>
        </section>
      )}

      {/* REVEAL — replaces the question while the AI reacts */}
      {pending && (
        <section className="space-y-8 animate-in fade-in duration-500">
          <p className="eyebrow">{counter}</p>

          {/* ✓ song — appears instantly */}
          <p className="font-mono text-lg md:text-xl text-foreground animate-in fade-in slide-in-from-bottom-1 duration-300">
            ✓ {pending.song}
          </p>

          {/* thinking dots while we wait */}
          {pending.stage === "thinking" && (
            <p className="font-mono text-sm uppercase tracking-[0.22em] text-muted-foreground inline-flex items-center gap-2">
              listening
              <span className="inline-flex gap-1 text-primary">
                <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: "120ms" }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: "240ms" }}>·</span>
              </span>
            </p>
          )}

          {/* preamble — "Interesting…" lands first, alone */}
          {(pending.stage === "preamble" || pending.stage === "observation") && (
            <p className="font-serif italic text-3xl md:text-4xl text-primary animate-in fade-in slide-in-from-bottom-2 duration-500">
              Interesting…
            </p>
          )}

          {/* the observation — the reward */}
          {pending.stage === "observation" && pending.reaction && (
            <p className="font-serif text-2xl md:text-3xl leading-snug text-foreground animate-in fade-in slide-in-from-bottom-2 duration-700">
              {pending.reaction}
            </p>
          )}

          {/* working hypothesis after song #3 */}
          {pending.stage === "observation" && pending.hypothesis && (
            <div className="border-l-2 border-primary/60 pl-4 py-1 animate-in fade-in duration-700">
              <p className="eyebrow mb-1">working hypothesis</p>
              <p className="font-serif text-lg italic">"{pending.hypothesis}"</p>
            </div>
          )}

          {/* Next */}
          {pending.stage === "observation" && (
            <div className="pt-4 animate-in fade-in duration-500">
              <button
                onClick={commitAndAdvance}
                className="bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90"
                autoFocus
              >
                {nextLabel}
              </button>
            </div>
          )}
        </section>
      )}

      {/* FINAL PAYOFF */}
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
    </main>
  );
}
