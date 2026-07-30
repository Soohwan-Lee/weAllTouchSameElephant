import assert from "node:assert/strict";
import { discoveryProgress } from "../src/lib/discovery.ts";
import type { Bridge, Fragment, Participant, RelationType } from "../src/lib/types.ts";

let passed = 0;
const check = (name: string, run: () => void) => {
  run();
  passed++;
  console.log("  ✓", name);
};

const participants: Participant[] = [
  { id: "p1", name: "A", role: "sales", color: "#111111" },
  { id: "p2", name: "B", role: "support", color: "#222222" },
  { id: "p3", name: "C", role: "engineering", color: "#333333" },
];
const fragment = (id: string, authorId: string): Fragment => ({
  id,
  authorId,
  authorName: authorId,
  authorRole: "role",
  title: id,
  body: `${id} body`,
  x: 0,
  y: 0,
});
const fragments = [fragment("f1", "p1"), fragment("f2", "p2"), fragment("f3", "p3")];
const bridge = (id: string, a: string, b: string, relationType: RelationType): Bridge => ({
  id,
  fragmentAId: a,
  fragmentBId: b,
  relationType,
  explanation: "because",
  evidenceA: "a",
  evidenceB: "b",
  status: "confirmed",
  createdBy: "human",
});

console.log("\ndiscovery compass");

check("collects every seat before treating the current frame as complete", () => {
  const progress = discoveryProgress(fragments.slice(0, 2), [], participants);
  assert.equal(progress.next, "collect");
  assert.equal(progress.contributed, 2);
});

check("asks for a cross-seat bridge after every seat contributes", () => {
  const progress = discoveryProgress(fragments, [], participants);
  assert.equal(progress.next, "cross");
});

check("does not mistake same-seat linking for integration", () => {
  const progress = discoveryProgress(
    [...fragments, fragment("f4", "p1")],
    [bridge("b1", "f1", "f4", "overlap")],
    participants
  );
  assert.equal(progress.crossSeatLinks, 0);
  assert.equal(progress.next, "cross");
});

check("asks for direction after perspectives cross", () => {
  const progress = discoveryProgress(
    fragments,
    [bridge("b1", "f1", "f2", "complement")],
    participants
  );
  assert.equal(progress.next, "cause");
});

check("asks for a challenge before converging on an untested causal picture", () => {
  const progress = discoveryProgress(
    fragments,
    [
      bridge("b1", "f1", "f2", "dependency"),
      bridge("b2", "f2", "f3", "complement"),
    ],
    participants
  );
  assert.equal(progress.next, "challenge");
});

check("recognizes a picture that has voices, direction, and dissent", () => {
  const progress = discoveryProgress(
    fragments,
    [
      bridge("b1", "f1", "f2", "dependency"),
      bridge("b2", "f2", "f3", "tension"),
    ],
    participants
  );
  assert.equal(progress.next, "reflect");
  assert.equal(progress.crossSeatLinks, 2);
  assert.equal(progress.causalLinks, 1);
  assert.equal(progress.challengeLinks, 1);
});

console.log(`\n${passed} discovery-compass assertions passed\n`);
