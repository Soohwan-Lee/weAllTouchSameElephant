import assert from "node:assert/strict";
import { computeSynthesis } from "../src/lib/synthesis.ts";
import type { Bridge, Fragment, RelationType } from "../src/lib/types.ts";

const F = (id: string, title: string): Fragment =>
  ({ id, title, body: title, authorRole: "role", authorName: "", x: 0, y: 0 });
const B = (id: string, a: string, b: string, rel: RelationType): Bridge =>
  ({ id, fragmentAId: a, fragmentBId: b, relationType: rel, explanation: "why",
     evidenceA: "", evidenceB: "", confidence: 1, status: "confirmed", createdBy: "ai" });

/** run over the WHOLE table, so pieces nobody linked still count against the score */
const synth = (frags: Fragment[], brs: Bridge[]) =>
  computeSynthesis(frags, brs, { id: "c", fragmentIds: frags.map((f) => f.id) } as never);
const pct = (frags: Fragment[], brs: Bridge[]) => Math.round(synth(frags, brs).coverage.wholeness * 100);

let pass = 0;
const t = (name: string, fn: () => void) => { fn(); pass++; console.log("  ok -", name); };

const f4 = [F("f1", "A"), F("f2", "B"), F("f3", "C"), F("f4", "D")];

console.log("\n[wholeness — the share of pieces actually related to something]");
t("no links at all → 0%", () => assert.equal(pct(f4, []), 0));
t("every piece wired by dependency → 100% (regression: this read 0%)", () => {
  assert.equal(pct(f4, [B("b1", "f1", "f2", "dependency"), B("b2", "f2", "f3", "dependency"), B("b3", "f3", "f4", "dependency")]), 100);
});
t("every piece fused by overlap → 100%", () => {
  assert.equal(pct(f4, [B("b1", "f1", "f2", "overlap"), B("b2", "f2", "f3", "overlap"), B("b3", "f3", "f4", "overlap")]), 100);
});
t("tension counts as assembly — a kept trade-off is a relation", () => {
  assert.equal(pct(f4, [B("b1", "f1", "f2", "tension"), B("b2", "f3", "f4", "tension")]), 100);
});
t("half the table wired → 50%", () => assert.equal(pct(f4, [B("b1", "f1", "f2", "dependency")]), 50));
t("3 of 4 wired → 75%", () => {
  assert.equal(pct(f4, [B("b1", "f1", "f2", "dependency"), B("b2", "f2", "f3", "dependency")]), 75);
});
t("`separate` alone is NOT assembly → 0%", () => {
  assert.equal(pct(f4, [B("b1", "f1", "f2", "separate"), B("b2", "f3", "f4", "separate")]), 0);
});
t("`separate` never inflates a real score", () => {
  const withSep = pct(f4, [B("b1", "f1", "f2", "dependency"), B("b2", "f3", "f4", "separate")]);
  assert.equal(withSep, 50, "only the dependency pair counts");
});

console.log("\n[keystone — causal position, not link count]");
t("the root drives others but nothing drives it, even when sparsely linked", () => {
  // f1 → f2, and f2 → f3, f2 → f4 makes f2 the BUSIEST node; f1 is still the root.
  const s = synth(f4, [B("b1", "f1", "f2", "dependency"), B("b2", "f2", "f3", "dependency"), B("b3", "f2", "f4", "dependency")]);
  const keystone = s.facets.find((x) => x.id === s.keystoneFacetId)!;
  assert.equal(keystone.fragmentIds[0], "f1", "a sparsely-linked source must beat a busy mid-chain node");
});

console.log("\n[separate is a boundary, not glue]");
t("`separate` never fuses two pieces into one facet", () => {
  const s = synth(f4, [B("b1", "f1", "f2", "separate")]);
  const a = s.facets.find((x) => x.fragmentIds.includes("f1"))!;
  const b = s.facets.find((x) => x.fragmentIds.includes("f2"))!;
  assert.notEqual(a.id, b.id);
});
t("only `overlap` fuses; dependency/complement/tension keep pieces distinct", () => {
  for (const rel of ["dependency", "complement", "tension"] as RelationType[]) {
    const s = synth(f4, [B("b1", "f1", "f2", rel)]);
    const a = s.facets.find((x) => x.fragmentIds.includes("f1"))!;
    const b = s.facets.find((x) => x.fragmentIds.includes("f2"))!;
    assert.notEqual(a.id, b.id, `${rel} must not fuse`);
  }
  const fused = synth(f4, [B("b1", "f1", "f2", "overlap")]);
  const a = fused.facets.find((x) => x.fragmentIds.includes("f1"))!;
  assert.ok(a.fragmentIds.includes("f2"), "overlap must fuse");
});

console.log("\n[loose pieces]");
t("a piece with no confirmed link is reported loose", () => {
  const s = synth(f4, [B("b1", "f1", "f2", "dependency")]);
  assert.deepEqual(s.looseFragmentIds.sort(), ["f3", "f4"]);
});

// The spine is what tells the naming model "A drove B drove C". It used to keep only the
// LONGEST path per source, so a root with several consequences handed the model one of them
// and silently dropped the others — at 100% wholeness, with nothing reporting the loss. On a
// real 5-person table that cost two people their place in the reading.
console.log("\n[spine]");
t("every branch off a root reaches the spine, not just the longest", () => {
  const s = synth(f4, [
    B("b1", "f1", "f2", "dependency"),
    B("b2", "f1", "f3", "dependency"),
    B("b3", "f1", "f4", "dependency"),
  ]);
  const anchors = new Set(
    s.spine.flat().map((fid) => s.facets.find((x) => x.id === fid)!.anchorId)
  );
  for (const id of ["f1", "f2", "f3", "f4"]) {
    assert.ok(anchors.has(id), `${id} dropped from the spine`);
  }
});

t("a chain that adds no new piece is not repeated", () => {
  // f1→f2→f3 plus a shortcut f1→f3: the shortcut covers nothing new, so it is dropped.
  const s = synth(f4, [
    B("b1", "f1", "f2", "dependency"),
    B("b2", "f2", "f3", "dependency"),
    B("b3", "f1", "f3", "dependency"),
  ]);
  assert.equal(s.spine.length, 1, "redundant path kept");
  assert.equal(s.spine[0].length, 3, "should keep the chain that covers all three");
});

t("a dense table stays small and still covers every piece", () => {
  const n = 12;
  const frags = Array.from({ length: n }, (_, i) => F(`g${i}`, `G${i}`));
  const bs = [];
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) bs.push(B(`b${i}_${j}`, `g${i}`, `g${j}`, "dependency"));
  const s = synth(frags, bs);
  const covered = new Set(s.spine.flat());
  assert.equal(covered.size, s.facets.length, "a piece went missing from the spine");
  assert.ok(s.spine.length <= 8, `spine exploded to ${s.spine.length} chains`);
});

console.log(`\n${pass} assertions passed.\n`);
