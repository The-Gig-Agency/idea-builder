import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { analyzeOpeningSongs, recordEvent } from "@/lib/musicdna.functions";
import { searchSongs } from "@/lib/songs.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Five songs — MusicDNA" }] }),
  component: Onboarding,
});

type Song = { id: string; title: string; artist: string; year: number | null };
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
  const navigate = useNavigate();
  const [picks, setPicks] = useState<Array<Song | null>>([null, null, null, null, null]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const search = useServerFn(searchSongs);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (activeIdx === null || query.trim().length < 2) { setResults([]); return; }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const { songs } = await search({ data: { q: query.trim() } });
        setResults(songs as Song[]);
      } catch { /* ignore */ } finally { setSearching(false); }
    }, 180);
  }, [query, activeIdx, search]);

  function choose(s: Song) {
    if (activeIdx === null) return;
    if (picks.some((p, i) => p?.id === s.id && i !== activeIdx)) {
      toast.error("Already picked.");
      return;
    }
    setPicks(picks.map((p, i) => (i === activeIdx ? s : p)));
    setActiveIdx(null);
    setQuery("");
    setResults([]);
  }

  async function submit() {
    if (picks.some((p) => !p)) { toast.error("Pick five songs."); return; }
    setBusy(true);
    try {
      const labels = picks.map((p) => `${p!.title} — ${p!.artist}`);
      const result = await fn({ data: { songs: labels } });
      setAnalysis(result as Analysis);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to read your songs.");
    } finally { setBusy(false); }
  }

  if (analysis) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20">
        <p className="eyebrow mb-8">Opening hypothesis</p>
        <p className="font-serif text-3xl md:text-4xl leading-snug text-foreground">"{analysis.hypothesis}"</p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Lane</span>
          <span className="border hairline-strong rounded-sm px-3 py-1 text-sm font-medium">{LANE_LABEL[analysis.lane] ?? analysis.lane}</span>
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
        Not the most popular ones. The ones that, if you lost them, you'd feel it.
      </p>

      <ol className="space-y-2">
        {picks.map((p, i) => (
          <li key={i}>
            <button
              onClick={() => { setActiveIdx(i); setQuery(p ? `${p.title} ${p.artist}` : ""); }}
              className={`w-full text-left flex items-center gap-4 border hairline-strong rounded-sm px-4 py-3 transition-colors ${
                activeIdx === i ? "border-primary bg-surface" : "bg-surface hover:bg-background"
              }`}
            >
              <span className="font-mono text-xs text-muted-foreground w-6">{String(i + 1).padStart(2, "0")}</span>
              {p ? (
                <span className="flex-1 min-w-0">
                  <span className="font-serif text-lg block truncate">{p.title}</span>
                  <span className="text-xs text-muted-foreground truncate">{p.artist}{p.year ? ` · ${p.year}` : ""}</span>
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">Search the canon…</span>
              )}
            </button>

            {activeIdx === i && (
              <div className="mt-2 border hairline-strong rounded-sm bg-surface overflow-hidden">
                <input
                  autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type a title or artist…"
                  className="w-full bg-transparent px-4 py-2.5 text-sm focus:outline-none border-b hairline"
                />
                <ul className="max-h-72 overflow-y-auto">
                  {searching && <li className="px-4 py-3 text-xs text-muted-foreground">Searching…</li>}
                  {!searching && query.length >= 2 && !results.length && (
                    <li className="px-4 py-3 text-xs text-muted-foreground">No matches in the canon.</li>
                  )}
                  {results.map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => choose(s)}
                        className="w-full text-left px-4 py-2.5 hover:bg-background transition-colors"
                      >
                        <span className="font-serif text-base block">{s.title}</span>
                        <span className="text-xs text-muted-foreground">{s.artist}{s.year ? ` · ${s.year}` : ""}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ol>

      <button
        onClick={submit} disabled={busy || picks.some((p) => !p)}
        className="mt-8 bg-primary text-primary-foreground rounded-sm px-6 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-40"
      >
        {busy ? "Reading…" : "Read these"}
      </button>
    </main>
  );
}
