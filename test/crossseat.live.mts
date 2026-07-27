/**
 * DOES THE READING CROSS SEATS, OR AMPLIFY ONE?
 *
 * The premise of this tool is that each person holds a different part of the situation, so a
 * reading that could have been written from one person's card has assembled nothing. A live
 * run showed exactly that failure: the verdict declared a root and cited one of six pieces.
 *
 * This measures whether the "cross the seats" instruction changes that, with the scenario
 * built so a correct reading REQUIRES two seats:
 *
 *   • procurement knows the seat count is frozen (the constraint)
 *   • eng keeps asking why they can't add people (bumping into it, unknowingly)
 *   • sales reports a nine-day onboarding queue (the effect)
 *   • analytics reports the conversion drop (the effect's effect)
 *
 * No single card says "the contract is why onboarding is slow" — procurement never mentions
 * onboarding, sales never mentions the contract. That sentence only exists ACROSS seats, and
 * the links the team drew are what make it available.
 *
 * Metric: how many distinct seats the verdict's citations touch, plus whether the claim names
 * a link BETWEEN seats rather than restating one card.
 *
 * Usage: OPENAI_API_KEY=... npx tsx test/crossseat.live.mts [model] [runs]
 */
import OpenAI from "openai";
import { namePrompt, type NameInput, type FacetSummary } from "../src/lib/prompts.ts";
import { buildGroundingTable, verifyClaim, groundingReport } from "../src/lib/grounding.ts";
import { computeSynthesis } from "../src/lib/synthesis.ts";
import type { Bridge, Fragment } from "../src/lib/types.ts";

const MODEL = process.argv[2] || "gpt-4.1";
const RUNS = Number(process.argv[3] || 5);

const F = (id: string, title: string, body: string, role: string): Fragment =>
  ({ id, title, body, authorRole: role, authorName: role, x: 0.5, y: 0.5 });
const B = (id: string, a: string, b: string, rel: Bridge["relationType"], expl: string): Bridge => ({
  id, fragmentAId: a, fragmentBId: b, relationType: rel, explanation: expl,
  evidenceA: "", evidenceB: "", confidence: 0.8, status: "confirmed", createdBy: "ai",
});

const fragments = [
  F("f1", "Vendor contract", "The renewal we signed in March fixes the seat count until next March. Adding seats mid-term needs a new negotiation.", "procurement"),
  F("f2", "Slack thread", "The team keeps asking why we can't just add people to the workspace when demand spikes.", "eng"),
  F("f3", "Onboarding calls", "New accounts are waiting nine days for a setup call. Two churned last month while waiting.", "sales"),
  F("f4", "Q3 numbers", "Conversion on the trial tier is down eleven percent quarter over quarter.", "analytics"),
  F("f5", "Thursday sync", "The three of us spent most of Thursday re-explaining the same workflow to different people.", "support"),
];
const bridges = [
  B("b1", "f1", "f2", "dependency", "The reason we can't just add people is the contract — the team is asking a question only procurement can answer"),
  B("b2", "f1", "f3", "dependency", "Because the seat count is frozen we cannot staff up onboarding, which is why the queue is nine days"),
  B("b3", "f3", "f4", "dependency", "Accounts that wait nine days never activate, and that is what the conversion drop is measuring"),
  B("b4", "f3", "f5", "dependency", "The setup backlog is what pushes people to ask support for the workflow instead"),
];

const cluster = { id: "c", fragmentIds: fragments.map((f) => f.id) } as never;
const synth = computeSynthesis(fragments, bridges, cluster);
const byId = (id: string) => fragments.find((f) => f.id === id)!;
const keystone = synth.facets.find((f) => f.id === synth.keystoneFacetId);
const table = buildGroundingTable(fragments, bridges);

const facets: FacetSummary[] = synth.facets.map((f) => ({
  anchor: byId(f.anchorId).title,
  members: f.fragmentIds.map((id) => byId(id).title),
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

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function run() {
  const prompt = namePrompt(input, "en", "verdict", table);
  const c = await client.chat.completions.create({
    model: MODEL, messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }, temperature: 0.5,
  });
  const p = JSON.parse(c.choices[0]?.message?.content ?? "{}") as Record<string, unknown>;
  const verdict = String(p.verdict ?? "");
  const claims = [
    verifyClaim(String(p.name ?? ""), p.nameGrounds, table),
    verifyClaim(String(p.question ?? ""), p.questionGrounds, table),
    verifyClaim(verdict, p.verdictGrounds ?? p.readingGrounds, table),
  ];
  const rep = groundingReport(claims);
  // which SEATS the citations touch — the number this test exists for
  const seats = new Set<string>();
  for (const h of rep.citedHandles) {
    const hit = table.byHandle.get(h);
    if (!hit) continue;
    const frag = fragments.find((f) => f.id === hit.id);
    if (frag) seats.add(frag.authorRole);
    else {
      // a bridge citation implicates BOTH its ends' seats
      const br = bridges.find((b) => b.id === hit.id);
      if (br) { seats.add(byId(br.fragmentAId).authorRole); seats.add(byId(br.fragmentBId).authorRole); }
    }
  }
  return { verdict, name: String(p.name ?? ""), seats: [...seats], rate: rep.rate };
}

// The claim only exists across seats: it must tie the CONSTRAINT (procurement) to a
// DOWNSTREAM EFFECT (sales/analytics/eng) — neither card states that link alone.
const linksConstraintToEffect = (v: string) => {
  const s = v.toLowerCase();
  const constraint = /(contract|seat count|seats|renewal|negotiat|procure)/.test(s);
  const effect = /(onboard|setup|queue|nine day|churn|conversion|backlog|add people|staff)/.test(s);
  return constraint && effect;
};

console.log(`\nmodel=${MODEL}  runs=${RUNS}  seats on the table: 5\n`);
let totalSeats = 0, crossed = 0, linked = 0;
for (let i = 0; i < RUNS; i++) {
  const r = await run();
  totalSeats += r.seats.length;
  if (r.seats.length >= 2) crossed++;
  if (linksConstraintToEffect(r.verdict)) linked++;
  console.log(`[${i + 1}] "${r.name}"  seats=${r.seats.length} (${r.seats.join(", ")})`);
  console.log(`    ${r.verdict}`);
}
console.log("\n" + "═".repeat(70));
console.log(`avg seats cited      : ${(totalSeats / RUNS).toFixed(1)} of 5`);
console.log(`crossed ≥2 seats     : ${crossed}/${RUNS}`);
console.log(`tied constraint→effect: ${linked}/${RUNS}   ← the claim no single card states`);
console.log("═".repeat(70));
