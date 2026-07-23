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
  // the team saw the cost their decision commits to — exposure-vs-action for the trade-off.
  | { id: string; seq: number; t: number; actorId?: string; type: "tradeoff_shown"; tension: string; favors: string; cost: string }
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
      facets: Array<{ anchor: string; members: string[]; depth: number }>;
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
}

/** Structured, non-authoritative reflection from /api/mirror. */
export interface MirrorReflection {
  connected: string[]; // sentences citing fragment titles
  tensions: string[];
  separate: string[];
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
