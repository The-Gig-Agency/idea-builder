import { describe, expect, it } from "vitest";
import { PRIOR_SEED_WEIGHT, seedVectorFromPriors } from "./priors";

describe("seedVectorFromPriors", () => {
  it("returns {} for null/undefined/empty input", () => {
    expect(seedVectorFromPriors(null)).toEqual({});
    expect(seedVectorFromPriors(undefined)).toEqual({});
    expect(seedVectorFromPriors({})).toEqual({});
  });

  it("applies PRIOR_SEED_WEIGHT and rounds", () => {
    const v = seedVectorFromPriors({ movement: 100, tension: -40, scale: 3 });
    expect(v).toEqual({
      movement: Math.round(100 * PRIOR_SEED_WEIGHT),
      tension: Math.round(-40 * PRIOR_SEED_WEIGHT),
      scale: Math.round(3 * PRIOR_SEED_WEIGHT),
    });
  });

  it("drops non-finite and non-numeric values", () => {
    const v = seedVectorFromPriors({
      good: 50,
      nan: NaN,
      inf: Infinity,
      str: "high" as unknown,
      nul: null as unknown,
    });
    expect(v).toEqual({ good: Math.round(50 * PRIOR_SEED_WEIGHT) });
  });

  it("accepts a custom weight", () => {
    expect(seedVectorFromPriors({ x: 100 }, 0.5)).toEqual({ x: 50 });
  });
});
