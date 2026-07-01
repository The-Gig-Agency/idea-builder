import { describe, expect, it } from "vitest";
import { deriveDescriptors } from "./descriptors";

describe("deriveDescriptors", () => {
  it("returns [] on a zero vector", () => {
    expect(deriveDescriptors({})).toEqual([]);
  });

  it("detects nostalgic", () => {
    const out = deriveDescriptors({ immersion: -30, tension: -20, scale: -5 });
    expect(out).toContain("nostalgic");
  });

  it("detects dreamy", () => {
    const out = deriveDescriptors({ atmosphere: 30, immersion: 20, confidence: -5 });
    expect(out).toContain("dreamy");
  });

  it("detects multiple descriptors when thresholds overlap", () => {
    const out = deriveDescriptors({
      movement: 30,
      confidence: 20,
      tension: 5,
      transformation: 25,
      scale: 15,
    });
    expect(out).toEqual(expect.arrayContaining(["kinetic", "transporting"]));
  });

  it("does not label 'dark' when community is positive", () => {
    const out = deriveDescriptors({ tension: 30, community: 5, texture: -15 });
    expect(out).not.toContain("dark");
  });
});
