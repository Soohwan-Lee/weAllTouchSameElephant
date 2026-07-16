import type { BridgeProposal, Fragment, MirrorReflection, NameResult, RevealMode } from "./types";
import type { MirrorInput, NameInput, SeedSuggestion } from "./prompts";

export type BridgeMode = "live" | "sample" | "empty" | "error";

export async function fetchSeeds(
  decision: string,
  lang: "en" | "ko",
  max = 5
): Promise<{ seeds: SeedSuggestion[]; mode: string }> {
  const res = await fetch("/api/seeds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision, lang, max }),
  });
  if (!res.ok) return { seeds: [], mode: "error" };
  return res.json();
}

export async function fetchBridges(
  fragments: Fragment[],
  lang: "en" | "ko",
  max = 3
): Promise<{ bridges: BridgeProposal[]; mode: BridgeMode }> {
  const res = await fetch("/api/bridges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fragments, lang, max }),
  });
  if (!res.ok) return { bridges: [], mode: "error" };
  return res.json();
}

export async function fetchName(
  input: NameInput,
  lang: "en" | "ko",
  mode: RevealMode = "explore"
): Promise<NameResult> {
  const res = await fetch("/api/name", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, lang, mode }),
  });
  if (!res.ok) return { name: "", note: "", question: "", mode };
  return res.json();
}

export async function fetchMirror(
  input: MirrorInput,
  lang: "en" | "ko"
): Promise<{ reflection: MirrorReflection; mode: string }> {
  const res = await fetch("/api/mirror", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, lang }),
  });
  if (!res.ok) {
    return { reflection: { connected: [], tensions: [], separate: [] }, mode: "error" };
  }
  return res.json();
}
