/**
 * DOES THE TEAM'S WORK ACTUALLY CHANGE THE AI'S OUTPUT?
 *
 * The pipeline trace proves the team's cards and links REACH the prompt. That is a
 * different claim from "the output reflects them" — a model can be handed everything and
 * still say the same generic thing. This runs the real model and compares conditions that
 * differ only in what the team contributed.
 *
 * Conditions (same fragments, same relation types, same engine structure throughout):
 *   BARE     — titles and bare relation types. What a generic assistant could be handed.
 *   +LINKS   — adds the team's own explanations of WHY each pair connects.
 *   +SHAPE   — adds the engine's facets/spine/root (structure the model can't derive).
 *   FULL     — adds the overrides: where the team re-typed the AI, drew a link themselves,
 *              or declared a boundary. This is what the app actually sends.
 *
 * The decisive probe is the override. The scenario is built so that a model reading only
 * the graph would fuse two pieces the team explicitly refused to merge. If the team's
 * boundary work matters, FULL respects it and BARE does not.
 *
 * Usage:  OPENAI_API_KEY=... npx tsx test/ablation.live.mts [model] [runs]
 * Costs real money. Not part of `npm test`.
 */
import OpenAI from "openai";
import { namePrompt, type NameInput, type FacetSummary } from "../src/lib/prompts.ts";
import { buildGroundingTable } from "../src/lib/grounding.ts";
import { computeSynthesis } from "../src/lib/synthesis.ts";
import { verifyClaim, groundingReport } from "../src/lib/grounding.ts";
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

// ── The table. Built so the ROOT is sparsely linked (an engine finding a model would miss)
//    and so two pieces look mergeable but were explicitly kept apart by the team.
const fragments = [
  F("f1", "Nobody owns the rollout budget",
    "The pilot was approved out of innovation funds. No line item exists for scaling it, and no one has been named to ask for one.", "ops"),
  F("f2", "The floor is tired of new tools",
    "We replaced three tools last year. People have stopped reading the announcements.", "frontline"),
  F("f3", "Approvals leave no record",
    "When someone signs off on an exception there is no trail, so disputes come back to us months later with nothing to point at.", "legal"),
  F("f4", "Support tickets doubled",
    "Since the pilot, ticket volume is up 2x and the backlog is three weeks deep.", "support"),
  F("f5", "Training never happened",
    "The rollout plan assumed two days of training per team. It was cut when the timeline moved up.", "enablement"),
];

// f1 is the ROOT: it drives f3 and f5, nothing drives it. It has FEW links — the engine
// finds it by causal position, whereas link-count would crown f4 or f2.
const bridges = [
  B("b1", "f1", "f3", "dependency",
    "With no budget line, the logging work that would create an approval trail keeps getting deferred",
    "no line item exists for scaling", "there is no trail"),
  B("b2", "f1", "f5", "dependency",
    "Training was the first thing cut precisely because no one owned a budget to defend it",
    "no one has been named to ask for one", "It was cut when the timeline moved up"),
  B("b3", "f5", "f4", "dependency",
    "Skipping training is what put the volume into the support queue",
    "two days of training per team", "ticket volume is up 2x"),
  // THE DECISIVE ONE. An AI first called this "overlap" — both sound like "people are
  // unhappy". The team re-typed it to "tension": fixing fatigue means slowing down, which
  // costs the very support backlog it would relieve. Merging them erases the trade-off.
  B("b4", "f2", "f4", "tension",
    "Relieving the backlog means pushing harder and faster, which is exactly what exhausted the floor",
    "stopped reading the announcements", "backlog is three weeks deep"),
  // The team drew this one themselves and declared a boundary.
  B("b5", "f2", "f3", "separate",
    "Staff fatigue and the audit gap are different kinds of claim — one is about capacity, one about liability. Solving them together would produce a compromise that fixes neither",
    "stopped reading", "disputes come back", "human"),
];
const history = new Map<string, BridgeEdit>([
  ["b4", { aiRelationType: "overlap", retyped: true, edited: true }],
]);

const cluster = { id: "c", fragmentIds: fragments.map((f) => f.id) } as never;
const synth = computeSynthesis(fragments, bridges, cluster);
const byId = (id: string) => fragments.find((f) => f.id === id)!;
const keystone = synth.facets.find((f) => f.id === synth.keystoneFacetId);

type Cond = "BARE" | "+LINKS" | "+SHAPE" | "FULL";

function inputFor(cond: Cond): { input: NameInput; table?: ReturnType<typeof buildGroundingTable> } {
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
  // BARE gets no grounding table: no handles, no citation contract — a generic prompt.
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
  const parsed = JSON.parse(c.choices[0]?.message?.content ?? "{}") as Record<string, unknown>;
  const verdict = String(parsed.verdict ?? "");
  const name = String(parsed.name ?? "");
  const question = String(parsed.question ?? "");

  // grounding, only measurable when the citation contract was in play
  let rate: number | null = null, fab: number | null = null;
  if (table) {
    const claims = [
      verifyClaim(name, parsed.nameGrounds, table),
      verifyClaim(question, parsed.questionGrounds, table),
      verifyClaim(verdict, parsed.verdictGrounds ?? parsed.readingGrounds, table),
    ];
    const r = groundingReport(claims);
    rate = r.rate; fab = r.fabricationRate;
  }
  return { cond, name, verdict, question, rate, fab, chars: prompt.length };
}

// ── Scoring the decisive behaviours, mechanically ──────────────────────────────
const txt = (r: { name: string; verdict: string; question: string }) =>
  `${r.name} ${r.verdict} ${r.question}`.toLowerCase();

/** Did it name the sparsely-linked causal ROOT (budget ownership) rather than a loud symptom? */
const namesRoot = (r: ReturnType<typeof txt> extends never ? never : { name: string; verdict: string; question: string }) => {
  const s = txt(r);
  return /budget|owner|own |fund|line item|no one owns/.test(s);
};
/** Did it fall for the loudest symptom instead? */
const namesSymptom = (r: { name: string; verdict: string; question: string }) => {
  const s = txt(r);
  return /(ticket|backlog|support queue)/.test(s) && !namesRoot(r);
};
/** Did it MERGE the two the team kept apart (fatigue + audit), which the team refused? */
const mergesSeparated = (r: { name: string; verdict: string; question: string }) => {
  const s = txt(r);
  const fatigue = /(fatigue|tired|exhaust|burnout|trust|morale)/.test(s);
  const audit = /(audit|approval|record|trail|complian|liabilit)/.test(s);
  return fatigue && audit;
};

const CONDS: Cond[] = ["BARE", "+LINKS", "+SHAPE", "FULL"];

console.log(`\nmodel=${MODEL}  runs=${RUNS} per condition\n`);
const tally: Record<string, { root: number; symptom: number; merged: number; rate: number[]; chars: number }> = {};

for (const cond of CONDS) {
  tally[cond] = { root: 0, symptom: 0, merged: 0, rate: [], chars: 0 };
  for (let i = 0; i < RUNS; i++) {
    const r = await run(cond);
    tally[cond].chars = r.chars;
    if (namesRoot(r)) tally[cond].root++;
    if (namesSymptom(r)) tally[cond].symptom++;
    if (mergesSeparated(r)) tally[cond].merged++;
    if (r.rate !== null) tally[cond].rate.push(r.rate);
    console.log(`[${cond} ${i + 1}] "${r.name}" — ${r.verdict}`);
    if (r.rate !== null) console.log(`         grounding rate ${(r.rate * 100).toFixed(0)}%  fabricated ${(r.fab! * 100).toFixed(0)}%`);
  }
  console.log();
}

console.log("═".repeat(74));
console.log("cond      names ROOT   names symptom   MERGED what team kept apart   grounding");
console.log("─".repeat(74));
for (const c of CONDS) {
  const t = tally[c];
  const g = t.rate.length ? `${Math.round((t.rate.reduce((a, b) => a + b, 0) / t.rate.length) * 100)}%` : "n/a";
  console.log(
    `${c.padEnd(9)} ${String(t.root).padStart(2)}/${RUNS}         ${String(t.symptom).padStart(2)}/${RUNS}` +
    `              ${String(t.merged).padStart(2)}/${RUNS}                  ${g.padStart(5)}   (${t.chars} ch)`
  );
}
console.log("═".repeat(74));
console.log("\nROOT should RISE and MERGED should FALL as the team's work is added.");
console.log("MERGED in FULL is the failure that matters most: the team said do not merge these.\n");
