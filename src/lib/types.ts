// Core data model for We All Touch the Same Elephant.
// Spec: WATSE 4.1 — fragments stay visible; AI proposes bridges; humans assemble.

/**
 * How two pieces relate. Four of these are forms of CONNECTION; `separate` is the one way
 * to assert the opposite — "these must NOT be merged." Without it the construct was
 * lopsided: the team could only ever say "join", and refusing a bridge was silence rather
 * than a claim. Keeping perspectives apart is half of integration boundary work.
 */
export type RelationType = "overlap" | "tension" | "dependency" | "complement" | "separate";

/**
 * What kind of "elephant" the team wants the AI to hand back after they assemble:
 *  - explore : hold 2–3 competing readings open (safest re: anchoring)
 *  - verdict : the sharpest single claim — "the core is X" (most anchoring risk)
 *
 * There used to be a third, `hypothesis` ("maybe the core is X, here's the test"). It sat on
 * the SAME axis as verdict — how hard the AI commits — so to a user the two read as the same
 * thing. Collapsed to just the two ends: spread open vs commit. `hypothesis` stays a valid
 * value in the data types (scenario reveals still carry the field) but is no longer offered.
 */
export type RevealMode = "explore" | "hypothesis" | "verdict";

/** The modes actually offered in the UI — explore (open) and verdict (commit). */
export const REVEAL_MODES: RevealMode[] = ["explore", "verdict"];

export const RELATION_TYPES: RelationType[] = [
  "overlap",
  "tension",
  "dependency",
  "complement",
  "separate",
];

/** A person at the table. Locally-modeled multi-person now; the seam a future
 *  "each participant connects from their own device" build attaches to. */
/** A "side of the elephant" handed to the naming prompt — the shape the team built. */
export interface FacetSummary {
  /** the anchor piece's title (the side's handle) */
  anchor: string;
  /** the other pieces fused into this side */
  members: string[];
  /** 0 = a root pressure, higher = a downstream symptom */
  depth: number;
  /** how many other sides this one drives */
  supports: number;
  /** how many other sides drive this one */
  dependsOn: number;
  /** true if this is the ROOT the rest grow from (causal position, not link count) */
  isKeystone: boolean;
}

export interface Participant {
  id: string;
  name: string;
  role: string;
  /** a stable accent color (hex) so each voice is visible on the board */
  color: string;
}

export interface Fragment {
  id: string;
  /** the participant who added this piece (when the table has participants).
   *  authorName/authorRole stay as denormalized display copies so scenarios and
   *  mid-session relocalize keep working without a participant lookup. */
  authorId?: string;
  authorName: string;
  authorRole: string;
  title: string;
  body: string;
  /** canvas position (0..1 normalized so it scales with the board) */
  x: number;
  y: number;
}

/** What the team did to one AI-proposed link on its way to being confirmed.
 *  Recovered from the event log by `bridgeEditsFrom`; `bridges` only holds the final state. */
export interface BridgeEdit {
  /** the type the AI first proposed, when it differs from the type the team settled on */
  aiRelationType?: RelationType;
  /** the team re-typed the relation — they refused the AI's reading of this boundary */
  retyped?: boolean;
  /** the team rewrote the explanation in their own words */
  edited?: boolean;
}

export type BridgeStatus = "proposed" | "confirmed" | "edited" | "rejected";

export interface Bridge {
  id: string;
  fragmentAId: string;
  fragmentBId: string;
  relationType: RelationType;
  /** one-sentence, plain-language explanation of the connection */
  explanation: string;
  /** short quote/paraphrase grounding the bridge in each fragment */
  evidenceA: string;
  evidenceB: string;
  confidence: number; // 0..1
  status: BridgeStatus;
  createdBy: "ai" | "human";
  /** the participant who confirmed/edited/drew this bridge (the acting human). */
  actorId?: string;
}

/**
 * Boundary-work event log — the research payload. Append-only, timestamped record of the
 * moves that matter for studying "Integration Boundary Work": which AI proposals a team
 * confirmed / edited / REJECTED, who acted, which redundant links they kept on purpose, the
 * reveal mode they asked for, and — the key signal — whether they accepted the AI's framing
 * (name/question) or overrode it. None of this was recoverable before; rejections were deleted.
 */
export type SessionEvent =
  | { id: string; seq: number; t: number; actorId?: string; type: "fragment_added"; fragmentId: string; source: "write" | "seed" | "talk" }
  | { id: string; seq: number; t: number; actorId?: string; type: "bridge_proposed"; pairKey: string; relationType: RelationType }
  // Keeping a connection but REWRITING what it means is the finest-grained boundary work
  // there is, so the AI's original text and type are preserved beside the human's final
  // version — `edited` alone couldn't tell a substantive rewrite from a no-op re-save.
  | { id: string; seq: number; t: number; actorId?: string; bridgeId: string; type: "bridge_confirmed"; pairKey: string; relationType: RelationType; aiRelationType: RelationType; aiExplanation: string; humanExplanation: string; edited: boolean; retypedRelation: boolean }
  | { id: string; seq: number; t: number; actorId?: string; bridgeId: string; type: "bridge_rejected"; pairKey: string; relationType: RelationType; explanation: string; createdBy: "ai" | "human" }
  // a hand-drawn link carries the team's OWN words for why these two belong together —
  // the most theoretically loaded text in a session, and it used to go unrecorded.
  | { id: string; seq: number; t: number; actorId?: string; bridgeId: string; type: "manual_bridge_added"; pairKey: string; relationType: RelationType; explanation: string; wasRedundant: boolean }
  // reversals are boundary work too — a team that confirms a link and then takes it back
  // has negotiated something. Logged as its own event rather than erasing the original.
  | { id: string; seq: number; t: number; actorId?: string; type: "bridge_unconfirmed"; pairKey: string; relationType: RelationType }
  | { id: string; seq: number; t: number; actorId?: string; type: "rejection_undone"; pairKey: string }
  | { id: string; seq: number; t: number; actorId?: string; type: "reveal_mode_chosen"; mode: RevealMode }
  | { id: string; seq: number; t: number; actorId?: string; type: "name_accepted"; aiOriginal: string; humanFinal: string; changed: boolean }
  | { id: string; seq: number; t: number; actorId?: string; type: "question_accepted"; aiOriginal: string; humanFinal: string; changed: boolean }
  | { id: string; seq: number; t: number; actorId?: string; type: "decision_written"; text: string }
  | { id: string; seq: number; t: number; actorId?: string; type: "language_switched"; lang: "en" | "ko" }
  // AI named a missing vantage; `filled` marks whether the team went on to add a piece from
  // that seat (the elicitation actually landing), vs merely being shown the gap.
  | { id: string; seq: number; t: number; actorId?: string; type: "blindspot_shown"; angle: string; rationale: string }
  | { id: string; seq: number; t: number; actorId?: string; type: "blindspot_filled"; angle: string }
  // the team looked at the named seat and judged it NOT actually missing — refusal, which is
  // different from ignoring it, and is itself boundary work (declining a proposed gap).
  | { id: string; seq: number; t: number; actorId?: string; type: "blindspot_dismissed"; angle: string }
  // the team saw the cost their decision commits to — exposure-vs-action for the trade-off.
  // `groundedBridgeId` is the link the cost was actually read off, verified server-side.
  // Absent means the cost is an opportunity cost tied to no kept tension — a legitimate
  // outcome, and one worth telling apart from a cost that mirrors a tension the team kept.
  | { id: string; seq: number; t: number; actorId?: string; type: "tradeoff_shown"; tension: string; favors: string; cost: string; groundedBridgeId?: string }
  // …and how they answered it. Contesting the named cost is Integration Boundary Work in its
  // purest form — the team renegotiating what their decision merges vs keeps separate. The
  // stance says whether they took the AI's framing, moved the cost, or rejected it outright;
  // `note` holds their own words when they relocate or reject.
  | { id: string; seq: number; t: number; actorId?: string; type: "tradeoff_answered"; stance: "accepted" | "relocated" | "rejected"; cost: string; note: string }
  // The shape the team was actually looking at, plus what the AI said about it — captured
  // unconditionally at reveal time. Both used to be lost: the synthesis was recomputed from
  // the CURRENT board (which the team may have edited afterwards), and the AI's reading was
  // recorded only if someone pressed "Use this name". A team that read a verdict, argued
  // with it, and moved on left no trace that the AI had said anything at all.
  | {
      id: string; seq: number; t: number; actorId?: string;
      type: "reveal_computed";
      mode: RevealMode;
      fragmentCount: number;
      bridgeCount: number;
      wholeness: number;
      keystoneTitle?: string;
      /** the sides EXACTLY as the prompt saw them. This used to be narrowed to
       *  anchor/members/depth, which dropped supports/dependsOn/isKeystone — so the log
       *  could not say which side was the keystone or what drove what, even though the
       *  model was shown all of it. The point of this event is to reconstruct the shape
       *  the team was looking at; a narrowed copy cannot. */
      facets: FacetSummary[];
      spine: string[][];
      tensionCount: number;
      /** the AI's full reading, verbatim */
      aiName: string;
      aiNote: string;
      aiQuestion: string;
      aiReadings?: string[];
      aiHypothesis?: string;
      aiVerdict?: string;
      /** true when this came from a scenario's hand-written reveal (sample mode) */
      sample: boolean;
      /**
       * Server-verified record of which of the team's own pieces/links this reading cited,
       * and how much of it was anchored at all. Absent on sample/degraded runs.
       *
       * This is the row that makes the AI's framing auditable after the fact: an analysis can
       * ask not only whether the team kept the AI's name and question (already logged) but
       * whether that framing was read off their structure in the first place — and which
       * parts of the table it ignored.
       */
      grounding?: GroundingTrace;
    };

/** What the AI returns from /api/bridges (before we assign ids/status). */
export interface BridgeProposal {
  fragmentAId: string;
  fragmentBId: string;
  relationType: RelationType;
  explanation: string;
  evidenceA: string;
  evidenceB: string;
  confidence: number;
}

/** Result of /api/name — a named elephant + the mode-specific "reading." */
export interface NameResult {
  name: string;
  note: string;
  question: string;
  mode: RevealMode;
  /** explore: 2–3 competing readings */
  readings?: string[];
  /** hypothesis: one falsifiable claim */
  hypothesis?: string;
  /** verdict: the sharpest single claim */
  verdict?: string;
  /** true when this came from the local fallback (no API key) — client may swap in a scenario reveal */
  sample?: boolean;
  /** the call FAILED — distinct from "the AI had nothing to say", which the UI must not conflate */
  error?: boolean;
  /**
   * Which of the team's OWN pieces and links this reading was actually read off — verified
   * server-side against the real table, so a fabricated citation can never appear here.
   * Ids, not handles: handles are minted per request and meaningless afterwards, while ids
   * join back to `fragments`/`bridges` in the export.
   *
   * This is what turns "the AI reflects the team's structure" from a design claim into a
   * checkable property of each response. The UI does not need it (nothing renders it today);
   * it exists so the session log records what the framing rested on.
   */
  grounding?: GroundingTrace;
}

/** Server-verified trace of what an AI reading leaned on, plus how well it was anchored. */
export interface GroundingTrace {
  /** fragment ids the model cited and that actually exist on the table */
  fragmentIds: string[];
  /** bridge ids the model cited and that actually exist */
  bridgeIds: string[];
  /** share of the response's claims carrying ≥1 verifiable citation (0..1) */
  rate: number;
  /** share of cited handles that pointed at nothing — the model inventing references (0..1).
   *  Dropped before display; recorded because the rate itself is a finding. */
  fabricationRate: number;
  /** how many distinct claims were checked (name / reading(s) / question) */
  claims: number;
}

/** A localized fragment as stored in a scenario (title/body per language). */
export interface ScenarioFragment {
  id: string;
  authorName: string;
  authorRole: { en: string; ko: string };
  title: { en: string; ko: string };
  body: { en: string; ko: string };
  x: number;
  y: number;
}

/** A localized pre-baked bridge for sample mode. */
export interface ScenarioBridge {
  fragmentAId: string;
  fragmentBId: string;
  relationType: RelationType;
  explanation: { en: string; ko: string };
  evidenceA: { en: string; ko: string };
  evidenceB: { en: string; ko: string };
  confidence: number;
}

/** Hand-written per-mode reveal for sample mode (no API key). Bilingual. */
export interface ScenarioReveal {
  name: { en: string; ko: string };
  note: { en: string; ko: string };
  question: { en: string; ko: string };
  /** explore: 2–3 competing readings */
  readings: Array<{ en: string; ko: string }>;
  /** hypothesis: one falsifiable claim */
  hypothesis: { en: string; ko: string };
  /** verdict: the sharpest single claim */
  verdict: { en: string; ko: string };
}

export interface Scenario {
  id: string;
  emoji: string;
  title: { en: string; ko: string };
  prompt: { en: string; ko: string };
  fragments: ScenarioFragment[];
  /** pre-baked bridges so sample mode works with no API key */
  sampleBridges: ScenarioBridge[];
  /** pre-written reveal (name + 3 modes) so sample mode is a first-class experience */
  reveal?: ScenarioReveal;
}

/**
 * The result screen already prints "So the real question is…" as the panel's label, so a
 * question that *also* opens with that phrase reads it twice ("So the real question is… /
 * So the real question is: which…"). Strip any such lead-in — from the LLM, from the sample
 * fallback, or from the hand-written scenario reveals — so the question opens on substance.
 */
const QUESTION_LEAD_IN =
  /^\s*(?:so[, ]+)?(?:the\s+)?real\s+question\s+is\s*[::,—-]*\s*|^\s*그래서\s*(?:진짜\s*)?질문은\s*[::,—-]*\s*|^\s*진짜\s*질문은\s*[::,—-]*\s*/i;

export function stripQuestionLeadIn(q: string): string {
  const out = q.replace(QUESTION_LEAD_IN, "").trim();
  if (!out) return q.trim();
  // keep the sentence readable after the cut: re-capitalize a latin opener
  return /^[a-z]/.test(out) ? out.charAt(0).toUpperCase() + out.slice(1) : out;
}
