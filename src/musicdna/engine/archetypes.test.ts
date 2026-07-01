import { describe, it, expect } from "vitest";
import { assignArchetype, ARCHETYPE_SCORE_FLOOR } from "./archetypes";

const CATALOG = [
  { id: "arch-arch", name: "Architect", signature_axes: { craft: 1, escape: -0.5 } },
  { id: "arch-hed", name: "Hedonist", signature_axes: { escape: 1, craft: -0.5 } },
  { id: "arch-empty", name: "Empty", signature_axes: null },
];

describe("assignArchetype", () => {
  it("picks the archetype with the highest cosine", () => {
    // Listener leans hard toward craft
    const result = assignArchetype({ craft: 90, escape: -30 }, CATALOG);
    expect(result.assignment?.name).toBe("Architect");
    expect(result.flagged).toBe(false);
    expect(result.assignment?.runners_up[0].name).toBe("Hedonist");
  });

  it("returns runners_up with rounded scores and no self-entry", () => {
    const result = assignArchetype({ craft: 90, escape: -30 }, CATALOG);
    const names = result.assignment?.runners_up.map((r) => r.name) ?? [];
    expect(names).not.toContain("Architect");
    expect(result.assignment?.runners_up.every((r) => Number.isFinite(r.score))).toBe(true);
  });

  it("flags no_archetypes when the catalog is empty", () => {
    const result = assignArchetype({ craft: 10 }, []);
    expect(result.assignment).toBeNull();
    expect(result.flagged).toBe(true);
    expect(result.flag_reason).toBe("no_archetypes");
  });

  it("skips archetypes with null signature_axes", () => {
    const result = assignArchetype({ craft: 90 }, [CATALOG[2]]);
    // Only entry was skipped → treated as empty catalog
    expect(result.flag_reason).toBe("no_archetypes");
  });

  it("flags low_score when winner is below the floor", () => {
    // Very weak signal on the axes we score
    const result = assignArchetype({ craft: 1, escape: -0.5 }, CATALOG);
    if (result.assignment && result.assignment.score < ARCHETYPE_SCORE_FLOOR) {
      expect(result.flag_reason).toBe("low_score");
    }
  });

  it("flags ambiguous when best and runner-up are within margin floor", () => {
    // Two identical archetypes → margin = 0
    const twins = [
      { id: "a", name: "A", signature_axes: { craft: 1 } },
      { id: "b", name: "B", signature_axes: { craft: 1 } },
    ];
    const result = assignArchetype({ craft: 90 }, twins);
    expect(result.flagged).toBe(true);
    expect(result.flag_reason).toBe("ambiguous");
  });

  it("computes confidence_tier from the winning score", () => {
    const result = assignArchetype({ craft: 100 }, [
      { id: "x", name: "X", signature_axes: { craft: 1 } },
    ]);
    // Perfect alignment → tier 95
    expect(result.assignment?.confidence_tier).toBe(95);
  });
});
