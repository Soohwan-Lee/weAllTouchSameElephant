/**
 * ABLATION v2 — a scenario where the answer is NOT readable off the titles.
 *
 * v1 failed as an experiment: its titles ("Nobody owns the rollout budget") stated the
 * conclusion, so the BARE condition scored 3/3 and the ablation measured nothing. A model
 * that can solve the task from titles alone tells you nothing about whether the team's work
 * mattered.
 *
 * This version fixes the design:
 *   • Titles are neutral labels ("Q3 numbers", "Thursday sync") that name WHERE a piece
 *     came from, not what it concludes. No title contains a causal claim.
 *   • Every piece is written as a plain observation. The DIRECTION between them is not
 *     stated in any body — it exists only in the links the team typed.
 *   • Two pieces are worded to look like the same complaint. An AI proposed `overlap`;
 *     the team re-typed it to `tension`. Whether the model honours that is the probe.
 *   • The causal root is the piece with the FEWEST links, so counting links gets it wrong.
 *
 * Conditions are cumulative: BARE → +LINKS → +SHAPE → FULL (the app's real payload).
 *
 * Usage: OPENAI_API_KEY=... npx tsx test/ablation2.live.mts [model] [runs]
 */
import OpenAI from "openai";
import { namePrompt, type NameInput, type FacetSummary } from "../src/lib/prompts.ts";
import { buildGroundingTable, verifyClaim, groundingReport } from "../src/lib/grounding.ts";
import { computeSynthesis } from "../src/lib/synthesis.ts";
import type { Bridge, Fragment, BridgeEdit } from "../src/lib/types.ts";

const MODEL = process.argv[2] || "gpt-4.1";
const RUNS = Number(process.argv[3] || 3);

const F = (id: string, title: string, body: string, role: string): Fragment =>
  ({ id, title, body, authorRole: role, authorName: role, x: 0.5, y: 0.5 });
const B = (
  id: string, a: string, b: string, rel: Bridge["relationType"], expl: string,
  evA: string, evB: string, createdBy: Bridge["createdBy"] = "ai"
): Bridge => ({
  id, fragmentAId: a, fragmentBId: b, relationType: rel, explanation: expl,
  evidenceA: evA, evidenceB: evB, confidence: 0.8, status: "confirmed", createdBy,
});

// ── Neutral titles. No body states a cause. The direction lives only in the links. ──
const fragments = [
  // THE ROOT — mentioned once, quietly, by the least prominent seat. Two links total.
  F("f1", "Vendor contract", "The renewal we signed in March fixes the seat count until next March. Adding seats mid-term needs a new negotiation.", "procurement"),
  F("f2", "Q3 numbers", "Conversion on the trial tier is down eleven percent quarter over quarter.", "analytics"),
  F("f3", "Thursday sync", "The three of us spent most of Thursday re-explaining the same workflow to different people.", "support"),
  F("f4", "Onboarding calls", "New accounts are waiting nine days for a setup call. Two churned last month while waiting.", "sales"),
  F("f5", "Slack thread", "The team keeps asking why we can't just add people to the workspace when demand spikes.", "eng"),
];

// f1 drives f4 and f5, nothing drives it. f3 has the MOST links but is a symptom.
const bridges = [
  B("b1", "f1", "f4", "dependency",
    "Because the seat count is frozen until the renewal, we cannot staff up onboarding, which is why the queue is nine days",
    "fixes the seat count until next March", "waiting nine days for a setup call"),
  B("b2", "f1", "f5", "dependency",
    "The reason we can't just add people is the contract, not reluctance — the team is asking a question only procurement can answer",
    "Adding seats mid-term needs a new negotiation", "why we can't just add people"),
  B("b3", "f4", "f2", "dependency",
    "Accounts that wait nine days for setup never activate, and that is what the trial conversion drop is measuring",
    "Two churned last month while waiting", "Conversion on the trial tier is down"),
  B("b4", "f4", "f3", "dependency",
    "The setup backlog is what pushes people to ask support for the workflow instead",
    "waiting nine days", "re-explaining the same workflow"),
  // DECISIVE: both read as "the team is stretched". An AI called it overlap; the team
  // re-typed it to tension — relieving support means pulling the same people off onboarding,
  // which lengthens the very queue that creates the support load.
  B("b5", "f3", "f5", "tension",
    "Every hour we spend answering the workflow questions is an hour not spent on the setup queue that generates them — we cannot relieve both with the same people",
    "spent most of Thursday re-explaining", "keeps asking why we can't just add people"),
  // The team drew this boundary themselves.
  B("b6", "f2", "f3", "separate",
    "The conversion number and the support load are different kinds of claim — one is a market signal, one is a capacity signal. Treating them as one problem produces a fix that moves neither",
    "down eleven percent", "re-explaining the same workflow", "human"),
];
const history = new Map<string, BridgeEdit>([
  ["b5", { aiRelationType: "overlap", retyped: true, edited: true }],
]);

const cluster = { id: "c", fragmentIds: fragments.map((f) => f.id) } as never;
const synth = computeSynthesis(fragments, bridges, cluster);
const byId = (id: string) => fragments.find((f) => f.id === id)!;
const keystone = synth.facets.find((f) => f.id === synth.keystoneFacetId);

type Cond = "BARE" | "+LINKS" | "+SHAPE" | "FULL";

function inputFor(cond: Cond) {
  const withLinks = cond !== "BARE";
  const withShape = cond === "+SHAPE" || cond === "FULL";
  const withOverrides = cond === "FULL";
  const table = buildGroundingTable(fragments, bridges, withOverrides ? history : new Map());
  const facets: FacetSummary[] = synth.facets.map((f) => ({
    anchor: byId(f.anchorId).title,
    members: f.fragmentIds.map((id) => byId(id).title),
    depth: f.depth, supports: f.supports, dependsOn: f.dependsOn,
    isKeystone: f.id === synth.keystoneFacetId,
  }));
  const spine = synth.spine.map((c) =>
    c.map((fid) => byId(synth.facets.find((x) => x.id === fid)!.anchorId).title));
  const input: NameInput = {
    fragments: fragments.map((f) => ({ id: f.id, title: f.title, body: f.body, authorRole: f.authorRole })),
    bridges: bridges.map((b) => ({
      id: b.id, aId: b.fragmentAId, bId: b.fragmentBId,
      aTitle: byId(b.fragmentAId).title, bTitle: byId(b.fragmentBId).title,
      relationType: b.relationType,
      explanation: withLinks ? b.explanation : undefined,
      evidenceA: withLinks ? b.evidenceA : undefined,
      evidenceB: withLinks ? b.evidenceB : undefined,
      aiRelationType: withOverrides ? history.get(b.id)?.aiRelationType : undefined,
      retyped: withOverrides ? Boolean(history.get(b.id)?.retyped) : false,
      humanDrawn: withOverrides ? b.createdBy === "human" : false,
    })),
    cruxTitle: keystone ? byId(keystone.anchorId).title : undefined,
    facets: withShape ? facets : undefined,
    spine: withShape ? spine : undefined,
    wholeness: withShape ? Math.round(synth.coverage.wholeness * 100) : undefined,
  };
  return { input, table: cond === "BARE" ? undefined : table };
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function run(cond: Cond) {
  const { input, table } = inputFor(cond);
  const prompt = namePrompt(input, "en", "verdict", table);
  const c = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.4,
  });
  const p = JSON.parse(c.choices[0]?.message?.content ?? "{}") as Record<string, unknown>;
  const out = {
    cond,
    name: String(p.name ?? ""),
    verdict: String(p.verdict ?? ""),
    question: String(p.question ?? ""),
    rate: null as number | null,
    chars: prompt.length,
  };
  if (table) {
    const r = groundingReport([
      verifyClaim(out.name, p.nameGrounds, table),
      verifyClaim(out.question, p.questionGrounds, table),
      verifyClaim(out.verdict, p.verdictGrounds ?? p.readingGrounds, table),
    ]);
    out.rate = r.rate;
  }
  return out;
}

type Out = Awaited<ReturnType<typeof run>>;
const txt = (r: Out) => `${r.name} ${r.verdict} ${r.question}`.toLowerCase();

/** the ROOT: the frozen seat count / contract. Fewest links, named once. */
const namesRoot = (r: Out) => /contract|seat count|seats|renewal|procure|negotiat|headcount/.test(txt(r));
/** the loudest symptom: the support load (most links). */
const namesSymptom = (r: Out) => !namesRoot(r) && /(support|re-explain|workflow question|thursday)/.test(txt(r));
/** merging the pair the team explicitly kept apart (conversion + support load) */
const mergesSeparated = (r: Out) => {
  const s = txt(r);
  return /(conversion|churn|trial tier|eleven percent)/.test(s) && /(support load|re-explain|workflow question)/.test(s);
};
/** flattening the kept tension into "everyone is just overloaded" */
const flattensTension = (r: Out) =>
  /(both|same problem|all.*overload|simply overwhelmed|stretched thin)/.test(txt(r)) && !/trade|either|cannot.*both|at the cost/.test(txt(r));

const CONDS: Cond[] = ["BARE", "+LINKS", "+SHAPE", "FULL"];
console.log(`\nmodel=${MODEL}  runs=${RUNS}  (neutral titles; direction lives only in the links)\n`);

const tally: Record<string, { root: number; sym: number; merged: number; flat: number; rate: number[]; chars: number }> = {};
for (const cond of CONDS) {
  tally[cond] = { root: 0, sym: 0, merged: 0, flat: 0, rate: [], chars: 0 };
  for (let i = 0; i < RUNS; i++) {
    const r = await run(cond);
    const t = tally[cond];
    t.chars = r.chars;
    if (namesRoot(r)) t.root++;
    if (namesSymptom(r)) t.sym++;
    if (mergesSeparated(r)) t.merged++;
    if (flattensTension(r)) t.flat++;
    if (r.rate !== null) t.rate.push(r.rate);
    console.log(`[${cond} ${i + 1}] "${r.name}"\n    ${r.verdict}`);
  }
  console.log();
}

console.log("═".repeat(78));
console.log("cond       ROOT    symptom   MERGED kept-apart   flattened tension   grounding");
console.log("─".repeat(78));
for (const c of CONDS) {
  const t = tally[c];
  const g = t.rate.length ? `${Math.round((t.rate.reduce((a, b) => a + b, 0) / t.rate.length) * 100)}%` : " n/a";
  console.log(
    `${c.padEnd(10)} ${String(t.root).padStart(2)}/${RUNS}     ${String(t.sym).padStart(2)}/${RUNS}` +
    `        ${String(t.merged).padStart(2)}/${RUNS}              ${String(t.flat).padStart(2)}/${RUNS}` +
    `             ${g.padStart(4)}  (${t.chars}ch)`
  );
}
console.log("═".repeat(78));
