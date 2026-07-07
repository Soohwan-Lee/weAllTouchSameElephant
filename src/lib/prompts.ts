import type { Fragment, RelationType } from "./types";

const RELATION_GUIDE = `Relation types (choose exactly one per bridge):
- "overlap": the two pieces describe the SAME underlying issue from different angles.
- "tension": the two pieces pull in CONFLICTING directions.
- "dependency": one piece causes, blocks, enables, or affects the other.
- "complement": one piece adds MISSING context the other needs.`;

export function bridgePrompt(fragments: Fragment[], lang: "en" | "ko", maxBridges: number) {
  const list = fragments
    .map((f) => `- id=${f.id} | ${f.title} — ${f.body} (by ${f.authorRole})`)
    .join("\n");

  const language = lang === "ko" ? "Korean" : "English";

  return `You are helping a team see how their scattered fragments connect into one bigger picture — the "blind men and the elephant" problem. Each teammate wrote a partial view. Your ONLY job is to propose plausible CONNECTIONS (bridges) between PAIRS of fragments.

Hard rules:
- You do NOT summarize, conclude, or recommend a decision. Only propose bridges.
- Propose at most ${maxBridges} bridges, the strongest ones. Fewer is fine.
- A bridge connects exactly TWO different fragments by id.
- Ground each bridge: quote or closely paraphrase a short snippet from EACH fragment as evidence.
- If two fragments are only loosely or superficially related (shared keyword, generic theme), DO NOT force a bridge. It is correct and expected to return few or zero bridges.
- Write explanation and evidence in ${language}.

${RELATION_GUIDE}

Fragments:
${list}

Return ONLY valid JSON of this exact shape (no prose, no markdown):
{"bridges":[{"fragmentAId":"<id>","fragmentBId":"<id>","relationType":"overlap|tension|dependency|complement","explanation":"<one sentence in ${language}>","evidenceA":"<short snippet from A>","evidenceB":"<short snippet from B>","confidence":<0..1>}]}
If there are no strong bridges, return {"bridges":[]}.`;
}

export interface MirrorInput {
  fragments: Fragment[];
  bridges: Array<{
    aTitle: string;
    bTitle: string;
    relationType: RelationType;
    explanation: string;
  }>;
  looseTitles: string[];
}

export function mirrorPrompt(input: MirrorInput, lang: "en" | "ko") {
  const language = lang === "ko" ? "Korean" : "English";
  const bridgeLines = input.bridges
    .map((b) => `- "${b.aTitle}" —[${b.relationType}]— "${b.bTitle}": ${b.explanation}`)
    .join("\n");
  const loose = input.looseTitles.length ? input.looseTitles.join(", ") : "(none)";

  return `The team has finished assembling their pieces into connections. Your job is to MIRROR BACK the shape they built — reflect only what they confirmed. You are a mirror, not an author.

Hard rules:
- Do NOT introduce any new claim, fact, or interpretation.
- Do NOT recommend or make a decision.
- Only reference the confirmed connections and fragment titles given below.
- Reference fragments by their titles in quotes.
- Write in ${language}. Keep each line short.

Confirmed connections:
${bridgeLines || "(none)"}

Fragments still with no connection: ${loose}

Return ONLY valid JSON of this exact shape (no prose, no markdown):
{"connected":["<short sentence citing fragment titles>"],"tensions":["<short sentence about a tension link>"],"separate":["<short sentence naming an unconnected fragment>"]}
Sorting rule (each link goes in exactly ONE list, never both):
- A link whose relation is "tension" → put it ONLY in "tensions".
- Every other link → put it ONLY in "connected".
- Each unconnected fragment → put it in "separate".`;
}
