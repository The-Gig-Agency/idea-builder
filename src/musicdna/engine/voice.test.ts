import { describe, expect, it } from "vitest";
import {
  HEDGES,
  HESITATION_BUCKETS,
  dimSeed,
  hedgeForRound,
  hesitationFor,
  pickByHash,
} from "./voice";

describe("pickByHash", () => {
  it("returns undefined for empty/undefined input", () => {
    expect(pickByHash(undefined, 3)).toBeUndefined();
    expect(pickByHash([], 3)).toBeUndefined();
  });

  it("is stable for a given seed", () => {
    const arr = ["a", "b", "c", "d"];
    expect(pickByHash(arr, 7)).toBe(pickByHash(arr, 7));
  });

  it("handles negative seeds", () => {
    const arr = ["a", "b", "c"];
    expect(arr).toContain(pickByHash(arr, -1));
  });
});

describe("hesitationFor", () => {
  it("returns '' when ms is null", () => {
    expect(hesitationFor(null, 0)).toBe("");
  });

  it("returns a line from the matching bucket", () => {
    const line = hesitationFor(100, 0);
    expect(HESITATION_BUCKETS[0].lines).toContain(line);
  });

  it("routes very slow decisions to the last bucket", () => {
    const line = hesitationFor(20_000, 2);
    expect(HESITATION_BUCKETS[HESITATION_BUCKETS.length - 1].lines).toContain(line);
  });
});

describe("hedgeForRound", () => {
  it("clamps round below 1 to the first hedge", () => {
    expect(hedgeForRound(0)).toBe(HEDGES[0]);
    expect(hedgeForRound(-4)).toBe(HEDGES[0]);
  });
  it("clamps round beyond the ladder to the last hedge", () => {
    expect(hedgeForRound(99)).toBe(HEDGES[HEDGES.length - 1]);
  });
  it("indexes 1-based", () => {
    expect(hedgeForRound(1)).toBe(HEDGES[0]);
    expect(hedgeForRound(3)).toBe(HEDGES[2]);
  });
});

describe("dimSeed", () => {
  it("is deterministic", () => {
    expect(dimSeed("movement")).toBe(dimSeed("movement"));
  });
  it("varies across dimensions", () => {
    expect(dimSeed("movement")).not.toBe(dimSeed("tension"));
  });
});
