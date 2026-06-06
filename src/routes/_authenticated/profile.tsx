import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { getMyResult } from "@/lib/musicdna.functions";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from "recharts";

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

function ProfilePage() {
  const fn = useServerFn(getMyResult);
  const { data } = useSuspenseQuery(
    queryOptions({ queryKey: ["myResult"], queryFn: () => fn({}) }),
  );
  const latest = data.sessions[0];
  const vector = (latest?.vector ?? {}) as Record<string, number>;
  const max = Math.max(20, ...DIMS.map((d) => Math.abs(vector[d] ?? 0)));
  const chartData = DIMS.map((d) => ({
    dim: d.replace(/_/g, " "),
    value: ((vector[d] ?? 0) + max) / (2 * max) * 100,
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      {!latest ? (
        <div>
          <p className="eyebrow mb-6">No readings yet</p>
          <p className="font-serif text-3xl">Complete a round of matchups to see your DNA.</p>
        </div>
      ) : (
        <>
          <p className="eyebrow mb-6">Your latest reading</p>
          {latest.archetype && (
            <div className="mb-10">
              <h1 className="display text-5xl md:text-6xl mb-3">{latest.archetype.name}</h1>
              {latest.archetype.tagline && (
                <p className="text-lg text-muted-foreground italic">{latest.archetype.tagline}</p>
              )}
            </div>
          )}
          {latest.interpretation && (
            <blockquote className="border-l-2 border-primary pl-6 my-12 max-w-2xl">
              <p className="font-serif text-2xl leading-snug text-foreground">{latest.interpretation}</p>
            </blockquote>
          )}

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
