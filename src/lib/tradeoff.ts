/**
 * TRADE-OFF MATCHING — the deterministic half of /api/tradeoff.
 *
 * This lives in src/lib rather than in the route because it is pure, framework-free logic that
 * has to be unit-testable, and because a Next.js route file may only export the HTTP handlers
 * and a fixed set of config fields. Exporting `sampleTradeOff` from the route type-checked
 * fine and passed the whole test suite, but failed `next build` with "sampleTradeOff is not a
 * valid Route export field" — a breakage neither tsc nor the tests can see. Keep it here, the
 * way evidence.ts / clusters.ts / reviewChecks.ts already do, and the route imports it.
 */
import type { TradeOff } from "./prompts";

/** A kept tension / separation. `id` is the real bridge id; `retyped` marks a relation the
 *  team changed INTO a tension after the AI proposed something else. */
export type Pair = {
  a: string;
  b: string;
  id?: string;
  retyped?: boolean;
  why?: string;
  evidenceA?: string;
  evidenceB?: string;
};

/**
 * Words too generic to signal that a decision actually touches a tension's side. Includes
 * common light verbs (start/do/make/keep…): a decision and a tension can share "start"
 * without the decision being ABOUT that tension, which caused false matches (a hiring
 * decision snapping onto a "just start vs prove ROI" tension merely because both said
 * "start"). Only content words should carry a match.
 */
const STOP = new Set([
  "the","a","an","and","or","but","to","of","in","on","for","with","by","we","our","us","you",
  "will","would","should","must","can","do","does","did","is","are","be","been","that","this",
  "it","then","than","one","two","first","now","next","any","all","not","no","yes","from","at",
  "start","begin","make","made","get","got","keep","kept","take","took","go","going","put",
  "use","using","try","let","just","only","more","less","some","each","who","what","when","how",
  "그리고","그러나","우리","우리는","이","그","저","것","수","를","을","은","는","이가","에","의","로",
  "먼저","일단","그냥","지금","다시","좀","더","것을","한다","하고","해서","위해","대해","같은",
]);

/**
 * Words that are real content — you cannot drop them from a title without changing what it
 * says — but that are far too COMMON to establish that a decision is about a given tension.
 * They are the vocabulary every workplace decision is written in.
 *
 * The STOP list above removes light verbs entirely. That is the wrong treatment here: dropping
 * "improve" would make "improve the audit trail" and "improve the onboarding flow" tokenize to
 * {audit, trail} and {onboarding, flow}, which is right — but it would ALSO stop "improve" from
 * ever contributing to a match that a real subject overlap has already earned, and it would
 * distort the score of a title whose only distinguishing word is one of these.
 *
 * So these are kept as tokens and counted, but they cannot CARRY a match on their own: a side
 * needs at least one non-generic token in common with the decision before it can claim the
 * decision leans toward it (see `overlapScore`). This is the same defect the STOP list's header
 * describes — a decision snapping onto an unrelated tension on one shared word — with the
 * vocabulary that survived it. Every entry below was verified to fire ALONE as the only bridge
 * between an unrelated decision and tension.
 */
const GENERIC = new Set([
  "improve","improving","reduce","reducing","support","supporting","increase","increasing",
  "focus","focusing","build","building","review","reviewing","fix","fixing","team","teams",
  "time","times","work","working","plan","plans","planning","add","adding","change","changing",
  "keep","move","moving","set","need","needs","better","faster","slower","new","own","owns",
  "개선","축소","감소","지원","증가","집중","구축","검토","수정","팀","시간","작업","계획","변경",
  "추가","필요","개선한다","집중한다",
]);

/** true when a token is too common to establish that a decision is about a given tension */
function isGeneric(w: string): boolean {
  if (GENERIC.has(w)) return true;
  // Korean is agglutinative, so a generic stem arrives with particles/endings attached
  // ("집중한다", "팀은"). Match on the stem the same way `overlapScore` does, or the list would
  // only ever catch the bare citation form and Korean would keep the defect English just lost.
  for (const g of GENERIC) {
    if (g.length >= 2 && !/^[a-z]+$/.test(g) && w.startsWith(g)) return true;
  }
  return false;
}

/** significant tokens of a piece of text — lowercased words of length >= 2, minus stopwords */
function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 2 && !STOP.has(w))
  );
}

/**
 * How many significant tokens a tension side shares with the decision text.
 *
 * Exact set matching is not enough for Korean, which is agglutinative: the decision
 * "먼저 ROI부터 증명한다" and the tension side "ROI 증명" are plainly about the same thing, but
 * tokenize to {roi부터, 증명한다} and {roi, 증명} — zero exact overlap, so the decision looked
 * unrelated to a tension it obviously leans on and fell through to the opportunity-cost
 * branch. English split on spaces and happened to work, which is exactly how this stayed
 * hidden.
 *
 * So a side token also counts when it is a prefix of a decision token (or vice versa) with
 * the longer one at least 2 characters — enough to absorb particles and verb endings
 * (ROI/ROI부터, 증명/증명한다) without letting short fragments match everything. The threshold
 * is on the SIDE token's length, so a 1-character side token still requires an exact hit.
 *
 * Returns the total AND how much of it came from non-generic words. The split is what lets the
 * caller reject a match whose entire evidence is a word like "improve": `total` still orders
 * candidates sensibly, while `specific` says whether there is any real subject overlap under it.
 */
function overlapScore(
  decisionTokens: Set<string>,
  sideTitle: string
): { total: number; specific: number } {
  let total = 0;
  let specific = 0;
  const hit = (w: string) => {
    total++;
    if (!isGeneric(w)) specific++;
  };
  for (const w of tokens(sideTitle)) {
    if (decisionTokens.has(w)) {
      hit(w);
      continue;
    }
    if (w.length < 2) continue;
    for (const d of decisionTokens) {
      if (d.length >= 2 && (d.startsWith(w) || w.startsWith(d))) {
        hit(w);
        break;
      }
    }
  }
  return { total, specific };
}

/**
 * Deterministic fallback — always names ONE cost, never "no trade-off", but now GROUNDED in
 * the decision text instead of blindly grabbing tensions[0]. That old behavior invented a
 * favors/gives-way split even for a decision that had nothing to do with any kept tension
 * (e.g. a joke "we sit still" still produced "leans toward X, Y gives way") — exactly the
 * out-of-context result to fix.
 *
 * Logic: only mirror a kept tension back when the decision actually LEANS toward one of its
 * sides — measured by real word-overlap between the decision and each side's title. Pick the
 * tension whose favored side the decision most clearly picks up, and only if that signal
 * clears a floor. Otherwise (a decision that engages no tension, or is too thin to read),
 * fall back to the honest OPPORTUNITY cost of committing at all — no fabricated favors/against.
 */
export function sampleTradeOff(
  decision: string,
  tensions: Pair[],
  separations: Pair[],
  lang: "en" | "ko"
): TradeOff {
  const ko = lang === "ko";
  const decTokens = tokens(decision);

  // find the tension the decision most clearly leans on: a side whose title shares real words
  // with the decision. `favors` = that side; `cost` = the OTHER side (what gives way).
  let best: { tension: Pair; favors: string; against: string; score: number } | null = null;
  for (const t of [...tensions, ...separations]) {
    const sA = overlapScore(decTokens, t.a);
    const sB = overlapScore(decTokens, t.b);
    // A TIE IS NOT A LEAN. When both sides echo the decision equally the matcher genuinely
    // cannot tell which one is favored, and `sA >= sB` used to break that tie toward side A
    // arbitrarily — so "Let's document the process" against "process takes too long" ⟷
    // "documentation is missing" reported the team favoring "process takes too long" and
    // "documentation is missing" giving way, the exact inverse of the decision. A confident
    // wrong reading of the team's own decision is worse than no reading, and the file already
    // treats the opportunity-cost branch as the honest answer when signal is absent. So a tie
    // (including the 0-0 tie that was already skipped) falls through with everything else.
    //
    // KNOWN FALSE NEGATIVE — the cost of this rule, accepted deliberately.
    // A decision that NAMES BOTH SIDES and picks one ties, because both sides score equally,
    // and so it drops to the generic opportunity cost. That is the most common shape of a
    // decision that actually engages a trade-off: "X before Y", "X over Y", "Y보다 X를 먼저",
    // "Y 대신 X". Measured over 6 such pairs, only 1 still fires:
    //     LEAN  "We will prove ROI before shipping"              [prove ROI first ⟷ ship it now]
    //     drop  "We will prove ROI on the refund flow first"     [prove ROI first ⟷ ship the refund flow now]
    //     drop  "Hire support before we scale marketing"         [hire support ⟷ scale marketing]
    //     drop  "We choose audit trail work over new onboarding" [audit trail ⟷ new onboarding]
    //     drop  "환불 흐름보다 ROI 증명을 먼저 한다"                  [ROI 증명 ⟷ 환불 흐름 출시]
    //     drop  "품질보다 속도를 택한다"                             [속도 ⟷ 품질]
    // ("품질보다 속도를 택한다" is about as explicit a lean as a decision can be, and it drops.)
    // Accepted anyway because the two failures are not symmetric: an inverted lean is a
    // confident WRONG reading of the team's own decision, while a false negative degrades to
    // the honest opportunity cost — the team loses a reading, but is never told something
    // untrue about what they decided. The failure IS invisible to them, which is the real
    // cost of this trade, so it is written down here rather than left to be rediscovered.
    //
    // POSSIBLE FIX, not attempted here: break the tie on ordering cues already present in the
    // text — "before", "over", "instead of", "먼저", "보다", "대신", "우선" — which encode WHICH
    // side was chosen. That is deterministic string work, not inference, so it fits this file.
    // Note before trying it: "먼저" is in the STOP list at the top of this file and is discarded by
    // `tokens()` before any matching runs, so the cue is already gone by the time you would
    // want it; it has to come out of STOP first. Whoever does this should expect the pinned
    // test "a decision naming both sides ties and falls through" to fail, and should update it
    // deliberately rather than deleting it.
    if (sA.total === sB.total) continue;
    const aWins = sA.total > sB.total;
    const win = aWins ? sA : sB;
    // The winning side must overlap on a word that is not merely generic. Without this, one
    // shared "improve" is enough to declare a lean: the decision "improve the onboarding flow"
    // matched "improve the audit trail" ⟷ "leave the trail as is" on that single word and
    // reported the team favoring the audit trail — a different subject entirely. Testing the
    // WINNER (not the pair) is deliberate: it is the side we are about to claim the decision
    // picks up, so it is the side that has to have earned it.
    if (win.specific === 0) continue;
    const favors = aWins ? t.a : t.b;
    const against = aWins ? t.b : t.a;
    // `retyped` ranks ACROSS tensions, and deliberately cannot decide WITHIN one. It is a claim
    // that this trade-off is real — not a claim about which side a decision picks up — so it
    // must not settle a side-tie, and it cannot: the tie test above runs before this bonus
    // exists, and the bonus is added once per tension rather than to either side. A retyped
    // tension therefore still has to show a genuine lean of its own before it can win anything.
    const score = Math.max(sA.total, sB.total) + (t.retyped ? 0.5 : 0);
    if (!best || score > best.score) best = { tension: t, favors, against, score };
  }

  // Require at least ONE genuine shared term — otherwise the decision doesn't engage the
  // tension and forcing a favors/against split is the exact context-free bug we're fixing.
  // The re-typed bonus is deliberately fractional so it can only ever ORDER candidates that
  // already cleared this bar; it can never lift a tension the decision never touched. That
  // reasoning still holds: every candidate reaching here already cleared a strict margin and a
  // non-generic overlap, both integer tests applied before the bonus is ever added, so the
  // floor() below still sees only the real overlap count.
  if (best && Math.floor(best.score) >= 1) {
    return ko
      ? {
          tension: `"${best.tension.a}" ⟷ "${best.tension.b}"`,
          favors: `"${best.favors}" 쪽`,
          cost: `그만큼 "${best.against}"은(는) 뒤로 밀립니다.`,
          groundedBridgeId: best.tension.id,
        }
      : {
          tension: `"${best.tension.a}" vs "${best.tension.b}"`,
          favors: `the "${best.favors}" side`,
          cost: `"${best.against}" is what gives way.`,
          groundedBridgeId: best.tension.id,
        };
  }

  // no tension the decision actually engages → the honest opportunity cost of committing.
  return ko
    ? {
        tension: "이 방향에 시간을 쓰는 것",
        favors: "지금 이 결정에 팀의 시간과 집중을 씁니다",
        cost: "여기에 쓰는 시간·집중은, 아직 열어둘 수 있었던 다른 선택지에서 빠져나갑니다.",
      }
    : {
        tension: "Spending time on this path",
        favors: "puts the team's time and attention on this decision now",
        cost: "the time and attention this takes is pulled from the other options you could have kept open.",
      };
}
