"use client";

import { create } from "zustand";
import type { Bridge, BridgeProposal, Fragment, RelationType, Scenario } from "./types";

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

  setStep: (s: Step) => void;
  loadScenario: (sc: Scenario, lang: "en" | "ko") => void;
  reset: () => void;

  addFragment: (f: Omit<Fragment, "id" | "x" | "y">) => void;
  removeFragment: (id: string) => void;
  moveFragment: (id: string, x: number, y: number) => void;

  setLoadingBridges: (v: boolean) => void;
  addProposals: (proposals: BridgeProposal[]) => number; // returns # added
  confirmBridge: (id: string, patch?: Partial<Pick<Bridge, "relationType" | "explanation">>) => void;
  rejectBridge: (id: string) => void;
  addManualBridge: (aId: string, bId: string, relationType: RelationType, explanation: string) => void;
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

  setStep: (step) => set({ step }),

  loadScenario: (sc, lang) => {
    const fragments: Fragment[] = sc.fragments.map((f) => ({
      id: f.id,
      authorName: f.authorName,
      authorRole: f.authorRole,
      title: f.title,
      body: f.body,
      x: f.x,
      y: f.y,
    }));
    set({
      scenarioId: sc.id,
      fragments,
      tray: [],
      bridges: [],
      rejectedPairKeys: new Set(),
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

  addManualBridge: (aId, bId, relationType, explanation) =>
    set((s) => {
      if (aId === bId) return {};
      const key = pairKey(aId, bId);
      if (s.bridges.some((b) => pairKey(b.fragmentAId, b.fragmentBId) === key)) return {};
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
      return { bridges: [...s.bridges, manual] };
    }),
}));
