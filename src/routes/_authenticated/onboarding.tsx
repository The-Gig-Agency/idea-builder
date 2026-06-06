import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { analyzeOpeningSongs, recordEvent } from "@/lib/musicdna.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Five songs — MusicDNA" }] }),
  component: Onboarding,
});

type Analysis = {
  lane: string;
  confidence: number;
  secondary_lanes: string[];
  reasoning: string[];
  hypothesis: string;
};

const LANE_LABEL: Record<string, string> = {
  alternative: "Alternative",
  pop: "Pop",
  hip_hop: "Hip-Hop",
  electronic: "Electronic",
  classic_rock: "Classic Rock",
  general: "General",
};

function Onboarding() {
  const fn = useServerFn(analyzeOpeningSongs);
  const logEvent = useServerFn(recordEvent);
  const navigate = useNavigate();
  const [picks, setPicks] = useState<string[]>(["", "", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  function update(i: number, v: string) {
    setPicks(picks.map((p, idx) => (idx === i ? v : p)));
  }

  async function submit() {
    const cleaned = picks.map((p) => p.trim());
    if (cleaned.some((p) => p.length < 2)) {
      toast.error("Name all five.");
      return;
    }
    setBusy(true);
    try {
      const result = await fn({ data: { songs: cleaned } });
      setAnalysis(result as Analysis);
      logEvent({
        data: {
          event_type: "onboarding_classified",
          props: {
            lane: result.lane,
            confidence: result.confidence,
            secondary_lanes: result.secondary_lanes,
            song_count: cleaned.length,
          },
        },
      } as never).catch(() => { /* swallow */ });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to read your songs.");
    } finally {
      setBusy(false);
    }
  }

  if (analysis) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20">
        <p className="eyebrow mb-8">Opening hypothesis</p>
        <p className="font-serif text-3xl md:text-4xl leading-snug text-foreground">"{analysis.hypothesis}"</p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Lane</span>
          <span className="border hairline-strong rounded-sm px-3 py-1 text-sm font-medium">
            {LANE_LABEL[analysis.lane] ?? analysis.lane}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {Math.round(analysis.confidence * 100)}% confidence
          </span>
        </div>
        {analysis.reasoning.length > 0 && (
          <ul className="mt-6 text-sm text-muted-foreground space-y-1 max-w-xl">
            {analysis.reasoning.map((r, i) => <li key={i}>— {r}</li>)}
          </ul>
        )}
        <p className="mt-10 text-sm text-muted-foreground max-w-xl">
          That's a guess from five songs. The matchups will test it.
        </p>
        <button
          onClick={() => navigate({ to: "/play" })}
          className="mt-10 bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90"
        >
          Begin the matchups →
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <p className="eyebrow mb-8">Step one of two</p>
      <h1 className="display text-4xl md:text-5xl mb-4">Name five songs you love.</h1>
      <p className="text-sm text-muted-foreground mb-10 max-w-lg">
        Not the most popular ones. The ones that, if you lost them, you'd feel it. Type them however you want — "Song — Artist" works best.
      </p>

      <ol className="space-y-2">
        {picks.map((p, i) => (
          <li key={i} className="flex items-center gap-4 border hairline-strong rounded-sm bg-surface px-4 py-2 focus-within:border-primary transition-colors">
            <span className="font-mono text-xs text-muted-foreground w-6">{String(i + 1).padStart(2, "0")}</span>
            <input
              value={p}
              onChange={(e) => update(i, e.target.value)}
              placeholder="e.g. Ceremony — New Order"
              className="flex-1 bg-transparent py-1.5 text-base font-serif placeholder:text-muted-foreground/50 placeholder:font-sans placeholder:text-sm focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && i < 4) {
                  e.preventDefault();
                  const next = document.querySelectorAll<HTMLInputElement>('main input')[i + 1];
                  next?.focus();
                }
              }}
            />
          </li>
        ))}
      </ol>

      <button
        onClick={submit}
        disabled={busy || picks.some((p) => p.trim().length < 2)}
        className="mt-8 bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-40"
      >
        {busy ? "Reading…" : "Read these"}
      </button>
    </main>
  );
}
