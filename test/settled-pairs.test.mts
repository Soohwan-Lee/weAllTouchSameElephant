import assert from "node:assert/strict";
import { settledPairKey, settledPairSet } from "../src/lib/settledPairs.ts";

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log("  ✓", name);
};

console.log("\nsettled pairs");

check("compact keys preserve exclusions beyond the detailed-history cap", () => {
  const keys = Array.from({ length: 85 }, (_, index) =>
    settledPairKey(`f${index}`, `f${index + 1}`)
  );
  const settled = settledPairSet({
    confirmed: keys.slice(0, 40).map((key) => {
      const [aId, bId] = key.split("::");
      return { aId, bId, relationType: "complement" as const };
    }),
    rejectedPairs: [],
    settledPairKeys: keys,
  });

  assert.equal(settled.size, 85);
  assert.equal(settled.has(settledPairKey("f84", "f85")), true);
});

check("pair order and malformed keys cannot bypass or pollute filtering", () => {
  const settled = settledPairSet({
    confirmed: [],
    rejectedPairs: [],
    settledPairKeys: ["b::a", "a::b", "missing", "a::b::c"],
  });
  assert.deepEqual([...settled], ["a::b"]);
});

console.log(`\n${passed} settled-pair assertions passed\n`);
