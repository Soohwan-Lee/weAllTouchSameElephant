import type { BridgeProposal, Fragment } from "./types";

/**
 * EVIDENCE SPANS — does a proposed link actually point at words in the two cards?
 *
 * The grounding layer (see ./grounding) checks that a claim cites a piece that EXISTS. This is
 * the tighter question one level down: the prompt asks the model to "quote a short real snippet
 * from EACH fragment", and until now nothing checked that the snippet was in the fragment. A
 * link whose evidence is a paraphrase, a summary, or a plausible-sounding invention reads on
 * screen exactly like one quoted off the card — and the team confirms or rejects it on the
 * strength of that evidence, so an unquotable snippet is not a cosmetic flaw.
 *
 * Span-level provenance is the known defense here. Talk to the City ties every claim it shows
 * to an exact source quote; the Polis+LLM study (arXiv 2306.11932) documented the opposite
 * failure — summaries too generic to attribute back to any participant. Verifying the span in
 * code rather than asking for it in the prompt follows the same rule the rest of this route
 * runs on: structural constraints hold, prompt requests do not (see selectForSeatCoverage).
 *
 * An EMPTY evidence string fails. A link that cannot point at a span in the card is exactly the
 * generic link we refuse to show; treating blank as "nothing to check, let it through" would
 * make omission the cheapest way past the check.
 */

/**
 * Fold away the differences that are not the model's fault: casing, whitespace runs, and
 * punctuation the model re-styles while quoting (smart quotes for straight ones, a dropped
 * trailing period, an em dash for a hyphen). What survives is the word sequence, which is the
 * thing that has to have come from the card.
 *
 * NFC comes first because the two sides reach here from different places — the card was typed
 * into a browser, the snippet came back through a model and a JSON round-trip — and either can
 * arrive decomposed. Decomposed and composed forms look identical on screen and compare as
 * unequal, so without this a perfectly quoted Korean or accented span is rejected as invented:
 * "감사 기록" in NFD does not match the same characters in NFC.
 *
 * Punctuation is stripped rather than mapped to a space: a quote that trims "on-call" to
 * "oncall" is still the same span, while collapsing it to "on call" would not match the card.
 * Korean text carries no spaces at some boundaries, so this must not depend on word splitting.
 *
 * Two consequences of deleting punctuation are known and accepted. A span may be spliced across
 * a sentence boundary ("shipped late budget never landed" matches "We shipped late. Budget never
 * landed."), and an ellipsis-elided quote ("A … B") is rejected because the gap is not in the
 * card. Both were measured against real proposals rather than reasoned about: 22/22 legitimate
 * proposals passed across EN and KO, 0 false rejections. Tightening either one costs real quotes
 * to catch a splice no observed model produced.
 */
export function normalizeSpan(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Shortest normalized span that counts as pointing at the card.
 *
 * Blank evidence already fails, but a one-word span is the next-cheapest way past the check:
 * "the" is a substring of almost any card, so it would verify while pointing at nothing. Four
 * characters is the floor because it clears the common function words in both languages ("the",
 * "and", "은", "그") while staying under any real quoted phrase — the shortest legitimate
 * evidence in the measured set was well above it. This bounds how generic a passing snippet can
 * be; it does not try to judge whether the quote is a GOOD one, which is the team's call.
 */
const MIN_SPAN_LENGTH = 4;

/** Is `evidence` a near-verbatim span of `source`? Empty or trivially short evidence is never
 *  a span — see MIN_SPAN_LENGTH. */
export function isSpanOf(evidence: string, source: string): boolean {
  const needle = normalizeSpan(evidence);
  if (needle.length < MIN_SPAN_LENGTH) return false;
  return normalizeSpan(source).includes(needle);
}

/**
 * The text a snippet may be quoted from — title and body both, since a model quoting a card
 * often quotes its label, and a title is the team's own words just as much as the body is.
 */
function textOf(f: Fragment): string {
  return `${f.title} ${f.body}`;
}

/**
 * True when BOTH snippets are spans of their OWN card. Checking each against its own side is
 * the point: evidence lifted from the other card would still be real text from the table while
 * saying nothing about the piece it is attached to, and the UI labels these "From the first
 * piece" / "From the second piece".
 */
export function verifyProposalEvidence(p: BridgeProposal, fragments: Fragment[]): boolean {
  const a = fragments.find((f) => f.id === p.fragmentAId);
  const b = fragments.find((f) => f.id === p.fragmentBId);
  if (!a || !b) return false;
  return isSpanOf(p.evidenceA, textOf(a)) && isSpanOf(p.evidenceB, textOf(b));
}

export function filterToVerifiedEvidence(
  proposals: BridgeProposal[],
  fragments: Fragment[]
): BridgeProposal[] {
  return proposals.filter((p) => verifyProposalEvidence(p, fragments));
}
