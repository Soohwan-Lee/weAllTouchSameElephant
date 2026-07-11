"use client";

import { create } from "zustand";
import type {
  Bridge,
  BridgeProposal,
  Fragment,
  RelationType,
  Scenario,
  ScenarioBridge,
} from "./types";

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

export type Step = "start" | "gather" | "connect" | "mirror";

function uid(prefix: string): string {
  // deterministic-ish unique id without external deps
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${(idCounter++).toString(36)}`;
}
let idCounter = 0;

interface SessionState {
  step: Step;
  scenarioId: string | null;
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
  /** whether the reveal ("assemble the elephant") is active */
  assembled: boolean;
  /** which reveal view: "crux" = the synthesis shape, "assembly" = the loose ring */
  revealView: "assembly" | "crux";

  setStep: (s: Step) => void;
  loadScenario: (sc: Scenario, lang: "en" | "ko") => void;
  reset: () => void;

  addFragment: (f: Omit<Fragment, "id" | "x" | "y">) => void;
  removeFragment: (id: string) => void;
  moveFragment: (id: string, x: number, y: number) => void;

  setLoadingBridges: (v: boolean) => void;
  setClusterName: (clusterId: string, name: string) => void;
  setClusterQuestion: (clusterId: string, q: string) => void;
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
  fragments: [],
  tray: [],
  bridges: [],
  rejectedPairKeys: new Set(),
  loadingBridges: false,
  clusterNames: {},
  clusterQuestions: {},
  assembled: false,
  revealView: "crux",

  setStep: (step) => set({ step }),
  setClusterName: (clusterId, name) =>
    set((s) => ({ clusterNames: { ...s.clusterNames, [clusterId]: name } })),
  setClusterQuestion: (clusterId, q) =>
    set((s) => ({ clusterQuestions: { ...s.clusterQuestions, [clusterId]: q } })),
  setAssembled: (assembled) => set({ assembled }),
  setRevealView: (revealView) => set({ revealView }),

  loadScenario: (sc, lang) => {
    const fragments: Fragment[] = sc.fragments.map((f) => ({
      id: f.id,
      authorName: f.authorName,
      authorRole: f.authorRole[lang],
      title: f.title[lang],
      body: f.body[lang],
      x: f.x,
      y: f.y,
    }));
    set({
      scenarioId: sc.id,
      fragments,
      tray: [],
      bridges: [],
      rejectedPairKeys: new Set(),
      clusterNames: {},
      clusterQuestions: {},
      assembled: false,
      revealView: "crux",
      step: "gather",
    });
  },

  reset: () =>
    set({
      step: "start",
      scenarioId: null,
      fragments: [],
      tray: [],
      bridges: [],
      rejectedPairKeys: new Set(),
      clusterNames: {},
      clusterQuestions: {},
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
    set((s) => ({
      fragments: [
        ...s.fragments,
        { ...f, id: uid("frag"), x: Math.min(0.9, Math.max(0.1, x)), y: Math.min(0.9, Math.max(0.12, y)) },
      ],
    }));
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
    };
    set({ bridges: [...s.bridges, manual] });
    return true;
  },
}));
