import assert from "node:assert/strict";
import {
  buildGroundingTable,
  verifyClaim,
  groundingReport,
  resolveToIds,
  renderFragments,
  renderBridges,
  traceNameResult,
} from "../src/lib/grounding.ts";

const F = (id: string, title: string, role = "ops") => ({
  id, title, body: `body of ${title}`, authorRole: role, authorName: "", x: 0, y: 0,
}) as any;

const B = (id: string, a: string, b: string, rel: string, extra: any = {}) => ({
  id, fragmentAId: a, fragmentBId: b, relationType: rel,
  explanation: `why ${a}~${b}`, evidenceA: "ev-a", evidenceB: "ev-b",
  confidence: 1, status: "confirmed", createdBy: "ai", ...extra,
}) as any;

let pass = 0;
const t = (name: string, fn: () => void) => {
  fn();
  pass++;
  console.log("  ok -", name);
};

console.log("\n[handles]");
const frags = [F("frag-aaa", "Budget is missing"), F("frag-bbb", "Floor is exhausted", "frontline"), F("frag-ccc", "No audit trail", "legal")];
const bridges = [
  B("br-1", "frag-aaa", "frag-ccc", "dependency"),
  B("br-2", "frag-bbb", "frag-aaa", "tension"),
];
const table = buildGroundingTable(frags, bridges);

t("fragments get sequential F handles", () => {
  assert.deepEqual(table.fragments.map((f) => f.handle), ["F1", "F2", "F3"]);
});
t("bridges get sequential B handles", () => {
  assert.deepEqual(table.bridges.map((b) => b.handle), ["B1", "B2"]);
});
t("valid set contains all handles and nothing else", () => {
  assert.deepEqual([...table.valid].sort(), ["B1", "B2", "F1", "F2", "F3"]);
});

console.log("\n[dangling bridges dropped]");
t("bridge referencing a fragment outside the table is excluded", () => {
  const tb = buildGroundingTable(frags, [...bridges, B("br-x", "frag-aaa", "frag-ZZZ", "overlap")]);
  assert.equal(tb.bridges.length, 2, "the dangling bridge must not get a handle");
  assert.ok(!tb.valid.has("B3"));
});

console.log("\n[citation verification]");
t("valid handles verify", () => {
  const c = verifyClaim("some reading", ["F1", "B2"], table);
  assert.deepEqual(c.grounds, ["F1", "B2"]);
  assert.equal(c.ungrounded, false);
  assert.deepEqual(c.invalidGrounds, []);
});
t("invented handle is dropped, not passed through", () => {
  const c = verifyClaim("x", ["F1", "F99", "B7"], table);
  assert.deepEqual(c.grounds, ["F1"]);
  assert.deepEqual(c.invalidGrounds.sort(), ["B7", "F99"]);
  assert.equal(c.ungrounded, false, "one good citation still counts as grounded");
});
t("all-invented citations => ungrounded", () => {
  const c = verifyClaim("x", ["F42"], table);
  assert.deepEqual(c.grounds, []);
  assert.equal(c.ungrounded, true);
});
t("prose is NEVER modified by verification", () => {
  const c = verifyClaim("the exact prose", ["NOPE"], table);
  assert.equal(c.value, "the exact prose");
});
t("no citations at all => ungrounded, no crash", () => {
  assert.equal(verifyClaim("x", undefined, table).ungrounded, true);
  assert.equal(verifyClaim("x", null, table).ungrounded, true);
  assert.equal(verifyClaim("x", [], table).ungrounded, true);
});

console.log("\n[handle normalization — model drift]");
t("bracketed / lowercase / padded handles all accepted", () => {
  const c = verifyClaim("x", ["[F1]", " f2 ", "b1"], table);
  assert.deepEqual(c.grounds.sort(), ["B1", "F1", "F2"]);
});
t("comma string instead of array still parses", () => {
  const c = verifyClaim("x", "F1, B2", table);
  assert.deepEqual(c.grounds.sort(), ["B2", "F1"]);
});
t("duplicate citations counted once", () => {
  const c = verifyClaim("x", ["F1", "F1", "[f1]"], table);
  assert.deepEqual(c.grounds, ["F1"]);
});
t("non-string junk ignored", () => {
  const c = verifyClaim("x", [null, 42, {}, "F1"], table);
  assert.deepEqual(c.grounds, ["F1"]);
});

console.log("\n[grounding report]");
t("rate = share of claims with >=1 valid citation", () => {
  const r = groundingReport([
    verifyClaim("a", ["F1"], table),
    verifyClaim("b", ["F2"], table),
    verifyClaim("c", ["F99"], table),
    verifyClaim("d", [], table),
  ]);
  assert.equal(r.claims, 4);
  assert.equal(r.grounded, 2);
  assert.equal(r.rate, 0.5);
});
t("fabricationRate = invented / all cited", () => {
  const r = groundingReport([verifyClaim("a", ["F1", "F99"], table)]);
  assert.equal(r.fabricationRate, 0.5);
  assert.deepEqual(r.invalidHandles, ["F99"]);
});
t("empty claim list does not divide by zero", () => {
  const r = groundingReport([]);
  assert.equal(r.rate, 0);
  assert.equal(r.fabricationRate, 0);
});

console.log("\n[resolve back to real ids]");
t("handles resolve to the ORIGINAL ids, split by kind", () => {
  const { fragmentIds, bridgeIds } = resolveToIds(["F1", "F3", "B2"], table);
  assert.deepEqual(fragmentIds, ["frag-aaa", "frag-ccc"]);
  assert.deepEqual(bridgeIds, ["br-2"]);
});
t("unknown handles resolve to nothing", () => {
  const r = resolveToIds(["F99", "ZZ"], table);
  assert.deepEqual(r.fragmentIds, []);
  assert.deepEqual(r.bridgeIds, []);
});

console.log("\n[override history — the key signal]");
const hist = new Map([["br-2", { aiRelationType: "overlap" as any, retyped: true, edited: false }]]);
const tableH = buildGroundingTable(frags, bridges, hist);
t("retype recorded when AI type differs from final", () => {
  const b2 = tableH.bridges.find((b) => b.id === "br-2")!;
  assert.equal(b2.retyped, true);
  assert.equal(b2.aiRelationType, "overlap");
});
t("override surfaces in the rendered prompt text", () => {
  const txt = renderBridges(tableH);
  assert.match(txt, /THE TEAM OVERRODE THE AI/);
  assert.match(txt, /proposed "overlap"/);
  assert.match(txt, /re-typed it to "tension"/);
});
t("no override => no override line", () => {
  const txt = renderBridges(table);
  assert.doesNotMatch(txt, /OVERRODE/);
});
t("AI type equal to final is NOT reported as an override", () => {
  const same = new Map([["br-2", { aiRelationType: "tension" as any, retyped: false }]]);
  const tb = buildGroundingTable(frags, bridges, same);
  assert.equal(tb.bridges.find((b) => b.id === "br-2")!.retyped, false);
  assert.equal(tb.bridges.find((b) => b.id === "br-2")!.aiRelationType, undefined);
});
t("differing AI type implies retype even if the flag is missing", () => {
  const noFlag = new Map([["br-1", { aiRelationType: "complement" as any }]]);
  const tb = buildGroundingTable(frags, bridges, noFlag);
  assert.equal(tb.bridges.find((b) => b.id === "br-1")!.retyped, true);
});
t("human-drawn link is announced", () => {
  const tb = buildGroundingTable(frags, [B("br-h", "frag-aaa", "frag-bbb", "overlap", { createdBy: "human" })]);
  assert.match(renderBridges(tb), /THE TEAM DREW THIS THEMSELVES/);
});

console.log("\n[rendering]");
t("every fragment is rendered with its handle and role", () => {
  const txt = renderFragments(table);
  assert.match(txt, /\[F1\] "Budget is missing"/);
  assert.match(txt, /from the frontline seat/);
});
t("direction is preserved for dependency", () => {
  assert.match(renderBridges(table), /F1 --dependency--> F3/);
});
t("complement is rendered without a causal arrow", () => {
  const tb = buildGroundingTable(frags, [B("br-c", "frag-aaa", "frag-bbb", "complement")]);
  const txt = renderBridges(tb);
  assert.match(txt, /F1 <--complement--> F2/);
  assert.doesNotMatch(txt, /F1 --complement--> F2/);
});
t("tension renders bidirectionally", () => {
  assert.match(renderBridges(table), /F2 <--tension--> F1/);
});
t("separate renders as a barred link, not a join", () => {
  const tb = buildGroundingTable(frags, [B("br-s", "frag-aaa", "frag-bbb", "separate")]);
  assert.match(renderBridges(tb), /-\/-separate-\/-/);
});
t("separate spells out KEEP APART in words, not only in symbols", () => {
  const tb = buildGroundingTable(frags, [B("br-s", "frag-aaa", "frag-bbb", "separate")]);
  const txt = renderBridges(tb);
  assert.match(txt, /KEEP APART/);
  assert.match(txt, /must NOT be merged/);
});
t("a connecting relation never gets the KEEP APART warning", () => {
  assert.doesNotMatch(renderBridges(table), /KEEP APART/);
});
t("empty table renders '(none)' rather than blank", () => {
  const empty = buildGroundingTable([], []);
  assert.equal(renderFragments(empty), "(none)");
  assert.equal(renderBridges(empty), "(none)");
});

console.log("\n[shown-claim trace]");
t("fallback prose cannot inherit citations from a missing model claim", () => {
  const parsed = {
    name: "A model name",
    nameGrounds: ["F1"],
    question: "A model question?",
    questionGrounds: ["F2"],
    verdict: "",
    verdictGrounds: ["B1"],
  };
  const shown = {
    name: "A model name",
    note: "",
    question: "A model question?",
    mode: "verdict" as const,
    verdict: "A local fallback verdict",
  };
  const trace = traceNameResult(parsed, "verdict", table, shown, new Set(["verdict"]));
  assert.deepEqual(trace.fragmentIds.sort(), ["frag-aaa", "frag-bbb"]);
  assert.deepEqual(trace.bridgeIds, [], "the fallback verdict must not inherit B1");
  assert.equal(trace.rate, 0.667);
  assert.equal(trace.claims, 3);
});

console.log(`\n${pass} assertions passed.\n`);
