/**
 * EVIDENCE SPANS — the snippet shown under a bridge has to be quotable off the card.
 *
 * The prompt asks the model to quote from each fragment; these tests pin the code that checks
 * it did. What matters is the pair of failures: an invented snippet, and a real snippet
 * attached to the wrong card — both of which render identically to a real quote.
 */
import assert from "node:assert/strict";
import { filterToVerifiedEvidence, isSpanOf, normalizeSpan, verifyProposalEvidence } from "../src/lib/evidence.ts";
import type { BridgeProposal, Fragment } from "../src/lib/types.ts";

const F = (id: string, title: string, body: string): Fragment =>
  ({ id, title, authorName: id, authorRole: id, body, x: 0, y: 0 });

const P = (evidenceA: string, evidenceB: string): BridgeProposal => ({
  fragmentAId: "a",
  fragmentBId: "b",
  relationType: "dependency",
  explanation: "",
  evidenceA,
  evidenceB,
});

const a = F("a", "Onboarding stalls", "New accounts wait 3 weeks for the audit trail to clear.");
const b = F("b", "Sales pipeline", "Deals slip past quarter-end because setup isn't done.");
const table = [a, b];

let n = 0;
const check = (label: string, fn: () => void) => { fn(); n++; console.log(`  ✓ ${label}`); };

console.log("\nevidence spans");

check("a verbatim snippet from each card verifies", () => {
  const p = P("wait 3 weeks for the audit trail", "Deals slip past quarter-end");
  assert.equal(verifyProposalEvidence(p, table), true);
  assert.deepEqual(filterToVerifiedEvidence([p], table), [p]);
});

check("case, whitespace and punctuation differences still verify", () => {
  // the same words, re-styled the way a model quoting a card actually re-styles them
  assert.equal(isSpanOf("WAIT   3 WEEKS", a.body), true, "case and whitespace fold away");
  assert.equal(isSpanOf("setup isn’t done.", b.body), true, "smart quote and trailing period fold away");
  assert.equal(verifyProposalEvidence(P("New  accounts WAIT 3 weeks!", "deals slip past quarter-end;"), table), true);
});

check("the title counts as the card's own words", () => {
  assert.equal(verifyProposalEvidence(P("Onboarding stalls", "Sales pipeline"), table), true);
});

check("a snippet that is nowhere in the card is dropped", () => {
  // plausible, on-topic, and never written by anyone at this table
  const p = P("the team lacks a shared definition of done", "Deals slip past quarter-end");
  assert.equal(verifyProposalEvidence(p, table), false);
  assert.deepEqual(filterToVerifiedEvidence([p], table), []);
});

check("empty evidence is dropped — a link that points at nothing is the generic link", () => {
  assert.equal(isSpanOf("", a.body), false);
  assert.equal(isSpanOf("   ", a.body), false, "whitespace is not a span");
  assert.equal(isSpanOf("…", a.body), false, "punctuation alone is not a span");
  assert.equal(verifyProposalEvidence(P("", "Deals slip past quarter-end"), table), false);
  assert.equal(verifyProposalEvidence(P("wait 3 weeks", ""), table), false);
});

check("a trivially short span is dropped — it points at nothing in particular", () => {
  // real substrings of the card, and useless as evidence: they would verify against almost
  // any card ever written, which is the generic link wearing a quote's clothes
  assert.equal(isSpanOf("the", a.body), false, "a function word is not evidence");
  assert.equal(isSpanOf("for", a.body), false);
  assert.equal(isSpanOf("3", a.body), false, "a bare digit is not evidence");
  assert.equal(verifyProposalEvidence(P("the", "Deals slip past quarter-end"), table), false);
  // the floor must not eat real quotes
  assert.equal(isSpanOf("weeks", a.body), true, "a real word still verifies");
});

check("spans compare equal across Unicode normalization forms", () => {
  // the card is typed in a browser, the snippet comes back through a model and JSON — either
  // side can arrive decomposed, and the two forms are indistinguishable on screen
  const koCard = "우리는 감사 기록이 필요합니다".normalize("NFC");
  assert.equal(isSpanOf("감사 기록이".normalize("NFD"), koCard), true, "NFD quote of an NFC card");
  assert.equal(isSpanOf("감사 기록이".normalize("NFC"), koCard.normalize("NFD")), true, "and the reverse");
  const frCard = "the café closed early".normalize("NFD");
  assert.equal(isSpanOf("café closed".normalize("NFC"), frCard), true, "accented latin too");
});

check("evidence quoted off the WRONG card is dropped", () => {
  // real text from the table, attached to the piece it says nothing about
  const p = P("Deals slip past quarter-end", "wait 3 weeks for the audit trail");
  assert.equal(verifyProposalEvidence(p, table), false);
});

check("a proposal naming a fragment that isn't on the table is dropped", () => {
  const p = { ...P("Onboarding stalls", "Sales pipeline"), fragmentBId: "ghost" };
  assert.equal(verifyProposalEvidence(p, table), false);
});

check("filtering keeps only the verifiable proposals, in order", () => {
  const good = P("audit trail to clear", "setup isn't done");
  const invented = P("nobody owns the handoff", "setup isn't done");
  const blank = P("audit trail to clear", "");
  assert.deepEqual(filterToVerifiedEvidence([invented, good, blank], table), [good]);
});

check("normalization keeps the word sequence and does not split on punctuation", () => {
  // "on-call" must not become "on call": the card doesn't contain the spaced form
  assert.equal(normalizeSpan("On-Call!"), "oncall");
  assert.equal(normalizeSpan("  a   b  "), "a b");
  const card = "The on-call rota is unowned.";
  assert.equal(isSpanOf("on-call rota", card), true, "the hyphenated quote matches");
  assert.equal(isSpanOf("oncall rota", card), true, "and so does the de-hyphenated one");
  assert.equal(isSpanOf("on call rota", card), false, "but the SPACED form is not in the card");
});

check("Korean spans verify without depending on word splitting", () => {
  const ko = F("k", "온보딩 지연", "신규 고객은 감사 기록이 정리될 때까지 3주를 기다립니다.");
  assert.equal(isSpanOf("감사 기록이 정리될 때까지", ko.body), true);
  assert.equal(isSpanOf("담당자가 없습니다", ko.body), false);
});

console.log(`\n${n} evidence assertions passed\n`);
