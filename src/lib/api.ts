import type { BridgeProposal, Fragment, NameResult, RelationType, RevealMode } from "./types";
import type { BridgeContext, CardCandidate, NameInput, SeedSuggestion } from "./prompts";

/** `insufficient` is distinct from `empty`: the model answered, but nothing it proposed could
 *  be traced back to a span in the cards. The cause is thin material, not a missing table. */
export type BridgeMode = "live" | "sample" | "empty" | "error" | "insufficient";

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

/** `context` carries what the team has already confirmed or dismissed, so a repeat round
 *  proposes something new rather than re-offering settled work. Optional: without it the
 *  route behaves exactly as before. */
export async function fetchBridges(
  fragments: Fragment[],
  lang: "en" | "ko",
  max = 3,
  context?: BridgeContext,
  decision = ""
): Promise<{ bridges: BridgeProposal[]; mode: BridgeMode }> {
  try {
    const res = await fetch("/api/bridges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fragments, lang, max, context, decision }),
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

/** `links` lets the seat-finder see the shape the team has built, not just isolated cards —
 *  a kept tension shows a trade-off it may only be hearing one side of. Optional; empty on a
 *  first pass through Gather, which behaves exactly as before. */
export async function fetchBlindSpot(
  decision: string,
  pieces: Array<{ title: string; body: string; role: string }>,
  lang: "en" | "ko",
  exclude: string[] = [],
  links: Array<{ a: string; b: string; relationType: RelationType; why?: string }> = []
): Promise<{ angle: string; rationale: string; question: string; mode: string }> {
  try {
    const res = await fetch("/api/blindspot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, pieces, lang, exclude, links }),
    });
    if (!res.ok) return { angle: "", rationale: "", question: "", mode: "error" };
    return await res.json();
  } catch {
    return { angle: "", rationale: "", question: "", mode: "error" };
  }
}

/** `id`/`retyped` travel so the server can hand the model a citable handle per tension and
 *  then check that the cost it names belongs to a tension the team really kept. Both are
 *  optional: a caller that sends only titles gets the previous, uncited behavior. */
export async function fetchTradeOff(
  decision: string,
  tensions: Array<{
    a: string;
    b: string;
    id?: string;
    retyped?: boolean;
    why?: string;
    evidenceA?: string;
    evidenceB?: string;
  }>,
  separations: Array<{
    a: string;
    b: string;
    id?: string;
    why?: string;
    evidenceA?: string;
    evidenceB?: string;
  }>,
  lang: "en" | "ko"
): Promise<{
  tension: string;
  favors: string;
  cost: string;
  mode: string;
  /** the bridge id of the kept tension the cost was read off, when the model cited one and
   *  it verified. Absent means the cost is an opportunity cost, not tied to a tension. */
  groundedBridgeId?: string;
}> {
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

/** `pieces`/`spine` carry the team's own words and the causal chain they built, so a
 *  starting direction can rest on what people actually wrote instead of on headline titles.
 *  Both optional — omitting them reproduces the previous behavior. */
export async function fetchDirections(
  decision: string,
  realQuestion: string,
  cruxTitle: string | undefined,
  tensions: Array<{ a: string; b: string; why?: string; retyped?: boolean }>,
  lang: "en" | "ko",
  pieces: Array<{ title: string; body: string; role?: string }> = [],
  spine: string[][] = []
): Promise<{ directions: Array<{ direction: string; because: string }>; mode: string }> {
  try {
    const res = await fetch("/api/directions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, realQuestion, cruxTitle, tensions, lang, pieces, spine }),
    });
    if (!res.ok) return { directions: [], mode: "error" };
    return await res.json();
  } catch {
    return { directions: [], mode: "error" };
  }
}
