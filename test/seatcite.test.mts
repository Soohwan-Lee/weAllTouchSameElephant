/**
 * SEAT CITATION — did the READING reach the seats the shape already reached?
 *
 * Distinct from test/seats.test.mts, which asks whether the assembled shape reaches people.
 * A table can pass that and still get a reveal that quietly rests on three of five voices:
 * measured at 3.0 of 5 connected seats cited, with grounding at 89% and zero fabrications.
 * The pieces are all there and the model cites some of them. These tests pin what gets
 * reported to the room when it does.
 */
import assert from "node:assert/strict";
import { seatCitation } from "../src/lib/clusters.ts";
import type { Bridge, Fragment } from "../src/lib/types.ts";

const F = (id: string, seat: string, title = id): Fragment =>
  ({ id, title, body: id, authorRole: seat, authorName: seat, x: 0, y: 0 });
/** a cited link, as the caller resolves them out of the session's bridges */
const L = (a: string, b: string, relationType: Bridge["relationType"] = "dependency") =>
  ({ fragmentAId: a, fragmentBId: b, relationType });
const anon = (id: string): Fragment =>
  ({ id, title: id, body: id, authorRole: "", authorName: "", x: 0, y: 0 });

let n = 0;
const check = (label: string, fn: () => void) => { fn(); n++; console.log(`  ✓ ${label}`); };

console.log("\nseat citation");

check("every seat cited → nothing to report", () => {
  const frags = [F("r1", "rae"), F("t1", "tae"), F("m1", "min")];
  const out = seatCitation(frags, ["r1", "t1", "m1"]);
  assert.deepEqual(out.uncited, []);
  assert.deepEqual(out.cited.sort(), ["min", "rae", "tae"]);
});

// THE MEASURED CASE: the model sees five seats and cites three.
check("uncited seats are reported by name, with their passed-over pieces", () => {
  const frags = [
    F("r1", "rae", "queue backs up at 4pm"),
    F("t1", "tae", "refund policy is unclear"),
    F("m1", "min", "we never staffed the evening"),
    F("j1", "jae", "the script assumes one channel"),
    F("j2", "jae", "escalations skip the log"),
  ];
  const out = seatCitation(frags, ["r1", "t1", "m1"]);
  assert.deepEqual(out.cited.sort(), ["min", "rae", "tae"]);
  assert.deepEqual(out.uncited, [
    { seat: "jae", titles: ["the script assumes one channel", "escalations skip the log"] },
  ]);
});

check("one cited piece is enough to make a seat cited, however many it has", () => {
  const frags = [F("j1", "jae"), F("j2", "jae"), F("r1", "rae")];
  const out = seatCitation(frags, ["j2"]);
  assert.deepEqual(out.uncited, [{ seat: "rae", titles: ["r1"] }], "jae is heard via one piece");
});

check("anonymous seats are never named as uncited", () => {
  // Blank authorship means unknown, not unheard. Reporting "— was not cited" to the room
  // invents an excluded person out of a missing field.
  const out = seatCitation([anon("a"), anon("b"), F("r1", "rae")], ["r1"]);
  assert.deepEqual(out.uncited, []);
  assert.deepEqual(out.cited, ["rae"]);
  const none = seatCitation([anon("a"), anon("b")], []);
  assert.deepEqual(none, { cited: [], uncited: [] }, "a table with no named seats reports nothing");
});

check("citations pointing at unknown pieces don't crash and cite nobody", () => {
  const frags = [F("r1", "rae"), F("t1", "tae")];
  const out = seatCitation(frags, ["ghost", "", "r1"]);
  assert.deepEqual(out.cited, ["rae"]);
  assert.deepEqual(out.uncited, [{ seat: "tae", titles: ["t1"] }]);
  assert.doesNotThrow(() => seatCitation([], ["ghost"]));
  assert.doesNotThrow(() => seatCitation(frags, []));
});

// THE BOUNDARY THIS FUNCTION IS SCOPED BY.
//
// `bo` wrote a piece, but it never got linked into the assembled cluster, so it is not on
// the table this reading was made from. The reading could not have cited it — no handle for
// it was ever minted. Reporting bo here would mean the screen says the same absence twice,
// under two headings that mean different things: "Not in this picture" (your piece never
// joined the shape — go back and link it) versus "Not yet cited in this reading" (your piece
// IS in the shape and the reading skipped it — worth asking whether it would change).
// Collapsing those two would tell bo to argue with the reading when the fix is upstream.
//
// Two things enforce this. A piece that reached neither the cluster nor the request is simply
// absent from `fragments` — the case below. A piece that DID travel to the model as a boundary
// far-end is present but excluded from `uncited` by `inPicture`, which the scope-split test
// further down covers. Both roads end with the outside seat unreported here.
check("a seat whose only piece is outside the assembled cluster is NOT reported here", () => {
  const all = [F("r1", "rae"), F("t1", "tae"), F("b1", "bo")];
  const clusterOnly = all.filter((f) => f.id !== "b1"); // bo never joined the shape
  const out = seatCitation(clusterOnly, ["r1"]);
  assert.deepEqual(out.uncited, [{ seat: "tae", titles: ["t1"] }], "only tae — bo is elsewhere");
  assert.ok(!out.uncited.some((u) => u.seat === "bo"));
  assert.ok(!out.cited.includes("bo"));
  // and a seat straddling the edge counts by its INSIDE pieces only: bo's in-cluster piece
  // was cited, so bo is heard here regardless of the piece left outside.
  const straddle = seatCitation([F("r1", "rae"), F("b2", "bo")], ["b2"]);
  assert.deepEqual(straddle.uncited, [{ seat: "rae", titles: ["r1"] }]);
});

// FROM A LIVE RUN (gpt-4.1): a verdict cited F1, F3, B2, B3. Analytics' piece was never
// cited on its own — the reading reached that seat only through the link into it. Counting
// pieces alone would have printed "analytics: not yet cited" beneath a reading built on
// exactly that link, which is the one error this panel must not make: it would send a team
// to re-argue a voice the reading already used.
check("a cited LINK reaches both the seats it joins", () => {
  const frags = [F("f1", "procurement"), F("f3", "sales"), F("f4", "analytics"), F("f2", "eng")];
  const out = seatCitation(frags, ["f1", "f3"], [L("f3", "f4")]); // B3, sales↔analytics
  assert.deepEqual(out.cited.sort(), ["analytics", "procurement", "sales"]);
  assert.deepEqual(out.uncited, [{ seat: "eng", titles: ["f2"] }]);
  // and without the link, that same seat reads as uncited — the parameter is load-bearing
  const noLinks = seatCitation(frags, ["f1", "f3"]);
  assert.deepEqual(noLinks.uncited.map((u) => u.seat).sort(), ["analytics", "eng"]);
});

// A `separate` link is the team saying "these two must NOT be merged". Citing that boundary
// is a claim ABOUT the pair, not a use of what either seat said — so it must not mark either
// end as heard. Before this was filtered, one cited piece plus one cited boundary reported
// nothing uncited on a table where two seats had genuinely gone undrawn-on: the panel went
// silent on exactly the case it exists for.
check("a cited `separate` boundary does NOT credit its endpoints", () => {
  const frags = [F("r1", "rae"), F("t1", "tae"), F("b1", "bo")];
  const out = seatCitation(frags, ["r1"], [L("t1", "b1", "separate")]);
  assert.deepEqual(out.cited, ["rae"], "the boundary heard nobody");
  assert.deepEqual(out.uncited.map((u) => u.seat).sort(), ["bo", "tae"]);
  // the same pair joined by a real link is a different claim, and does credit both
  const joined = seatCitation(frags, ["r1"], [L("t1", "b1")]);
  assert.deepEqual(joined.uncited, [], "a connecting link reaches both ends");
});

check("a cited link whose far end is unknown credits only the end that is here", () => {
  const frags = [F("r1", "rae"), F("t1", "tae")];
  const out = seatCitation(frags, [], [L("r1", "ghost")]);
  assert.deepEqual(out.cited, ["rae"]);
  assert.deepEqual(out.uncited, [{ seat: "tae", titles: ["t1"] }]);
});

// THE SCOPE SPLIT. `bo`'s piece is the far end of a keep-apart boundary: outside the cluster,
// but carried into the request so the model can cite it — so it CAN be cited, and when it is,
// the logged rate must say so or it under-reports every time a boundary crosses the edge.
// `uncited` is scoped the other way: bo is owned by the "Not in this picture" panel.
check("cited spans everything the model saw; uncited is limited to the picture", () => {
  const inPicture = [F("r1", "rae"), F("t1", "tae")];
  const shown = [...inPicture, F("b1", "bo")]; // bo = separate far-end, outside the cluster
  const ids = new Set(inPicture.map((f) => f.id));

  const out = seatCitation(shown, ["r1", "b1"], [], ids);
  assert.ok(out.cited.includes("bo"), "a far-end seat the model really cited is counted");
  assert.deepEqual(out.cited.sort(), ["bo", "rae"]);
  assert.deepEqual(out.uncited, [{ seat: "tae", titles: ["t1"] }], "bo is never named uncited");

  // and when the model cites nothing of bo's, bo still stays out of the panel entirely
  const skipped = seatCitation(shown, ["r1"], [], ids);
  assert.deepEqual(skipped.uncited.map((u) => u.seat), ["tae"]);
  assert.ok(!skipped.cited.includes("bo"));
});

check("a far-end piece is never listed among a seat's passed-over titles", () => {
  // rae has one piece in the picture and one far-end piece. Only the in-picture one is what
  // this reading passed over; naming the far-end piece here would point at the wrong thing.
  const shown = [F("r1", "rae", "in the shape"), F("r2", "rae", "far end"), F("t1", "tae")];
  const out = seatCitation(shown, ["t1"], [], new Set(["r1", "t1"]));
  assert.deepEqual(out.uncited, [{ seat: "rae", titles: ["in the shape"] }]);
});

check("seats are listed in table order, pieces in the order they were written", () => {
  const frags = [F("t1", "tae", "first"), F("r1", "rae", "second"), F("t2", "tae", "third")];
  const out = seatCitation(frags, []);
  assert.deepEqual(out.uncited, [
    { seat: "tae", titles: ["first", "third"] },
    { seat: "rae", titles: ["second"] },
  ]);
});

check("empty table is safe", () => {
  assert.deepEqual(seatCitation([], []), { cited: [], uncited: [] });
});

console.log(`\n${n} seat-citation assertions passed\n`);
