/**
 * SEAT COVERAGE — does the shape reach PEOPLE, or just pieces?
 *
 * The reveal gate counts pieces (`largestClusterSize >= 3`). These tests pin the gap that
 * makes that insufficient: a table can pass the piece gate while one voice holds the whole
 * connected group. That is the failure the tool exists to prevent, so it gets a test.
 */
import assert from "node:assert/strict";
import { largestClusterSize, seatCoverage } from "../src/lib/clusters.ts";
import type { Bridge, Fragment } from "../src/lib/types.ts";

const F = (id: string, seat: string): Fragment =>
  ({ id, title: id, body: id, authorRole: seat, authorName: seat, x: 0, y: 0 });
const B = (id: string, a: string, b: string, rel: Bridge["relationType"] = "dependency"): Bridge => ({
  id, fragmentAId: a, fragmentBId: b, relationType: rel, explanation: "",
  evidenceA: "", evidenceB: "", confidence: 0.8, status: "confirmed", createdBy: "ai",
});

let n = 0;
const check = (label: string, fn: () => void) => { fn(); n++; console.log(`  ✓ ${label}`); };

console.log("\nseat coverage");

// THE BUG THIS EXISTS FOR: three pieces, one person, gate opens.
check("piece gate opens on a single-seat cluster — seat coverage catches it", () => {
  const frags = [F("r1", "rae"), F("r2", "rae"), F("r3", "rae"), F("t1", "tae"), F("m1", "min")];
  const bridges = [B("b1", "r1", "r2"), B("b2", "r2", "r3")];
  assert.equal(largestClusterSize(frags, bridges), 3, "piece gate passes");
  const cov = seatCoverage(frags, bridges);
  assert.equal(cov.total, 3);
  assert.equal(cov.connected, 1, "only Rae is in the shape");
  // Rae is isolated too: her three pieces link only to each other, so the shape she built
  // reaches no one else. Three linked pieces, three unheard seats, and the gate is open.
  assert.deepEqual(cov.isolated.sort(), ["min", "rae", "tae"]);
});

check("linking your own two notes does not make you heard", () => {
  const frags = [F("r1", "rae"), F("r2", "rae"), F("t1", "tae")];
  const cov = seatCoverage(frags, [B("b1", "r1", "r2")]);
  assert.deepEqual(cov.isolated.sort(), ["rae", "tae"], "same-seat link crosses nobody");
});

check("a cross-seat link makes both seats heard", () => {
  const frags = [F("r1", "rae"), F("t1", "tae"), F("m1", "min")];
  const cov = seatCoverage(frags, [B("b1", "r1", "t1")]);
  assert.equal(cov.connected, 2);
  assert.deepEqual(cov.isolated, ["min"]);
});

check("`separate` is a boundary, not a link — it connects no seats", () => {
  const frags = [F("r1", "rae"), F("t1", "tae")];
  const cov = seatCoverage(frags, [B("b1", "r1", "t1", "separate")]);
  assert.equal(cov.connected, 1, "separate must not pull seats together");
  assert.deepEqual(cov.isolated.sort(), ["rae", "tae"]);
});

check("connected counts seats in the LARGEST group, not the whole table", () => {
  // rae–tae joined; min–jae joined separately. Largest group has 2 seats, not 4.
  const frags = [F("r1", "rae"), F("t1", "tae"), F("m1", "min"), F("j1", "jae"), F("j2", "jae")];
  const cov = seatCoverage(frags, [B("b1", "r1", "t1"), B("b2", "m1", "j1"), B("b3", "j1", "j2")]);
  assert.equal(cov.total, 4);
  assert.equal(cov.connected, 2, "largest group (min,jae,jae) holds 2 seats");
  assert.deepEqual(cov.isolated, [], "everyone crossed to someone");
});

check("unattributed pieces each count as their own seat, never merged", () => {
  const anon = (id: string): Fragment =>
    ({ id, title: id, body: id, authorRole: "", authorName: "", x: 0, y: 0 });
  const cov = seatCoverage([anon("a"), anon("b")], []);
  assert.equal(cov.total, 2, "two blank authors are not one seat");
  assert.deepEqual(cov.isolated, [], "anonymous seats are not named as unheard");
});

check("empty table is safe", () => {
  const cov = seatCoverage([], []);
  assert.deepEqual(cov, { total: 0, connected: 0, isolated: [] });
});

console.log(`\n${n} seat-coverage assertions passed\n`);
