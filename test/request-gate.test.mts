import assert from "node:assert/strict";
import { createRequestGate } from "../src/lib/requestGate.ts";

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log("  ✓", name);
};

console.log("\nrequest gate");

check("a second click cannot start while the first request is live", () => {
  const gate = createRequestGate();
  const first = gate.begin();
  assert.equal(typeof first, "number");
  assert.equal(gate.begin(), null);
  assert.equal(gate.isCurrent(first!), true);
});

check("finishing the current request admits exactly one next request", () => {
  const gate = createRequestGate();
  const first = gate.begin()!;
  assert.equal(gate.finish(first), true);
  const second = gate.begin();
  assert.equal(typeof second, "number");
  assert.notEqual(second, first);
  assert.equal(gate.begin(), null);
});

check("cancel invalidates a late response without finishing a newer request", () => {
  const gate = createRequestGate();
  const stale = gate.begin()!;
  gate.cancel();
  const current = gate.begin()!;
  assert.equal(gate.isCurrent(stale), false);
  assert.equal(gate.finish(stale), false);
  assert.equal(gate.isCurrent(current), true);
});

console.log(`\n${passed} request-gate assertions passed\n`);
