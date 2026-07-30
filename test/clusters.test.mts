import assert from "node:assert/strict";
import { findClusters } from "../src/lib/clusters.ts";
import type { Bridge, Fragment } from "../src/lib/types.ts";

const fragment = (id: string): Fragment => ({
  id,
  authorName: id,
  authorRole: "role",
  title: id,
  body: `${id} body`,
  x: 0.5,
  y: 0.5,
});

const bridge = (id: string, a: string, b: string): Bridge => ({
  id,
  fragmentAId: a,
  fragmentBId: b,
  relationType: "complement",
  explanation: "together",
  evidenceA: "",
  evidenceB: "",
  status: "confirmed",
  createdBy: "human",
});

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log("  ✓", name);
};

console.log("\nclusters");

check("adding a lexically smaller uid does not change cluster identity", () => {
  const original = [fragment("frag_zz1"), fragment("frag_zz2"), fragment("frag_zz3")];
  const originalBridges = [
    bridge("b1", "frag_zz1", "frag_zz2"),
    bridge("b2", "frag_zz2", "frag_zz3"),
  ];
  const before = findClusters(original, originalBridges)[0];
  const after = findClusters(
    [...original, fragment("frag_aa9")],
    [...originalBridges, bridge("b3", "frag_zz3", "frag_aa9")]
  )[0];

  assert.equal(before.id, "cluster_frag_zz1");
  assert.equal(after.id, before.id);
});

check("equal-sized groups have deterministic table-order priority", () => {
  const fragments = ["a1", "a2", "a3", "b1", "b2", "b3"].map(fragment);
  const clusters = findClusters(fragments, [
    bridge("ba1", "a1", "a2"),
    bridge("ba2", "a2", "a3"),
    bridge("bb1", "b1", "b2"),
    bridge("bb2", "b2", "b3"),
  ]);

  assert.deepEqual(
    clusters.map((cluster) => cluster.id),
    ["cluster_a1", "cluster_b1"]
  );
});

console.log(`\n${passed} cluster assertions passed\n`);
