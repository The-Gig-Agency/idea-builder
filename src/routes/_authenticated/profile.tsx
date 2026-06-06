import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { getMyResult } from "@/lib/musicdna.functions";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Your reading — MusicDNA" }] }),
  errorComponent: ({ error }) => (
    <div className="px-6 py-20 text-muted-foreground">Couldn't load: {error.message}</div>
  ),
  component: () => (
    <Suspense fallback={<div className="px-6 py-20 text-muted-foreground">Loading…</div>}>
      <ProfilePage />
    </Suspense>
  ),
});

const DIMS = [
  "movement","atmosphere","groove","darkness","hope","nostalgia","transformation",
  "complexity","melody","verbal_cleverness","authenticity","romanticism","energy",
  "dreaminess","community",
];

type Claim = {
  dimension: string;
  preferred?: string;
  opposed?: string;
  supporting_choices: number;
  tested_total: number;
  confidence: number;
  examples?: Array<{ chosen: string; rejected: string; delta: number }>;
  tradeoff: string;
};
type Counter = { claim: string; impact: "low" | "medium" | "high"; notes: string };
type Reasoning = { allowed_claims: Claim[]; blocked_claims: Claim[]; counterarguments: Counter[]; patterns: Claim[] };

function ProfilePage() {
  const fn = useServerFn(getMyResult);
  const { data } = useSuspenseQuery(
    queryOptions({ queryKey: ["myResult"], queryFn: () => fn({}) }),
  );
  const [copied, setCopied] = useState(false);
  const latest = data.sessions[0];
  const reasoning = data.reasoning as Reasoning | null;
  const vector = (latest?.vector ?? {}) as Record<string, number>;

  const max = Math.max(20, ...DIMS.map((d) => Math.abs(vector[d] ?? 0)));
  const chartData = DIMS.map((d) => ({
    dim: d.replace(/_/g, " "),
    value: ((vector[d] ?? 0) + max) / (2 * max) * 100,
  }));

  async function share() {
    if (!latest) return;
    const lines = [
      `My MusicDNA: ${latest.archetype?.name ?? "Unassigned"}`,
      latest.archetype?.tagline ? `— ${latest.archetype.tagline}` : "",
      "",
      latest.interpretation ?? "",
      "",
      ...(data.definingChoices?.slice(0, 3).map(
        (c) => `→ ${c.chosen} over ${c.rejected}`,
      ) ?? []),
    ].filter(Boolean).join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ title: "My MusicDNA", text: lines });
      } else {
        await navigator.clipboard.writeText(lines);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      try {
        await navigator.clipboard.writeText(lines);
        toast.success("Copied to clipboard");
      } catch {
        toast.error("Could not copy");
      }
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      {!latest ? (
        <div>
          <p className="eyebrow mb-6">No readings yet</p>
          <p className="font-serif text-3xl">Complete a round of matchups to see your DNA.</p>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-6 mb-10">
            <div>
              <p className="eyebrow mb-6">Your latest reading</p>
              {latest.archetype && (
                <>
                  <h1 className="display text-5xl md:text-6xl mb-3">{latest.archetype.name}</h1>
                  {latest.archetype.tagline && (
                    <p className="text-lg text-muted-foreground italic">{latest.archetype.tagline}</p>
                  )}
                </>
              )}
            </div>
            <button
              onClick={share}
              className="shrink-0 border hairline-strong rounded-sm px-4 py-2 text-xs font-medium hover:bg-surface"
            >
              {copied ? "Copied" : "Share"}
            </button>
          </div>

          {latest.interpretation && (
            <blockquote className="border-l-2 border-primary pl-6 my-12 max-w-2xl">
              <p className="font-serif text-2xl leading-snug text-foreground">{latest.interpretation}</p>
            </blockquote>
          )}

          {data.definingChoices?.length ? (
            <section className="mt-12 mb-12">
              <p className="eyebrow mb-5">Defining choices</p>
              <ul className="divide-y divide-border border hairline-strong rounded-sm bg-surface">
                {data.definingChoices.slice(0, 5).map((c, i) => (
                  <li key={i} className="px-5 py-4 flex items-baseline gap-4">
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="font-serif text-lg leading-snug">
                        <span className="text-foreground">{c.chosen}</span>
                        <span className="text-muted-foreground"> over </span>
                        <span className="text-muted-foreground line-through decoration-1">{c.rejected}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {c.chosenArtist} vs {c.rejectedArtist}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {reasoning?.allowed_claims?.length ? (
            <section className="mt-12 mb-12">
              <p className="eyebrow mb-5">The evidence</p>
              <ul className="divide-y divide-border border hairline-strong rounded-sm bg-surface">
                {reasoning?.allowed_claims.map((c, i) => (
                  <li key={i} className="px-5 py-4">
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="font-serif text-lg leading-snug">
                        <span className="text-foreground">{c.preferred}</span>
                        <span className="text-muted-foreground"> over </span>
                        <span className="text-muted-foreground">{c.opposed}</span>
                      </p>
                      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground shrink-0">
                        {c.supporting_choices}/{c.tested_total} · conf {c.confidence.toFixed(2)}
                      </span>
                    </div>
                    {c.examples?.length ? (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        e.g. {c.examples.map((e) => `${e.chosen} over ${e.rejected}`).join(" · ")}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {reasoning?.counterarguments?.length ? (
            <section className="mt-8 mb-12">
              <p className="eyebrow mb-3">What this reading could also be</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {reasoning?.counterarguments.map((c, i) => (
                  <li key={i} className="border-l-2 border-border pl-4">
                    <span className="text-foreground">{c.claim}</span> <span className="opacity-70">— {c.notes}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}


          <div className="border hairline-strong rounded-sm bg-surface p-6 mt-10">
            <p className="eyebrow mb-4">15-axis radar</p>
            <div style={{ width: "100%", height: 460 }}>
              <ResponsiveContainer>
                <RadarChart data={chartData}>
                  <PolarGrid stroke="oklch(1 0 0 / 0.1)" />
                  <PolarAngleAxis dataKey="dim" tick={{ fill: "oklch(0.715 0.010 240)", fontSize: 10 }} />
                  <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                  <Radar dataKey="value" stroke="oklch(0.617 0.205 261)" fill="oklch(0.617 0.205 261)" fillOpacity={0.35} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {data.sessions.length > 1 && (
            <section className="mt-16">
              <p className="eyebrow mb-4">Past readings</p>
              <ul className="space-y-3">
                {data.sessions.slice(1).map((s) => (
                  <li key={s.id} className="border hairline rounded-sm bg-surface px-5 py-4 flex justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-serif text-lg truncate">{s.archetype?.name ?? "Incomplete"}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.interpretation ?? "—"}</p>
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground shrink-0">
                      {new Date(s.started_at).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
