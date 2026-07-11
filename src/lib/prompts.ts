import type { Fragment, RelationType, RevealMode } from "./types";

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

/** A "side of the elephant" handed to the naming prompt — the shape the team built. */
export interface FacetSummary {
  /** the anchor piece's title (the side's handle) */
  anchor: string;
  /** the other pieces fused into this side */
  members: string[];
  /** 0 = a root pressure, higher = a downstream symptom */
  depth: number;
  /** how many other sides this one drives */
  supports: number;
  /** how many other sides drive this one */
  dependsOn: number;
  /** true if this is the ROOT the rest grow from (causal position, not link count) */
  isKeystone: boolean;
}

export interface NameInput {
  fragments: Array<{ title: string; body: string }>;
  bridges: Array<{ aTitle: string; bTitle: string; relationType: RelationType }>;
  /** the anchor of the facet the most others rest on — a starting point, not a verdict */
  cruxTitle?: string;
  /** the assembled shape: the sides the pieces fused into (root→symptom) */
  facets?: FacetSummary[];
  /** live tensions the team kept (pairs pulling in different directions) */
  tensions?: Array<{ a: string; b: string }>;
  /** how assembled the picture is (0..100) */
  wholeness?: number;
}

/** Per-mode instruction block: same input, three different "elephants" out. */
const MODE_SPEC: Record<
  RevealMode,
  { label: string; instruction: string; shape: string }
> = {
  explore: {
    label: "EXPLORE",
    instruction:
      "Hold the space OPEN. Offer 2–3 genuinely COMPETING readings of what this elephant is — each a different lens that a smart teammate could defend. Keep EACH reading to ONE tight sentence (~25 words max). Do not rank them. The value is that the team sees the picture could be read more than one way before they commit.",
    shape:
      '"readings": ["<reading 1: one sentence, this is really about X>", "<reading 2: one sentence, or it is about Y>", "<optional reading 3: one sentence>"]',
  },
  hypothesis: {
    label: "HYPOTHESIS",
    instruction:
      "Make ONE sharp, FALSIFIABLE bet about what is really going on underneath — a provocation the team can test and disprove, not a safe restatement. Phrase it as 'Maybe the real core is X — and if so, we'd expect to see Y.' It should feel like it names something the pieces were circling but nobody said out loud. Being wrong-but-testable beats being vague-but-safe.",
    shape:
      '"hypothesis": "<one falsifiable \'maybe the real core is X\' claim with a testable consequence>"',
  },
  verdict: {
    label: "VERDICT",
    instruction:
      "Commit. State the SHARPEST single claim about what the core actually is — the one sentence you'd stake on it. No hedging, no 'it could be'. Name the thing the whole shape is really about, even if it stings a little. (The team asked for a verdict; give them one worth arguing with.)",
    shape:
      '"verdict": "<the single sharpest claim about what the core is — one committed sentence>"',
  },
};

export function namePrompt(input: NameInput, lang: "en" | "ko", mode: RevealMode = "explore") {
  const language = lang === "ko" ? "Korean" : "English";
  const spec = MODE_SPEC[mode];

  const frags = input.fragments.map((f) => `- ${f.title}: ${f.body}`).join("\n");
  const links = input.bridges
    .map((b) => `- "${b.aTitle}" —[${b.relationType}]— "${b.bTitle}"`)
    .join("\n");

  // Give the model the SHAPE the team built, not just a flat list — this is what
  // lets it say something specific instead of a generic theme.
  let shapeBlock = "";
  if (input.facets?.length) {
    const sides = input.facets
      .map((f) => {
        const tag = f.isKeystone
          ? " [ROOT — drives others but nothing drives it; likely the real core even though it may be linked to FEW pieces]"
          : "";
        const pieces = [f.anchor, ...f.members.filter((m) => m !== f.anchor)];
        const role = f.depth === 0 ? "root pressure" : `downstream (depth ${f.depth})`;
        return `  • SIDE "${f.anchor}"${tag} — ${role}, drives ${f.supports} other side(s), driven by ${f.dependsOn} — fuses: ${pieces.map((p) => `"${p}"`).join(", ")}`;
      })
      .join("\n");
    shapeBlock += `\n\nThe shape the team assembled (their pieces fused into these "sides of the elephant", laid out root pressures → visible symptoms). IMPORTANT: the real core is about CAUSAL POSITION, not how many pieces a side has — a root that drives the rest matters more than a big cluster of symptoms:\n${sides}`;
  }
  if (input.tensions?.length) {
    const tens = input.tensions.map((t) => `  • "${t.a}" ↔ "${t.b}"`).join("\n");
    shapeBlock += `\n\nLive tensions they deliberately kept (do NOT resolve these away — they are load-bearing disagreements):\n${tens}`;
  }
  if (typeof input.wholeness === "number") {
    shapeBlock += `\n\nAssembled-ness: ${input.wholeness}% (100% would mean every difference was flattened — a healthy elephant keeps several sides and live tensions).`;
  }

  return `A team laid out their partial views as pieces and CONNECTED them by hand into one shape — sides of the same "elephant." They did the assembling; you did NOT. Your job now is to read the SHAPE THEY BUILT and hand back the "${spec.label}" they asked for.

Read for what the pieces are SECRETLY about together — the thing they were all circling. Lean on the shape: the ROOT side, what rests on what (root→symptom), and the tensions they kept. Be SPECIFIC to THESE pieces — reuse their actual words and concrete nouns. Never a generic theme any team could have gotten ("communication", "alignment", "prioritization" alone are failures).

CRUCIAL — anchor on the ROOT, not the loudest symptom: the side tagged [ROOT] drives the rest but nothing drives it. It is often NOT the biggest cluster and may be linked to only one or two pieces — that is exactly why teams miss it. A downstream symptom (e.g. "no tamper-proof record", "too many features") feels concrete and tempting, but if the shape says something upstream drives it, name the UPSTREAM thing as the core and treat the symptom as its consequence. Do not quietly promote a well-connected symptom over a sparsely-connected root.

MODE = ${spec.label}. ${spec.instruction}

Then, separately, propose ONE "so the real question is…" QUESTION: the single highest-leverage thing this team should decide next. It must be an open QUESTION they can actually answer, grounded in the keystone/tension — never a recommendation, never an answer.

Hard rules:
- Ground everything in the pieces and the shape. Do NOT invent facts beyond them.
- Honor the sides — do not silently collapse a real tension into one winner.
- The question is a QUESTION, not "you should…".
- Write everything in ${language}. Keep each sentence tight.

Fragments in this cluster:
${frags}

Confirmed connections:
${links}${shapeBlock}

Return ONLY valid JSON of this exact shape (no prose, no markdown):
{"name":"<2-5 word handle for the elephant in ${language}>","note":"<one short clause on why this name, in ${language}>",${spec.shape.replace(/<([^>]+)>/g, (_m, d) => `<${d}, in ${language}>`)},"question":"<one open 'so the real question is…' question in ${language}>"}`;
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
