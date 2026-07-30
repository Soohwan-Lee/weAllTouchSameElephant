"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type {
  Bridge,
  BridgeEdit,
  BridgeProposal,
  Fragment,
  NameResult,
  Participant,
  PreRevealReflection,
  RelationType,
  RevealMode,
  Scenario,
  ScenarioBridge,
  ScenarioReveal,
  SessionEvent,
} from "./types";
import { stripQuestionLeadIn } from "./types";
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
    // the panel label already reads "So the real question is…" — don't say it twice
    question: stripQuestionLeadIn(reveal.question[lang]),
    mode,
  };
  if (mode === "explore") return { ...base, readings: reveal.readings.map((r) => r[lang]) };
  if (mode === "hypothesis") return { ...base, hypothesis: reveal.hypothesis[lang] };
  return { ...base, verdict: reveal.verdict[lang] };
}

/**
 * One answered second look — the AI questioned a confirmed link and the team responded.
 *
 * `outcome` is the whole point of recording these. A team that KEEPS their link over the AI's
 * question has overridden it, and accept-vs-override on a challenge to their OWN work is a
 * signal nothing else in the session produces: every other logged decision is about what the
 * AI proposed, not about what they had already settled. Kept as a plain append-only list
 * rather than session events because it is a small, closed set of outcomes.
 */
export interface ContestRecord {
  aId: string;
  bId: string;
  /** the type the link carried when it was questioned */
  confirmedType: RelationType;
  /** the type the AI floated, when it offered one */
  suggestedType?: RelationType;
  outcome: "kept" | "revisited";
  /**
   * What the team settled on AFTER agreeing to look again — filled in when that pair is next
   * confirmed, so it stays `undefined` while the link sits in the tray awaiting their decision.
   *
   * Without it "revisited" is not yet an answer. A team that reopens a link and then re-confirms
   * the SAME type has considered the AI's question and rejected it, which is the opposite
   * conclusion from one that adopts the suggested type — and both were recorded identically.
   * Comparing this against `confirmedType` and `suggestedType` is what turns the outcome into
   * the accept-vs-override signal the feature exists to produce.
   *
   * `"dropped"` is the third answer: they reopened the link and then dismissed it rather than
   * re-confirming anything, so the connection is gone entirely. That is a real conclusion and
   * must not look like a session that ended mid-decision — which is exactly what an
   * `undefined` left behind by a dismissal would look like.
   */
  resolvedType?: RelationType | "dropped";
}

export type Step = "start" | "gather" | "connect" | "mirror";

/** An event to log, without the meta the store stamps (id/seq/t/actorId).
 *  Distributive so each union member keeps its OWN discriminated fields. */
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
export type EventPayload = DistributiveOmit<SessionEvent, "id" | "seq" | "t" | "actorId">;

/** A full session snapshot for research analysis / handoff. */
export interface SessionExport {
  version: 3;
  /** stable per-run id — without it, exports from different teams can't be told apart
   *  or joined, and two sessions on one scenario used to overwrite each other's file. */
  sessionId: string;
  /** clock origin, so the log can be aligned against a session recording */
  startedAt: number;
  exportedAt: number;
  tzOffsetMinutes: number;
  /** the UI language at export; `relocalize` can leave a session's text mixed, so
   *  analysis needs to know this was in play. */
  lang: "en" | "ko";
  scenarioId: string | null;
  decisionPrompt: string;
  participants: Participant[];
  removedParticipants: Participant[];
  fragments: Fragment[];
  /** AI proposals still awaiting a human answer when the export was made */
  tray: Bridge[];
  bridges: Bridge[];
  rejectedPairKeys: string[];
  /** how the team answered each second look the AI raised on their own confirmed links */
  contests: ContestRecord[];
  clusterNames: Record<string, string>;
  clusterQuestions: Record<string, string>;
  clusterDecisions: Record<string, string>;
  preRevealReflections: Record<string, PreRevealReflection>;
  events: SessionEvent[];
  step: Step;
  activeParticipantId: string | null;
  activeClusterId: string | null;
  assembled: boolean;
  revealView: "assembly" | "crux";
}

function uid(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${(idCounter++).toString(36)}`;
}
let idCounter = 0;

/**
 * Recover, per bridge, what the AI originally proposed versus what the team settled on.
 *
 * The event log is the only place this survives: `bridges` holds the final state, so once a
 * team re-types a relation the AI's original reading exists nowhere else. That override is
 * the sharpest boundary-work signal a session produces — "you said these are the same thing;
 * they are not" — and every prompt that reasons about the team's links wants to see it.
 *
 * Last confirmation wins, since a link can be unconfirmed and confirmed again.
 */
export function bridgeEditsFrom(events: SessionEvent[]): Map<string, BridgeEdit> {
  const m = new Map<string, BridgeEdit>();
  for (const e of events) {
    if (e.type !== "bridge_confirmed") continue;
    m.set(e.bridgeId, {
      aiRelationType: e.aiRelationType,
      retyped: e.retypedRelation,
      edited: e.edited,
    });
  }
  return m;
}

export function newSessionIdentity() {
  return {
    sessionId: uid("sess"),
    startedAt: typeof Date !== "undefined" ? Date.now() : 0,
    eventSeq: 0,
  };
}

interface SessionState {
  /** persisted run identity and event clock — part of the session, never module globals */
  sessionId: string;
  startedAt: number;
  eventSeq: number;
  step: Step;
  scenarioId: string | null;
  /** the question the team is deciding together ("Should we redesign the park?").
   *  Prefilled from a scenario's title; on a blank table the team types it. AI
   *  seed/conversation input scaffolds lean on this so suggestions are on-topic. */
  decisionPrompt: string;
  /** people at the table. Locally-modeled multi-person (no backend yet). */
  participants: Participant[];
  /** people removed from the live roster, retained for referentially complete exports */
  removedParticipants: Participant[];
  /** whose turn it is to add/act — stamps authorId/actorId on their actions. */
  activeParticipantId: string | null;
  /** reveal target chosen by the team; prevents size changes from silently switching topics */
  activeClusterId: string | null;
  /** append-only boundary-work event log (the research payload). */
  events: SessionEvent[];
  /** UI language, mirrored into the store so the export records it (i18n owns the toggle) */
  lang: "en" | "ko";
  /** a blind-spot angle handed from Connect → Gather, so "add a piece from this seat"
   *  lands the person on the write form pre-aimed at that vantage (they fill the words). */
  pendingAngle: string | null;
  fragments: Fragment[];
  /** bridges proposed by AI, awaiting human action */
  tray: Bridge[];
  /** confirmed/edited bridges on the board */
  bridges: Bridge[];
  rejectedPairKeys: Set<string>;
  /** answered second looks — append-only, and the source of the contested pairs the next
   *  round is told not to ask about again. */
  contests: ContestRecord[];
  loadingBridges: boolean;
  /** team-accepted name for the assembled elephant (per cluster id) */
  clusterNames: Record<string, string>;
  /** team-edited "so the real question is…" (per cluster id) */
  clusterQuestions: Record<string, string>;
  /** team's own next step / decision that answers the real question (per cluster id) */
  clusterDecisions: Record<string, string>;
  /** team's own pre-AI hypothesis and falsifier, keyed to the shape they inspected */
  preRevealReflections: Record<string, PreRevealReflection>;
  /** whether the reveal ("assemble the elephant") is active */
  assembled: boolean;
  /** which reveal view: "crux" = the synthesis shape, "assembly" = the loose ring */
  revealView: "assembly" | "crux";

  setStep: (s: Step) => void;
  setDecisionPrompt: (q: string) => void;
  setPendingAngle: (angle: string | null) => void;
  /** add a person; returns the new participant id. First one becomes active. */
  addParticipant: (name: string, role: string) => string;
  removeParticipant: (id: string) => void;
  setActiveParticipant: (id: string | null) => void;
  setActiveCluster: (id: string | null) => void;
  migrateClusterAnnotations: (fromId: string, toId: string) => void;
  /** append a boundary-work event (meta id/seq/t/actorId is stamped for you). */
  logEvent: (e: EventPayload) => void;
  /** serialize the whole session (participants, board, events, decisions) for a researcher. */
  exportSession: () => SessionExport;
  loadScenario: (sc: Scenario, lang: "en" | "ko") => void;
  /** re-project scenario-derived fragment/bridge text into `lang` (mid-session language switch) */
  relocalize: (lang: "en" | "ko") => void;
  /** record the active language + log the switch (relocalize early-returns on blank tables) */
  setLang: (lang: "en" | "ko") => void;
  reset: () => void;

  addFragment: (f: Omit<Fragment, "id" | "x" | "y">, source?: "write" | "seed" | "talk") => void;
  updateFragment: (id: string, patch: Pick<Fragment, "title" | "body">) => void;
  removeFragment: (id: string) => void;
  moveFragment: (id: string, x: number, y: number) => void;

  setLoadingBridges: (v: boolean) => void;
  setClusterName: (clusterId: string, name: string) => void;
  setClusterQuestion: (clusterId: string, q: string) => void;
  setClusterDecision: (clusterId: string, d: string) => void;
  savePreRevealReflection: (clusterId: string, reflection: PreRevealReflection) => void;
  setAssembled: (v: boolean) => void;
  setRevealView: (v: "assembly" | "crux") => void;
  addProposals: (proposals: BridgeProposal[]) => number; // returns # added
  confirmBridge: (
    id: string,
    patch?: Partial<
      Pick<Bridge, "fragmentAId" | "fragmentBId" | "relationType" | "explanation">
    >
  ) => void;
  rejectBridge: (id: string) => void;
  /** take a confirmed link back off the board — AI proposals return to the tray */
  unconfirmBridge: (id: string) => void;
  /** un-block a pair the team dismissed, so the AI may propose it again */
  undoRejection: (pairKey: string) => void;
  /** record how the team answered a second look on one of their confirmed links */
  recordContest: (c: ContestRecord) => void;
  addManualBridge: (
    aId: string,
    bId: string,
    relationType: RelationType,
    explanation: string,
    /** did the two ends already connect through other pieces? (kept-redundant = boundary data) */
    wasRedundant?: boolean
  ) => boolean;
}

function eventMeta(
  s: Pick<SessionState, "eventSeq" | "activeParticipantId">,
  offset = 0
): { id: string; seq: number; t: number; actorId?: string } {
  return {
    id: uid("evt"),
    seq: s.eventSeq + offset,
    t: typeof Date !== "undefined" ? Date.now() : 0,
    actorId: s.activeParticipantId ?? undefined,
  };
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const persistedStorage = createJSONStorage<SessionState>(
  () => (typeof window === "undefined" ? noopStorage : window.localStorage),
  {
    replacer: (_key, value) =>
      value instanceof Set ? { __watseType: "Set", values: [...value] } : value,
    reviver: (_key, value) => {
      if (
        value &&
        typeof value === "object" &&
        (value as { __watseType?: string }).__watseType === "Set"
      ) {
        return new Set((value as { values?: unknown[] }).values ?? []);
      }
      return value;
    },
  }
);

function pairKey(a: string, b: string) {
  return [a, b].sort().join("::");
}

/**
 * Close out an open second look on `key` with what the team decided.
 *
 * Only the NEWEST unresolved record for the pair is touched, so an older contest that already
 * has its answer keeps it. Returns the same array when there is nothing open, so callers that
 * spread the result never write a pointless new reference.
 */
function resolveContest(
  contests: ContestRecord[],
  key: string,
  resolvedType: RelationType | "dropped"
): ContestRecord[] {
  for (let i = contests.length - 1; i >= 0; i--) {
    const r = contests[i];
    if (r.outcome === "revisited" && !r.resolvedType && pairKey(r.aId, r.bId) === key) {
      return contests.map((c, j) => (j === i ? { ...c, resolvedType } : c));
    }
  }
  return contests;
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
  sessionId: "",
  startedAt: 0,
  eventSeq: 0,
  step: "start",
  scenarioId: null,
  decisionPrompt: "",
  participants: [],
  removedParticipants: [],
  activeParticipantId: null,
  activeClusterId: null,
  events: [],
  lang: "en",
  pendingAngle: null,
  fragments: [],
  tray: [],
  bridges: [],
  rejectedPairKeys: new Set(),
  contests: [],
  loadingBridges: false,
  clusterNames: {},
  clusterQuestions: {},
  clusterDecisions: {},
  preRevealReflections: {},
  assembled: false,
  revealView: "crux",

  setStep: (step) => set({ step }),
  setDecisionPrompt: (decisionPrompt) => set({ decisionPrompt }),
  setPendingAngle: (pendingAngle) => set({ pendingAngle }),

  addParticipant: (name, role) => {
    const id = uid("person");
    set((s) => {
      const color = PARTICIPANT_COLORS[s.participants.length % PARTICIPANT_COLORS.length];
      const p: Participant = { id, name: name.trim() || "—", role: role.trim() || "—", color };
      return {
        participants: [...s.participants, p],
        events: [
          ...s.events,
          { ...eventMeta(s), type: "participant_added" as const, participant: p },
        ],
        eventSeq: s.eventSeq + 1,
        // first person added becomes the active actor
        activeParticipantId: s.activeParticipantId ?? id,
      };
    });
    return id;
  },
  removeParticipant: (id) =>
    set((s) => {
      const removed = s.participants.find((p) => p.id === id);
      if (!removed) return {};
      const participants = s.participants.filter((p) => p.id !== id);
      const activeParticipantId =
        s.activeParticipantId === id ? participants[0]?.id ?? null : s.activeParticipantId;
      return {
        participants,
        removedParticipants: [...s.removedParticipants, removed],
        activeParticipantId,
        events: [
          ...s.events,
          { ...eventMeta(s), type: "participant_removed" as const, participant: removed },
        ],
        eventSeq: s.eventSeq + 1,
      };
    }),
  setActiveParticipant: (activeParticipantId) => set({ activeParticipantId }),
  setActiveCluster: (activeClusterId) =>
    set((s) => {
      if (s.activeClusterId === activeClusterId) return {};
      return {
        activeClusterId,
        events: [
          ...s.events,
          { ...eventMeta(s), type: "cluster_selected" as const, clusterId: activeClusterId },
        ],
        eventSeq: s.eventSeq + 1,
      };
    }),
  migrateClusterAnnotations: (fromId, toId) =>
    set((s) => {
      if (fromId === toId) return {};
      const name = s.clusterNames[fromId];
      const question = s.clusterQuestions[fromId];
      const decision = s.clusterDecisions[fromId];
      const preRevealReflection = s.preRevealReflections[fromId];
      if (
        name === undefined &&
        question === undefined &&
        decision === undefined &&
        preRevealReflection === undefined
      ) return {};
      const migrate = <T,>(record: Record<string, T>, value: T | undefined): Record<string, T> => {
        const next = { ...record };
        if (value === undefined) delete next[toId];
        else next[toId] = value;
        return next;
      };
      return {
        // The explicitly selected lineage wins a merge. Any displaced target annotation is
        // copied into the event below, so this remains auditable rather than silently mixing
        // one cluster's name with the other cluster's question.
        clusterNames: migrate(s.clusterNames, name),
        clusterQuestions: migrate(s.clusterQuestions, question),
        clusterDecisions: migrate(s.clusterDecisions, decision),
        preRevealReflections: migrate(s.preRevealReflections, preRevealReflection),
        events: [
          ...s.events,
          {
            ...eventMeta(s),
            type: "cluster_annotations_migrated" as const,
            fromClusterId: fromId,
            toClusterId: toId,
            annotations: { name, question, decision, preRevealReflection },
            displaced: {
              name: s.clusterNames[toId],
              question: s.clusterQuestions[toId],
              decision: s.clusterDecisions[toId],
              preRevealReflection: s.preRevealReflections[toId],
            },
          },
        ],
        eventSeq: s.eventSeq + 1,
      };
    }),

  logEvent: (e) =>
    set((s) => ({
      events: [...s.events, { ...(e as SessionEvent), ...eventMeta(s) }],
      eventSeq: s.eventSeq + 1,
    })),

  exportSession: () => {
    let s = get();
    if (!s.sessionId) {
      const identity = newSessionIdentity();
      set(identity);
      s = { ...s, ...identity };
    }
    return {
      version: 3 as const,
      sessionId: s.sessionId,
      startedAt: s.startedAt,
      exportedAt: typeof Date !== "undefined" ? Date.now() : 0,
      tzOffsetMinutes: typeof Date !== "undefined" ? new Date().getTimezoneOffset() : 0,
      lang: s.lang,
      scenarioId: s.scenarioId,
      decisionPrompt: s.decisionPrompt,
      participants: s.participants,
      removedParticipants: s.removedParticipants,
      fragments: s.fragments,
      tray: s.tray,
      bridges: s.bridges,
      rejectedPairKeys: [...s.rejectedPairKeys],
      contests: s.contests,
      clusterNames: s.clusterNames,
      clusterQuestions: s.clusterQuestions,
      clusterDecisions: s.clusterDecisions,
      preRevealReflections: s.preRevealReflections,
      events: s.events,
      step: s.step,
      activeParticipantId: s.activeParticipantId,
      activeClusterId: s.activeClusterId,
      assembled: s.assembled,
      revealView: s.revealView,
    };
  },
  setClusterName: (clusterId, name) =>
    set((s) => ({ clusterNames: { ...s.clusterNames, [clusterId]: name } })),
  setClusterQuestion: (clusterId, q) =>
    set((s) => ({ clusterQuestions: { ...s.clusterQuestions, [clusterId]: q } })),
  setClusterDecision: (clusterId, d) =>
    set((s) => ({ clusterDecisions: { ...s.clusterDecisions, [clusterId]: d } })),
  savePreRevealReflection: (clusterId, reflection) =>
    set((s) => {
      const cleaned: PreRevealReflection = {
        hypothesis: reflection.hypothesis.trim(),
        disconfirmingEvidence: reflection.disconfirmingEvidence.trim(),
        shapeSignature: reflection.shapeSignature,
        skipped: reflection.skipped,
      };
      if (
        !cleaned.skipped &&
        (!cleaned.hypothesis || !cleaned.disconfirmingEvidence || !cleaned.shapeSignature)
      ) return {};
      return {
        preRevealReflections: {
          ...s.preRevealReflections,
          [clusterId]: cleaned,
        },
        events: [
          ...s.events,
          {
            ...eventMeta(s),
            type: "pre_reveal_reflection" as const,
            clusterId,
            ...cleaned,
          },
        ],
        eventSeq: s.eventSeq + 1,
      };
    }),
  setAssembled: (assembled) => set({ assembled }),
  setRevealView: (revealView) => set({ revealView }),

  loadScenario: (sc, lang) => {
    const identity = newSessionIdentity();
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
      createdLang: lang,
      x: f.x,
      y: f.y,
    }));
    set({
      ...identity,
      scenarioId: sc.id,
      lang,
      decisionPrompt: sc.title[lang],
      pendingAngle: null,
      participants,
      removedParticipants: [],
      activeParticipantId: participants[0]?.id ?? null,
      activeClusterId: null,
      events: [],
      fragments,
      tray: [],
      bridges: [],
      rejectedPairKeys: new Set(),
      contests: [],
      clusterNames: {},
      clusterQuestions: {},
      clusterDecisions: {},
      preRevealReflections: {},
      assembled: false,
      revealView: "crux",
      loadingBridges: false,
      step: "gather",
    });
  },

  setLang: (lang) =>
    set((s) => {
      if (s.lang === lang) return {};
      // a mid-session switch can leave human/live-AI text in the old language while
      // scenario text reprojects — analysis needs to know it happened, and when.
      return {
        lang,
        events: [
          ...s.events,
          { ...eventMeta(s), type: "language_switched" as const, lang },
        ],
        eventSeq: s.eventSeq + 1,
      };
    }),

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

  reset: () => {
    // a reset is a new run — give it its own id and clock so two teams on one machine
    // don't export sessions that look like the same one.
    const identity = newSessionIdentity();
    set({
      ...identity,
      step: "start",
      scenarioId: null,
      decisionPrompt: "",
      pendingAngle: null,
      participants: [],
      removedParticipants: [],
      activeParticipantId: null,
      activeClusterId: null,
      events: [],
      fragments: [],
      tray: [],
      bridges: [],
      rejectedPairKeys: new Set(),
      contests: [],
      clusterNames: {},
      clusterQuestions: {},
      clusterDecisions: {},
      preRevealReflections: {},
      assembled: false,
      revealView: "crux",
      loadingBridges: false,
    });
  },

  addFragment: (f, source = "write") => {
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
      const fragId = uid("frag");
      const fragment: Fragment = {
        ...f,
        authorId,
        authorName,
        authorRole,
        createdLang: s.lang,
        id: fragId,
        x: Math.min(0.9, Math.max(0.1, x)),
        y: Math.min(0.9, Math.max(0.12, y)),
      };
      const evt: SessionEvent = {
        ...eventMeta(s),
        type: "fragment_added",
        fragmentId: fragId,
        fragment,
        source,
        lang: s.lang,
      };
      return {
        fragments: [...s.fragments, fragment],
        events: [...s.events, evt],
        eventSeq: s.eventSeq + 1,
      };
    });
  },

  updateFragment: (id, patch) =>
    set((s) => {
      const current = s.fragments.find((f) => f.id === id);
      if (!current) return {};
      const title = patch.title.trim();
      const body = patch.body.trim();
      if (!title || !body || (title === current.title && body === current.body)) return {};
      const evt: SessionEvent = {
        ...eventMeta(s),
        type: "fragment_edited",
        fragmentId: id,
        before: { title: current.title, body: current.body },
        after: { title, body },
        lang: s.lang,
      };
      return {
        fragments: s.fragments.map((f) => (f.id === id ? { ...f, title, body } : f)),
        events: [...s.events, evt],
        eventSeq: s.eventSeq + 1,
      };
    }),

  removeFragment: (id) =>
    set((s) => {
      const fragment = s.fragments.find((f) => f.id === id);
      if (!fragment) return {};
      const removedBridges = s.bridges.filter(
        (b) => b.fragmentAId === id || b.fragmentBId === id
      );
      const removedTray = s.tray.filter(
        (b) => b.fragmentAId === id || b.fragmentBId === id
      );
      const removedRejectedPairKeys = [...s.rejectedPairKeys].filter((key) =>
        key.split("::").includes(id)
      );
      const rejectedPairKeys = new Set(s.rejectedPairKeys);
      removedRejectedPairKeys.forEach((key) => rejectedPairKeys.delete(key));
      const evt: SessionEvent = {
        ...eventMeta(s),
        type: "fragment_removed",
        fragment,
        removedBridgeIds: removedBridges.map((b) => b.id),
        removedTrayIds: removedTray.map((b) => b.id),
        removedRejectedPairKeys,
      };
      return {
        fragments: s.fragments.filter((f) => f.id !== id),
        bridges: s.bridges.filter((b) => b.fragmentAId !== id && b.fragmentBId !== id),
        tray: s.tray.filter((b) => b.fragmentAId !== id && b.fragmentBId !== id),
        rejectedPairKeys,
        events: [...s.events, evt],
        eventSeq: s.eventSeq + 1,
      };
    }),

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
        status: "proposed",
        createdBy: "ai",
      });
    }
    if (fresh.length)
      set((s) => ({
        tray: [...s.tray, ...fresh],
        events: [
          ...s.events,
          ...fresh.map(
            (b, i): SessionEvent => ({
              ...eventMeta(s, i),
              type: "bridge_proposed",
              bridge: b,
              pairKey: pairKey(b.fragmentAId, b.fragmentBId),
              relationType: b.relationType,
            })
          ),
        ],
        eventSeq: s.eventSeq + fresh.length,
      }));
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
      // Keep the AI's original beside the human's final. `edited: !!patch` couldn't tell a
      // real rewrite from opening the editor and saving unchanged — and a relation RETYPE
      // (overlap→tension = "that's not the same thing, it's a tradeoff") is the sharpest
      // boundary-work signal there is, so record the from-type, not just the to-type.
      const evt: SessionEvent = {
        ...eventMeta(s),
        bridgeId: b.id,
        type: "bridge_confirmed",
        pairKey: pairKey(b.fragmentAId, b.fragmentBId),
        relationType: confirmed.relationType,
        aiRelationType: b.relationType,
        aiExplanation: b.explanation,
        humanExplanation: confirmed.explanation,
        edited: b.explanation !== confirmed.explanation || b.relationType !== confirmed.relationType,
        retypedRelation: b.relationType !== confirmed.relationType,
      };
      // The team agreed to look again, and this confirm is what they decided.
      return {
        tray: s.tray.filter((x) => x.id !== id),
        bridges: [...s.bridges, confirmed],
        events: [...s.events, evt],
        eventSeq: s.eventSeq + 1,
        contests: resolveContest(
          s.contests,
          pairKey(b.fragmentAId, b.fragmentBId),
          confirmed.relationType
        ),
      };
    }),

  rejectBridge: (id) =>
    set((s) => {
      const b = s.tray.find((x) => x.id === id);
      if (!b) return {};
      const next = new Set(s.rejectedPairKeys);
      next.add(pairKey(b.fragmentAId, b.fragmentBId));
      // preserve the discarded proposal — this was destroyed before, and it's the
      // single most important boundary-work signal (what the team refused).
      const evt: SessionEvent = {
        ...eventMeta(s),
        bridgeId: b.id,
        type: "bridge_rejected",
        pairKey: pairKey(b.fragmentAId, b.fragmentBId),
        relationType: b.relationType,
        explanation: b.explanation,
        createdBy: b.createdBy,
      };
      // Reopening a link and then throwing it away IS an answer to the second look — the
      // team's conclusion was that the connection should not be there at all. Left unresolved
      // it would be indistinguishable from a session that ended mid-decision.
      return {
        tray: s.tray.filter((x) => x.id !== id),
        rejectedPairKeys: next,
        events: [...s.events, evt],
        eventSeq: s.eventSeq + 1,
        contests: resolveContest(s.contests, pairKey(b.fragmentAId, b.fragmentBId), "dropped"),
      };
    }),

  // A single click used to put a link on the board forever — there was no way to take one
  // back, which made a misclick permanent and left the "too many links" warning with no
  // remedy. An AI proposal goes back to the tray (so it can be reconsidered or dismissed);
  // a hand-drawn one just disappears, since its author can simply draw it again.
  unconfirmBridge: (id) =>
    set((s) => {
      const b = s.bridges.find((x) => x.id === id);
      if (!b) return {};
      const evt: SessionEvent = {
        ...eventMeta(s),
        bridgeId: b.id,
        type: "bridge_unconfirmed",
        pairKey: pairKey(b.fragmentAId, b.fragmentBId),
        relationType: b.relationType,
      };
      return {
        bridges: s.bridges.filter((x) => x.id !== id),
        tray: b.createdBy === "ai" ? [...s.tray, { ...b, status: "proposed" as const }] : s.tray,
        events: [...s.events, evt],
        eventSeq: s.eventSeq + 1,
      };
    }),

  undoRejection: (key) =>
    set((s) => {
      if (!s.rejectedPairKeys.has(key)) return {};
      const next = new Set(s.rejectedPairKeys);
      next.delete(key);
      return {
        rejectedPairKeys: next,
        events: [
          ...s.events,
          { ...eventMeta(s), type: "rejection_undone", pairKey: key },
        ],
        eventSeq: s.eventSeq + 1,
      };
    }),

  recordContest: (c) => set((s) => ({ contests: [...s.contests, c] })),

  addManualBridge: (aId, bId, relationType, explanation, wasRedundant = false) => {
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
      status: "edited",
      createdBy: "human",
      actorId: s.activeParticipantId ?? undefined,
    };
    const evt: SessionEvent = {
      ...eventMeta(s),
      bridgeId: manual.id,
      type: "manual_bridge_added",
      pairKey: key,
      relationType,
      explanation,
      wasRedundant,
    };
    set({
      bridges: [...s.bridges, manual],
      events: [...s.events, evt],
      eventSeq: s.eventSeq + 1,
    });
    return true;
  },
    }),
    {
      name: "watse-session-v3",
      version: 3,
      storage: persistedStorage,
      skipHydration: true,
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SessionState>;
        return {
          ...current,
          ...saved,
          // Export v3 added the archive after persistence v3 shipped. Old local snapshots
          // therefore need an empty value instead of rehydrating `undefined`.
          removedParticipants: saved.removedParticipants ?? [],
          activeClusterId: saved.activeClusterId ?? null,
          preRevealReflections: saved.preRevealReflections ?? {},
          rejectedPairKeys:
            saved.rejectedPairKeys instanceof Set
              ? saved.rejectedPairKeys
              : new Set(saved.rejectedPairKeys ?? []),
          // A request cannot survive a page reload; never rehydrate a phantom spinner.
          loadingBridges: false,
        };
      },
    }
  )
);
