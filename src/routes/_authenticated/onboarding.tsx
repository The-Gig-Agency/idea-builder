import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { reactToThree, refineWithTwoMore, recordEvent } from "@/lib/musicdna.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Name your songs — MusicDNA" }] }),
  component: Onboarding,
});

type Stage = "three" | "two" | "locked";

type ReactResult = {
  reaction: string;
  hypothesis_v1: string;
  lane_guess: string;
  confidence: number;
  suspected_dimensions: string[];
};

type FinalResult = {
  reaction?: string;
  hypothesis: string;
  lane: string;
  confidence: number;
  reasoning: string[];
};

const LANE_LABEL: Record<string, string> = {
  alternative: "Alternative",
  pop: "Pop",
  hip_hop: "Hip-Hop",
  electronic: "Electronic",
  classic_rock: "Classic Rock",
  general: "General",
};

function ChatBubble({ eyebrow, body, italic = false }: { eyebrow: string; body: string; italic?: boolean }) {
  return (
    <div className="border-l-2 border-primary/40 pl-5 py-1 animate-in fade-in slide-in-from-left-2 duration-500">
      <p className="eyebrow mb-2">{eyebrow}</p>
      <p className={`font-serif text-xl md:text-2xl leading-snug text-foreground ${italic ? "italic" : ""}`}>
        {body}
      </p>
    </div>
  );
}

function Onboarding() {
  const reactFn = useServerFn(reactToThree);
  const refineFn = useServerFn(refineWithTwoMore);
  const logEvent = useServerFn(recordEvent);
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>("three");
  const [threeInputs, setThreeInputs] = useState<string[]>(["", "", ""]);
  const [twoInputs, setTwoInputs] = useState<string[]>(["", ""]);
  const [react1, setReact1] = useState<ReactResult | null>(null);
  const [final, setFinal] = useState<FinalResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitThree() {
    const cleaned = threeInputs.map((s) => s.trim());
    if (cleaned.some((s) => s.length < 2)) { toast.error("Name all three."); return; }
    setBusy(true);
    try {
      const r = (await reactFn({ data: { songs: cleaned } })) as ReactResult;
      setReact1(r);
      setStage("two");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read those three.");
    } finally {
      setBusy(false);
    }
  }

  async function submitTwo() {
    const three = threeInputs.map((s) => s.trim());
    const two = twoInputs.map((s) => s.trim());
    if (two.some((s) => s.length < 2)) { toast.error("Name both."); return; }
    setBusy(true);
    try {
      const r = (await refineFn({
        data: { firstThree: three, twoMore: two, hypothesis_v1: react1?.hypothesis_v1 },
      })) as FinalResult;
      setFinal(r);
      setStage("locked");
      logEvent({
        data: {
          event_type: "onboarding_classified",
          props: { lane: r.lane, confidence: r.confidence, song_count: 5 },
        },
      } as never).catch(() => {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't refine.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 space-y-10">
      <header>
        <p className="eyebrow mb-3">A short conversation</p>
        <h1 className="display text-3xl md:text-4xl">Let's read your taste.</h1>
        <p className="text-sm text-muted-foreground mt-3 max-w-lg">
          Not a quiz. Five songs, two beats, one working hypothesis. Then the matchups stress-test it.
        </p>
      </header>

      {/* Step A — three songs */}
      <section className="space-y-5">
        <ChatBubble eyebrow="Me" body="Name three songs you love. Not the popular ones — the ones you'd feel the loss of." />
        <ol className="space-y-2">
          {threeInputs.map((p, i) => (
            <li key={i} className="flex items-center gap-4 border hairline-strong rounded-sm bg-surface px-4 py-2 focus-within:border-primary transition-colors">
              <span className="font-mono text-xs text-muted-foreground w-6">{String(i + 1).padStart(2, "0")}</span>
              <input
                value={p}
                disabled={stage !== "three"}
                onChange={(e) => setThreeInputs(threeInputs.map((v, idx) => (idx === i ? e.target.value : v)))}
                placeholder='e.g. Ceremony — New Order'
                className="flex-1 bg-transparent py-1.5 text-base font-serif placeholder:text-muted-foreground/50 placeholder:font-sans placeholder:text-sm focus:outline-none disabled:opacity-60"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && stage === "three") {
                    e.preventDefault();
                    if (i < 2) {
                      const next = document.querySelectorAll<HTMLInputElement>('main input')[i + 1];
                      next?.focus();
                    } else submitThree();
                  }
                }}
              />
            </li>
          ))}
        </ol>
        {stage === "three" && (
          <button
            onClick={submitThree}
            disabled={busy || threeInputs.some((s) => s.trim().length < 2)}
            className="bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Reading…" : "Hand them over →"}
          </button>
        )}
      </section>

      {/* Step B — reaction + two more */}
      {react1 && (
        <section className="space-y-5">
          <ChatBubble eyebrow="MusicDNA" body={react1.reaction} />
          <ChatBubble eyebrow="Working hypothesis" body={`"${react1.hypothesis_v1}"`} italic />
          <ChatBubble eyebrow="Me" body="Now two more — go somewhere else. Push me. Pick songs that don't sit next to those first three." />
          <ol className="space-y-2">
            {twoInputs.map((p, i) => (
              <li key={i} className="flex items-center gap-4 border hairline-strong rounded-sm bg-surface px-4 py-2 focus-within:border-primary transition-colors">
                <span className="font-mono text-xs text-muted-foreground w-6">{String(i + 4).padStart(2, "0")}</span>
                <input
                  value={p}
                  disabled={stage !== "two"}
                  onChange={(e) => setTwoInputs(twoInputs.map((v, idx) => (idx === i ? e.target.value : v)))}
                  placeholder="something different from the first three"
                  className="flex-1 bg-transparent py-1.5 text-base font-serif placeholder:text-muted-foreground/50 placeholder:font-sans placeholder:text-sm focus:outline-none disabled:opacity-60"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && stage === "two") {
                      e.preventDefault();
                      if (i < 1) {
                        const inputs = document.querySelectorAll<HTMLInputElement>('main input');
                        inputs[3 + i + 1]?.focus();
                      } else submitTwo();
                    }
                  }}
                />
              </li>
            ))}
          </ol>
          {stage === "two" && (
            <button
              onClick={submitTwo}
              disabled={busy || twoInputs.some((s) => s.trim().length < 2)}
              className="bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Listening…" : "Throw them at me →"}
            </button>
          )}
        </section>
      )}

      {/* Step C — locked */}
      {final && (
        <section className="space-y-5">
          {final.reaction && <ChatBubble eyebrow="MusicDNA" body={final.reaction} />}
          <ChatBubble eyebrow="Refined hypothesis" body={`"${final.hypothesis}"`} italic />
          <div className="flex flex-wrap items-center gap-3 pl-5">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Lane</span>
            <span className="border hairline-strong rounded-sm px-3 py-1 text-sm font-medium">
              {LANE_LABEL[final.lane] ?? final.lane}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {Math.round(final.confidence * 100)}% confidence
            </span>
          </div>
          {final.reasoning?.length > 0 && (
            <ul className="text-sm text-muted-foreground space-y-1 max-w-xl pl-5">
              {final.reasoning.map((r, i) => <li key={i}>— {r}</li>)}
            </ul>
          )}
          <div className="pl-5 pt-4">
            <button
              onClick={() => navigate({ to: "/play" })}
              className="bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90"
            >
              Begin the matchups →
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
