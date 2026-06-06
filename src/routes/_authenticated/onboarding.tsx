import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { generateOpeningHypothesis } from "@/lib/musicdna.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Five songs — MusicDNA" }] }),
  component: Onboarding,
});

function Onboarding() {
  const fn = useServerFn(generateOpeningHypothesis);
  const navigate = useNavigate();
  const [songs, setSongs] = useState(["", "", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [hypothesis, setHypothesis] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (songs.some((s) => s.trim().length < 2)) {
      toast.error("All five fields required.");
      return;
    }
    setBusy(true);
    try {
      const { hypothesis } = await fn({ data: { songs: songs.map((s) => s.trim()) } });
      setHypothesis(hypothesis);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to read your songs.");
    } finally {
      setBusy(false);
    }
  }

  if (hypothesis) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20">
        <p className="eyebrow mb-8">Opening hypothesis</p>
        <p className="font-serif text-3xl md:text-4xl leading-snug text-foreground">"{hypothesis}"</p>
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
        Not the most popular ones. The ones that, if you lost them, you'd feel it.
        Title and artist if possible.
      </p>
      <form onSubmit={submit} className="space-y-3">
        {songs.map((s, i) => (
          <div key={i} className="flex items-center gap-4">
            <span className="font-mono text-xs text-muted-foreground w-6">{String(i + 1).padStart(2, "0")}</span>
            <input
              value={s} onChange={(e) => setSongs(songs.map((x, j) => (i === j ? e.target.value : x)))}
              placeholder="e.g. Ceremony — New Order"
              className="flex-1 bg-surface border hairline-strong rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
            />
          </div>
        ))}
        <button
          type="submit" disabled={busy}
          className="mt-6 bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Reading…" : "Read these"}
        </button>
      </form>
    </main>
  );
}
