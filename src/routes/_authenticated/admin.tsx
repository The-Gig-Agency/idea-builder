import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  adminCheck,
  adminList,
  adminUpsert,
  adminDelete,
  adminSetDiagnosticWeight,
} from "@/lib/admin.functions";
import {
  listDecadePrompts,
  updateDecadePromptText,
  setActiveDecadePrompt,
  createDecadePrompt,
  deleteDecadePrompt,
  DECADES,
  type Decade,
  type DecadePrompt,
} from "@/lib/decade-prompts.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — MusicDNA" }] }),
  component: AdminPage,
});

type Entity = "songs" | "pairings" | "archetypes";
type Tab = Entity | "decade_prompts";
const ENTITIES: { key: Tab; label: string }[] = [
  { key: "songs", label: "Songs" },
  { key: "pairings", label: "Pairings" },
  { key: "archetypes", label: "Archetypes" },
  { key: "decade_prompts", label: "Decade Prompts" },
];

type Row = Record<string, unknown> & { id: string };

function AdminPage() {
  const check = useServerFn(adminCheck);
  // Component-level gate. Retry a few times because the first server-fn call
  // after hydration can race the bearer-token attacher reading the session.
  const gate = useQuery({
    queryKey: ["admin", "check"],
    queryFn: () => check(),
    retry: 3,
    retryDelay: (attempt) => 300 * (attempt + 1),
    staleTime: 60_000,
  });
  const [tab, setTab] = useState<Tab>("songs");
  const [editing, setEditing] = useState<{ row: Row | null } | null>(null);

  if (gate.isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16 text-sm text-muted-foreground">
        Checking credentials…
      </main>
    );
  }
  if (gate.isError || !gate.data?.isAdmin) {
    const errMsg = gate.error instanceof Error ? gate.error.message : null;
    const looksUnauth = errMsg?.toLowerCase().includes("unauth");
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="eyebrow mb-3">{looksUnauth ? "401" : "403"}</p>
        <h1 className="display text-3xl mb-3">
          {looksUnauth ? "Session didn't reach the door." : "Not your room."}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {looksUnauth
            ? "Your bearer token didn't make it to the server. Usually a stale session — refetch, or sign out and back in."
            : "This page is admin-only. If you think that's wrong, sign out and back in — sometimes the session takes a beat to catch up."}
        </p>
        {errMsg && (
          <pre className="mb-6 max-w-full overflow-x-auto rounded border hairline bg-muted/40 p-3 text-[11px] font-mono text-muted-foreground">
            {errMsg}
          </pre>
        )}
        {!errMsg && gate.data && (
          <pre className="mb-6 max-w-full overflow-x-auto rounded border hairline bg-muted/40 p-3 text-[11px] font-mono text-muted-foreground">
            {`server saw userId: ${gate.data.userId}\nreason: ${gate.data.reason ?? "unknown"}`}
          </pre>
        )}

        <div className="flex gap-3 items-center">
          <button
            onClick={() => gate.refetch()}
            className="bg-primary text-primary-foreground rounded-sm px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            Try again
          </button>
          <Link to="/profile" className="text-sm underline">
            Back to profile
          </Link>
        </div>
      </main>
    );
  }


  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-end justify-between mb-8 gap-6 flex-wrap">
        <div>
          <p className="eyebrow mb-3">Admin</p>
          <h1 className="display text-4xl">Catalog</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Edit songs, pairings, and archetypes. Changes go live immediately.
          </p>
        </div>
        {tab !== "decade_prompts" && (
          <button
            onClick={() => setEditing({ row: null })}
            className="rounded-sm bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            + New {tab.replace(/s$/, "")}
          </button>
        )}
      </div>

      <nav className="flex gap-1 border-b hairline mb-6 flex-wrap">
        {ENTITIES.map((e) => (
          <button
            key={e.key}
            onClick={() => setTab(e.key)}
            className={`px-4 py-2 text-sm font-mono uppercase tracking-[0.18em] border-b-2 -mb-px ${
              tab === e.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {e.label}
          </button>
        ))}
      </nav>

      {tab === "decade_prompts" ? (
        <DecadePromptsEditor />
      ) : (
        <EntityTable
          key={tab}
          entity={tab as Exclude<Entity, "decade_prompts">}
          onEdit={(row) => setEditing({ row })}
        />
      )}

      {editing && tab !== "decade_prompts" && (
        <EditDrawer
          entity={tab as Exclude<Entity, "decade_prompts">}
          row={editing.row}
          onClose={() => setEditing(null)}
        />
      )}
    </main>
  );
}

function EntityTable({ entity, onEdit }: { entity: Entity; onEdit: (row: Row) => void }) {
  const qc = useQueryClient();
  const list = useServerFn(adminList);
  const del = useServerFn(adminDelete);
  const setWeight = useServerFn(adminSetDiagnosticWeight);
  const [search, setSearch] = useState("");
  const [lane, setLane] = useState("");

  const query = useQuery({
    queryKey: ["admin", entity, search, lane],
    queryFn: () => list({ data: { table: entity, search: search || undefined, lane: lane || undefined } }),
  });

  const columns = useMemo(() => columnsFor(entity), [entity]);

  return (
    <div>
      <div className="flex gap-3 items-center mb-3 flex-wrap">
        {entity !== "archetypes" && (
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={entity === "songs" ? "Search title or artist…" : "Search…"}
            className="border hairline rounded-sm bg-background px-3 py-1.5 text-sm w-64"
          />
        )}
        {(entity === "songs" || entity === "pairings") && (
          <select
            value={lane}
            onChange={(e) => setLane(e.target.value)}
            className="border hairline rounded-sm bg-background px-3 py-1.5 text-sm"
          >
            <option value="">All lanes</option>
            {["alternative", "pop", "hip_hop", "electronic", "classic_rock", "metal", "country", "general"].map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {query.data?.rows.length ?? 0} rows{query.isFetching ? " · loading…" : ""}
        </span>
      </div>

      <div className="border hairline-strong rounded-sm overflow-x-auto bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-background/50">
            <tr>
              {columns.map((c) => (
                <th key={c} className="text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground px-3 py-2">
                  {c}
                </th>
              ))}
              <th className="w-32" />
            </tr>
          </thead>
          <tbody>
            {(query.data?.rows as Row[] | undefined)?.map((r) => (
              <tr key={r.id} className="border-t hairline align-top">
                {columns.map((c) => (
                  <td key={c} className="px-3 py-2 max-w-[280px] truncate">
                    {entity === "pairings" && c === "diagnostic_weight" ? (
                      <input
                        type="number"
                        defaultValue={Number(r[c] ?? 0)}
                        min={0}
                        max={100}
                        onBlur={async (e) => {
                          const v = parseInt(e.target.value, 10);
                          if (Number.isNaN(v) || v === Number(r[c])) return;
                          try {
                            await setWeight({ data: { id: r.id, diagnostic_weight: v } });
                            toast.success("Weight updated");
                            qc.invalidateQueries({ queryKey: ["admin", entity] });
                          } catch (err) {
                            toast.error((err as Error).message);
                          }
                        }}
                        className="w-16 border hairline rounded-sm bg-background px-2 py-1 text-xs"
                      />
                    ) : entity === "pairings" && c === "active" ? (
                      <input
                        type="checkbox"
                        defaultChecked={!!r[c]}
                        onChange={async (e) => {
                          try {
                            await setWeight({ data: { id: r.id, diagnostic_weight: Number(r.diagnostic_weight ?? 0), active: e.target.checked } });
                            qc.invalidateQueries({ queryKey: ["admin", entity] });
                          } catch (err) {
                            toast.error((err as Error).message);
                          }
                        }}
                      />
                    ) : (
                      formatCell(r[c])
                    )}
                  </td>
                ))}
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button
                    onClick={() => onEdit(r)}
                    className="text-xs underline mr-3"
                  >
                    Edit
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm("Delete this row? This cannot be undone.")) return;
                      try {
                        await del({ data: { table: entity, id: r.id } });
                        toast.success("Deleted");
                        qc.invalidateQueries({ queryKey: ["admin", entity] });
                      } catch (err) {
                        toast.error((err as Error).message);
                      }
                    }}
                    className="text-xs text-destructive underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!query.isLoading && (query.data?.rows.length ?? 0) === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-8 text-center text-muted-foreground">
                  Nothing here yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function columnsFor(e: Entity): string[] {
  if (e === "songs") return ["title", "artist", "year", "primary_lane", "diagnostic_power", "canon_score", "curator_count"];
  if (e === "pairings") return ["user_facing_tradeoff", "hypothesis", "song_a_id", "song_b_id", "lane", "difficulty", "diagnostic_weight", "active"];
  return ["name", "tagline", "description"];
}

function formatCell(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") return v.length > 120 ? v.slice(0, 117) + "…" : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 80 ? s.slice(0, 77) + "…" : s;
  } catch {
    return String(v);
  }
}

// ============ Edit drawer ============
function EditDrawer({
  entity,
  row,
  onClose,
}: {
  entity: Entity;
  row: Row | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const upsert = useServerFn(adminUpsert);
  const fields = useMemo(() => fieldsFor(entity), [entity]);
  const initial = useMemo(() => {
    const init: Record<string, string> = {};
    for (const f of fields) {
      const v = row?.[f.key];
      init[f.key] = v == null ? "" : typeof v === "object" ? JSON.stringify(v, null, 2) : String(v);
    }
    return init;
  }, [fields, row]);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const f of fields) {
        const raw = values[f.key]?.trim() ?? "";
        if (raw === "" && f.optional) continue;
        if (raw === "" && !f.optional) {
          throw new Error(`Missing required field: ${f.key}`);
        }
        if (f.type === "number") {
          const n = Number(raw);
          if (Number.isNaN(n)) throw new Error(`${f.key} must be a number`);
          payload[f.key] = n;
        } else if (f.type === "boolean") {
          payload[f.key] = raw === "true";
        } else if (f.type === "json") {
          try {
            payload[f.key] = raw === "" ? null : JSON.parse(raw);
          } catch {
            throw new Error(`${f.key} must be valid JSON`);
          }
        } else {
          payload[f.key] = raw;
        }
      }
      await upsert({ data: { table: entity, id: row?.id ?? null, row: payload } });
      toast.success(row ? "Saved" : "Created");
      qc.invalidateQueries({ queryKey: ["admin", entity] });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-stretch justify-end">
      <div className="w-full max-w-xl bg-background border-l hairline-strong overflow-y-auto">
        <div className="p-6 border-b hairline flex items-center justify-between">
          <div>
            <p className="eyebrow">{row ? "Edit" : "New"}</p>
            <h2 className="font-serif text-2xl mt-1">{entity.replace(/s$/, "")}</h2>
          </div>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Close</button>
        </div>
        <div className="p-6 space-y-4">
          {fields.map((f) => (
            <label key={f.key} className="block">
              <span className="block text-xs font-mono uppercase tracking-[0.18em] text-muted-foreground mb-1">
                {f.key}{f.optional ? "" : " *"}
              </span>
              {f.type === "json" || f.long ? (
                <textarea
                  rows={f.type === "json" ? 6 : 3}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  className="w-full border hairline rounded-sm bg-background px-3 py-2 text-sm font-mono"
                />
              ) : (
                <input
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  placeholder={f.hint}
                  className="w-full border hairline rounded-sm bg-background px-3 py-2 text-sm"
                />
              )}
            </label>
          ))}
        </div>
        <div className="p-6 border-t hairline flex justify-end gap-2 sticky bottom-0 bg-background">
          <button onClick={onClose} className="text-sm px-4 py-2 border hairline-strong rounded-sm">Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="text-sm px-4 py-2 bg-primary text-primary-foreground rounded-sm disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

type Field = { key: string; type: "text" | "number" | "boolean" | "json"; optional?: boolean; long?: boolean; hint?: string };

function fieldsFor(e: Entity): Field[] {
  if (e === "songs") {
    const dims = [
      "movement","atmosphere","groove","darkness","hope","nostalgia","transformation",
      "complexity","melody","verbal_cleverness","authenticity","romanticism","energy",
      "dreaminess","community",
    ];
    return [
      { key: "title", type: "text" },
      { key: "artist", type: "text" },
      { key: "year", type: "number", optional: true },
      { key: "primary_lane", type: "text", hint: "alternative · pop · hip_hop · electronic · classic_rock · metal · country · general" },
      { key: "lane", type: "text", hint: "granular sub-lane, e.g. post_punk_new_wave" },
      // --- Diagnostic Power Score (DPS): six components, sum = diagnostic_power ---
      { key: "polarization", type: "number", optional: true, hint: "0–25 — splits the room. 0=everyone agrees · 25=fistfight in the comments" },
      { key: "tradeoff_richness", type: "number", optional: true, hint: "0–20 — how many real tradeoffs this song surfaces" },
      { key: "pairing_density", type: "number", optional: true, hint: "0–15 — how many sharp same-lane opponents exist" },
      { key: "identity_signaling", type: "number", optional: true, hint: "0–15 — picking this says something about you" },
      { key: "longevity", type: "number", optional: true, hint: "0–10 — still revealing five years from now?" },
      { key: "cross_genre_mapping", type: "number", optional: true, hint: "0–15 — maps cleanly to opponents in other lanes" },
      { key: "canon_score", type: "number", optional: true, hint: "0–100 — cultural weight. Billie Jean=99, deep cut=20" },
      { key: "curator_count", type: "number", optional: true, hint: "how many curators have scored this (drives confidence)" },
      { key: "diagnostic_power_confidence", type: "number", optional: true, hint: "0.00–1.00 — how much we trust the score" },
      ...dims.map((d) => ({ key: d, type: "number" as const, optional: true, hint: "-10 to +10" })),
    ];
  }
  if (e === "pairings") {
    return [
      { key: "song_a_id", type: "text", hint: "uuid of song A" },
      { key: "song_b_id", type: "text", hint: "uuid of song B" },
      { key: "user_facing_tradeoff", type: "text", long: true, optional: true, hint: 'Plain-language tradeoff. Must pass the Friend Test, e.g. "Do you disappear into a song, or bring it into the room with you?"' },
      { key: "hypothesis", type: "text", long: true, hint: "internal critic-speak — what dimensions this tests" },
      { key: "why_good", type: "text", long: true, optional: true },
      { key: "tests", type: "json", optional: true, hint: '["movement","darkness"]' },
      { key: "lane", type: "text", optional: true, hint: "default: alternative" },
      { key: "difficulty", type: "number", optional: true, hint: "1=obvious · 2=moderate · 3=painful" },
      { key: "diagnostic_weight", type: "number", hint: "0–100" },
      { key: "active", type: "boolean", hint: "true / false" },
    ];
  }
  return [
    { key: "name", type: "text" },
    { key: "tagline", type: "text", optional: true },
    { key: "description", type: "text", long: true, optional: true },
    { key: "signature_axes", type: "json", optional: true, hint: '{"movement":5,"darkness":-3}' },
    { key: "signature_signals", type: "json", optional: true, hint: '["…"]' },
  ];
}

// ============ Decade Opening Prompts editor ============
function DecadePromptsEditor() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDecadePrompts);
  const updateTextFn = useServerFn(updateDecadePromptText);
  const setActiveFn = useServerFn(setActiveDecadePrompt);
  const createFn = useServerFn(createDecadePrompt);
  const deleteFn = useServerFn(deleteDecadePrompt);

  const query = useQuery({
    queryKey: ["admin", "decade_prompts"],
    queryFn: () => listFn(),
  });

  const grouped = useMemo(() => {
    const map: Record<Decade, DecadePrompt[]> = {
      "70s": [], "80s": [], "90s": [], "00s": [], "10s": [],
    };
    for (const r of query.data?.rows ?? []) map[r.decade]?.push(r);
    return map;
  }, [query.data]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin", "decade_prompts"] });
  }

  return (
    <div className="space-y-10">
      <p className="text-sm text-muted-foreground max-w-2xl">
        The opening question shown as song #1 on each decade's onboarding page. One per decade is marked <span className="text-foreground font-medium">active</span> — that's the one users see. Edit text inline (press Enter or blur to save). Promote a different option by clicking its radio.
      </p>

      {DECADES.map((decade) => (
        <section key={decade} className="space-y-3">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="display text-2xl">{decade}</h2>
            <NewPromptInline
              onCreate={async (text) => {
                try {
                  await createFn({ data: { decade, text } });
                  toast.success(`Added to ${decade}`);
                  invalidate();
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            />
          </div>
          <ul className="border hairline-strong rounded-sm bg-surface divide-y hairline">
            {grouped[decade].map((p) => (
              <li key={p.id} className="flex items-start gap-3 p-3">
                <label className="pt-2 cursor-pointer" title="Make this the active prompt">
                  <input
                    type="radio"
                    name={`active-${decade}`}
                    checked={p.is_active}
                    onChange={async () => {
                      try {
                        await setActiveFn({ data: { id: p.id } });
                        toast.success(`${decade} active prompt set`);
                        invalidate();
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  />
                </label>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground pt-2 w-8">
                  {String(p.position).padStart(2, "0")}
                </span>
                <PromptTextField
                  initial={p.text}
                  onSave={async (text) => {
                    if (text === p.text) return;
                    try {
                      await updateTextFn({ data: { id: p.id, text } });
                      toast.success("Saved");
                      invalidate();
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                />
                <button
                  onClick={async () => {
                    if (p.is_active) {
                      toast.error("Promote a different prompt first.");
                      return;
                    }
                    if (!confirm("Delete this prompt?")) return;
                    try {
                      await deleteFn({ data: { id: p.id } });
                      toast.success("Deleted");
                      invalidate();
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                  className="text-xs text-destructive underline mt-2 whitespace-nowrap"
                >
                  Delete
                </button>
              </li>
            ))}
            {grouped[decade].length === 0 && (
              <li className="p-4 text-center text-sm text-muted-foreground">
                No prompts for {decade} yet.
              </li>
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PromptTextField({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (text: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onSave(value.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="flex-1 bg-transparent border-b hairline focus:border-primary focus:outline-none px-1 py-2 text-base font-serif"
    />
  );
}

function NewPromptInline({ onCreate }: { onCreate: (text: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-mono uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
      >
        + add option
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="New prompt text…"
        className="border hairline rounded-sm bg-background px-2 py-1 text-sm w-80"
        autoFocus
      />
      <button
        onClick={async () => {
          const t = text.trim();
          if (t.length < 3) return;
          await onCreate(t);
          setText("");
          setOpen(false);
        }}
        className="text-xs px-3 py-1 bg-primary text-primary-foreground rounded-sm"
      >
        Add
      </button>
      <button
        onClick={() => { setText(""); setOpen(false); }}
        className="text-xs text-muted-foreground"
      >
        Cancel
      </button>
    </div>
  );
}
