/**
 * END-TO-END PIPELINE TRACE — verify with EXECUTION, not by reading code.
 *
 * The claim to falsify: "the team's cards flow into the link proposals, and the confirmed
 * links flow into the final elephant." This drives a real session through the real modules
 * and prints what each stage would actually send to the model, so a broken hand-off shows
 * up as a missing string rather than as a plausible-sounding paragraph.
 */
import { bridgePrompt, namePrompt, tradeOffPrompt, directionsPrompt, blindSpotPrompt, type NameInput, type FacetSummary } from "../src/lib/prompts.ts";
import { buildGroundingTable } from "../src/lib/grounding.ts";
import { computeSynthesis } from "../src/lib/synthesis.ts";
import { findClusters } from "../src/lib/clusters.ts";

const F = (id: string, title: string, body: string, role: string) =>
  ({ id, title, body, authorRole: role, authorName: role, x: 0.5, y: 0.5 }) as any;
const B = (id: string, a: string, b: string, rel: string, expl: string, createdBy = "ai") =>
  ({ id, fragmentAId: a, fragmentBId: b, relationType: rel, explanation: expl,
     evidenceA: `ev-${a}`, evidenceB: `ev-${b}`, confidence: 0.8, status: "confirmed", createdBy }) as any;

// ── A realistic table. Distinctive tokens per card so we can grep for leakage. ──
const fragments = [
  F("f1", "Budget never landed", "The pilot passed but ZEBRAFISH money for the rollout was never allocated.", "ops"),
  F("f2", "Floor is exhausted", "We swapped three tools last year; nobody trusts a new QUOKKA rollout.", "frontline"),
  F("f3", "No audit trail", "There is no record of who approved what, so NARWHAL disputes go nowhere.", "legal"),
  F("f4", "Support queue grew", "Tickets doubled since the pilot; the AXOLOTL backlog is now weeks.", "support"),
];
const bridges = [
  B("b1", "f1", "f3", "dependency", "Budget delay keeps pushing the PANGOLIN logging work back"),
  B("b2", "f2", "f1", "tension", "Every push to scale faster costs more OKAPI trust on the floor"),
  B("b3", "f1", "f4", "dependency", "Unfunded rollout left support carrying the TAPIR load"),
  B("b4", "f2", "f3", "separate", "Fatigue and compliance are different kinds of IBEX claim", "human"),
];

const say = (h: string) => console.log(`\n${"═".repeat(78)}\n${h}\n${"═".repeat(78)}`);

// A trace that only prints can never fail, so it rots. Every check below is also an
// assertion: if a hand-off breaks, this exits non-zero instead of printing a quiet ❌.
let failures = 0;
const has = (hay: string, needle: string) => {
  if (hay.includes(needle)) return "✅";
  failures++;
  return "❌ MISSING";
};
const expect = (cond: boolean, what: string) => {
  if (cond) return "✅";
  failures++;
  return `❌ ${what}`;
};

// ── STAGE 2: Connect — do the CARDS reach the link proposal? ──
say("STAGE 2 · CONNECT — do the team's cards reach the bridge prompt?");
const bp = bridgePrompt(fragments, "en", 3, {
  confirmed: [{ aId: "f1", bId: "f3", relationType: "dependency" as any, retyped: true, aiRelationType: "overlap" as any }],
  rejectedPairs: [{ aId: "f2", bId: "f4" }],
});
for (const f of fragments) {
  const tok = f.body.match(/[A-Z]{4,}/)![0];
  console.log(`  card "${f.title}" body token ${tok}: ${has(bp, tok)}`);
}
console.log(`  already-confirmed pair hidden from re-proposal: ${has(bp, "ALREADY CONNECTED")}`);
console.log(`  rejected pair announced:                        ${has(bp, "REJECTED by the team")}`);
console.log(`  team's type correction taught back:             ${has(bp, "CORRECTED it to")}`);

// ── The engine: does the graph the team built actually drive the shape? ──
say("STAGE 3a · ENGINE — is the elephant computed from the CONFIRMED links?");
const clusters = findClusters(fragments, bridges, 3);
const main = clusters[0];
console.log(`  clusters found: ${clusters.length}; main holds ${main?.fragmentIds.length} pieces`);
const synth = computeSynthesis(fragments, bridges, main);
const byId = (id: string) => fragments.find((f) => f.id === id);
console.log(`  facets: ${synth.facets.length}, tensions kept: ${synth.tensions.length}, wholeness: ${Math.round(synth.coverage.wholeness * 100)}%`);
const keystone = synth.facets.find((f) => f.id === synth.keystoneFacetId);
console.log(`  KEYSTONE (causal root): "${keystone ? byId(keystone.anchorId)?.title : "(none)"}"`);
console.log(`  spine: ${synth.spine.map((c) => c.map((fid) => { const fx = synth.facets.find((x) => x.id === fid); return byId(fx!.anchorId)?.title; }).join(" → ")).join(" | ") || "(none)"}`);
console.log(`  → is "separate" (b4) excluded from the walk? f2-f3 must NOT be fused:`);
const f2f = synth.facets.find((x) => x.fragmentIds.includes("f2"));
const f3f = synth.facets.find((x) => x.fragmentIds.includes("f3"));
console.log(`     f2 in ${f2f?.id}, f3 in ${f3f?.id} → ${expect(f2f?.id !== f3f?.id, "FUSED — separate must never join two pieces")}`);

// ── STAGE 3b: does the reveal prompt carry BOTH the cards and the links? ──
say("STAGE 3b · REVEAL — do cards AND confirmed links reach the elephant prompt?");
const clusterFrags = main.fragmentIds.map(byId).filter(Boolean) as any[];
const clusterBridges = bridges.filter((b) => main.fragmentIds.includes(b.fragmentAId) && main.fragmentIds.includes(b.fragmentBId));
const hist = new Map([["b1", { aiRelationType: "overlap" as any, retyped: true, edited: false }]]);
const table = buildGroundingTable(clusterFrags, clusterBridges, hist);
const facets: FacetSummary[] = synth.facets.map((f) => ({
  anchor: byId(f.anchorId)?.title ?? "?", members: f.fragmentIds.map((id) => byId(id)?.title ?? "?"),
  depth: f.depth, supports: f.supports, dependsOn: f.dependsOn, isKeystone: f.id === synth.keystoneFacetId,
}));
const input: NameInput = {
  fragments: clusterFrags.map((f) => ({ id: f.id, title: f.title, body: f.body, authorRole: f.authorRole })),
  bridges: clusterBridges.map((b) => ({ id: b.id, aTitle: byId(b.fragmentAId)?.title ?? "?", bTitle: byId(b.fragmentBId)?.title ?? "?",
    relationType: b.relationType, explanation: b.explanation, evidenceA: b.evidenceA, evidenceB: b.evidenceB,
    aiRelationType: hist.get(b.id)?.aiRelationType, retyped: Boolean(hist.get(b.id)?.retyped), humanDrawn: b.createdBy === "human" })),
  cruxTitle: keystone ? byId(keystone.anchorId)?.title : undefined, facets,
  tensions: synth.tensions.map((tn) => { const b = bridges.find((x) => x.id === tn.bridgeId)!;
    return { a: byId(b.fragmentAId)!.title, b: byId(b.fragmentBId)!.title }; }),
  spine: synth.spine.map((c) => c.map((fid) => { const fx = synth.facets.find((x) => x.id === fid)!; return byId(fx.anchorId)!.title; })),
  wholeness: Math.round(synth.coverage.wholeness * 100),
};
const np = namePrompt(input, "en", "verdict", table);
console.log("  CARD bodies present in the reveal prompt:");
for (const f of clusterFrags) { const tok = f.body.match(/[A-Z]{4,}/)![0]; console.log(`    "${f.title}" (${tok}): ${has(np, tok)}`); }
console.log("  LINK explanations present in the reveal prompt:");
for (const b of clusterBridges) { const tok = b.explanation.match(/[A-Z]{4,}/)![0]; console.log(`    ${b.id} (${tok}): ${has(np, tok)}`); }
console.log(`  team's override surfaced:      ${has(np, "THE TEAM OVERRODE THE AI")}`);
console.log(`  hand-drawn link surfaced:      ${has(np, "THE TEAM DREW THIS THEMSELVES")}`);
console.log(`  keep-apart spelled out:        ${has(np, "KEEP APART")}`);
console.log(`  citation contract present:     ${has(np, "CITATION")}`);
console.log(`  engine's ROOT tagged:          ${has(np, "[ROOT")}`);

// ── STAGE 3c: downstream steps ──
say("STAGE 3c · DOWNSTREAM — trade-off & directions");
const tens = synth.tensions.map((tn) => { const b = bridges.find((x) => x.id === tn.bridgeId)!;
  return { id: b.id, a: byId(b.fragmentAId)!.title, b: byId(b.fragmentBId)!.title, why: b.explanation, retyped: false, handle: "T1" }; });
const tp = tradeOffPrompt("We fund the rollout before proving ROI", tens, [], "en");
console.log(`  trade-off sees the kept tension:        ${has(tp, "Floor is exhausted")}`);
console.log(`  trade-off can cite it by handle:        ${has(tp, "[T1]")}`);
const dp = directionsPrompt("fund it", "what to prove first?", input.cruxTitle, tens, "en",
  clusterFrags.map((f) => ({ title: f.title, body: f.body, role: f.authorRole })), input.spine!);
console.log("  directions sees CARD bodies:");
for (const f of clusterFrags) { const tok = f.body.match(/[A-Z]{4,}/)![0]; console.log(`    "${f.title}" (${tok}): ${has(dp, tok)}`); }
console.log(`  directions sees the tension's WHY:      ${has(dp, "OKAPI")}`);
console.log(`  directions sees the causal spine:       ${has(dp, "→")}`);
const bsp = blindSpotPrompt("adopt the tool", clusterFrags.map((f) => ({ title: f.title, body: f.body, role: f.authorRole })), "en", [],
  clusterBridges.map((b) => ({ a: byId(b.fragmentAId)!.title, b: byId(b.fragmentBId)!.title, relationType: b.relationType, why: b.explanation })));
console.log(`  blind spot sees the connections:        ${has(bsp, "CONNECTED so far")}`);
console.log(`  blind spot sees a kept tension:         ${has(bsp, "tension")}`);

// ── SIZE PROFILE ──
say("SIZE PROFILE (chars) — 4 cards / 4 links");
for (const [n, p] of [["bridges", bp], ["name/reveal", np], ["tradeoff", tp], ["directions", dp], ["blindspot", bsp]] as const) {
  console.log(`  ${n.padEnd(14)} ${String(p.length).padStart(6)} chars  ≈ ${String(Math.round(p.length / 3.6)).padStart(5)} tok`);
}

// ── DUPLICATION CHECK: how many times does one card title appear in the reveal prompt? ──
say("DUPLICATION — how often does each card TITLE repeat inside the reveal prompt?");
for (const f of clusterFrags) {
  const n = np.split(f.title).length - 1;
  console.log(`  "${f.title}" appears ${n}×`);
}
if (failures) {
  console.error(`\n${failures} pipeline hand-off check(s) FAILED — the team's work is not reaching a prompt.`);
  process.exit(1);
}
console.log("\nAll pipeline hand-offs intact.");
