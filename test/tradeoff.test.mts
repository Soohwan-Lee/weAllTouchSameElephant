/**
 * TRADE-OFF MATCHING — when may the deterministic fallback claim a decision LEANS on a tension?
 *
 * `sampleTradeOff` mirrors a kept tension back at the team: "you favor X, Y gives way". That
 * sentence is only worth printing when the decision really does pick up one side. Two ways it
 * used to print anyway, both of which read to a team as a confident statement about their own
 * decision:
 *
 *   1. ONE generic word was enough. "We should improve the onboarding flow" matched the tension
 *      "improve the audit trail" ⟷ "leave the trail as is" on the single word "improve" and
 *      announced the team favored the audit trail — a different subject entirely. The STOP list
 *      was built to prevent exactly this ("start"), but a dozen words like improve/reduce/team
 *      /time survived it and each fires alone.
 *   2. A TIE picked side A. `sA >= sB` meant "Let's document the process" against "process takes
 *      too long" ⟷ "documentation is missing" reported the team favoring "process takes too
 *      long" — the INVERSE of the decision. A tie means the matcher cannot tell which side is
 *      favored; choosing one anyway is worse than staying quiet, because the opportunity-cost
 *      branch is an honest answer and a wrong lean is not.
 *
 * So these tests pin one property in both directions: a real lean still fires (in English AND
 * Korean, whose agglutinative endings are why the prefix rule exists at all), and a match built
 * only on generic vocabulary, or on no margin, falls through instead.
 */
import assert from "node:assert/strict";
import { sampleTradeOff } from "../src/app/api/tradeoff/route.ts";

/** the two opportunity-cost labels the fallback uses when no tension is engaged */
const OPP_EN = "Spending time on this path";
const OPP_KO = "이 방향에 시간을 쓰는 것";

type Side = "a" | "b" | "none";

/**
 * Run one decision against one tension and report which side it claimed, or "none" when it
 * fell through to the opportunity cost. Asserting on the RENDERED favors string (rather than
 * on internals) is deliberate: the inverted-tie bug was only visible in the sentence.
 */
const lean = (decision: string, a: string, b: string, opts: { retyped?: boolean } = {}): Side => {
  const lang = /[가-힯]/.test(decision) ? "ko" : "en";
  const out = sampleTradeOff(decision, [{ a, b, id: "b1", retyped: opts.retyped }], [], lang);
  if (out.tension === OPP_EN || out.tension === OPP_KO) return "none";
  // the favored side is quoted verbatim into `favors`; `against` is quoted into `cost`
  assert.ok(out.favors.includes(a) || out.favors.includes(b), `favors named neither side: ${out.favors}`);
  return out.favors.includes(a) ? "a" : "b";
};

let n = 0;
const check = (label: string, fn: () => void) => { fn(); n++; console.log(`  ✓ ${label}`); };

console.log("\ntrade-off matching");

check("a real lean still fires, either side, in English", () => {
  assert.equal(lean("We prove ROI on one team before we hire anyone else.", "prove ROI first", "hire ahead of demand"), "a");
  assert.equal(lean("We are hiring two more onboarding specialists this quarter.", "prove ROI first", "hiring onboarding specialists"), "b");
  assert.equal(lean("We will rebuild the checkout payment flow first.", "checkout payment flow", "leave checkout alone"), "a");
});

check("the documented Korean prefix case still matches", () => {
  // 먼저 ROI부터 증명한다 / ROI 증명 — zero EXACT token overlap; this is what the prefix rule is for
  assert.equal(lean("먼저 ROI부터 증명한다", "ROI 증명", "선제적 채용"), "a");
});

check("short Korean titles are not silenced — a 2-token title still leans", () => {
  // "결제 안정성" is two tokens TOTAL, so any rule demanding two shared tokens would kill it
  assert.equal(lean("이번 분기에는 결제 안정성을 먼저 확보한다", "결제 안정성", "신규 기능 출시"), "a");
  assert.equal(lean("신규 기능 출시를 이번 분기 목표로 잡는다", "결제 안정성", "신규 기능 출시"), "b");
});

check("a narrow but real Korean margin (2 tokens vs 1) still fires", () => {
  // 결제(exact) + 속도를/속도가(prefix) beats 문서화한다/문서화가 — a genuine lean, not a tie.
  // Kept next to the tie case below because the two look alike and are not.
  assert.equal(lean("결제 속도를 문서화한다", "결제 속도가 느리다", "문서화가 안 되어 있다"), "a");
});

check("ONE generic word is not a lean — the reported false match falls through", () => {
  // the exact case: different subject, bridged only by "improve"
  assert.equal(
    lean("We should improve the onboarding flow", "improve the audit trail", "leave the trail as is"),
    "none"
  );
});

check("every generic verb that used to fire alone now falls through", () => {
  // each of these was verified to be the ONLY bridge between an unrelated decision and tension
  for (const w of ["improve","reduce","support","increase","focus","build","review","fix","team","time","work","plan"]) {
    assert.equal(
      lean(`We should ${w} the onboarding flow`, `${w} the audit trail`, "leave the trail as is"),
      "none",
      `"${w}" alone still claimed a lean`
    );
  }
});

check("a generic word still COUNTS once a real subject overlap has earned the match", () => {
  // the generic list must not become a second STOP list: dropping these words outright would
  // also drop them from matches the decision genuinely made. Same tension as the case above,
  // but now the decision really is about the audit trail.
  assert.equal(
    lean("We should improve the audit trail this quarter", "improve the audit trail", "leave the trail as is"),
    "a"
  );
});

check("Korean generic vocabulary is caught through its endings too", () => {
  // 집중/집중한다 — an English-only generic list would leave Korean holding the same defect
  assert.equal(lean("우리는 채용에 집중한다", "환불 지연에 집중", "환불 지연을 감수"), "none");
});

check("a TIE never claims a side — it falls through instead of inverting the decision", () => {
  // both sides score 1; the old `sA >= sB` reported "process takes too long" as favored, which
  // is the opposite of what the decision says
  assert.equal(lean("Let's document the process", "process takes too long", "documentation is missing"), "none");
  assert.equal(lean("속도와 문서화를 같이 본다", "속도가 느리다", "문서화가 안 되어 있다"), "none");
});

check("a retyped tension does not win a tie either", () => {
  // `retyped` is a claim that the trade-off is REAL, not a claim about which side is favored,
  // so it must not settle a side-tie. It is added once per tension and only after the tie test,
  // so it can order candidates without ever manufacturing a lean within one.
  assert.equal(
    lean("Let's document the process", "process takes too long", "documentation is missing", { retyped: true }),
    "none"
  );
});

/**
 * KNOWN LIMITATION, pinned as CURRENT behavior — not as aspiration. See the tie comment in
 * src/app/api/tradeoff/route.ts for the full reasoning and the measurement.
 *
 * A decision that NAMES BOTH SIDES and picks one ("X before Y", "X over Y", "Y보다 X를 먼저")
 * scores both sides equally, so the strict tie rule drops it to the generic opportunity cost.
 * That is the most common shape of a decision that genuinely engages a trade-off, and it is
 * the price paid for never inverting a lean. The failure is invisible to the team — they just
 * get the generic text — which is exactly why it is pinned here instead of left undocumented.
 *
 * If someone implements the cue-based tie-break (breaking on "before"/"over"/"먼저"/"보다",
 * which requires removing "먼저" from the STOP list first), THIS TEST SHOULD FAIL. That is the
 * intent: update it deliberately, case by case, rather than deleting it.
 */
check("a decision naming both sides ties and falls through — known false negative, see route.ts", () => {
  const bothSides: Array<[string, string, string]> = [
    ["We will prove ROI on the refund flow first", "prove ROI first", "ship the refund flow now"],
    ["Hire support before we scale marketing", "hire support", "scale marketing"],
    ["We choose audit trail work over new onboarding", "audit trail", "new onboarding"],
    ["환불 흐름보다 ROI 증명을 먼저 한다", "ROI 증명", "환불 흐름 출시"],
    // the sharpest case: about as explicit a lean as a decision can be, and it still drops
    ["품질보다 속도를 택한다", "속도", "품질"],
  ];
  for (const [decision, a, b] of bothSides) {
    assert.equal(lean(decision, a, b), "none", `"${decision}" no longer falls through — if this is the cue-based tie-break, update this test deliberately`);
  }
});

check("the other side of that boundary: naming only ONE side still leans", () => {
  // the same "before" shape, but the decision echoes only the favored side, so there is a real
  // margin and it fires. Kept next to the case above so the boundary is visible in one place.
  assert.equal(lean("We will prove ROI before shipping", "prove ROI first", "ship it now"), "a");
});

check("an unrelated decision still falls through, as before", () => {
  assert.equal(lean("we sit still", "prove ROI first", "hire ahead of demand"), "none");
  assert.equal(lean("We are moving the office to the third floor.", "prove ROI first", "hire ahead of demand"), "none");
  assert.equal(lean("사무실을 3층으로 옮긴다", "결제 안정성", "신규 기능 출시"), "none");
});

check("the fallback always names exactly one cost, never nothing", () => {
  // the panel renders whatever comes back; an empty field would render as a blank half of the
  // favors/cost pair, so both branches must always be populated
  for (const [d, lang] of [["we sit still", "en"], ["사무실을 3층으로 옮긴다", "ko"]] as const) {
    const out = sampleTradeOff(d, [{ a: "prove ROI first", b: "hire ahead of demand", id: "b1" }], [], lang);
    assert.ok(out.tension.trim() && out.favors.trim() && out.cost.trim(), `empty field for "${d}"`);
    // a fall-through is an opportunity cost, so it must NOT be traced to a tension it didn't use
    assert.equal(out.groundedBridgeId, undefined, "a fall-through cited a bridge it never leaned on");
  }
});

check("a real lean is traced back to the bridge it was read off", () => {
  const out = sampleTradeOff(
    "We prove ROI on one team before we hire anyone else.",
    [{ a: "prove ROI first", b: "hire ahead of demand", id: "bridge-7" }],
    [],
    "en"
  );
  assert.equal(out.groundedBridgeId, "bridge-7");
});

console.log(`\n  ${n} trade-off checks passed\n`);
