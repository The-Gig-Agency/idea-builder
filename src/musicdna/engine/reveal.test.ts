import { describe, it, expect } from "vitest";
import { buildPublicReveal } from "./reveal";

describe("buildPublicReveal", () => {
  it("shapes session + choices into the public DTO", () => {
    const out = buildPublicReveal({
      session: {
        id: "sess-1",
        share_token: "tok-abc",
        is_public: true,
        started_at: "2026-01-01T00:00:00Z",
        completed_at: "2026-01-01T00:05:00Z",
        interpretation: "You're an Architect.",
        vector: { craft: 80 },
        lane: "Alternative",
        archetype: { id: "arch-1", name: "Architect", tagline: "Craft first.", description: null },
      },
      definingChoices: [
        { chosen_title: "A", chosen_artist: "X", rejected_title: "B", rejected_artist: "Y" },
      ],
    });
    expect(out.session_id).toBe("sess-1");
    expect(out.share_token).toBe("tok-abc");
    expect(out.archetype?.name).toBe("Architect");
    expect(out.defining_choices[0]).toEqual({
      chosen: "A",
      chosenArtist: "X",
      rejected: "B",
      rejectedArtist: "Y",
    });
  });

  it("passes through nulls without exploding", () => {
    const out = buildPublicReveal({
      session: {
        id: "sess-2",
        share_token: null,
        is_public: false,
        started_at: null,
        completed_at: null,
        interpretation: null,
        vector: null,
        lane: null,
        archetype: null,
      },
      definingChoices: [],
    });
    expect(out.archetype).toBeNull();
    expect(out.defining_choices).toEqual([]);
  });
});
