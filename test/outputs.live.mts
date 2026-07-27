/**
 * DOES THE TEAM'S WORK SURVIVE THE MODEL — not just reach it?
 *
 * test/pipeline.trace.mts proves the cards and links reach every prompt. That is the input
 * side. This is the OUTPUT side: after the model runs, do the five things a team actually
 * reads on the final screen — the readings, the core, the real question, the trade-off, and
 * the next move — still rest on the pieces THEY wrote and the links THEY confirmed?
 *
 * The failure this is built to catch is the one that looks fine: fluent, plausible output
 * that could have been written without ever reading the table. So every card body carries a
 * distinctive nonsense token, and every link explanation carries another. A verdict that
 * names the causal root the team built will echo the structure; a verdict that was invented
 * will not. Citations are verified server-side against the real handle table, so a claim can
 * only count as grounded if it points at a piece that exists.
 *
 * Usage: OPENAI_API_KEY=... npx tsx test/outputs.live.mts [model] [runs]
 */
import OpenAI from "openai";
import {
  namePrompt, tradeOffPrompt, directionsPrompt,
  type NameInput, type FacetSummary,
} from "../src/lib/prompts.ts";
import { buildGroundingTable, verifyClaim, groundingReport } from "../src/lib/grounding.ts";
import { computeSynthesis } from "../src/lib/synthesis.ts";
import { findClusters } from "../src/lib/clusters.ts";
import type { Bridge, Fragment, RevealMode } from "../src/lib/types.ts";

const MODEL = process.argv[2] || "gpt-4.1";
const RUNS = Number(process.argv[3] || 3);

const F = (id: string, title: string, body: string, role: string): Fragment =>
  ({ id, title, body, authorRole: role, authorName: role, x: 0.5, y: 0.5 });
const B = (id: string, a: string, b: string, rel: Bridge["relationType"], expl: string, createdBy: "ai" | "human" = "ai"): Bridge => ({
  id, fragmentAId: a, fragmentBId: b, relationType: rel, explanation: expl,
  evidenceA: "", evidenceB: "", confidence: 0.8, status: "confirmed", createdBy,
});

// The scenario is built so the RIGHT answer is only available across seats: procurement
// knows the contract froze the seat count, sales sees the nine-day queue, and NOBODY wrote
// the sentence connecting them. The team's links are what make that sentence available.
const fragments = [
  F("f1", "Vendor contract", "The March renewal fixed the seat count until next March; adding seats needs a new ZEBRAFISH negotiation.", "procurement"),
  F("f2", "Slack thread", "The team keeps asking why we can't just add people when QUOKKA demand spikes.", "eng"),
  F("f3", "Onboarding calls", "New accounts wait nine days for a setup call; two churned last month during the NARWHAL wait.", "sales"),
  F("f4", "Q3 numbers", "Trial-tier conversion is down eleven percent quarter over quarter, per the AXOLOTL dashboard.", "analytics"),
  F("f5", "Thursday sync", "We spent Thursday re-explaining the same workflow to different people — the OKAPI churn of it.", "support"),
];
const bridges = [
  B("b1", "f1", "f2", "dependency", "The reason we cannot add people is the contract — PANGOLIN is a question only procurement can answer"),
  B("b2", "f1", "f3", "dependency", "Because the seat count is frozen we cannot staff onboarding, which is why the TAPIR queue is nine days"),
  B("b3", "f3", "f4", "dependency", "Accounts that wait nine days never activate, and that is what the IBEX conversion drop measures"),
  B("b4", "f3", "f5", "dependency", "The setup backlog is what pushes people to ask support instead — the DUGONG spillover", "human"),
];

const byId = (id: string) => fragments.find((f) => f.id === id)!;
const cluster = findClusters(fragments, bridges, 3)[0];
const synth = computeSynthesis(fragments, bridges, cluster);
const keystone = synth.facets.find((f) => f.id === synth.keystoneFacetId);
const cruxTitle = keystone ? byId(keystone.anchorId).title : undefined;
const hist = new Map([["b2", { aiRelationType: "overlap" as Bridge["relationType"], retyped: true, edited: false }]]);
const table = buildGroundingTable(fragments, bridges, hist);

const facets: FacetSummary[] = synth.facets.map((f) => ({
  anchor: byId(f.anchorId).title, members: f.fragmentIds.map((id) => byId(id).title),
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
    relationType: b.relationType, explanation: b.explanation,
    aiRelationType: hist.get(b.id)?.aiRelationType, retyped: Boolean(hist.get(b.id)?.retyped),
    humanDrawn: b.createdBy === "human",
  })),
  cruxTitle, facets, spine,
  wholeness: Math.round(synth.coverage.wholeness * 100),
};

// every distinctive token, and which piece/link it belongs to
const CARD_TOKENS = fragments.map((f) => ({ tok: f.body.match(/[A-Z]{4,}/)![0], from: f.title, seat: f.authorRole }));
const LINK_TOKENS = bridges.map((b) => ({ tok: b.explanation.match(/[A-Z]{4,}/)![0], from: b.id }));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ask = async (prompt: string) => {
  const c = await client.chat.completions.create({
    model: MODEL, messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }, temperature: 0.5,
  });
  return JSON.parse(c.choices[0]?.message?.content ?? "{}") as Record<string, unknown>;
};

/** Which seats a set of verified citations actually rests on. */
function seatsOf(handles: string[]) {
  const seats = new Set<string>();
  for (const h of handles) {
    const hit = table.byHandle.get(h);
    if (!hit) continue;
    const frag = fragments.find((f) => f.id === hit.id);
    if (frag) { seats.add(frag.authorRole); continue; }
    const br = bridges.find((b) => b.id === hit.id);
    if (br) { seats.add(byId(br.fragmentAId).authorRole); seats.add(byId(br.fragmentBId).authorRole); }
  }
  return seats;
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
console.log(`\nmodel=${MODEL}  runs=${RUNS}   5 pieces / 5 seats / 4 links`);
console.log(`engine says the causal ROOT is: "${cruxTitle}"   wholeness ${input.wholeness}%\n`);

const agg = { grounded: 0, claims: 0, fab: 0, seats: 0, rootHit: 0, crossClaim: 0, tradeGrounded: 0, dirEcho: 0 };

for (let i = 0; i < RUNS; i++) {
  console.log("─".repeat(74));
  console.log(`RUN ${i + 1}`);

  // ── the three reveal modes a team can pick ──
  for (const mode of ["explore", "hypothesis", "verdict"] as RevealMode[]) {
    const p = await ask(namePrompt(input, "en", mode, table));
    const body = mode === "explore"
      ? (Array.isArray(p.readings) ? (p.readings as string[]).join(" ") : "")
      : String(p[mode] ?? "");
    const grounds = p[`${mode}Grounds`] ?? p.readingsGrounds ?? p.readingGrounds;
    const claims = [
      verifyClaim(String(p.name ?? ""), p.nameGrounds, table),
      verifyClaim(String(p.question ?? ""), p.questionGrounds, table),
      verifyClaim(body, grounds, table),
    ];
    const rep = groundingReport(claims);
    const seats = seatsOf(rep.citedHandles);
    agg.grounded += rep.grounded; agg.claims += rep.claims;
    agg.fab += rep.invalidHandles.length;
    if (mode === "verdict") {
      agg.seats += seats.size;
      // does the committed claim name the cross-seat link nobody wrote alone?
      const s = body.toLowerCase();
      const constraint = /(contract|seat count|seats|renewal|negotiat|procure)/.test(s);
      const effect = /(onboard|setup|queue|nine day|churn|conversion|backlog|add people|staff)/.test(s);
      if (constraint && effect) agg.crossClaim++;
      if (cruxTitle && (s.includes("contract") || s.includes("renewal"))) agg.rootHit++;
    }
    console.log(`  ${mode.padEnd(10)} grounded ${rep.grounded}/${rep.claims}  fab ${Math.round(rep.fabricationRate * 100)}%  seats ${seats.size}/5  [${[...seats].join(",")}]`);
    console.log(`      name: "${String(p.name ?? "").slice(0, 62)}"`);
    console.log(`      Q:    "${String(p.question ?? "").slice(0, 62)}"`);
    console.log(`      ${mode}: ${body.slice(0, 110)}`);
    // leakage: did the model quote a token from a card it never cited?
    const echoed = CARD_TOKENS.filter((c) => body.includes(c.tok) || String(p.name ?? "").includes(c.tok));
    if (echoed.length) console.log(`      ⚠ raw card token echoed verbatim: ${echoed.map((e) => e.tok).join(", ")}`);
  }

  // ── trade-off: is it tied to a REAL kept tension / link? ──
  const tens = synth.tensions.map((tn, k) => {
    const b = bridges.find((x) => x.id === tn.bridgeId)!;
    return { id: b.id, a: byId(b.fragmentAId).title, b: byId(b.fragmentBId).title, why: b.explanation, retyped: false, handle: `T${k + 1}` };
  });
  const decision = "We renegotiate the contract now rather than wait for the March renewal";
  const tp = await ask(tradeOffPrompt(decision, tens, [], "en"));
  // the route returns {tension, favors, cost} — not {gain, cost}
  const gain = String(tp.favors ?? ""), cost = String(tp.cost ?? "");
  const tradeTouches = CARD_TOKENS.some((c) => `${gain}${cost}`.includes(c.tok))
    || /contract|renewal|onboard|queue|conversion|seat/i.test(`${gain} ${cost}`);
  if (tradeTouches) agg.tradeGrounded++;
  console.log(`  trade-off  tied to the table: ${tradeTouches ? "✅" : "❌"}   (kept tensions on this table: ${tens.length})`);
  console.log(`      favors: ${gain.slice(0, 88)}`);
  console.log(`      tension: ${String(tp.tension ?? "").slice(0, 88)}`);
  console.log(`      costs: ${cost.slice(0, 88)}`);

  // ── next move: does it rest on the spine the team built? ──
  const dp = await ask(directionsPrompt(decision, "What has to be true for the renegotiation to pay off?",
    cruxTitle, tens, "en", fragments.map((f) => ({ title: f.title, body: f.body, role: f.authorRole })), spine));
  // directions are objects: {direction, because} — String() on them yields [object Object]
  const raw = Array.isArray(dp.directions) ? (dp.directions as Array<Record<string, unknown>>) : [];
  const moves = raw.map((d) => `${String(d.direction ?? "")} — ${String(d.because ?? "")}`);
  const joined = moves.join(" ");
  const echoesSpine = /contract|renewal|seat count|onboard|queue|conversion/i.test(joined);
  if (echoesSpine) agg.dirEcho++;
  console.log(`  next move  rests on the spine: ${echoesSpine ? "✅" : "❌"}`);
  for (const m of moves.slice(0, 3)) console.log(`      → ${m.slice(0, 92)}`);
  const linkLeak = LINK_TOKENS.filter((l) => joined.includes(l.tok));
  if (linkLeak.length) console.log(`      ⚠ raw link token echoed: ${linkLeak.map((l) => l.tok).join(", ")}`);
}

console.log("\n" + "═".repeat(74));
console.log("DOES THE TEAM'S WORK REACH WHAT THEY READ?");
console.log("═".repeat(74));
console.log(`claims grounded in the team's own pieces : ${agg.grounded}/${agg.claims}  (${pct(agg.grounded, agg.claims)}%)`);
console.log(`citations pointing at nothing           : ${agg.fab}  ← must be 0`);
console.log(`verdict rests on avg seats              : ${(agg.seats / RUNS).toFixed(1)} of 5`);
console.log(`verdict names the engine's causal ROOT  : ${agg.rootHit}/${RUNS}`);
console.log(`verdict states the CROSS-SEAT claim     : ${agg.crossClaim}/${RUNS}  ← the sentence no card holds`);
console.log(`trade-off tied to the real table        : ${agg.tradeGrounded}/${RUNS}`);
console.log(`next move rests on the team's spine     : ${agg.dirEcho}/${RUNS}`);
console.log("═".repeat(74));
