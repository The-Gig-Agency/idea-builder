// MusicDNA Engine — derived descriptors.
//
// Moods like nostalgic, dreamy, dark, hopeful are NOT stored and NOT scored.
// They're a READ off the canonical 10 axes — Spotify-style: keep the signal,
// derive the interpretation. The final synthesis prompt receives these as
// flavor ("you may call them X if the read supports it"), never as data.
//
// Pure function so descriptor thresholds get regression tests instead of
// silently drifting inside the LLM prompt builder.

import type { Vector } from "./types";

export function deriveDescriptors(vector: Vector): string[] {
  const v = (k: string) => vector[k] ?? 0;
  const out: string[] = [];
  if (v("immersion") < -25 && v("tension") < -15 && v("scale") < 0) out.push("nostalgic");
  if (v("atmosphere") > 25 && v("immersion") > 15 && v("confidence") < 0) out.push("dreamy");
  if (v("tension") > 25 && v("community") < 0 && v("texture") < -10) out.push("dark");
  if (v("movement") > 15 && v("tension") < -10 && v("scale") > 0) out.push("hopeful");
  if (v("confidence") < -15 && v("perspective") < -10 && v("atmosphere") > 0) out.push("romantic");
  if (v("movement") > 25 && v("confidence") > 15 && v("tension") > 0) out.push("kinetic");
  if (v("transformation") > 20 && v("scale") > 10) out.push("transporting");
  if (v("texture") < -20 && v("confidence") < -10) out.push("raw");
  if (v("scale") < -15 && v("atmosphere") > 10 && v("tension") < 0) out.push("intimate");
  return out;
}
