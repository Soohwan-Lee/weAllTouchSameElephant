/**
 * DOES A RICHER "WHO AM I" ACTUALLY BUY ANYTHING?
 *
 * Today the role field is a one-word text input ("Sales"). The premise worth testing before
 * spending UI on it: if people could say what they're responsible for and what they can see
 * that others can't, would the AI's links and reading get better — or is the card body
 * already carrying all the signal?
 *
 * Same pieces, same links, three conditions:
 *   BARE   — no role at all
 *   THIN   — today's one word ("procurement")
 *   RICH   — a sentence: what they own, and what they have visibility into
 *
 * Measured on the reveal, because that is what the team reads: how many SEATS the verdict
 * rests on, whether it names the causal root, and whether it states the cross-seat claim that
 * no single card contains.
 *
 * Usage: OPENAI_API_KEY=... npx tsx test/rolecontext.live.mts [model] [runs]
 */
import OpenAI from "openai";
import { namePrompt, type NameInput, type FacetSummary } from "../src/lib/prompts.ts";
import { buildGroundingTable, verifyClaim, groundingReport } from "../src/lib/grounding.ts";
import { computeSynthesis } from "../src/lib/synthesis.ts";
import { findClusters } from "../src/lib/clusters.ts";
import type { Bridge, Fragment } from "../src/lib/types.ts";

const MODEL = process.argv[2] || "gpt-4.1";
const RUNS = Number(process.argv[3] || 4);

const ROLES = {
  bare: { f1: "—", f2: "—", f3: "—", f4: "—", f5: "—" },
  thin: { f1: "procurement", f2: "eng", f3: "sales", f4: "analytics", f5: "support" },
  rich: {
    f1: "procurement — I own vendor contracts and renewals; I see cost and terms, not what teams hit day to day",
    f2: "eng — I run the platform team; I see what we're blocked on shipping, not why the constraint exists",
    f3: "sales — I run new-account onboarding; I see the customer's first two weeks, not our internal limits",
    f4: "analytics — I own the funnel dashboards; I see the numbers move but never the cause",
    f5: "support — I take the tickets; I see what breaks repeatedly, not whether anyone owns fixing it",
  },
} as const;

const bodies = {
  f1: ["Vendor contract", "The March renewal fixed the seat count until next March; adding seats needs a new negotiation."],
  f2: ["Slack thread", "The team keeps asking why we can't just add people when demand spikes."],
  f3: ["Onboarding calls", "New accounts wait nine days for a setup call; two churned last month during the wait."],
  f4: ["Q3 numbers", "Trial-tier conversion is down eleven percent quarter over quarter."],
  f5: ["Thursday sync", "We spent Thursday re-explaining the same workflow to different people."],
} as const;

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

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function build(cond: keyof typeof ROLES) {
  const roles = ROLES[cond];
  const fragments: Fragment[] = (Object.keys(bodies) as Array<keyof typeof bodies>).map((k) => ({
    id: k, title: bodies[k][0], body: bodies[k][1],
    authorRole: roles[k], authorName: roles[k].split(" —")[0], x: 0.5, y: 0.5,
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
  return { fragments, table, input, byId };
}

const SEAT_OF: Record<string, string> = { f1: "procurement", f2: "eng", f3: "sales", f4: "analytics", f5: "support" };

async function run(cond: keyof typeof ROLES) {
  const { table, input, byId } = build(cond);
  const c = await client.chat.completions.create({
    model: MODEL, messages: [{ role: "user", content: namePrompt(input, "en", "verdict", table) }],
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
    if (SEAT_OF[hit.id]) { seats.add(SEAT_OF[hit.id]); continue; }
    const br = bridges.find((b) => b.id === hit.id);
    if (br) { seats.add(SEAT_OF[br.fragmentAId]); seats.add(SEAT_OF[br.fragmentBId]); }
  }
  const s = verdict.toLowerCase();
  const cross = /(contract|seat count|renewal|negotiat|procure)/.test(s)
    && /(onboard|setup|queue|nine day|churn|conversion|backlog|add people|staff)/.test(s);
  const root = /contract|renewal|seat/.test(s);
  return { seats: seats.size, cross, root, grounded: rep.grounded, claims: rep.claims, verdict, byId };
}

console.log(`\nmodel=${MODEL}  runs=${RUNS} per condition   5 pieces / 5 seats / 4 links\n`);
const out: Record<string, { seats: number; cross: number; root: number; grounded: number; claims: number }> = {};
for (const cond of ["bare", "thin", "rich"] as const) {
  out[cond] = { seats: 0, cross: 0, root: 0, grounded: 0, claims: 0 };
  console.log("─".repeat(74));
  console.log(`${cond.toUpperCase()}  — ${cond === "bare" ? "no role" : cond === "thin" ? "one word (today)" : "a sentence of context"}`);
  for (let i = 0; i < RUNS; i++) {
    const r = await run(cond);
    out[cond].seats += r.seats; out[cond].cross += r.cross ? 1 : 0;
    out[cond].root += r.root ? 1 : 0; out[cond].grounded += r.grounded; out[cond].claims += r.claims;
    console.log(`  [${i + 1}] seats ${r.seats}/5  cross:${r.cross ? "Y" : "n"} root:${r.root ? "Y" : "n"}  ${r.verdict.slice(0, 88)}`);
  }
}
console.log("\n" + "═".repeat(74));
console.log("condition        seats/5   cross-seat claim   names root   grounded");
for (const cond of ["bare", "thin", "rich"] as const) {
  const o = out[cond];
  console.log(
    `${cond.padEnd(16)} ${(o.seats / RUNS).toFixed(1)}      ` +
    `${String(o.cross).padStart(2)}/${RUNS}              ${String(o.root).padStart(2)}/${RUNS}        ${o.grounded}/${o.claims}`
  );
}
console.log("═".repeat(74));
