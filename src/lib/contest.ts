import { isSpanOf, normalizeSpan } from "./evidence";
import { RELATION_TYPES, type ContestProposal, type Fragment, type RelationType } from "./types";

/**
 * CONTEST — a discrepancy between how the team typed a link and how the same two cards read
 * to an AI that was shown nothing else.
 *
 * This is the only AI surface in the app pointed at human work, so it is also the one whose
 * output needs the strictest gate. A bad bridge proposal costs a team one dismissal; a bad
 * contest tells them their own settled judgment may be wrong, on evidence that has to hold up
 * or the whole move is manipulation dressed as help. Everything below is therefore a check the
 * model cannot talk its way past, in the same spirit as selectForSeatCoverage: structural
 * constraints hold where prompt requests do not.
 *
 * Nothing here asks a model whether a link is right. That was tried and measured: shown the
 * recorded type, it deferred and detected 0/9 deliberately mistyped links across three prompt
 * structures, while typing the same cards COLD it was right 3/3 (see blindTypePrompt). So the
 * model only ever types two cards blind, and the comparison — the part that constitutes
 * disagreement — happens here, in code.
 *
 * The SERVER also chooses which link is examined and names the pair, so nothing here reads a
 * pair from the model. An earlier version did, and had to re-orient the model's pair onto the
 * confirmed link before it could verify anything; that class of error is gone by construction.
 *
 * The failure mode is silence, never an error. An agreement, a malformed reading, or a
 * merely-adjacent difference is dropped and the round returns its bridges as if nothing had
 * been asked — the team never sees that the model looked, because a half-formed doubt is
 * worse than none.
 */

/** The confirmed link under judgment, as the route carries it. `evidenceA/B` are the snippets
 *  the link itself already cites — kept so a "second look" that merely repeats them can be
 *  told apart from one that actually re-read the cards. */
export interface ConfirmedLink {
  aId: string;
  bId: string;
  relationType: RelationType;
  createdBy?: "ai" | "human";
  evidenceA?: string;
  evidenceB?: string;
}

/**
 * Does a surviving discrepancy actually reach the team? Currently NO: the whole pipeline runs
 * and logs, and the response carries no contest.
 *
 * The measured story, end to end. Shown the type the team had recorded, the model deferred to
 * it and detected 0/9 deliberately mistyped links — unchanged across three framings ("sound is
 * expected", judge-then-compare, and the judgment moved to its own call). Hiding the recorded
 * type fixed exactly that: detection went to 9/9, confirming the deference diagnosis. But the
 * blind reading is not a substitute for a person's. Agreement with human typing on real cards
 * runs 0–67% depending on the relation guide, and it is not noise — the same pair gets the same
 * answer 100%/100%/67% across repeated runs. Nor is it a capability gap: gpt-5.4 scored WORSE
 * than gpt-5.4-mini (44% agreement, 11% detection). On one pair the blind pass said "overlap"
 * 6/6 where the fixture said "dependency", and reading those two cards it is arguably right —
 * which is the real finding: "which of five relations holds" has no single ground truth a cold
 * reader and a situated one converge on. The human was at the meeting; the model has 40 words.
 *
 * So surfacing today would question a correct link about as often as a mistyped one, and
 * Johnson et al. (CHI 2026, arXiv:2602.14407) is precisely about that tax: users pay a social
 * cost to reject an AI, so a ~50% false-fire rate is not a neutral cost of a helpful feature.
 * Flip this to true only once live-session logs identify a disagreement class precise enough to
 * be worth a team's attention — the log line below exists to find one.
 */
const SURFACE_CONTESTS = false;

/** Would this discrepancy be shown to the team, if surfacing were on? Always consult this
 *  rather than reading SURFACE_CONTESTS directly, so the log and the response cannot drift. */
export function surfaceContests(): boolean {
  return SURFACE_CONTESTS;
}

/** How often a second look may happen: at most one every this many rounds. */
export const CONTEST_ROUND_INTERVAL = 2;

/**
 * WHICH confirmed link gets looked at this round — a server-side rule, not a model choice.
 *
 * Two exclusions are safety, not taste:
 *  - a link the team DREW THEMSELVES is never eligible. Answering "look again" un-confirms the
 *    link, and `unconfirmBridge` returns AI links to the tray but DELETES human ones outright,
 *    since a person can redraw their own. Contesting one would therefore make the AI capable of
 *    destroying human-authored content, which is the one thing this app must never do.
 *  - a "separate" link is never eligible. That is the team asserting a boundary — "these must
 *    NOT be merged" — and it is the relation they are most often right about and most likely to
 *    have argued over. Questioning a boundary is qualitatively different from questioning a
 *    connection, and the same special-casing already exists in selectForSeatCoverage.
 *
 * Among what survives, selection is rotation by round rather than any judgment of which link
 * looks weakest. Ranking candidates here would be a second opinion about the team's work formed
 * before the model has read anything, and it would keep returning to the same link; rotation
 * walks the board and keeps the sampling interpretable.
 */
export function pickContestTarget(
  confirmed: ConfirmedLink[],
  contested: Array<{ aId: string; bId: string }> = [],
  round = 0
): ConfirmedLink | undefined {
  // Not every round. Johnson et al. (CHI 2026, arXiv:2602.14407) found users pay a social cost
  // to reject an AI, so a tool that questions their work every single time they press "suggest"
  // is applying pressure, whatever each individual question says.
  if (round % CONTEST_ROUND_INTERVAL !== 0) return undefined;
  const key = (a: string, b: string) => [a, b].sort().join("|");
  const asked = new Set(contested.map((p) => key(p.aId, p.bId)));
  const eligible = confirmed.filter(
    (l) =>
      // absent createdBy is treated as human: guessing wrong destroys human work
      l.createdBy === "ai" && l.relationType !== "separate" && !asked.has(key(l.aId, l.bId))
  );
  if (!eligible.length) return undefined;
  return eligible[Math.floor(round / CONTEST_ROUND_INTERVAL) % eligible.length];
}

/**
 * Relation types where a disagreement is worth interrupting a team over.
 *
 * A blind re-reading will drift between ADJACENT types on links that are perfectly well typed —
 * "overlap" and "complement" are both ways of saying "these belong together", and a team that
 * picked one over the other has not made a mistake worth a card. What changes what a team would
 * DO is a disagreement involving direction (`dependency`), conflict (`tension`), or a boundary
 * (`separate`): those say the pieces cause, fight, or must not be merged, and getting them
 * wrong reshapes the whole picture downstream (see the causal spine the reveal reads).
 *
 * So a contest is raised only when at least one SIDE of the disagreement is load-bearing. An
 * overlap↔complement swap is dropped as noise; overlap→dependency is not.
 */
// `separate` covers both sides of a disagreement, but only the BLIND side is reachable today:
// pickContestTarget already excludes links the team recorded as "separate", so the
// recorded-side case never arrives here. Kept anyway — this list answers "which relations
// matter", which is a different question from "which links may be examined", and pruning it to
// match today's upstream filter would silently change meaning if that filter ever loosens.
const LOAD_BEARING: RelationType[] = ["dependency", "tension", "separate"];

/**
 * Compare a blind reading of two cards against the type the team recorded.
 *
 * Returns a ContestProposal ONLY on a load-bearing disagreement. Agreement, an unusable
 * reading, or a merely-adjacent difference all produce `undefined` — silence is the common and
 * correct outcome, and the caller must treat it as "nothing to say" rather than an error.
 *
 * Ways to fail, each one a way the observation would be dishonest rather than merely wrong:
 *  - the blind type matches the recorded one, which is the whole point of asking (agreement);
 *  - neither side of the disagreement is load-bearing (see LOAD_BEARING);
 *  - the type is not a relation type at all;
 *  - either snippet is not a span of ITS OWN card, i.e. the reading rests on words nobody wrote
 *    (the check `evidence.ts` already applies to bridges, held to here for the same reason);
 *  - BOTH snippets merely repeat the evidence the link already cites. A second look has to be a
 *    re-reading; handing back the same two quotes is the appearance of scrutiny without it.
 */
export function contestFromBlindReading(
  raw: unknown,
  fragments: Fragment[],
  link: ConfirmedLink
): ContestProposal | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Record<string, unknown>;

  const readRaw = String(c.relationType ?? "");
  if (!RELATION_TYPES.includes(readRaw as RelationType)) return undefined;
  const suggestedType = readRaw as RelationType;
  // Agreement. The expected outcome, and the reason the base rate is worth logging.
  if (suggestedType === link.relationType) return undefined;
  if (!LOAD_BEARING.includes(suggestedType) && !LOAD_BEARING.includes(link.relationType)) {
    return undefined;
  }

  const because = String(c.because ?? "").trim().slice(0, 300);
  if (!because) return undefined;

  const evidenceA = String(c.evidenceA ?? "").slice(0, 200);
  const evidenceB = String(c.evidenceB ?? "").slice(0, 200);
  const fragA = fragments.find((f) => f.id === link.aId);
  const fragB = fragments.find((f) => f.id === link.bId);
  if (!fragA || !fragB) return undefined;
  const textOf = (f: Fragment) => `${f.title} ${f.body}`;
  if (!isSpanOf(evidenceA, textOf(fragA)) || !isSpanOf(evidenceB, textOf(fragB))) return undefined;

  // Recycling both of the link's own snippets is not a re-reading. One repeated snippet is
  // allowed — a card may have only one sentence that bears on the relation at all, and
  // demanding novelty on both sides would push the model toward quoting something irrelevant
  // just to look fresh.
  const same = (a: string, b?: string) => Boolean(b) && normalizeSpan(a) === normalizeSpan(b!);
  if (same(evidenceA, link.evidenceA) && same(evidenceB, link.evidenceB)) return undefined;

  return { aId: link.aId, bId: link.bId, suggestedType, because, evidenceA, evidenceB };
}
