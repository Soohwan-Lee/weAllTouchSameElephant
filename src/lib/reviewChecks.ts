import type { TKey } from "./i18n";
import { seatOf } from "./clusters";
import type { Bridge, Fragment } from "./types";

/**
 * WHAT TO ACTUALLY ASK ABOUT *THIS* LINK, before it becomes part of the picture.
 *
 * The review scaffold used to print the same three sentences under every bridge card. A team
 * working through eight proposals read one identical checklist eight times and stopped reading
 * it around the third — which is the failure mode the scaffold exists to prevent. A prompt that
 * is right about every link is a prompt about no link.
 *
 * So the questions are selected here, in deterministic code, off structural facts the session
 * already holds: the relation type, whether each end carries a verified quote, and whether the
 * two pieces come from the same seat or two different people. The AI is never asked to write
 * any of this — every string below is a fixed human-authored template, and the only variable
 * text interpolated into one is a piece TITLE, which the humans wrote themselves. That keeps
 * the project invariant intact: nothing a team reads as an argument came from a model.
 *
 * It is also the house rule that has now paid off three times: a structural rule belongs in
 * deterministic code, not in a prompt request. A prompt asking the model to "vary the review
 * questions per bridge" would be the fourth measured null.
 */
export type ReviewCheck = {
  key: TKey;
  /** substituted into the string at render time via the repo's existing `{x}` replace pattern */
  vars?: Record<string, string>;
};

/** Titles go inline in an 11px list item; a long one has to yield or the card reflows. */
const MAX_TITLE = 28;
const clip = (s: string | undefined) => {
  const t = (s ?? "").trim();
  if (!t) return "?";
  return t.length <= MAX_TITLE ? t : `${t.slice(0, MAX_TITLE - 1).trimEnd()}…`;
};

/**
 * The one question that is different for each of the five relation types.
 *
 * Each is aimed at the specific way THAT type goes wrong, not at links in general:
 *  - overlap is the only relation that FUSES two pieces into one facet downstream
 *    (`isFusing` in synthesis.ts), so confirming it merges two people's cards. Its risk is
 *    two different claims that merely share vocabulary.
 *  - tension feeds the trade-off panel, which only means anything if the two really cannot
 *    both be had. Two unrelated topics typed as tension produce a fake cost.
 *  - dependency is the only directed type, and direction is the thing most often backwards.
 *  - complement claims each side adds what the other lacks — worth checking it isn't restating.
 *  - separate glues nothing; the question is whether keeping them apart is the actual point.
 */
const RELATION_CHECK: Record<Bridge["relationType"], TKey> = {
  overlap: "review.rel.overlap",
  tension: "review.rel.tension",
  dependency: "review.rel.dependency",
  complement: "review.rel.complement",
  separate: "review.rel.separate",
};

/**
 * Relation types where "both of these are effects of something nobody has put on the table"
 * is a LIVE competing reading of the same two cards, rather than a generic caveat.
 *
 *  - dependency asserts A drives B, and the classic way that is wrong is that some unnamed C
 *    drives both. This is the confounder case proper.
 *  - overlap says two people are describing one thing. When they are, the thing they are both
 *    describing is often a downstream symptom of a cause neither of them named — which is why
 *    they converged without either one holding the explanation.
 *
 * Deliberately NOT tension, complement, or separate. A third cause is not the obvious rival
 * reading for any of them: two things can trade off, complete each other, or need to stay
 * apart whatever produced them, so the question would degrade back into the every-card filler
 * this module exists to remove.
 */
const CONFOUNDABLE = new Set<Bridge["relationType"]>(["dependency", "overlap"]);

/**
 * 2–3 questions sized to the link in front of the team.
 *
 * Composition is fixed: exactly one relation-type check, exactly one evidence check, and one
 * third check — the seat question, or on dependency/overlap the confounder question. Order
 * rotates deterministically off the bridge id so two consecutive cards in a tray do not open
 * with the same sentence — never `Math.random()`, which would break sample mode's
 * reproducibility and repeat the unstable-id bug this repo already ate once (clusters.ts:95).
 */
export function reviewChecksFor(
  bridge: Pick<Bridge, "id" | "relationType" | "evidenceA" | "evidenceB">,
  fragA?: Fragment,
  fragB?: Fragment
): ReviewCheck[] {
  const titles = { a: clip(fragA?.title), b: clip(fragB?.title) };

  /**
   * Can a question quote BOTH cards by name?
   *
   * `byId` in ConnectScreen is a `.find()`, so a tray bridge whose fragment was removed reaches
   * this with an endpoint undefined. The card header can print "?" for a missing piece and stay
   * readable, but a QUESTION cannot: `Does "queue backs up at 4pm" really have to come before
   * "?"` asks the team about a card that is not on their screen, and the answer is unknowable
   * rather than merely hard. Both checks that name the two ends are suppressed together — the
   * rule is about interpolating a title that does not exist, not about any one question, and
   * splitting it would leave one broken line sitting next to the fixed one.
   */
  const bothTitlesKnown = Boolean(fragA?.title.trim() && fragB?.title.trim());

  // Only dependency names both ends: its question IS about which of the two comes first, and
  // asking it abstractly ("is the direction right?") is what made the old prompt ignorable. The
  // other four read fine without interpolation, and a title crammed into every line would cost
  // more than it buys. When a title is missing the question falls back to the abstract wording
  // rather than quoting a "?" — weaker, but still answerable, and it is the degraded path.
  const relation: ReviewCheck =
    bridge.relationType !== "dependency"
      ? { key: RELATION_CHECK[bridge.relationType] }
      : bothTitlesKnown
      ? { key: "review.rel.dependency", vars: titles }
      : { key: "review.rel.dependencyAbstract" };

  // Evidence. A quote on each end and a missing quote are materially different situations,
  // and showing "do the quoted parts support this?" when there are no quoted parts is the
  // original bug in miniature — a question about something not on screen.
  const hasA = Boolean(bridge.evidenceA?.trim());
  const hasB = Boolean(bridge.evidenceB?.trim());
  const evidence: ReviewCheck =
    hasA && hasB
      ? { key: "review.ev.both" }
      : hasA || hasB
      ? { key: "review.ev.one", vars: { piece: hasA ? titles.b : titles.a } }
      : { key: "review.ev.none" };

  const checks: ReviewCheck[] = [relation, evidence];

  // THE THIRD SLOT — one of two questions, never both, so the cap stays at three.
  //
  // Candidate 1, who the link crosses. A link between two of one person's own cards is a
  // different review from a link across two people — cross-seat is where the contestable claim
  // lives, and same-seat is where a team quietly mistakes one person's internal consistency for
  // the table agreeing. When authorship is unknown (`seatOf` falls back to a synthetic id), or
  // an endpoint isn't loaded, there is nothing honest to ask.
  const seatA = fragA ? seatOf(fragA) : "";
  const seatB = fragB ? seatOf(fragB) : "";
  const seatKnown =
    Boolean(seatA && seatB) && !seatA.startsWith("__anon_") && !seatB.startsWith("__anon_");
  const seat: ReviewCheck | null = !seatKnown
    ? null
    : seatA === seatB
    ? { key: "review.seat.same", vars: { seat: clip(seatA) } }
    : { key: "review.seat.cross", vars: { seatA: clip(seatA), seatB: clip(seatB) } };

  // Candidate 2, the confounder — the only question in the pool that points at a piece NOBODY
  // has put on the table. Every other check validates a link the AI already drew; this one asks
  // what is missing, which is the job this project's invariant actually reserves for the AI.
  // It was in the original three and was the one worth keeping.
  // It quotes both cards, so it is held to `bothTitlesKnown` like the dependency check above.
  // Unlike that one it gets no abstract fallback: "could both be effects of a third thing?"
  // without naming the two is precisely the vague version that made the original ignorable, so
  // on a card with a missing endpoint it simply steps aside.
  const confound: ReviewCheck | null =
    CONFOUNDABLE.has(bridge.relationType) && bothTitlesKnown
      ? { key: "review.alt.confound", vars: titles }
      : null;

  // How they compete, and why it is not simply "confounder wins":
  //
  // On DEPENDENCY the confounder replaces the seat question outright. Dependency's own check
  // already asks about direction, and direction plus "or is it a third thing?" is one coherent
  // line of attack on the same claim; the seat question would change the subject mid-card. It is
  // also the type where a wrong answer does the most downstream damage — dependency is what the
  // causal spine is walked over in synthesis.
  //
  // On OVERLAP they rotate off the id instead. Overlap is the type that FUSES two people's cards
  // into one facet (`isFusing`, synthesis.ts), so "are these two people really saying the same
  // thing" is not a subject change — it is the same question from the other side, and both are
  // worth asking. Rotating shows each on roughly half the overlap cards rather than permanently
  // silencing either, and it doubles as the tray-level variation this module is for.
  const third =
    !confound ? seat
    : !seat ? confound
    : bridge.relationType === "dependency" ? confound
    : idBit(bridge.id, WHICH_THIRD) ? confound
    : seat;
  if (third) checks.push(third);

  // Rotation. The relation check is the sharpest thing on the card, so it leads on most bridges;
  // on the rest the evidence check leads instead, which is enough to break the "I've read this"
  // reflex without ever hiding a question. Derived from the id, so the same bridge always shows
  // the same order — a review prompt that reshuffles under the team while they argue is worse
  // than a repetitive one.
  //
  // A DIFFERENT bit from the one picking the third slot. Reusing one would tie the two choices
  // together, so every overlap card showing the confounder would also open with the same check —
  // reintroducing, inside the overlap group, exactly the uniformity this module removes.
  if (idBit(bridge.id, LEAD_ORDER)) {
    [checks[0], checks[1]] = [checks[1], checks[0]];
  }

  return checks;
}

// Two independent decisions, so two independent salts. Values are arbitrary and only need to
// differ; they are not tuned and nothing depends on their magnitude.
const WHICH_THIRD = 0x9e37;
const LEAD_ORDER = 0x85eb;

/**
 * A stable bit from an id, salted per decision. Deterministic by construction: the same bridge
 * id yields the same bit forever, across reloads, exports, and sample mode. Never `Math.random()`
 * — a checklist that reshuffles under a team mid-argument is worse than a repetitive one, and
 * this repo has already paid once for deriving identity from unstable values (clusters.ts:95).
 */
function idBit(id: string, salt: number): boolean {
  let h = salt;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  // Avalanche before taking a bit. Reading a bit straight off the accumulator looked fine on
  // realistic ids and was silently constant across a run of short ones differing only in their
  // last character (b1…b9): that character lands in the low bits, so any single higher bit is
  // decided almost entirely by the salt. Folding the word onto itself lets every input bit
  // reach the one bit actually used.
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return (h & 1) === 1;
}

/**
 * Apply a check's vars using the repo's existing `{x}` replace convention (see
 * `bridge.dismissedCount` at its call site in ConnectScreen).
 *
 * ONE pass over the template, not one pass per key. Substituting keys in sequence lets an
 * already-inserted value be re-scanned by the next key's pass, so a card title containing a
 * literal `{b}` would get rewritten by the `b` substitution. Card titles are human text and
 * this code has no business editing it after inserting it.
 */
export function fillCheck(text: string, vars?: Record<string, string>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, k: string) => vars[k] ?? whole);
}
