// Core data model for We All Touch the Same Elephant.
// Spec: WATSE 4.1 — fragments stay visible; AI proposes bridges; humans assemble.

export type RelationType = "overlap" | "tension" | "dependency" | "complement";

/**
 * What kind of "elephant" the team wants the AI to hand back after they assemble:
 *  - explore   : hold 2–3 competing readings open (safest re: anchoring)
 *  - hypothesis: one falsifiable "maybe the real core is X" — a provocation to test
 *  - verdict   : the sharpest single claim — "the core is X" (most anchoring risk)
 */
export type RevealMode = "explore" | "hypothesis" | "verdict";

export const REVEAL_MODES: RevealMode[] = ["explore", "hypothesis", "verdict"];

export const RELATION_TYPES: RelationType[] = [
  "overlap",
  "tension",
  "dependency",
  "complement",
];

export interface Fragment {
  id: string;
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
}

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
