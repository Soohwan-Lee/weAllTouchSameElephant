/**
 * CONTEST — a blind reading of two cards, compared against how the team typed them.
 *
 * This is the only AI output in the app aimed at human work, so these tests pin two gates:
 * WHICH link may be looked at (pickContestTarget — where a wrong answer can destroy a
 * hand-drawn link), and which blind readings are worth showing (contestFromBlindReading).
 * The cases that matter are the dishonest and the merely noisy ones: a reading resting on
 * words nobody wrote, one that just hands back the snippets the link already cited, and an
 * adjacent type swap that would nag a team about a link they got right.
 */
import assert from "node:assert/strict";
import {
  contestFromBlindReading,
  pickContestTarget,
  surfaceContests,
  type ConfirmedLink,
} from "../src/lib/contest.ts";
import type { Fragment } from "../src/lib/types.ts";

const F = (id: string, title: string, body: string): Fragment =>
  ({ id, title, authorName: id, authorRole: id, body, x: 0, y: 0 });

const a = F("a", "Onboarding stalls", "New accounts wait 3 weeks for the audit trail to clear.");
const b = F("b", "Sales pipeline", "Deals slip past quarter-end because setup isn't done.");
const c = F("c", "Support load", "Tickets spike whenever a release ships on a Friday.");
const table = [a, b, c];

/** the link under judgment: AI-created, typed "overlap", citing one snippet per card */
const link: ConfirmedLink = {
  aId: "a",
  bId: "b",
  relationType: "overlap",
  createdBy: "ai",
  evidenceA: "wait 3 weeks for the audit trail",
  evidenceB: "Deals slip past quarter-end",
};

/** a well-formed blind reading: a different type, quoting DIFFERENT words than the link cites.
 *  Note it carries no question and no notion of the recorded type — the blind pass never saw
 *  one, and the disagreement is the server's observation, not the model's claim. */
const good = {
  relationType: "dependency",
  because: "The audit-trail wait is what pushes the deals past quarter-end.",
  evidenceA: "New accounts wait",
  evidenceB: "because setup isn't done",
};

let n = 0;
const check = (label: string, fn: () => void) => { fn(); n++; console.log(`  ✓ ${label}`); };

console.log("\ncontest — target selection");

check("only AI-created links are eligible — a hand-drawn link is never contested", () => {
  // un-confirming a human link DELETES it (unconfirmBridge keeps only AI links), so
  // contesting one would let the AI destroy human-authored content
  const human: ConfirmedLink = { ...link, createdBy: "human" };
  assert.equal(pickContestTarget([human], [], 0), undefined);
  assert.ok(pickContestTarget([link], [], 0), "the AI-created one is eligible");
});

check("a link with unknown origin is treated as human and skipped", () => {
  const { createdBy: _drop, ...unknown } = link;
  assert.equal(pickContestTarget([unknown as ConfirmedLink], [], 0), undefined);
});

check("a 'separate' link is never contested — that boundary is the team's to hold", () => {
  const boundary: ConfirmedLink = { ...link, relationType: "separate" };
  assert.equal(pickContestTarget([boundary], [], 0), undefined);
});

check("an already-answered pair is skipped, order-insensitively", () => {
  assert.equal(pickContestTarget([link], [{ aId: "b", bId: "a" }], 0), undefined);
});

check("at most one second look every other round", () => {
  assert.ok(pickContestTarget([link], [], 0), "round 0 asks");
  assert.equal(pickContestTarget([link], [], 1), undefined, "round 1 stays quiet");
  assert.ok(pickContestTarget([link], [], 2), "round 2 asks again");
  assert.equal(pickContestTarget([link], [], 3), undefined);
});

check("targets rotate across rounds instead of circling one link", () => {
  const second: ConfirmedLink = { ...link, aId: "b", bId: "c", relationType: "tension" };
  const pool = [link, second];
  assert.equal(pickContestTarget(pool, [], 0)?.bId, "b");
  assert.equal(pickContestTarget(pool, [], 2)?.bId, "c", "next asking round moves on");
  assert.equal(pickContestTarget(pool, [], 4)?.bId, "b", "and wraps");
});

check("no eligible links means no second look", () => {
  assert.equal(pickContestTarget([], [], 0), undefined);
});

console.log("\ncontest — blind reading vs the recorded type");

check("a load-bearing disagreement becomes a contest, with the pair named by the server", () => {
  const out = contestFromBlindReading(good, table, link);
  assert.ok(out, "should survive");
  assert.equal(out.aId, "a", "the server names the pair, never the model");
  assert.equal(out.bId, "b");
  assert.equal(out.suggestedType, "dependency");
  assert.equal(out.because, good.because);
});

check("agreement produces silence — the expected outcome", () => {
  // the blind pass read it exactly as the team typed it
  assert.equal(contestFromBlindReading({ ...good, relationType: "overlap" }, table, link), undefined);
});

check("an adjacent, non-load-bearing difference is dropped as noise", () => {
  // overlap vs complement are two ways of saying "these belong together"; a team that picked
  // one over the other has not made a mistake worth interrupting them for
  assert.equal(contestFromBlindReading({ ...good, relationType: "complement" }, table, link), undefined);
});

check("a disagreement is load-bearing if EITHER side is", () => {
  // overlap → dependency: direction appears where there was none
  assert.ok(contestFromBlindReading({ ...good, relationType: "dependency" }, table, link));
  // and the reverse: a recorded tension read as mere overlap loses a real trade-off
  const tension: ConfirmedLink = { ...link, relationType: "tension" };
  assert.ok(contestFromBlindReading({ ...good, relationType: "overlap" }, table, tension));
});

check("a relationType that isn't a relation type is dropped", () => {
  assert.equal(contestFromBlindReading({ ...good, relationType: "contradiction" }, table, link), undefined);
  assert.equal(contestFromBlindReading({ ...good, relationType: "" }, table, link), undefined);
});

check("a reading with no because is dropped", () => {
  assert.equal(contestFromBlindReading({ ...good, because: "   " }, table, link), undefined);
});

check("fabricated evidence is dropped", () => {
  // plausible, on-topic, and never written by anyone at this table
  assert.equal(contestFromBlindReading({ ...good, evidenceA: "nobody owns the handoff" }, table, link), undefined);
  assert.equal(contestFromBlindReading({ ...good, evidenceB: "" }, table, link), undefined, "blank too");
});

check("evidence quoted off the WRONG card is dropped", () => {
  const crossed = { ...good, evidenceA: "because setup isn't done", evidenceB: "New accounts wait" };
  assert.equal(contestFromBlindReading(crossed, table, link), undefined);
});

check("recycling BOTH of the link's own snippets is dropped — that is not a re-reading", () => {
  const recycled = { ...good, evidenceA: link.evidenceA, evidenceB: link.evidenceB };
  assert.equal(contestFromBlindReading(recycled, table, link), undefined);
  // punctuation/case restyling must not sneak the same span past the check
  assert.equal(
    contestFromBlindReading(
      { ...good, evidenceA: "Wait 3 weeks for the audit trail!", evidenceB: "deals slip past quarter-end" },
      table,
      link
    ),
    undefined
  );
});

check("repeating ONE snippet is allowed — a card may have only one relevant sentence", () => {
  assert.ok(contestFromBlindReading({ ...good, evidenceA: link.evidenceA }, table, link));
  assert.ok(contestFromBlindReading({ ...good, evidenceB: link.evidenceB }, table, link));
});

check("a link naming a card that isn't on the table is dropped", () => {
  assert.equal(contestFromBlindReading(good, table, { ...link, bId: "ghost" }), undefined);
});

check("junk in place of a reading is dropped, never thrown", () => {
  for (const junk of [undefined, null, "reading", 42, [], {}]) {
    assert.equal(contestFromBlindReading(junk, table, link), undefined);
  }
});

console.log("\ncontest — the dark gate");

check("TRIPWIRE: contests are not surfaced to teams", () => {
  // DELIBERATE. This assertion MUST fail the moment someone flips SURFACE_CONTESTS, so that a
  // human reads the measured story before a team is ever questioned about their own work:
  // blind detection is 9/9, but agreement with situated human typing is only 0-67% and is NOT
  // noise (self-consistency 100/100/67, and gpt-5.4 scored WORSE than gpt-5.4-mini). Surfacing
  // at that rate questions correct links about as often as mistyped ones, which is precisely
  // the social cost Johnson et al. (CHI 2026, arXiv:2602.14407) measured.
  //
  // If you are here because this test failed: that is the intended alarm, not a broken test.
  // Read the comment on SURFACE_CONTESTS, confirm live logs justify the flip, then update this.
  assert.equal(surfaceContests(), false);
});

check("the pipeline still COMPUTES what it withholds", () => {
  // The gate must withhold a finished proposal, not skip the work — otherwise flipping the
  // constant would expose a code path nothing has exercised since it was written.
  const out = contestFromBlindReading(good, table, link);
  assert.ok(out, "a real proposal is produced");
  assert.equal(out.suggestedType, "dependency");
  assert.ok(out.because.length > 0);
  assert.ok(out.evidenceA.length > 0 && out.evidenceB.length > 0);
});

console.log(`\n${n} contest assertions passed\n`);
