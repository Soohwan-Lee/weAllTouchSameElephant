import type { Fragment, RelationType, RevealMode } from "./types";

const RELATION_GUIDE = `Relation types — pick the ONE that is truest, in this priority when more than one seems to fit:
- "dependency": one piece CAUSES, drives, blocks, or enables the other. Prefer this whenever there's any cause→effect direction — it's what reveals root vs symptom. Put the CAUSE/root as fragmentA and the EFFECT/symptom as fragmentB (direction matters).
- "tension": the two pieces pull in genuinely CONFLICTING directions — satisfying one costs the other. Only if a real trade-off exists, not just different topics.
- "overlap": the two are the SAME underlying issue in two vocabularies — one could be rephrased into the other. Use sparingly; this FUSES them into one side.
- "complement": one adds the MISSING context the other needs to make sense — different facets of one situation, neither causing the other.
- "separate": these two look linkable but must be kept APART — merging them would collapse a distinction that matters (different timescales, different people affected, different kinds of claim). Propose this ONLY when a merge is genuinely tempting and genuinely wrong; it is the team's call to make far more often than yours.`;

export function bridgePrompt(fragments: Fragment[], lang: "en" | "ko", maxBridges: number) {
  const list = fragments
    .map((f) => `- id=${f.id} | ${f.title} — ${f.body} (by ${f.authorRole})`)
    .join("\n");

  const language = lang === "ko" ? "Korean" : "English";

  return `You are helping a team see how their scattered fragments connect into ONE bigger picture — the "blind men and the elephant" problem. Each teammate wrote a partial view of the same situation. Your ONLY job is to propose the connections (bridges) that assemble those views into a single coherent shape.

Think first, then propose:
1. Read all fragments as partial views of ONE underlying situation. What is the situation?
2. Find the CAUSAL SPINE: which piece is a root pressure, which are downstream symptoms of it? Direction is the most valuable thing you can surface — it's what tells the team what's a cause vs a symptom.
3. Propose bridges that CONNECT THE PICTURE TOGETHER (prefer links that grow one connected group over links between already-linked pieces or isolated side-pairs).

Hard rules:
- You do NOT summarize, conclude, or recommend a decision. Only propose bridges between PAIRS of fragments (by id).
- Propose at most ${maxBridges} bridges — the ones that most reveal the shape. Fewer, sharper bridges beat many weak ones.
- QUALITY BAR — reject weak bridges. A bridge is weak (do NOT propose it) if it rests on a shared keyword, a generic theme ("both about the team", "both are problems"), or a link so obvious it tells the team nothing. Every bridge must say something the team might NOT already see.
- Each explanation must name the SPECIFIC relationship in ONE concrete sentence — not "these are related" but *how* and, for dependency, *which way*. Ground it: quote a short real snippet from EACH fragment as evidence.
- It is correct to return few or zero bridges if the fragments don't genuinely connect. Do not force coverage.
- Write explanation and evidence in ${language}. Evidence snippets stay in the fragment's own words.

${RELATION_GUIDE}

Fragments:
${list}

Return ONLY valid JSON of this exact shape (no prose, no markdown):
{"bridges":[{"fragmentAId":"<cause/root id for dependency>","fragmentBId":"<effect/symptom id for dependency>","relationType":"dependency|tension|overlap|complement|separate","explanation":"<one concrete sentence in ${language} naming the specific relationship and, for dependency, the direction>","evidenceA":"<short snippet from A>","evidenceB":"<short snippet from B>","confidence":<0..1>}]}
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
  /** the causal chains the team built, root→symptom (e.g. ["A", "B", "C"]) —
   *  the actual spine, so the model can see what drives what, not just per-side depth */
  spine?: string[][];
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
      "Hold the space OPEN. Offer 2–3 genuinely COMPETING readings of what this elephant is — each a different lens that a smart teammate could defend. Keep EACH reading to ONE tight sentence (~25 words max). Do not rank them. STYLE: each reading must open DIFFERENTLY and lead with its own concrete claim — do NOT stamp them all from one template ('It's a … story', '이건 … 이야기', 'Maybe…', '어쩌면…'). The value is that the team sees the picture could be read more than one way before they commit.",
    shape:
      '"readings": ["<reading 1: one sentence, lead with the concrete claim>", "<reading 2: one sentence, a different lens, different opening>", "<optional reading 3: one sentence>"]',
  },
  hypothesis: {
    label: "HYPOTHESIS",
    instruction:
      "Make ONE sharp, FALSIFIABLE bet about what is really going on underneath — a provocation the team can test and disprove, not a safe restatement. Two moves in one or two sentences: (1) name the underlying core, (2) give the concrete thing you'd EXPECT TO SEE if it's true (the test). It should name something the pieces were circling but nobody said out loud. Being wrong-but-testable beats vague-but-safe. STYLE: open with the claim itself, not a hedge. Do NOT begin with 'Maybe the real core is…' / '어쩌면 진짜 핵심은…' — that opener is banned. Start from the concrete noun (e.g. 'The audit trail is the hidden dependency — if so, every stalled deal traces to it.'). Vary sentence shape.",
    shape:
      '"hypothesis": "<one falsifiable claim + its testable consequence; do NOT start with \'Maybe\'/\'어쩌면\'>"',
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
  if (input.spine?.length) {
    const chains = input.spine
      .filter((c) => c.length >= 2)
      .map((c) => `  • ${c.map((s) => `"${s}"`).join(" → ")}`)
      .join("\n");
    if (chains) {
      shapeBlock += `\n\nThe causal chains they built (read left→right as "drives / is needed by"). The LEFTMOST link in a chain is upstream of everything to its right — that is where the core usually hides:\n${chains}`;
    }
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

Then, separately, propose ONE QUESTION: the single highest-leverage thing this team should decide next. It must be an open QUESTION they can actually answer, grounded in the keystone/tension — never a recommendation, never an answer.

Hard rules:
- Ground everything in the pieces and the shape. Do NOT invent facts beyond them.
- Honor the sides — do not silently collapse a real tension into one winner.
- The question is a QUESTION, not "you should…".
- Start the question with its OWN first word. The UI already prints the "so the real question is…" framing above it, so any lead-in ("So the real question is", "그래서 진짜 질문은", "The question is") would read twice. Open on the substance.
- Write everything in ${language}. Keep each sentence tight.

Fragments in this cluster:
${frags}

Confirmed connections:
${links}${shapeBlock}

Return ONLY valid JSON of this exact shape (no prose, no markdown):
{"name":"<2-5 word handle for the elephant in ${language}>","note":"<one short clause on why this name, in ${language}>",${spec.shape.replace(/<([^>]+)>/g, (_m, d) => `<${d}, in ${language}>`)},"question":"<one open question in ${language}, with NO 'so the real question is' lead-in>"}`;
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

/** One "angle seed" — a possible vantage on the decision, NOT a finished fragment.
 *  The person picks one and rewrites it in their own words before it becomes a card. */
export interface SeedSuggestion {
  /** a short handle for the angle (becomes a title draft) */
  angle: string;
  /** a one-line nudge that opens the angle — a prompt to answer, not a claim to keep */
  nudge: string;
  /** which vantage this angle comes from (e.g. "frontline", "customer") — for grouping */
  lens: string;
}

/**
 * SEEDS prompt — for the person who's stuck on a blank card. The model does NOT write
 * their perspective; it scatters SHORT possible ANGLES on the decision, each from a
 * different vantage, so the person can pick one and fill it in themselves. This keeps the
 * "everyone touched a different side" premise real: the seed is a doorway, not the room.
 */
export function seedsPrompt(decision: string, lang: "en" | "ko", maxSeeds: number) {
  const language = lang === "ko" ? "Korean" : "English";
  return `A team is deciding: "${decision}". One member is stuck on a blank card — they can't tell what part of this THEY see. Your job is to offer ${maxSeeds} short possible ANGLES on this decision, each from a DIFFERENT vantage (e.g. frontline worker, customer/user, decision-maker, builder, someone affected but unheard).

CRUCIAL — you are NOT writing their perspective for them. Each angle is a DOORWAY: a short handle + a one-line question that opens it. It must be generic enough that the person has to fill in their OWN specifics — never a finished opinion they could just accept. Think "a lens to look through", not "a view to adopt".

Rules:
- ${maxSeeds} angles, each a genuinely different vantage. Spread them — do not give three flavors of one seat.
- "angle": 2–5 words, a neutral handle (e.g. "The daily grind", "What users feel", "The trade-off nobody names").
- "nudge": ONE open question that makes the person supply their own content (e.g. "What part of this do you deal with that others don't see?"). Never a claim, never an answer.
- Stay on THIS decision. Do not invent facts about the team.
- Write in ${language}.

Return ONLY valid JSON of this exact shape (no prose, no markdown):
{"seeds":[{"angle":"<2-5 word handle in ${language}>","nudge":"<one open question in ${language}>","lens":"<one-word vantage tag>"}]}`;
}

/** A card candidate extracted from what the person SAID — a draft they then edit/approve. */
export interface CardCandidate {
  title: string;
  body: string;
}

/**
 * TALK: opening questions. For the person who can't yet name what they see, the model asks
 * a few short questions to draw it out — it does NOT answer for them. One round, 2–3 questions.
 */
export function talkQuestionsPrompt(decision: string, lang: "en" | "ko") {
  const language = lang === "ko" ? "Korean" : "English";
  return `A team is deciding: "${decision}". One member can't yet put their finger on what THEY see about it. Ask 2–3 SHORT, open questions to draw out their own perspective — the kind a good facilitator asks. Do NOT suggest answers, do NOT hint at a "right" view. Each question should pull a concrete, first-hand observation from where they sit.

Rules:
- 2–3 questions, each one sentence, genuinely different (not rephrasings).
- Open and specific-to-this-decision; never yes/no, never leading.
- Write in ${language}.

Return ONLY valid JSON (no prose, no markdown):
{"questions":["<one open question in ${language}>"]}`;
}

/**
 * TALK: extract card candidates. Given what the person WROTE in answer, pull out the distinct
 * perspectives THEY expressed as short card drafts. This is extraction/paraphrase of THEIR
 * words — never invention. The person edits/approves each before it becomes a fragment.
 */
export function talkExtractPrompt(decision: string, answer: string, lang: "en" | "ko") {
  const language = lang === "ko" ? "Korean" : "English";
  return `A team is deciding: "${decision}". A member was asked what they see, and answered:

"""
${answer}
"""

Pull out the DISTINCT perspectives THEY expressed, as short card drafts. This is extraction of THEIR OWN words — paraphrase tightly, never add a view they didn't state, never invent facts. If they expressed one thing, return one card; if several, split them.

Rules:
- Each card: a short "title" (2–6 words) + a "body" (1–2 sentences) drawn only from what they wrote.
- Do NOT merge genuinely different points into one card; do NOT pad a thin answer into many.
- If the answer has no substantive perspective, return an empty list.
- Write in ${language}, staying close to their phrasing.

Return ONLY valid JSON (no prose, no markdown):
{"cards":[{"title":"<2-6 words in ${language}>","body":"<1-2 sentences in ${language}>"}]}`;
}

/**
 * One BLIND SPOT — a vantage the team's pieces do not yet cover on this decision.
 *
 * The research line holds: this NAMES an angle and asks a question about it; it never writes
 * the perspective itself. The point is to send the person back to add THEIR OWN piece from a
 * seat no one has taken, not to hand them a pre-written view (that would manufacture the
 * representational gap we study, à la Empty Chair).
 */
export interface BlindSpot {
  /** the missing vantage, as a short handle (e.g. "The person who has to use it") */
  angle: string;
  /** WHY it reads as missing — grounded in what's present, so the rationale is legible */
  rationale: string;
  /** an open question that would draw out a piece from that seat (person answers it) */
  question: string;
}

export function blindSpotPrompt(
  decision: string,
  pieces: Array<{ title: string; body: string; role: string }>,
  lang: "en" | "ko",
  exclude: string[] = []
) {
  const language = lang === "ko" ? "Korean" : "English";
  const present = pieces.map((p) => `- [${p.role}] ${p.title}: ${p.body}`).join("\n");
  const roles = [...new Set(pieces.map((p) => p.role).filter((r) => r && r !== "—"))];
  const already = exclude.length
    ? `\n\nYou have ALREADY suggested these seats — do NOT repeat them; find a genuinely different one:\n${exclude.map((a) => `- ${a}`).join("\n")}`
    : "";

  return `A team is deciding: "${decision}". Below are the pieces they have put on the table, each tagged with the ROLE/seat it came from.

Your job: name ONE vantage on THIS decision that the pieces do NOT yet cover — a blind spot. Then give the RATIONALE (why it reads as missing, grounded in what IS present — e.g. "every piece is from an operator/cost seat; no one has spoken for the people who'd actually use it"), and ONE open question that would draw a piece out of that seat.

Roles present: ${roles.length ? roles.join(", ") : "(unlabeled)"}${already}

HARD rules — the team writes their own perspectives, you do NOT:
- Do NOT write the missing perspective. Name the SEAT and ask a QUESTION; the person fills it.
- The blind spot must be specific to THIS decision and these pieces, not a generic checklist item.
- Ground the rationale in what's actually on the table (roles/angles over-represented, an obviously affected party unheard, one side of a trade-off only).
- If the pieces genuinely cover the decision well from several sides, say so — return an empty angle rather than inventing a gap.
- Write in ${language}. Keep each field to one tight sentence.

Pieces on the table:
${present}

Return ONLY valid JSON (no prose, no markdown):
{"angle":"<the missing seat, 2-6 words in ${language}, or empty string if none>","rationale":"<why it reads as missing, grounded in what's present, one sentence in ${language}>","question":"<one open question that would draw out a piece from that seat, in ${language}>"}`;
}

/**
 * The TRADE-OFF a decision commits to — read off the tensions the team themselves kept.
 *
 * Grounded entirely in the team's own confirmed `tension`/`separate` structure: it does not
 * invent a cost, it names which kept tension the written decision leans on, and what the
 * other side of that tension therefore gives up. A mirror on the decision, not advice.
 */
export interface TradeOff {
  /** the tension the decision resolves in one direction (short handle) */
  tension: string;
  /** what the decision favors */
  favors: string;
  /** what therefore gives way — the cost, in the team's own terms */
  cost: string;
}

export function tradeOffPrompt(
  decision: string,
  keptTensions: Array<{ a: string; b: string }>,
  separations: Array<{ a: string; b: string }>,
  lang: "en" | "ko"
) {
  const language = lang === "ko" ? "Korean" : "English";
  const tens = keptTensions.length
    ? keptTensions.map((t) => `- "${t.a}" ⟷ "${t.b}"`).join("\n")
    : "(none)";
  const seps = separations.length
    ? separations.map((s) => `- "${s.a}" ∦ "${s.b}" (kept apart on purpose)`).join("\n")
    : "(none)";

  return `A team made this decision: "${decision}".

Below are the TENSIONS they deliberately kept while assembling (pairs pulling in different directions) and the pairs they deliberately kept SEPARATE. A decision usually resolves one of these tensions in one direction — which means the other side pays a cost.

Your job: name the ONE kept tension this decision most leans on, which side it favors, and what therefore gives way. This is a MIRROR on their own structure — do NOT invent a cost that isn't in the tensions/separations they kept, and do NOT tell them whether the trade-off is right.

HARD rules:
- Ground everything in the kept tensions/separations below. If none are relevant to the decision, return an empty "tension".
- Name the cost in the team's OWN terms (reuse the fragment titles).
- Do NOT recommend, warn, or judge — just make the trade-off legible.
- Write in ${language}. One tight sentence per field.

Kept tensions:
${tens}

Kept separate:
${seps}

Return ONLY valid JSON (no prose, no markdown):
{"tension":"<the tension the decision leans on, or empty string if none apply>","favors":"<what the decision favors, one clause in ${language}>","cost":"<what gives way as a result, one clause in ${language}>"}`;
}

/**
 * DECISION DIRECTIONS — 2–3 grounded starting points the team could take, offered right
 * before they write their own decision. Like Seeds at the input step: a HANDLE to react to,
 * never a finished decision authored for them. Each is a short direction ("Decide X before
 * Y") drawn from the shape they built — the keystone, the kept tensions, the real question —
 * so the team can pick one and rewrite it in their own words, or reject them all.
 */
export interface DecisionDirection {
  /** a short, concrete direction the team could take (a handle, not a full decision) */
  direction: string;
  /** one clause on what taking it would commit them to — grounded in their shape */
  because: string;
}

export function directionsPrompt(
  decision: string,
  realQuestion: string,
  cruxTitle: string | undefined,
  tensions: Array<{ a: string; b: string }>,
  lang: "en" | "ko"
) {
  const language = lang === "ko" ? "Korean" : "English";
  const tens = tensions.length
    ? tensions.map((t) => `- "${t.a}" ⟷ "${t.b}"`).join("\n")
    : "(none)";

  return `A team has assembled their views on this decision: "${decision}". They landed on this reframed question to answer: "${realQuestion}".

The shape they built:
- The likely core: ${cruxTitle ?? "(not identified)"}
- Live tensions they kept (real trade-offs, do NOT resolve these away):
${tens}

Offer 2–3 DIFFERENT starting DIRECTIONS the team could take on their next move — each a short, concrete handle they can react to, NOT a finished decision. The team writes their own decision; you give them starting points grounded in THEIR shape.

HARD rules:
- Each direction is a QUESTION-CLOSING MOVE the team could make ("Decide X before committing to Y", "Pilot Z with one team first"), grounded in the core and the kept tensions above.
- They must be genuinely DIFFERENT from each other — different bets, not rephrasings.
- Do NOT pick a winner, do NOT recommend one, do NOT resolve a kept tension by fiat.
- Ground each "because" in the shape (the core, a specific tension) — not generic advice.
- Write in ${language}. Keep each field to one tight clause.

Return ONLY valid JSON (no prose, no markdown):
{"directions":[{"direction":"<a concrete starting direction in ${language}>","because":"<what it commits them to, grounded in their shape, in ${language}>"}]}`;
}
