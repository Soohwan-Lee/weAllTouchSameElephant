/**
 * DOES SITUATIONAL CONTEXT HELP, WHERE ROLE CONTEXT DID NOT?
 *
 * test/rolecontext.live.mts found that saying more about WHO you are changes nothing —
 * no-role, one-word, and a full sentence of role context scored identically. This asks the
 * follow-up: does more about the SITUATION help? Those are different things. A role is a
 * label the model can already infer from the card; a situation carries facts that exist
 * nowhere else on the table.
 *
 * This matters because the app already collects exactly this and throws it away. In talk
 * mode a person writes up to 1,200 characters in their own words, the AI extracts short
 * card drafts, and the original answer is then discarded — never stored, never logged,
 * never seen again by any later step. If the long version helps, that is a deletion of the
 * team's own words; if it does not, the current behaviour is correct and cheap.
 *
 * Conditions, same 5 pieces / same 4 links / same seats:
 *   CARD  — today: the short card only
 *   +WHY  — each card keeps one extra sentence of the circumstance behind it
 *   +FULL — each card keeps the whole paragraph the person actually wrote
 *
 * RESULT (gpt-4.1): a NULL, and a lesson about run counts. At 4 runs per condition the
 * longer versions looked better — 3.3 seats vs 3.0, and verdicts that said the constraint was
 * "invisible to most of the team", which the short-card condition never produced. At 8 runs
 * per condition every number was identical: 3.0 seats, 0.0 deep facts, 24/24 grounded, across
 * all three depths. The apparent effect was noise. Do not trust n=4 here.
 *
 * So today's behaviour is correct: talk mode may keep discarding the long answer, and the
 * card body is doing the work. The extra text costs ~16% prompt size and buys nothing
 * measurable. Together with test/rolecontext.live.mts this is the second context-volume null
 * — more input text is not what is holding the reading back.
 *
 * Usage: OPENAI_API_KEY=... npx tsx test/context.live.mts [model] [runs]
 *        Use at least 8 runs per condition; 4 produced a false positive.
 */
import OpenAI from "openai";
import { namePrompt, type NameInput, type FacetSummary } from "../src/lib/prompts.ts";
import { buildGroundingTable, verifyClaim, groundingReport } from "../src/lib/grounding.ts";
import { computeSynthesis } from "../src/lib/synthesis.ts";
import { findClusters } from "../src/lib/clusters.ts";
import type { Bridge, Fragment } from "../src/lib/types.ts";

const MODEL = process.argv[2] || "gpt-4.1";
const RUNS = Number(process.argv[3] || 4);

// Each piece has three depths of the SAME observation. The extra sentences carry real
// circumstance — a date, a cause, a constraint — that the short card leaves implicit.
const PIECES = [
  { id: "f1", seat: "procurement", title: "Vendor contract",
    card: "The March renewal fixed the seat count until next March.",
    why: "Adding seats mid-term reopens the whole negotiation, which legal says takes about six weeks.",
    full: "We signed the renewal in March under budget pressure, and the trade we made was a locked per-seat price in exchange for a fixed seat count until next March. Adding seats mid-term reopens the whole negotiation, which legal says takes about six weeks. I flagged it at the time but nobody expected demand to move this fast." },
  { id: "f2", seat: "eng", title: "Slack thread",
    card: "The team keeps asking why we can't just add people when demand spikes.",
    why: "Nobody outside procurement seems to know there is a contractual cap at all.",
    full: "Every couple of weeks someone asks in the channel why we can't just add people when demand spikes, and I never have a good answer. Nobody outside procurement seems to know there is a contractual cap at all. I have started telling people it is a budget thing because that is the only explanation I have." },
  { id: "f3", seat: "sales", title: "Onboarding calls",
    card: "New accounts wait nine days for a setup call.",
    why: "Two churned last month during the wait, and both said the delay was the reason.",
    full: "New accounts are waiting nine days for a setup call because we only have two people who can run them. Two churned last month during the wait, and both said the delay was the reason. I have been quietly deprioritising smaller accounts to protect the big ones, which is not a decision anyone approved." },
  { id: "f4", seat: "analytics", title: "Q3 numbers",
    card: "Trial-tier conversion is down eleven percent quarter over quarter.",
    why: "The drop is concentrated entirely in accounts that waited more than a week to activate.",
    full: "Trial-tier conversion is down eleven percent quarter over quarter. The drop is concentrated entirely in accounts that waited more than a week to activate — the ones that got in quickly convert at the same rate as always. I cannot see why they waited from the dashboard, only that waiting predicts the loss." },
  { id: "f5", seat: "support", title: "Thursday sync",
    card: "We spent Thursday re-explaining the same workflow to different people.",
    why: "These are accounts that never got a proper setup call, so they arrive to us instead.",
    full: "We spent most of Thursday re-explaining the same workflow to different people. These are accounts that never got a proper setup call, so they arrive to us instead and we do the onboarding informally without any of the materials. It is the third week running and it is now most of what the team does." },
] as const;

const B = (id: string, a: string, b: string, expl: string): Bridge => ({
  id, fragmentAId: a, fragmentBId: b, relationType: "dependency", explanation: expl,
  evidenceA: "", evidenceB: "", confidence: 0.8, status: "confirmed", createdBy: "ai",
});
const bridges = [
  B("b1", "f1", "f2", "The reason we cannot add people is the contract"),
  B("b2", "f1", "f3", "Because the seat count is frozen we cannot staff onboarding, which is why the queue is nine days"),
  B("b3", "f3", "f4", "Accounts that wait nine days never activate, and that is what the conversion drop measures"),
  B("b4", "f3", "f5", "The setup backlog is what pushes people to ask support instead"),
];

type Depth = "card" | "why" | "full";
const bodyFor = (p: (typeof PIECES)[number], d: Depth) =>
  d === "card" ? p.card : d === "why" ? `${p.card} ${p.why}` : p.full;

function build(depth: Depth) {
  const fragments: Fragment[] = PIECES.map((p) => ({
    id: p.id, title: p.title, body: bodyFor(p, depth),
    authorRole: p.seat, authorName: p.seat, x: 0.5, y: 0.5,
  }));
  const cluster = findClusters(fragments, bridges, 3)[0];
  const synth = computeSynthesis(fragments, bridges, cluster);
  const byId = (id: string) => fragments.find((f) => f.id === id)!;
  const keystone = synth.facets.find((f) => f.id === synth.keystoneFacetId);
  const table = buildGroundingTable(fragments, bridges);
  const facets: FacetSummary[] = synth.facets.map((f) => ({
    anchor: byId(f.anchorId).title, members: f.fragmentIds.map((id) => byId(id).title),
    depth: f.depth, supports: f.supports, dependsOn: f.dependsOn,
    isKeystone: f.id === synth.keystoneFacetId,
  }));
  const input: NameInput = {
    fragments: fragments.map((f) => ({ id: f.id, title: f.title, body: f.body, authorRole: f.authorRole })),
    bridges: bridges.map((b) => ({
      id: b.id, aId: b.fragmentAId, bId: b.fragmentBId,
      aTitle: byId(b.fragmentAId).title, bTitle: byId(b.fragmentBId).title,
      relationType: b.relationType, explanation: b.explanation,
    })),
    cruxTitle: keystone ? byId(keystone.anchorId).title : undefined,
    facets,
    spine: synth.spine.map((c) => c.map((fid) => byId(synth.facets.find((x) => x.id === fid)!.anchorId).title)),
    wholeness: Math.round(synth.coverage.wholeness * 100),
  };
  return { table, input };
}

const SEAT: Record<string, string> = Object.fromEntries(PIECES.map((p) => [p.id, p.seat]));
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function run(depth: Depth) {
  const { table, input } = build(depth);
  const prompt = namePrompt(input, "en", "verdict", table);
  const c = await client.chat.completions.create({
    model: MODEL, messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }, temperature: 0.5,
  });
  const p = JSON.parse(c.choices[0]?.message?.content ?? "{}") as Record<string, unknown>;
  const verdict = String(p.verdict ?? "");
  const rep = groundingReport([
    verifyClaim(String(p.name ?? ""), p.nameGrounds, table),
    verifyClaim(String(p.question ?? ""), p.questionGrounds, table),
    verifyClaim(verdict, p.verdictGrounds ?? p.readingGrounds, table),
  ]);
  const seats = new Set<string>();
  for (const h of rep.citedHandles) {
    const hit = table.byHandle.get(h);
    if (!hit) continue;
    if (SEAT[hit.id]) { seats.add(SEAT[hit.id]); continue; }
    const br = bridges.find((b) => b.id === hit.id);
    if (br) { seats.add(SEAT[br.fragmentAId]); seats.add(SEAT[br.fragmentBId]); }
  }
  const s = verdict.toLowerCase();
  // Facts that ONLY exist in the deeper layers — if the reading uses them, the extra words
  // bought something the short card could not have said.
  const deepFacts = {
    sixWeeks: /six week|6 week/.test(s),
    nobodyKnew: /nobody (outside|else) know|not known|unaware|no one know|invisible|hidden from/.test(s),
    concentrated: /concentrated|only .* waited|those who waited|more than a week/.test(s),
    unapproved: /deprioriti|unapproved|nobody approved|quietly/.test(s),
    informal: /informal|without .* material|third week/.test(s),
  };
  const deepUsed = Object.values(deepFacts).filter(Boolean).length;
  return { seats: seats.size, grounded: rep.grounded, claims: rep.claims, verdict, deepUsed, promptChars: prompt.length };
}

console.log(`\nmodel=${MODEL}  runs=${RUNS} per condition   5 pieces / 5 seats / 4 links\n`);
const agg: Record<Depth, { seats: number; grounded: number; claims: number; deep: number; chars: number }> = {
  card: { seats: 0, grounded: 0, claims: 0, deep: 0, chars: 0 },
  why: { seats: 0, grounded: 0, claims: 0, deep: 0, chars: 0 },
  full: { seats: 0, grounded: 0, claims: 0, deep: 0, chars: 0 },
};
const LABEL: Record<Depth, string> = {
  card: "CARD  — today: the short card only",
  why: "+WHY  — one extra sentence of circumstance",
  full: "+FULL — the whole paragraph they wrote",
};
for (const depth of ["card", "why", "full"] as Depth[]) {
  console.log("─".repeat(76));
  console.log(LABEL[depth]);
  for (let i = 0; i < RUNS; i++) {
    const r = await run(depth);
    const a = agg[depth];
    a.seats += r.seats; a.grounded += r.grounded; a.claims += r.claims;
    a.deep += r.deepUsed; a.chars = r.promptChars;
    console.log(`  [${i + 1}] seats ${r.seats}/5  deep-facts ${r.deepUsed}/5  ${r.verdict.slice(0, 92)}`);
  }
}
console.log("\n" + "═".repeat(76));
console.log("condition   seats/5   deep facts used   grounded   prompt size");
for (const d of ["card", "why", "full"] as Depth[]) {
  const a = agg[d];
  console.log(
    `${d.padEnd(11)} ${(a.seats / RUNS).toFixed(1)}       ${(a.deep / RUNS).toFixed(1)}/5             ` +
    `${a.grounded}/${a.claims}      ${a.chars} chars`
  );
}
console.log("═".repeat(76));
console.log("deep facts = things stated ONLY in the longer versions (six-week legal lag,");
console.log("nobody outside procurement knew, drop concentrated in waiters, unapproved");
console.log("deprioritising, informal onboarding). If these never surface, the extra words");
console.log("bought nothing and today's discard is correct.");
