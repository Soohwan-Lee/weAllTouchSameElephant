"use client";

import { create } from "zustand";
import type {
  Bridge,
  BridgeProposal,
  Fragment,
  NameResult,
  Participant,
  RelationType,
  RevealMode,
  Scenario,
  ScenarioBridge,
  ScenarioReveal,
} from "./types";
import { getScenario } from "./scenarios";

/** Distinct, legible accent colors handed to participants in order. */
const PARTICIPANT_COLORS = [
  "#2563eb", // blue
  "#db2777", // pink
  "#059669", // green
  "#d97706", // amber
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#dc2626", // red
  "#65a30d", // lime
];

/** Turn a scenario's bilingual pre-baked bridges into proposals in one language. */
export function scenarioBridgesToProposals(
  bridges: ScenarioBridge[],
  lang: "en" | "ko"
): BridgeProposal[] {
  return bridges.map((b) => ({
    fragmentAId: b.fragmentAId,
    fragmentBId: b.fragmentBId,
    relationType: b.relationType,
    explanation: b.explanation[lang],
    evidenceA: b.evidenceA[lang],
    evidenceB: b.evidenceB[lang],
    confidence: b.confidence,
  }));
}

/** Turn a scenario's hand-written reveal into a NameResult for the chosen mode/language. */
export function scenarioRevealToResult(
  reveal: ScenarioReveal,
  lang: "en" | "ko",
  mode: RevealMode
): NameResult {
  const base: NameResult = {
    name: reveal.name[lang],
    note: reveal.note[lang],
    question: reveal.question[lang],
    mode,
  };
  if (mode === "explore") return { ...base, readings: reveal.readings.map((r) => r[lang]) };
  if (mode === "hypothesis") return { ...base, hypothesis: reveal.hypothesis[lang] };
  return { ...base, verdict: reveal.verdict[lang] };
}

export type Step = "start" | "gather" | "connect" | "mirror";

function uid(prefix: string): string {
  // deterministic-ish unique id without external deps
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${(idCounter++).toString(36)}`;
}
let idCounter = 0;

interface SessionState {
  step: Step;
  scenarioId: string | null;
  /** the question the team is deciding together ("Should we redesign the park?").
   *  Prefilled from a scenario's title; on a blank table the team types it. AI
   *  seed/conversation input scaffolds lean on this so suggestions are on-topic. */
  decisionPrompt: string;
  /** people at the table. Locally-modeled multi-person (no backend yet). */
  participants: Participant[];
  /** whose turn it is to add/act — stamps authorId/actorId on their actions. */
  activeParticipantId: string | null;
  fragments: Fragment[];
  /** bridges proposed by AI, awaiting human action */
  tray: Bridge[];
  /** confirmed/edited bridges on the board */
  bridges: Bridge[];
  rejectedPairKeys: Set<string>;
  loadingBridges: boolean;
  /** team-accepted name for the assembled elephant (per cluster id) */
  clusterNames: Record<string, string>;
  /** team-edited "so the real question is…" (per cluster id) */
  clusterQuestions: Record<string, string>;
  /** team's own next step / decision that answers the real question (per cluster id) */
  clusterDecisions: Record<string, string>;
  /** whether the reveal ("assemble the elephant") is active */
  assembled: boolean;
  /** which reveal view: "crux" = the synthesis shape, "assembly" = the loose ring */
  revealView: "assembly" | "crux";

  setStep: (s: Step) => void;
  setDecisionPrompt: (q: string) => void;
  /** add a person; returns the new participant id. First one becomes active. */
  addParticipant: (name: string, role: string) => string;
  removeParticipant: (id: string) => void;
  setActiveParticipant: (id: string | null) => void;
  loadScenario: (sc: Scenario, lang: "en" | "ko") => void;
  /** re-project scenario-derived fragment/bridge text into `lang` (mid-session language switch) */
  relocalize: (lang: "en" | "ko") => void;
  reset: () => void;

  addFragment: (f: Omit<Fragment, "id" | "x" | "y">) => void;
  removeFragment: (id: string) => void;
  moveFragment: (id: string, x: number, y: number) => void;

  setLoadingBridges: (v: boolean) => void;
  setClusterName: (clusterId: string, name: string) => void;
  setClusterQuestion: (clusterId: string, q: string) => void;
  setClusterDecision: (clusterId: string, d: string) => void;
  setAssembled: (v: boolean) => void;
  setRevealView: (v: "assembly" | "crux") => void;
  addProposals: (proposals: BridgeProposal[]) => number; // returns # added
  confirmBridge: (id: string, patch?: Partial<Pick<Bridge, "relationType" | "explanation">>) => void;
  rejectBridge: (id: string) => void;
  addManualBridge: (
    aId: string,
    bId: string,
    relationType: RelationType,
    explanation: string
  ) => boolean;
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join("::");
}

export const useSession = create<SessionState>((set, get) => ({
  step: "start",
  scenarioId: null,
  decisionPrompt: "",
  participants: [],
  activeParticipantId: null,
  fragments: [],
  tray: [],
  bridges: [],
  rejectedPairKeys: new Set(),
  loadingBridges: false,
  clusterNames: {},
  clusterQuestions: {},
  clusterDecisions: {},
  assembled: false,
  revealView: "crux",

  setStep: (step) => set({ step }),
  setDecisionPrompt: (decisionPrompt) => set({ decisionPrompt }),

  addParticipant: (name, role) => {
    const id = uid("person");
    set((s) => {
      const color = PARTICIPANT_COLORS[s.participants.length % PARTICIPANT_COLORS.length];
      const p: Participant = { id, name: name.trim() || "—", role: role.trim() || "—", color };
      return {
        participants: [...s.participants, p],
        // first person added becomes the active actor
        activeParticipantId: s.activeParticipantId ?? id,
      };
    });
    return id;
  },
  removeParticipant: (id) =>
    set((s) => {
      const participants = s.participants.filter((p) => p.id !== id);
      const activeParticipantId =
        s.activeParticipantId === id ? participants[0]?.id ?? null : s.activeParticipantId;
      return { participants, activeParticipantId };
    }),
  setActiveParticipant: (activeParticipantId) => set({ activeParticipantId }),
  setClusterName: (clusterId, name) =>
    set((s) => ({ clusterNames: { ...s.clusterNames, [clusterId]: name } })),
  setClusterQuestion: (clusterId, q) =>
    set((s) => ({ clusterQuestions: { ...s.clusterQuestions, [clusterId]: q } })),
  setClusterDecision: (clusterId, d) =>
    set((s) => ({ clusterDecisions: { ...s.clusterDecisions, [clusterId]: d } })),
  setAssembled: (assembled) => set({ assembled }),
  setRevealView: (revealView) => set({ revealView }),

  loadScenario: (sc, lang) => {
    // synthesize one participant per distinct author, so canned data reads as a
    // multi-person table and the fragments carry authorId.
    const participants: Participant[] = [];
    const byName = new Map<string, string>(); // authorName -> participant id
    sc.fragments.forEach((f) => {
      if (!byName.has(f.authorName)) {
        const id = uid("person");
        const color = PARTICIPANT_COLORS[participants.length % PARTICIPANT_COLORS.length];
        participants.push({ id, name: f.authorName, role: f.authorRole[lang], color });
        byName.set(f.authorName, id);
      }
    });
    const fragments: Fragment[] = sc.fragments.map((f) => ({
      id: f.id,
      authorId: byName.get(f.authorName),
      authorName: f.authorName,
      authorRole: f.authorRole[lang],
      title: f.title[lang],
      body: f.body[lang],
      x: f.x,
      y: f.y,
    }));
    set({
      scenarioId: sc.id,
      decisionPrompt: sc.title[lang],
      participants,
      activeParticipantId: participants[0]?.id ?? null,
      fragments,
      tray: [],
      bridges: [],
      rejectedPairKeys: new Set(),
      clusterNames: {},
      clusterQuestions: {},
      clusterDecisions: {},
      assembled: false,
      revealView: "crux",
      step: "gather",
    });
  },

  relocalize: (lang) => {
    const { scenarioId } = get();
    const sc = getScenario(scenarioId);
    if (!sc) return; // blank table / user content — nothing we can translate

    // fragment localized fields, keyed by scenario fragment id
    const fragText = new Map(
      sc.fragments.map((f) => [
        f.id,
        { authorRole: f.authorRole[lang], title: f.title[lang], body: f.body[lang] },
      ])
    );
    // pre-baked bridge text, keyed by unordered fragment pair
    const bridgeText = new Map(
      sc.sampleBridges.map((b) => [
        pairKey(b.fragmentAId, b.fragmentBId),
        {
          explanation: b.explanation[lang],
          evidenceA: b.evidenceA[lang],
          evidenceB: b.evidenceB[lang],
        },
      ])
    );

    // only AI bridges that match a pre-baked pair get re-projected;
    // human/manual and live-AI text can't be translated, so leave those as-is.
    const relBridge = (b: Bridge): Bridge => {
      if (b.createdBy !== "ai") return b;
      const txt = bridgeText.get(pairKey(b.fragmentAId, b.fragmentBId));
      return txt ? { ...b, ...txt } : b;
    };

    // participant roles are localized too (a scenario participant's role differs by lang).
    // key by the author name → the scenario's role text in the target language.
    const roleByName = new Map<string, string>();
    sc.fragments.forEach((f) => {
      if (!roleByName.has(f.authorName)) roleByName.set(f.authorName, f.authorRole[lang]);
    });

    set((s) => ({
      // re-project the decision prompt too — but only if it's still the scenario's
      // own title (untouched). If the team edited it, keep their wording.
      decisionPrompt:
        s.decisionPrompt === sc.title.en || s.decisionPrompt === sc.title.ko
          ? sc.title[lang]
          : s.decisionPrompt,
      participants: s.participants.map((p) => {
        const role = roleByName.get(p.name);
        return role ? { ...p, role } : p;
      }),
      fragments: s.fragments.map((f) => {
        const txt = fragText.get(f.id);
        return txt ? { ...f, ...txt } : f;
      }),
      bridges: s.bridges.map(relBridge),
      tray: s.tray.map(relBridge),
    }));
  },

  reset: () =>
    set({
      step: "start",
      scenarioId: null,
      decisionPrompt: "",
      participants: [],
      activeParticipantId: null,
      fragments: [],
      tray: [],
      bridges: [],
      rejectedPairKeys: new Set(),
      clusterNames: {},
      clusterQuestions: {},
      clusterDecisions: {},
      assembled: false,
      revealView: "crux",
      loadingBridges: false,
    }),

  addFragment: (f) => {
    // place new fragments in a loose ring so the board isn't a pile
    const n = get().fragments.length;
    const angle = (n * 2.399963) % (Math.PI * 2); // golden angle spread
    const radius = 0.22 + (n % 3) * 0.08;
    const x = 0.5 + Math.cos(angle) * radius;
    const y = 0.5 + Math.sin(angle) * radius;
    set((s) => {
      // when there's an active participant, stamp their id and prefer their name/role
      // (the caller may still pass explicit name/role, e.g. blank-table fallback).
      const active = s.participants.find((p) => p.id === s.activeParticipantId);
      const authorId = active?.id;
      const authorName = active ? active.name : f.authorName;
      const authorRole = active ? active.role : f.authorRole;
      return {
        fragments: [
          ...s.fragments,
          {
            ...f,
            authorId,
            authorName,
            authorRole,
            id: uid("frag"),
            x: Math.min(0.9, Math.max(0.1, x)),
            y: Math.min(0.9, Math.max(0.12, y)),
          },
        ],
      };
    });
  },

  removeFragment: (id) =>
    set((s) => ({
      fragments: s.fragments.filter((f) => f.id !== id),
      bridges: s.bridges.filter((b) => b.fragmentAId !== id && b.fragmentBId !== id),
      tray: s.tray.filter((b) => b.fragmentAId !== id && b.fragmentBId !== id),
    })),

  moveFragment: (id, x, y) =>
    set((s) => ({
      fragments: s.fragments.map((f) => (f.id === id ? { ...f, x, y } : f)),
    })),

  setLoadingBridges: (loadingBridges) => set({ loadingBridges }),

  addProposals: (proposals) => {
    const { bridges, tray, rejectedPairKeys, fragments } = get();
    const known = new Set<string>();
    for (const b of [...bridges, ...tray]) known.add(pairKey(b.fragmentAId, b.fragmentBId));
    const validIds = new Set(fragments.map((f) => f.id));

    const fresh: Bridge[] = [];
    for (const p of proposals) {
      if (!validIds.has(p.fragmentAId) || !validIds.has(p.fragmentBId)) continue;
      if (p.fragmentAId === p.fragmentBId) continue;
      const key = pairKey(p.fragmentAId, p.fragmentBId);
      if (known.has(key) || rejectedPairKeys.has(key)) continue;
      known.add(key);
      fresh.push({
        id: uid("bridge"),
        fragmentAId: p.fragmentAId,
        fragmentBId: p.fragmentBId,
        relationType: p.relationType,
        explanation: p.explanation,
        evidenceA: p.evidenceA,
        evidenceB: p.evidenceB,
        confidence: p.confidence,
        status: "proposed",
        createdBy: "ai",
      });
    }
    if (fresh.length) set((s) => ({ tray: [...s.tray, ...fresh] }));
    return fresh.length;
  },

  confirmBridge: (id, patch) =>
    set((s) => {
      const b = s.tray.find((x) => x.id === id);
      if (!b) return {};
      const confirmed: Bridge = {
        ...b,
        ...patch,
        status: patch ? "edited" : "confirmed",
        actorId: s.activeParticipantId ?? undefined,
      };
      return {
        tray: s.tray.filter((x) => x.id !== id),
        bridges: [...s.bridges, confirmed],
      };
    }),

  rejectBridge: (id) =>
    set((s) => {
      const b = s.tray.find((x) => x.id === id);
      if (!b) return {};
      const next = new Set(s.rejectedPairKeys);
      next.add(pairKey(b.fragmentAId, b.fragmentBId));
      return { tray: s.tray.filter((x) => x.id !== id), rejectedPairKeys: next };
    }),

  addManualBridge: (aId, bId, relationType, explanation) => {
    if (aId === bId) return false;
    const key = pairKey(aId, bId);
    const s = get();
    // don't duplicate an existing confirmed bridge or a pending tray proposal
    if (
      s.bridges.some((b) => pairKey(b.fragmentAId, b.fragmentBId) === key) ||
      s.tray.some((b) => pairKey(b.fragmentAId, b.fragmentBId) === key)
    )
      return false;
    const manual: Bridge = {
      id: uid("bridge"),
      fragmentAId: aId,
      fragmentBId: bId,
      relationType,
      explanation,
      evidenceA: "",
      evidenceB: "",
      confidence: 1,
      status: "edited",
      createdBy: "human",
      actorId: s.activeParticipantId ?? undefined,
    };
    set({ bridges: [...s.bridges, manual] });
    return true;
  },
}));
