/**
 * RESOLVING A SECOND LOOK — what the team decided after agreeing to look again.
 *
 * "revisited" on its own is not an answer: a team that reopens a link and then re-confirms the
 * SAME type has considered the AI's question and rejected it, which is the opposite conclusion
 * from one that adopts the suggested type. Both were recorded identically until `resolvedType`
 * was filled in on the next confirm of that pair, and this pins that it is.
 */
import assert from "node:assert/strict";
import { useSession } from "../src/lib/store.ts";
import type { BridgeProposal } from "../src/lib/types.ts";

const P = (aId: string, bId: string): BridgeProposal => ({
  fragmentAId: aId,
  fragmentBId: bId,
  relationType: "overlap",
  explanation: "same underlying issue",
  evidenceA: "a",
  evidenceB: "b",
});

let n = 0;
const check = (label: string, fn: () => void) => { fn(); n++; console.log(`  ✓ ${label}`); };

/** put two cards and one AI proposal on a clean board, then confirm it */
function boardWithConfirmedLink() {
  const s = useSession.getState();
  s.reset();
  s.addFragment({ authorName: "x", authorRole: "r", title: "A", body: "aaa" });
  s.addFragment({ authorName: "y", authorRole: "r", title: "B", body: "bbb" });
  const [f1, f2] = useSession.getState().fragments;
  useSession.getState().addProposals([P(f1.id, f2.id)]);
  const tray = useSession.getState().tray;
  useSession.getState().confirmBridge(tray[0].id);
  return { f1, f2 };
}

console.log("\ncontest resolution");

check("re-confirming a revisited link with the SAME type records that as the resolution", () => {
  const { f1, f2 } = boardWithConfirmedLink();
  const bridge = useSession.getState().bridges[0];
  useSession.getState().recordContest({
    aId: f1.id,
    bId: f2.id,
    confirmedType: "overlap",
    suggestedType: "dependency",
    outcome: "revisited",
  });
  assert.equal(useSession.getState().contests[0].resolvedType, undefined, "open while in the tray");

  // "look again" returns an AI link to the tray; the team then re-confirms it unchanged
  useSession.getState().unconfirmBridge(bridge.id);
  const back = useSession.getState().tray[0];
  useSession.getState().confirmBridge(back.id);

  const rec = useSession.getState().contests[0];
  assert.equal(rec.resolvedType, "overlap", "they kept their own reading");
  assert.notEqual(rec.resolvedType, rec.suggestedType, "and did NOT adopt the AI's");
});

check("adopting the AI's suggested type is recorded distinctly", () => {
  const { f1, f2 } = boardWithConfirmedLink();
  const bridge = useSession.getState().bridges[0];
  useSession.getState().recordContest({
    aId: f1.id,
    bId: f2.id,
    confirmedType: "overlap",
    suggestedType: "dependency",
    outcome: "revisited",
  });
  useSession.getState().unconfirmBridge(bridge.id);
  const back = useSession.getState().tray[0];
  useSession.getState().confirmBridge(back.id, { relationType: "dependency" });

  const rec = useSession.getState().contests[0];
  assert.equal(rec.resolvedType, "dependency");
  assert.equal(rec.resolvedType, rec.suggestedType, "an accept, not an override");
});

check("reopening a link and then DISMISSING it resolves as dropped", () => {
  // the third answer: they looked again and concluded the connection should not exist. Left
  // unresolved this is indistinguishable from a session that ended mid-decision.
  const { f1, f2 } = boardWithConfirmedLink();
  const bridge = useSession.getState().bridges[0];
  useSession.getState().recordContest({
    aId: f1.id,
    bId: f2.id,
    confirmedType: "overlap",
    suggestedType: "dependency",
    outcome: "revisited",
  });
  useSession.getState().unconfirmBridge(bridge.id);
  useSession.getState().rejectBridge(useSession.getState().tray[0].id);

  const rec = useSession.getState().contests[0];
  assert.equal(rec.resolvedType, "dropped");
  assert.equal(useSession.getState().bridges.length, 0, "and the link really is gone");
});

check("a KEPT contest is never resolved — the team never reopened it", () => {
  const { f1, f2 } = boardWithConfirmedLink();
  const bridge = useSession.getState().bridges[0];
  useSession.getState().recordContest({
    aId: f1.id,
    bId: f2.id,
    confirmedType: "overlap",
    outcome: "kept",
  });
  // an unrelated later confirm of the same pair must not backfill a kept record
  useSession.getState().unconfirmBridge(bridge.id);
  useSession.getState().confirmBridge(useSession.getState().tray[0].id);
  assert.equal(useSession.getState().contests[0].resolvedType, undefined);
});

check("confirming an unrelated pair leaves an open contest open", () => {
  const s = useSession.getState();
  s.reset();
  s.addFragment({ authorName: "x", authorRole: "r", title: "A", body: "aaa" });
  s.addFragment({ authorName: "y", authorRole: "r", title: "B", body: "bbb" });
  s.addFragment({ authorName: "z", authorRole: "r", title: "C", body: "ccc" });
  const [f1, f2, f3] = useSession.getState().fragments;
  useSession.getState().recordContest({
    aId: f1.id,
    bId: f2.id,
    confirmedType: "overlap",
    outcome: "revisited",
  });
  useSession.getState().addProposals([P(f2.id, f3.id)]);
  useSession.getState().confirmBridge(useSession.getState().tray[0].id);
  assert.equal(useSession.getState().contests[0].resolvedType, undefined);
});

check("the export carries the contests", () => {
  const { f1, f2 } = boardWithConfirmedLink();
  useSession.getState().recordContest({
    aId: f1.id,
    bId: f2.id,
    confirmedType: "overlap",
    outcome: "kept",
  });
  const out = useSession.getState().exportSession();
  assert.equal(out.contests.length, 1);
  assert.equal(out.contests[0].outcome, "kept");
});

console.log(`\n${n} contest-resolution assertions passed\n`);
