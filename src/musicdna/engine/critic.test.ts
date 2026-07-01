import { describe, expect, it } from "vitest";
import { CRITIC_PERSONA, CRITIC_VOICE_EDITORIAL } from "./critic";

describe("critic voice constants", () => {
  it("persona embeds the hard-rules block", () => {
    expect(CRITIC_PERSONA).toContain("HARD RULES:");
    expect(CRITIC_PERSONA).toContain("no platitudes");
    expect(CRITIC_PERSONA).toContain('no "music lover"');
  });

  it("persona forbids the corporate-assistant tells", () => {
    for (const banned of ['no "vibes"', 'no "journey"', "no therapy-speak"]) {
      expect(CRITIC_PERSONA).toContain(banned);
    }
  });

  it("editorial voice extends the persona", () => {
    expect(CRITIC_VOICE_EDITORIAL.startsWith(CRITIC_PERSONA)).toBe(true);
    expect(CRITIC_VOICE_EDITORIAL).toContain("One observation per sentence");
  });
});
