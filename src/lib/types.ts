// Core data model for We All Touch the Same Elephant.
// Spec: WATSE 4.1 — fragments stay visible; AI proposes bridges; humans assemble.

export type RelationType = "overlap" | "tension" | "dependency" | "complement";

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

/** Structured, non-authoritative reflection from /api/mirror. */
export interface MirrorReflection {
  connected: string[]; // sentences citing fragment titles
  tensions: string[];
  separate: string[];
}

export interface Scenario {
  id: string;
  title: { en: string; ko: string };
  prompt: { en: string; ko: string };
  fragments: Array<
    Omit<Fragment, "id" | "x" | "y"> & { id: string; x: number; y: number }
  >;
  /** pre-baked bridges so sample mode works with no API key */
  sampleBridges: BridgeProposal[];
}
