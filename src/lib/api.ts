import type { BridgeProposal, Fragment, MirrorReflection, NameResult, RevealMode } from "./types";
import type { CardCandidate, MirrorInput, NameInput, SeedSuggestion } from "./prompts";

export type BridgeMode = "live" | "sample" | "empty" | "error";

export async function fetchTalkQuestions(
  decision: string,
  lang: "en" | "ko"
): Promise<{ questions: string[]; mode: string }> {
  try {
    const res = await fetch("/api/talk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "questions", decision, lang }),
    });
    if (!res.ok) return { questions: [], mode: "error" };
    return await res.json();
  } catch {
    return { questions: [], mode: "error" };
  }
}

export async function fetchTalkExtract(
  decision: string,
  answer: string,
  lang: "en" | "ko"
): Promise<{ cards: CardCandidate[]; mode: string }> {
  try {
    const res = await fetch("/api/talk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "extract", decision, answer, lang }),
    });
    if (!res.ok) return { cards: [], mode: "error" };
    return await res.json();
  } catch {
    return { cards: [], mode: "error" };
  }
}

export async function fetchSeeds(
  decision: string,
  lang: "en" | "ko",
  max = 5
): Promise<{ seeds: SeedSuggestion[]; mode: string }> {
  try {
    const res = await fetch("/api/seeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, lang, max }),
    });
    if (!res.ok) return { seeds: [], mode: "error" };
    return await res.json();
  } catch {
    return { seeds: [], mode: "error" };
  }
}

export async function fetchBridges(
  fragments: Fragment[],
  lang: "en" | "ko",
  max = 3
): Promise<{ bridges: BridgeProposal[]; mode: BridgeMode }> {
  try {
    const res = await fetch("/api/bridges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fragments, lang, max }),
    });
    if (!res.ok) return { bridges: [], mode: "error" };
    return await res.json();
  } catch {
    return { bridges: [], mode: "error" };
  }
}

export async function fetchName(
  input: NameInput,
  lang: "en" | "ko",
  mode: RevealMode = "explore"
): Promise<NameResult> {
  try {
    const res = await fetch("/api/name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, lang, mode }),
    });
    if (!res.ok) return { name: "", note: "", question: "", mode, error: true };
    return await res.json();
  } catch {
    return { name: "", note: "", question: "", mode, error: true };
  }
}

export async function fetchMirror(
  input: MirrorInput,
  lang: "en" | "ko"
): Promise<{ reflection: MirrorReflection; mode: string }> {
  try {
    const res = await fetch("/api/mirror", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, lang }),
    });
    if (!res.ok) {
      return { reflection: { connected: [], tensions: [], separate: [] }, mode: "error" };
    }
    return await res.json();
  } catch {
    return { reflection: { connected: [], tensions: [], separate: [] }, mode: "error" };
  }
}

export async function fetchBlindSpot(
  decision: string,
  pieces: Array<{ title: string; body: string; role: string }>,
  lang: "en" | "ko",
  exclude: string[] = []
): Promise<{ angle: string; rationale: string; question: string; mode: string }> {
  try {
    const res = await fetch("/api/blindspot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, pieces, lang, exclude }),
    });
    if (!res.ok) return { angle: "", rationale: "", question: "", mode: "error" };
    return await res.json();
  } catch {
    return { angle: "", rationale: "", question: "", mode: "error" };
  }
}

export async function fetchTradeOff(
  decision: string,
  tensions: Array<{ a: string; b: string }>,
  separations: Array<{ a: string; b: string }>,
  lang: "en" | "ko"
): Promise<{ tension: string; favors: string; cost: string; mode: string }> {
  try {
    const res = await fetch("/api/tradeoff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, tensions, separations, lang }),
    });
    if (!res.ok) return { tension: "", favors: "", cost: "", mode: "error" };
    return await res.json();
  } catch {
    return { tension: "", favors: "", cost: "", mode: "error" };
  }
}

export async function fetchDirections(
  decision: string,
  realQuestion: string,
  cruxTitle: string | undefined,
  tensions: Array<{ a: string; b: string }>,
  lang: "en" | "ko"
): Promise<{ directions: Array<{ direction: string; because: string }>; mode: string }> {
  try {
    const res = await fetch("/api/directions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, realQuestion, cruxTitle, tensions, lang }),
    });
    if (!res.ok) return { directions: [], mode: "error" };
    return await res.json();
  } catch {
    return { directions: [], mode: "error" };
  }
}
