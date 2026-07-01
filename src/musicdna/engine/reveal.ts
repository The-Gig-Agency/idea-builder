// MusicDNA Engine — public share reveal (pure).
//
// Takes the raw session + choices rows a public gateway can safely return and
// shapes them into the DTO both the web /s/:token page and the Flutter client
// consume. No I/O.

import type { Reveal } from "./types";

export type PublicRevealInput = {
  session: {
    id: string;
    share_token: string | null;
    is_public: boolean | null;
    started_at: string | null;
    completed_at: string | null;
    interpretation: string | null;
    vector: Record<string, number> | null;
    lane: string | null;
    // Joined archetype row.
    archetype: {
      id: string;
      name: string;
      tagline: string | null;
      description: string | null;
    } | null;
  };
  // Choices are pre-sorted by ms_to_decide asc; caller limits count.
  definingChoices: Array<{
    chosen_title: string;
    chosen_artist: string;
    rejected_title: string;
    rejected_artist: string;
  }>;
};

export type PublicReveal = {
  session_id: string;
  share_token: string | null;
  completed_at: string | null;
  lane: string | null;
  interpretation: string | null;
  archetype: PublicRevealInput["session"]["archetype"];
  defining_choices: Reveal["defining_choices"];
};

export function buildPublicReveal(input: PublicRevealInput): PublicReveal {
  return {
    session_id: input.session.id,
    share_token: input.session.share_token,
    completed_at: input.session.completed_at,
    lane: input.session.lane,
    interpretation: input.session.interpretation,
    archetype: input.session.archetype,
    defining_choices: input.definingChoices.map((c) => ({
      chosen: c.chosen_title,
      chosenArtist: c.chosen_artist,
      rejected: c.rejected_title,
      rejectedArtist: c.rejected_artist,
    })),
  };
}
