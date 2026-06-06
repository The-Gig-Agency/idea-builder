import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { reactToThree, refineWithTwoMore, recordEvent } from "@/lib/musicdna.functions";
import { getOnboardingOpener, type OnboardingOpener } from "@/lib/onboarding-openers.functions";
import { ensureAnonSession } from "@/lib/anon-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({ meta: [{ title: "MusicDNA — Interview" }] }),
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

const SLOT1_LABELS = [
  "The one you'd save first",
  "The one right after",
  "And one more",
];
const SLOT2_LABELS = ["Try to break my read", "And one more — go"];

const PLACEHOLDERS = [
  "Ceremony — New Order",
  "Fool's Gold — The Stone Roses",
  "Untrue — Burial",
  "Bizarre Love Triangle — New Order",
  "Pyramid Song — Radiohead",
];

type Stage =
  | "rank3"
  | "reveal3"
  | "rank2"
  | "reveal5"
  | "done";

type ThreeReact = { reaction: string; hypothesis_v1: string };
type Refined = { reaction?: string; hypothesis: string; lane: string; confidence: number };

function Onboarding() {
  const reactThreeFn = useServerFn(reactToThree);
  const refineFn = useServerFn(refineWithTwoMore);
  const logEvent = useServerFn(recordEvent);
  const getOpenerFn = useServerFn(getOnboardingOpener);
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>("rank3");
  const [three, setThree] = useState<[string, string, string]>(["", "", ""]);
  const [two, setTwo] = useState<[string, string]>(["", ""]);
  const [busy, setBusy] = useState(false);
  const [threeRead, setThreeRead] = useState<ThreeReact | null>(null);
  const [done, setDone] = useState<Refined | null>(null);
  const [revealStep, setRevealStep] = useState<0 | 1 | 2>(0);
  const [opener, setOpener] = useState<OnboardingOpener | null>(null);

  // Boot an anonymous session up front so every server fn has auth.
  const [bootError, setBootError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureAnonSession();
        const o = (await getOpenerFn()) as OnboardingOpener;
        if (cancelled) return;
        setOpener(o);
        // Log a view tied to the variant so we can compute conversion later.
        logEvent({
          data: { event_type: "onboarding_viewed", variant: o.variant_key },
        } as never).catch(() => {});
      } catch (e) {
        setBootError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Reveal choreography
  useEffect(() => {
    if (stage !== "reveal3" && stage !== "reveal5") return;
    setRevealStep(0);
    const t1 = setTimeout(() => setRevealStep(1), 350);
    const t2 = setTimeout(() => setRevealStep(2), 1100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [stage]);

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
      setStage("reveal3");
      logEvent({
        data: {
          event_type: "onboarding_three_submitted",
          variant: opener?.variant_key ?? "fallback",
        },
      } as never).catch(() => {});
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
      setDone(r);
      setStage("reveal5");
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

  if (bootError) {
    return (
      <main className="mx-auto max-w-2xl px-6 pt-24 text-center space-y-4">
        <p className="eyebrow">can't start a session</p>
        <p className="font-serif text-xl text-muted-foreground">{bootError}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 pt-16 pb-24 min-h-screen flex flex-col">
      {/* STAGE 1: rank three */}
      {stage === "rank3" && (
        <section className="space-y-10 animate-in fade-in duration-500">
          <header className="space-y-3">
            <p className="eyebrow">{opener?.eyebrow ?? "three songs · ranked"}</p>
            <h1 className="display text-4xl md:text-5xl leading-[1.05] tracking-tight whitespace-pre-line">
              {opener
                ? renderHeadline(opener.headline)
                : (
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
      )}

      {/* STAGE 2: reaction to three */}
      {stage === "reveal3" && threeRead && (
        <section className="space-y-8 animate-in fade-in duration-500">
          <RankedChecklist songs={three} startRank={1} />

          {revealStep >= 1 && (
            <p className="font-serif italic text-3xl md:text-4xl text-primary animate-in fade-in slide-in-from-bottom-2 duration-500">
              Interesting…
            </p>
          )}

          {revealStep >= 2 && (
            <>
              <p className="font-serif text-2xl md:text-3xl leading-snug text-foreground animate-in fade-in slide-in-from-bottom-2 duration-700">
                {threeRead.reaction}
              </p>
              <div className="border-l-2 border-primary/60 pl-4 py-1 animate-in fade-in duration-700">
                <p className="eyebrow mb-1">working hypothesis</p>
                <p className="font-serif text-lg italic">"{threeRead.hypothesis_v1}"</p>
              </div>
              <div className="pt-4 animate-in fade-in duration-500">
                <button
                  onClick={() => setStage("rank2")}
                  className="bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90"
                  autoFocus
                >
                  Throw me two more →
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* STAGE 3: rank two more */}
      {stage === "rank2" && threeRead && (
        <section className="space-y-10 animate-in fade-in duration-500">
          <RankedChecklist songs={three} startRank={1} muted />
          <header className="space-y-3 pt-4">
            <p className="eyebrow">two more · still ranked</p>
            <h1 className="display text-3xl md:text-4xl leading-[1.05] tracking-tight">
              Throw me two more.
              <br />
              <span className="italic text-muted-foreground">Try to break my read.</span>
            </h1>
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

      {/* STAGE 4: final reveal */}
      {stage === "reveal5" && done && (
        <section className="space-y-8 animate-in fade-in duration-500">
          <RankedChecklist songs={[...three, ...two]} startRank={1} />

          {revealStep >= 1 && done.reaction && (
            <p className="font-serif text-2xl md:text-3xl leading-snug animate-in fade-in duration-500">
              {done.reaction}
            </p>
          )}

          {revealStep >= 2 && (
            <>
              <p className="display text-3xl md:text-4xl leading-[1.1] italic text-primary animate-in fade-in duration-700">
                "{done.hypothesis}"
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2 animate-in fade-in duration-700">
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
              <div className="pt-4 flex flex-col sm:flex-row gap-3 animate-in fade-in duration-500">
                <button
                  onClick={() => navigate({ to: "/play" })}
                  className="bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90"
                  autoFocus
                >
                  Test it with side-by-sides →
                </button>
                <button
                  onClick={() => navigate({ to: "/me" })}
                  className="border hairline-strong rounded-sm px-6 py-3 text-sm font-medium hover:bg-muted/40"
                >
                  Or just talk to me →
                </button>
              </div>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                You're never really done. Save this read when you're ready.
              </p>
            </>
          )}
        </section>
      )}
    </main>
  );
}

function RankedInput({
  rank,
  label,
  value,
  placeholder,
  onChange,
  onEnter,
  autoFocus,
}: {
  rank: number;
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  return (
    <div className="grid grid-cols-[3rem_1fr] gap-4 items-baseline">
      <div className="text-right">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
          #{rank}
        </p>
      </div>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-1">
          {label}
        </p>
        <div className="border-b-2 hairline-strong focus-within:border-primary transition-colors pb-1">
          <input
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && onEnter) {
                e.preventDefault();
                onEnter();
              }
            }}
            placeholder={placeholder}
            className="w-full bg-transparent text-xl md:text-2xl font-serif italic py-2 placeholder:text-muted-foreground/40 placeholder:not-italic placeholder:font-serif focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}

function RankedChecklist({
  songs,
  startRank,
  muted,
}: {
  songs: string[];
  startRank: number;
  muted?: boolean;
}) {
  return (
    <ul className="space-y-2">
      {songs.map((s, i) => (
        <li
          key={i}
          className={`grid grid-cols-[3rem_1fr] gap-4 items-baseline ${muted ? "opacity-50" : ""}`}
        >
          <span className="text-right font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            #{startRank + i}
          </span>
          <span className="font-mono text-base md:text-lg text-foreground">✓ {s}</span>
        </li>
      ))}
    </ul>
  );
}
