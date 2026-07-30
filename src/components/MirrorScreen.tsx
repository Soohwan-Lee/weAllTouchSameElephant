"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession, scenarioRevealToResult, bridgeEditsFrom } from "@/lib/store";
import { getScenario } from "@/lib/scenarios";
import { fetchName } from "@/lib/api";
import { findRevealClusters, seatCitation, selectedRevealCluster } from "@/lib/clusters";
import { computeSynthesis } from "@/lib/synthesis";
import type { FacetSummary } from "@/lib/prompts";
import type { NameResult, RevealMode } from "@/lib/types";
import { REVEAL_MODES } from "@/lib/types";
import { PuzzleCanvas } from "./PuzzleCanvas";
import { SynthesisCanvas } from "./SynthesisCanvas";
import { StorySpine } from "./StorySpine";
import { SynthesisSummary } from "./SynthesisSummary";
import { Hint } from "./Hint";
import { RevealRail, type RailSection } from "./RevealRail";
import { VoiceTag } from "./VoiceTag";
import { WhoseWords } from "./WhoseWords";
import { PreRevealCheckpointCard } from "./PreRevealCheckpointCard";

/**
 * The final picture — the assembled elephant.
 *
 * Order matters (WATSE v5 §4.5): people assemble the links first; only here does the
 * AI mirror back a reading. And it hands back the KIND of reading the team asks for —
 * explore (competing readings) / hypothesis (one falsifiable bet) / verdict (the sharpest
 * claim). Crucially, the AI is handed the SHAPE the team built (facets, keystone, tensions),
 * not just a flat list — that's what lets it say something specific, not a generic theme.
 */
export function MirrorScreen() {
  const { t, lang } = useI18n();
  const fragments = useSession((s) => s.fragments);
  const bridges = useSession((s) => s.bridges);
  const scenarioId = useSession((s) => s.scenarioId);
  const decisionPrompt = useSession((s) => s.decisionPrompt);
  const assembled = useSession((s) => s.assembled);
  const setAssembled = useSession((s) => s.setAssembled);
  const revealView = useSession((s) => s.revealView);
  const setRevealView = useSession((s) => s.setRevealView);
  const clusterNames = useSession((s) => s.clusterNames);
  const setClusterName = useSession((s) => s.setClusterName);
  const clusterQuestions = useSession((s) => s.clusterQuestions);
  const setClusterQuestion = useSession((s) => s.setClusterQuestion);
  const clusterDecisions = useSession((s) => s.clusterDecisions);
  const setClusterDecision = useSession((s) => s.setClusterDecision);
  const preRevealReflections = useSession((s) => s.preRevealReflections);
  const savePreRevealReflection = useSession((s) => s.savePreRevealReflection);
  const activeClusterId = useSession((s) => s.activeClusterId);
  const setActiveCluster = useSession((s) => s.setActiveCluster);
  const migrateClusterAnnotations = useSession((s) => s.migrateClusterAnnotations);

  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<RevealMode>("explore");
  const [result, setResult] = useState<NameResult | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [revealFailed, setRevealFailed] = useState(false);
  // the reading + question + decision + trade-off are the payoff; the assembled map/story/
  // stats are supporting EVIDENCE. Shown by default (collapsing it hid what people wanted
  // to see) but still toggleable so it can be tucked away once inspected.
  const [evidenceOpen, setEvidenceOpen] = useState(true);
  // remember whether the shown reveal came from a sample scenario (so we can re-project it on language switch)
  const fromSampleReveal = useRef(false);
  // one cached reading per reveal mode, so the three can be compared without re-fetching
  const cachedByMode = useRef<Partial<Record<RevealMode, NameResult>>>({});
  // the AI's ORIGINAL name/question, kept so we can log accept-vs-override (the key
  // boundary-work signal: did the team keep the AI's framing or change it?).
  const aiName = useRef("");
  const aiQuestion = useRef("");
  const logEvent = useSession((s) => s.logEvent);
  // The event log is the ONLY record of what the AI originally proposed for each link before
  // the team confirmed it. Where the team re-typed a relation — "you called this the same
  // thing; it's actually a trade-off" — that override is the sharpest statement they make
  // about where a boundary runs, and it used to be written to the log and never read again.
  // Reading it back here lets the reveal prompt see the connections as the team FOUGHT them,
  // not just as they finally stand.
  const setStep = useSession((s) => s.setStep);
  const events = useSession((s) => s.events);
  const bridgeHistory = useMemo(() => bridgeEditsFrom(events), [events]);
  const clusters = findRevealClusters(fragments, bridges, 3);
  const main = selectedRevealCluster(clusters, activeClusterId);
  const byId = (id: string) => fragments.find((f) => f.id === id);
  const mainIds = new Set(main?.fragmentIds ?? []);
  const signatureBridges = bridges.filter(
    (bridge) =>
      (mainIds.has(bridge.fragmentAId) && mainIds.has(bridge.fragmentBId)) ||
      (bridge.relationType === "separate" &&
        (mainIds.has(bridge.fragmentAId) || mainIds.has(bridge.fragmentBId)))
  );
  const signatureFragmentIds = new Set(mainIds);
  for (const bridge of signatureBridges) {
    signatureFragmentIds.add(bridge.fragmentAId);
    signatureFragmentIds.add(bridge.fragmentBId);
  }
  const shapeSignature = JSON.stringify({
    fragments: fragments
      .filter((fragment) => signatureFragmentIds.has(fragment.id))
      .map((fragment) => [fragment.id, fragment.title, fragment.body]),
    bridges: signatureBridges.map((bridge) => [
      bridge.id,
      bridge.fragmentAId,
      bridge.fragmentBId,
      bridge.relationType,
      bridge.explanation,
    ]),
  });
  const savedPreReveal = main ? preRevealReflections[main.id] : undefined;
  const checkpointComplete =
    Boolean(savedPreReveal) && savedPreReveal?.shapeSignature === shapeSignature;
  const [hypothesisDraft, setHypothesisDraft] = useState("");
  const [falsifierDraft, setFalsifierDraft] = useState("");
  const [checkpointEditing, setCheckpointEditing] = useState(false);

  useEffect(() => {
    setHypothesisDraft(savedPreReveal?.hypothesis ?? "");
    setFalsifierDraft(savedPreReveal?.disconfirmingEvidence ?? "");
    setCheckpointEditing(false);
  }, [main?.id, savedPreReveal?.hypothesis, savedPreReveal?.disconfirmingEvidence]);

  const saveCheckpoint = (skipped: boolean) => {
    if (!main) return;
    savePreRevealReflection(main.id, {
      hypothesis: skipped ? "" : hypothesisDraft,
      disconfirmingEvidence: skipped ? "" : falsifierDraft,
      shapeSignature,
      skipped,
    });
    setCheckpointEditing(false);
  };

  // Keep the team's chosen target stable. Size changes may reorder the candidates, but must
  // never silently swap the subject of a name, question, decision, or generated reading.
  useEffect(() => {
    const resolvedId = main?.id ?? null;
    if (resolvedId !== activeClusterId) {
      if (activeClusterId && resolvedId) {
        migrateClusterAnnotations(activeClusterId, resolvedId);
      }
      setActiveCluster(resolvedId);
    }
  }, [activeClusterId, main?.id, migrateClusterAnnotations, setActiveCluster]);

  const outside = fragments.filter((f) => !main?.fragmentIds.includes(f.id));
  const otherGroups = clusters.filter(
    (cluster) =>
      cluster.id !== main?.id &&
      !cluster.fragmentIds.some((id) => main?.fragmentIds.includes(id))
  );

  const chooseCluster = (id: string) => {
    if (id === main?.id) return;
    setActiveCluster(id);
    setAssembled(false);
    setResult(null);
    setNameDraft("");
    setRevealFailed(false);
    cachedByMode.current = {};
  };

  // The pieces the model is actually shown for a reading: the cluster, plus the far end of any
  // `separate` boundary that crosses the cluster edge. A `separate` boundary can point at a
  // piece outside the cluster (that is exactly what `separate` does — it refuses to pull the
  // two together), and the far end has to travel as a citable piece or the grounding layer
  // drops the boundary for having a dangling end and we are back to losing it.
  //
  // One definition, used by the request, the log, and the panel — this set decides which
  // citations can resolve at all, so a second copy of it would let the measurement and the
  // screen disagree about what the model was even allowed to cite.
  const fragmentsShownToModel = (cluster: { fragmentIds: string[] }) => {
    const shown = cluster.fragmentIds.map(byId).filter(Boolean) as typeof fragments;
    const farEnds = bridges
      .filter((b) => b.relationType === "separate")
      .flatMap((b) => [b.fragmentAId, b.fragmentBId])
      .filter((id) => !cluster.fragmentIds.includes(id));
    for (const id of new Set(farEnds)) {
      const f = byId(id);
      if (f && bridges.some((b) =>
        b.relationType === "separate" &&
        ((b.fragmentAId === id && cluster.fragmentIds.includes(b.fragmentBId)) ||
         (b.fragmentBId === id && cluster.fragmentIds.includes(b.fragmentAId)))
      )) shown.push(f);
    }
    return shown;
  };

  // WHOSE PIECES THE READING PASSED OVER.
  //
  // Two different scopes, and the difference is the whole correctness of this panel.
  // `cited` is measured over every piece the MODEL SAW (the cluster plus the far ends of
  // boundary links, which travel along for citability) — otherwise a far-end seat the model
  // really did cite drops out and the logged seat-rate reads low whenever a boundary crosses
  // the cluster edge. `uncited` is then restricted to seats holding a piece IN the cluster:
  // an uncited far-end seat belongs to the "Not in this picture" panel above, and reporting
  // one absence under both headings would collapse two different problems — your piece never
  // joined the shape (go link it) versus your piece IS in it and the reading skipped it.
  //
  // A cited CONNECTING link reaches both seats it joins, since a reading resting on the link
  // INTO someone's piece has drawn on that piece. `separate` is excluded by `seatCitation`:
  // citing a keep-apart boundary says nothing about what either seat contributed.
  const citedBridgesOf = (bridgeIds: string[]) =>
    bridgeIds.map((id) => bridges.find((b) => b.id === id)).filter(Boolean) as typeof bridges;

  const uncitedSeats = useMemo(() => {
    // Sample-mode reveals carry no grounding trace (nothing was verified against a real
    // table), so this panel stays silent in the demo path by design — honest degradation
    // rather than a fabricated seat list.
    if (!main || !result?.grounding) return [];
    return seatCitation(
      fragmentsShownToModel(main),
      result.grounding.fragmentIds,
      citedBridgesOf(result.grounding.bridgeIds),
      new Set(main.fragmentIds)
    ).uncited;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [main?.id, fragments, bridges, result]);

  const named = main ? clusterNames[main.id] : undefined;
  const question = main ? clusterQuestions[main.id] : undefined;
  const decision = main ? clusterDecisions[main.id] : undefined;

  // the core + kept tensions, in fragment titles — shared by decision-directions and trade-off
  const shape = useMemo(() => {
    const empty = {
      cruxTitle: undefined as string | undefined,
      tensions: [] as Array<{ a: string; b: string; id?: string; why?: string; retyped?: boolean }>,
      pieces: [] as Array<{ title: string; body: string; role?: string }>,
      spine: [] as string[][],
      facets: [] as FacetSummary[],
      wholeness: 0,
    };
    if (!main) return empty;
    const synth = computeSynthesis(fragments, bridges, main);
    const keystone = synth.facets.find((f) => f.id === synth.keystoneFacetId);
    const cruxTitle = keystone ? byId(keystone.anchorId)?.title : undefined;
    // Carry the link's own explanation and whether the team re-typed it. Two 3-word titles
    // are not enough for anything downstream to tell WHY a pair is in tension; the sentence
    // the team wrote about it is.
    // A missing endpoint is a bug, not a piece called "?". These titles travel to the reveal,
    // the trade-off, and the directions prompt, so a `?? "?"` fallback would send the model a
    // real-looking link to a piece that does not exist — and the trade-off would then
    // word-match a decision against the string "?". Drop the tension instead of inventing it.
    const tensions = synth.tensions.flatMap((tn) => {
      const b = bridges.find((x) => x.id === tn.bridgeId);
      const a = b && byId(b.fragmentAId);
      const c = b && byId(b.fragmentBId);
      if (!b || !a || !c) return [];
      return [{
        id: b.id,
        a: a.title,
        b: c.title,
        why: b.explanation,
        retyped: Boolean(bridgeHistory.get(b.id)?.retyped),
      }];
    });
    // The pieces and the causal spine were computed here for the reveal and then dropped
    // before the decision-directions call, which left it reasoning from headline titles.
    const pieces = main.fragmentIds
      .map(byId)
      .filter(Boolean)
      .map((f) => ({ title: f!.title, body: f!.body, role: f!.authorRole }));
    const anchorTitleOf = (fid: string) => {
      const f = synth.facets.find((x) => x.id === fid);
      return f ? byId(f.anchorId)?.title ?? "?" : "?";
    };
    const spine = synth.spine.map((chain) => chain.map(anchorTitleOf));
    // the sides the pieces grouped into — what the engine knows that the link list doesn't
    const facets: FacetSummary[] = synth.facets.map((f) => ({
      anchor: byId(f.anchorId)?.title ?? "?",
      members: f.fragmentIds.map((id) => byId(id)?.title ?? "?"),
      depth: f.depth,
      supports: f.supports,
      dependsOn: f.dependsOn,
      isKeystone: f.id === synth.keystoneFacetId,
    }));
    return { cruxTitle, tensions, pieces, spine, facets, wholeness: Math.round(synth.coverage.wholeness * 100) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [main?.id, fragments, bridges, bridgeHistory]);

  // rail entries mirror exactly which sections are actually rendered below, so the scroll-spy
  // never points at a section that isn't there. Decision appears once a question exists;
  // trade-off once a decision is written. Memoized on those gates so the rail's observer
  // isn't torn down and rebuilt on every keystroke.
  const hasQuestion = !loading && !!question;
  const hasDecision = !loading && !!(decision ?? "").trim();
  const railSections: RailSection[] = useMemo(() => {
    const s: RailSection[] = [
      { id: "watse-reading", labelKey: "rail.reading", emoji: "🧭" },
      { id: "watse-question", labelKey: "rail.question", emoji: "❓" },
    ];
    if (hasQuestion) s.push({ id: "watse-next-move", labelKey: "rail.move", emoji: "🎯", anchor: true });
    if (hasDecision) s.push({ id: "watse-tradeoff", labelKey: "rail.tradeoff", emoji: "⚖️" });
    s.push({ id: "watse-evidence", labelKey: "rail.evidence", emoji: "🐘" });
    return s;
  }, [hasQuestion, hasDecision]);

  async function reveal(chosen: RevealMode, force = false) {
    if (!main) return;
    setMode(chosen);
    setAssembled(true);
    logEvent({ type: "reveal_mode_chosen", mode: chosen });

    // Switching modes used to re-fetch and overwrite, so going verdict → explore → verdict
    // cost two API calls and lost the first verdict. The whole point of three modes is to
    // hold them side by side, so serve a mode you've already seen from cache.
    const cached = cachedByMode.current[chosen];
    if (cached && !force) {
      setResult(cached);
      if (cached.name) aiName.current = cached.name;
      if (cached.question) aiQuestion.current = cached.question;
      return;
    }

    setLoading(true);
    try {
      // the shape memo already computed all of this off the same fragments/bridges —
      // recomputing it here ran computeSynthesis twice per reveal and let the two copies
      // drift (the local tensions lost the `why`/`retyped` the memo carries).
      const { cruxTitle, facets, tensions, spine, wholeness } = shape;

      const clusterFrags = fragmentsShownToModel(main);
      // Both ends inside the cluster — EXCEPT for `separate`, which by definition never joins
      // its two pieces into a cluster, so a boundary drawn across the cluster edge would
      // otherwise always be dropped. That is the one link this tool must never lose: it is the
      // team saying "these must NOT be merged", and losing it lets the reading merge them.
      const inMain = (id: string) => main.fragmentIds.includes(id);
      const clusterBridges = bridges.filter((b) =>
        b.relationType === "separate"
          ? inMain(b.fragmentAId) || inMain(b.fragmentBId)
          : inMain(b.fragmentAId) && inMain(b.fragmentBId)
      );
      const input = {
        // The original question scopes what these fragments are about. It is deliberately
        // context rather than citable evidence; claims still have to point at cards/links.
        decision: decisionPrompt,
        // ids travel so the server can mint citable handles; role travels because who is
        // speaking is part of what a piece IS on this table.
        fragments: clusterFrags.map((f) => ({
          id: f.id,
          title: f.title,
          body: f.body,
          authorRole: f.authorRole,
        })),
        // The link's own text and its edit history used to be dropped here, which meant the
        // reveal was read off a bare typed graph while the team's actual words about WHY two
        // pieces connect — and every place they overruled the AI — stayed invisible to it.
        // Same rule as the tensions above: a link whose endpoint does not resolve is dropped
        // rather than sent as a link to a piece named "?".
        bridges: clusterBridges.flatMap((b) => {
          const h = bridgeHistory.get(b.id);
          const fa = byId(b.fragmentAId);
          const fb = byId(b.fragmentBId);
          if (!fa || !fb) return [];
          return [{
            id: b.id,
            aId: b.fragmentAId,
            bId: b.fragmentBId,
            aTitle: fa.title,
            bTitle: fb.title,
            relationType: b.relationType,
            explanation: b.explanation,
            evidenceA: b.evidenceA,
            evidenceB: b.evidenceB,
            aiRelationType:
              h?.aiRelationType && h.aiRelationType !== b.relationType ? h.aiRelationType : undefined,
            retyped: Boolean(h?.retyped),
            rewritten: Boolean(h?.edited),
            humanDrawn: b.createdBy === "human",
          }];
        }),
        cruxTitle,
        facets,
        spine,
        wholeness,
      };
      let res = await fetchName(input, lang, chosen);
      // a failed reveal used to render as an assembled screen with a blank reading and no
      // explanation. Say the call failed and leave the board where it was.
      if (res.error) {
        setRevealFailed(true);
        setAssembled(false);
        return;
      }
      setRevealFailed(false);
      // sample mode → use the scenario's hand-written, sharper reveal if we have one
      fromSampleReveal.current = false;
      if (res.sample) {
        const sc = getScenario(scenarioId);
        if (sc?.reveal) {
          res = scenarioRevealToResult(sc.reveal, lang, chosen);
          fromSampleReveal.current = true;
        }
      }
      setResult(res);
      cachedByMode.current[chosen] = res;
      // How many of the seats ON THE TABLE the reading actually cited. Logged per real
      // session because the 3.0-of-5 figure it exists to track is a property of live model
      // behaviour, and a number only ever produced by tests is a number about the tests.
      //
      // Measured over `clusterFrags` — every piece the model was shown — so a far-end seat it
      // really did cite is counted. `uncited` is separately narrowed to the cluster, matching
      // the panel exactly; see `uncitedSeats` for why the two halves are scoped differently.
      const seats = res.grounding
        ? seatCitation(
            clusterFrags,
            res.grounding.fragmentIds,
            citedBridgesOf(res.grounding.bridgeIds),
            new Set(main.fragmentIds)
          )
        : undefined;
      // Record the shape AND the reading, unconditionally — not only if someone later
      // presses "Use this name". This is what the team was looking at when they argued.
      logEvent({
        type: "reveal_computed",
        mode: chosen,
        fragmentCount: clusterFrags.length,
        bridgeCount: clusterBridges.length,
        wholeness: input.wholeness,
        keystoneTitle: cruxTitle,
        facets,
        spine,
        tensionCount: tensions.length,
        aiName: res.name,
        aiNote: res.note,
        aiQuestion: res.question,
        aiReadings: res.readings,
        aiHypothesis: res.hypothesis,
        aiVerdict: res.verdict,
        sample: fromSampleReveal.current,
        grounding: res.grounding,
        citedSeats: seats?.cited,
        uncitedSeats: seats?.uncited.map((u) => u.seat),
      });
      // capture the AI's originals so we can later detect if the team overrode them
      if (res.name) aiName.current = res.name;
      if (res.question) aiQuestion.current = res.question;
      if (!nameDraft && res.name) setNameDraft(res.name);
      if (main && res.question && !clusterQuestions[main.id]) setClusterQuestion(main.id, res.question);
    } finally {
      setLoading(false);
    }
  }

  // Accept the framing: commit the name, and log both name + question as accepted with
  // their AI originals so a researcher can tell "kept the AI's framing" from "overrode it".
  const acceptFraming = () => {
    if (!main || !nameDraft.trim()) return;
    const finalName = nameDraft.trim();
    setClusterName(main.id, finalName);
    logEvent({
      type: "name_accepted",
      aiOriginal: aiName.current,
      humanFinal: finalName,
      changed: aiName.current.trim() !== finalName,
    });
    const finalQuestion = (clusterQuestions[main.id] ?? "").trim();
    if (finalQuestion || aiQuestion.current) {
      logEvent({
        type: "question_accepted",
        aiOriginal: aiQuestion.current,
        humanFinal: finalQuestion,
        changed: aiQuestion.current.trim() !== finalQuestion,
      });
    }
  };

  // The cache describes ONE board. If the team goes back and edits the pieces or links,
  // every cached reading is about a shape that no longer exists — drop them all.
  // (also on language change: a cached English reading must not be served in Korean)
  useEffect(() => {
    cachedByMode.current = {};
  }, [fragments, bridges, lang, main?.id]);

  // when the user switches language mid-test, re-project a sample reveal into the new
  // language. Live-AI reveals can't be translated, so they're left as-is.
  useEffect(() => {
    if (!fromSampleReveal.current) return;
    const sc = getScenario(scenarioId);
    if (!sc?.reveal) return;
    const res = scenarioRevealToResult(sc.reveal, lang, mode);
    setResult(res);
    // only refresh the AI-suggested name draft if the team hasn't accepted a name yet
    if (!named) setNameDraft(res.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="animate-fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            {t(main?.kind === "boundary" ? "boundary.mainHeading" : "mirror.heading")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-faint">
            {t(main?.kind === "boundary" ? "boundary.mainHint" : "mirror.hint")}
          </p>
        </div>
        {assembled && (
          <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-line bg-paper-card p-0.5 text-xs font-semibold">
            <button
              onClick={() => setRevealView("crux")}
              className={[
                "rounded-full px-3 py-1.5 transition",
                revealView === "crux" ? "bg-ink text-paper" : "text-ink-faint hover:text-ink",
              ].join(" ")}
            >
              🐘 {t("crux.viewFlow")}
            </button>
            <button
              onClick={() => setRevealView("assembly")}
              className={[
                "rounded-full px-3 py-1.5 transition",
                revealView === "assembly" ? "bg-ink text-paper" : "text-ink-faint hover:text-ink",
              ].join(" ")}
            >
              🔗 {t("crux.viewAssembly")}
            </button>
          </div>
          </div>
        )}
      </div>

      {clusters.length > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-2" aria-label={t("cluster.choose")}>
          <span className="text-xs font-medium text-ink-faint">{t("cluster.choose")}</span>
          {clusters.map((cluster, index) => {
            const label =
              clusterNames[cluster.id] ||
              cluster.fragmentIds
                .slice(0, 2)
                .map((id) => byId(id)?.title)
                .filter(Boolean)
                .join(" · ");
            return (
              <button
                key={cluster.id}
                onClick={() => chooseCluster(cluster.id)}
                aria-pressed={cluster.id === main?.id}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  cluster.id === main?.id
                    ? "border-ink bg-ink text-paper"
                    : "border-line bg-paper-card text-ink-soft hover:border-accent hover:text-accent",
                ].join(" ")}
              >
                {cluster.kind === "boundary" ? "⫯" : "◇"}{" "}
                {label || `${t("cluster.fallback")} ${index + 1}`} · {cluster.fragmentIds.length}
              </button>
            );
          })}
        </div>
      )}

      {main?.kind === "boundary" && (
        <div className="mt-4 rounded-lg border border-dashed border-tension/40 bg-tension/5 px-4 py-3 text-sm leading-relaxed text-ink-soft">
          <span className="font-semibold text-ink">{t("boundary.heading")}</span>{" "}
          {t("boundary.hint")}
        </div>
      )}

      {!assembled ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <PuzzleCanvas />
          <div className="flex h-full flex-col items-center justify-center rounded-xl2 border border-dashed border-line bg-paper-sunken/40 p-6 text-center">
            <div className="text-4xl">🐘</div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-faint">
              {t(main?.kind === "boundary" ? "boundary.pick" : "reveal.pick")}
            </p>
            <PreRevealCheckpointCard
              hasRevealTarget={Boolean(main)}
              checkpointComplete={checkpointComplete}
              checkpointEditing={checkpointEditing}
              hypothesisDraft={hypothesisDraft}
              setHypothesisDraft={setHypothesisDraft}
              falsifierDraft={falsifierDraft}
              setFalsifierDraft={setFalsifierDraft}
              saveCheckpoint={saveCheckpoint}
              setCheckpointEditing={setCheckpointEditing}
              savedPreReveal={savedPreReveal}
            />
            {checkpointComplete && (
              <div className="mt-4 w-full max-w-sm space-y-2">
                {REVEAL_MODES.map((m) => (
                  <ModeButton
                    key={m}
                    mode={m}
                    disabled={!main || loading}
                    onClick={() => reveal(m)}
                  />
                ))}
              </div>
            )}
            {revealFailed && (
              <div className="mt-4 w-full max-w-xs rounded-lg border border-tension/40 bg-tension/5 px-3 py-2 text-[12px] leading-snug text-ink">
                ⚠︎ {t("common.aiFailed")}
              </div>
            )}
            {!main && <div className="mt-4"><Hint>{t("mirror.lockedGroup")}</Hint></div>}
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {revealView === "crux" ? (
            // Two-zone: a sticky scroll-spy rail (the spine you can see) + the single-scroll
            // argument. Tabs would sever reading→question→decision→trade-off; the rail keeps
            // it one continuous read while killing the "scrolling a report" feeling and
            // keeping the team's decision the unmistakable centre of gravity.
            <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
              <RevealRail sections={railSections} />
              <div className="min-w-0 space-y-5">
                {/* The narrative order is preserved (WATSE §4.5: the reading is the payoff of
                    assembling first). What changed is the VISUAL voice — the AI's reading and
                    reframed question read as proposals (calm), the decision reads as the
                    team's own (emphasized), so three accent zones no longer compete. */}
                <section id="watse-reading" className="scroll-mt-20">
                  <RevealResult
                    result={result}
                    loading={loading}
                    mode={mode}
                    onPickMode={reveal}
                    nameDraft={nameDraft}
                    onNameDraft={setNameDraft}
                    named={named}
                    onAcceptName={acceptFraming}
                  />
                  {/* Directly under the reading, because this is where the impression that
                      it covers everyone is formed. Only when there IS something outside. */}
                  {result && outside.length > 0 && (
                    <div className="mt-3 rounded-lg border border-dashed border-line bg-paper-sunken/40 px-3 py-2.5 text-[11px] leading-snug">
                      <div className="font-semibold uppercase tracking-wide text-ink-faint">
                        {t("outside.heading")}
                      </div>
                      <ul className="mt-1.5 space-y-1 text-ink-soft">
                        {otherGroups.map((g) => (
                          <li key={g.id}>
                            <span aria-hidden>◇</span>{" "}
                            {t("outside.group").replace("{n}", String(g.fragmentIds.length))}{" "}
                            <span className="text-ink-faint">
                              ({g.fragmentIds.map((id) => byId(id)?.title).filter(Boolean).join(" · ")})
                            </span>
                          </li>
                        ))}
                        {(() => {
                          // pieces in no group of 3 at all — written, stored, and until now
                          // absent from the reveal without a word
                          const loose = outside.filter(
                            (f) => !otherGroups.some((g) => g.fragmentIds.includes(f.id))
                          );
                          return loose.length ? (
                            <li>
                              <span aria-hidden>◇</span>{" "}
                              {t("outside.loose").replace("{n}", String(loose.length))}{" "}
                              <span className="text-ink-faint">
                                ({loose.map((f) => f.title).join(" · ")})
                              </span>
                            </li>
                          ) : null;
                        })()}
                      </ul>
                      <button
                        onClick={() => setStep("connect")}
                        className="mt-2 font-medium text-accent underline-offset-2 hover:underline"
                      >
                        {t("outside.fix")} →
                      </button>
                    </div>
                  )}
                  {/* Seats that ARE in the picture and the reading passed over anyway. Same
                      quiet dashed voice as the panel above — this is an observation to check,
                      not a fault to fix, and an alarming treatment would push teams to argue
                      with the reading before they have read it. */}
                  {!loading && uncitedSeats.length > 0 && (
                    <div className="mt-3 rounded-lg border border-dashed border-line bg-paper-sunken/40 px-3 py-2.5 text-[11px] leading-snug">
                      <div className="font-semibold uppercase tracking-wide text-ink-faint">
                        {t("uncited.heading")}
                      </div>
                      <ul className="mt-1.5 space-y-1 text-ink-soft">
                        {uncitedSeats.map((u) => (
                          <li key={u.seat}>
                            <span aria-hidden>◇</span>{" "}
                            <span className="font-medium text-ink">{u.seat}</span>{" "}
                            <span className="text-ink-faint">({u.titles.join(" · ")})</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-ink-faint">{t("uncited.why")}</p>
                      {/* Re-reads at the model's own sampling temperature — the same forced
                          path as "Re-reflect". It cannot be aimed at the pieces listed above:
                          the request carries no per-piece steering, and the reveal prompt
                          forbids manufacturing seat coverage precisely so this panel stays
                          honest. The hint says so rather than letting the button imply it. */}
                      <button
                        onClick={() => reveal(mode, true)}
                        disabled={loading}
                        className="mt-2 font-medium text-accent underline-offset-2 hover:underline disabled:opacity-60"
                      >
                        <span aria-hidden>↻</span> {t("uncited.retry")}
                      </button>
                      <p className="mt-1 text-ink-faint">{t("uncited.retryHint")}</p>
                    </div>
                  )}
                </section>
                <section id="watse-question" className="scroll-mt-20">
                  <RealQuestion
                    value={question ?? ""}
                    // The AI's draft is seeded straight into this field, so a non-empty value
                    // does NOT mean the team wrote it. Only a value that differs from the
                    // AI's original is theirs — labelling the untouched draft "your words"
                    // would be the tool putting words in their mouth.
                    edited={!!question && question.trim() !== aiQuestion.current.trim()}
                    loading={loading}
                    onChange={(v) => main && setClusterQuestion(main.id, v)}
                    label={t("crux.realQuestion")}
                    editLabel={t("crux.editQuestion")}
                    placeholder={lang === "ko" ? "우리가 먼저 답해야 할 것은…" : "What we must answer first is…"}
                  />
                </section>
                {!loading && !!question && (
                  <section id="watse-next-move" className="scroll-mt-20">
                    <NextStep
                      value={decision ?? ""}
                      onChange={(v) => main && setClusterDecision(main.id, v)}
                      onCommit={(v) => logEvent({ type: "decision_written", text: v })}
                      decisionPrompt={decisionPrompt}
                      realQuestion={question ?? ""}
                      cruxTitle={shape.cruxTitle}
                      tensions={shape.tensions}
                      pieces={shape.pieces}
                      spine={shape.spine}
                      lang={lang}
                    />
                  </section>
                )}

                {/* the cost the decision commits to — read off the team's own kept tensions.
                    Only after a decision exists, since it mirrors THAT decision. */}
                {!loading && !!(decision ?? "").trim() && main && (
                  <section id="watse-tradeoff" className="scroll-mt-20">
                    <TradeOffPanel
                      decision={decision ?? ""}
                      cluster={main}
                      onRevise={() => {
                        const el = document.getElementById("watse-next-move");
                        el?.scrollIntoView({ behavior: "smooth", block: "center" });
                        // the saved decision renders as a button (click to edit); open it, then
                        // focus the textarea it reveals on the next frame.
                        const ta = el?.querySelector("textarea");
                        if (ta) ta.focus();
                        else {
                          (el?.querySelector("button") as HTMLButtonElement | null)?.click();
                          requestAnimationFrame(() => el?.querySelector("textarea")?.focus());
                        }
                      }}
                    />
                  </section>
                )}

                {/* the evidence behind the reading: the assembled shape you can inspect.
                    Shown by default now, but still collapsible once inspected. */}
                <section id="watse-evidence" className="scroll-mt-20">
                  <button
                    onClick={() => setEvidenceOpen((o) => !o)}
                    className="flex w-full items-center gap-2 rounded-xl border border-line bg-paper-sunken/40 px-4 py-3 text-left transition hover:border-ink/20"
                  >
                    <span className="text-base leading-none">🐘</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-ink">
                        {evidenceOpen ? t("crux.evidenceHide") : t("crux.evidenceShow")}
                      </span>
                      {!evidenceOpen && (
                        <span className="mt-0.5 block text-[11px] leading-snug text-ink-faint">
                          {t("crux.evidenceSub")}
                        </span>
                      )}
                    </span>
                    <span className="text-ink-faint">{evidenceOpen ? "▴" : "▾"}</span>
                  </button>
                  {evidenceOpen && (
                    // inverted pyramid within the evidence: the slim numbers first, then the
                    // readable story, then the visual map last. (Previously map→story→numbers,
                    // which led with the hardest-to-read artifact.)
                    <div className="animate-fade-up mt-5 space-y-5">
                      <SynthesisSummary />
                      <StorySpine />
                      <SynthesisCanvas />
                    </div>
                  )}
                </section>
              </div>
            </div>
          ) : (
            <>
              <PuzzleCanvas showCenterName={!!named} />
              <NamePanel
                suggested={result?.name ?? ""}
                note={result?.note ?? ""}
                draft={nameDraft}
                named={named}
                loading={loading}
                onDraft={setNameDraft}
                onAccept={acceptFraming}
                onRedo={() => reveal(mode, true)}
              />
            </>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => setAssembled(false)}
              className="text-xs font-medium text-ink-faint transition hover:text-ink"
            >
              ← {t("assemble.scatter")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const MODE_META: Record<RevealMode, { emoji: string; titleKey: string; subKey: string }> = {
  explore: { emoji: "🧭", titleKey: "reveal.explore", subKey: "reveal.explore.sub" },
  hypothesis: { emoji: "💡", titleKey: "reveal.hypothesis", subKey: "reveal.hypothesis.sub" },
  verdict: { emoji: "🎯", titleKey: "reveal.verdict", subKey: "reveal.verdict.sub" },
};

function ModeButton({
  mode,
  disabled,
  onClick,
}: {
  mode: RevealMode;
  disabled: boolean;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const m = MODE_META[mode];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group w-full rounded-xl border border-line bg-paper-card px-4 py-2.5 text-left transition enabled:hover:border-accent/50 enabled:hover:shadow-card disabled:opacity-50"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
        <span>{m.emoji}</span>
        {t(m.titleKey as Parameters<typeof t>[0])}
      </div>
      <div className="mt-0.5 text-[11px] leading-snug text-ink-faint">
        {t(m.subKey as Parameters<typeof t>[0])}
      </div>
    </button>
  );
}

/** The mode-specific reading: readings / hypothesis / verdict, with a mode switcher. */
function RevealResult({
  result,
  loading,
  mode,
  onPickMode,
  nameDraft,
  onNameDraft,
  named,
  onAcceptName,
}: {
  result: NameResult | null;
  loading: boolean;
  mode: RevealMode;
  onPickMode: (m: RevealMode) => void;
  nameDraft: string;
  onNameDraft: (v: string) => void;
  named?: string;
  onAcceptName: () => void;
}) {
  const { t } = useI18n();
  const m = MODE_META[mode];
  return (
    // Calm, line-bordered — this is the AI's READING (a proposal), not the team's decision.
    // It used to be accent-bordered + shadow-lift, which stacked three accent zones down the
    // page so nothing anchored; the accent now belongs to the decision alone (Granola's
    // AI-voice-vs-your-voice convention).
    <div className="animate-fade-up overflow-hidden rounded-xl2 border border-line bg-paper-card shadow-card">
      {/* big mode tabs — "how would you like to read the whole?" is a first-class choice */}
      <div className="border-b border-line bg-paper-sunken/40 px-4 pt-3">
        <div className="mb-2 text-[11px] font-medium text-ink-faint">{t("reveal.pickHint")}</div>
        <div className="flex flex-wrap gap-1.5">
          {REVEAL_MODES.map((mm) => {
            const meta = MODE_META[mm];
            const active = mm === mode;
            return (
              <button
                key={mm}
                onClick={() => onPickMode(mm)}
                disabled={loading}
                className={[
                  "group flex items-center gap-2 rounded-t-lg border-b-2 px-3.5 py-2 text-left transition disabled:opacity-50",
                  active
                    ? "border-accent bg-paper-card"
                    : "border-transparent hover:bg-paper-card/60",
                ].join(" ")}
              >
                <span className="text-base leading-none">{meta.emoji}</span>
                <span>
                  <span
                    className={[
                      "block text-[13px] font-semibold leading-tight",
                      active ? "text-accent" : "text-ink",
                    ].join(" ")}
                  >
                    {t(meta.titleKey as Parameters<typeof t>[0])}
                  </span>
                  <span className="hidden text-[10px] leading-tight text-ink-faint sm:block">
                    {t(meta.subKey as Parameters<typeof t>[0])}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5">
        {/* THE READING — the star of the screen: big, spacious, easy to read */}
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-ink-faint">
            <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-accent/50" />
            {t("reveal.thinking")}
          </div>
        ) : mode === "explore" ? (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              🧭 {t("reveal.readingsLabel")}
            </div>
            {/* each competing reading as its own card so "several angles" actually reads that way */}
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(result?.readings ?? []).map((r, i) => (
                <div
                  key={i}
                  className="flex flex-col rounded-xl border border-line bg-paper-sunken/40 p-4 transition hover:border-accent/40 hover:shadow-card"
                >
                  <span className="text-[11px] font-bold uppercase tracking-wide text-accent">
                    {t("reveal.angleLabel")} {i + 1}
                  </span>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-ink">{r}</p>
                </div>
              ))}
            </div>
          </div>
        ) : mode === "hypothesis" ? (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              💡 {t("reveal.hypothesisLabel")} <VoiceTag who="ai" />
            </div>
            <p className="mt-2 text-balance text-xl font-semibold leading-snug text-ink sm:text-2xl">
              {result?.hypothesis}
            </p>
          </div>
        ) : (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              🎯 {t("reveal.verdictLabel")} <VoiceTag who="ai" />
            </div>
            <p className="mt-2 text-balance text-2xl font-semibold leading-snug text-ink sm:text-[26px]">
              {result?.verdict}
            </p>
            <div className="mt-2 text-[12px] italic text-ink-faint">{t("reveal.verdictCaveat")}</div>
          </div>
        )}

        {result?.note && !loading && (
          <div className="mt-3 text-[12px] leading-relaxed text-ink-soft">{result.note}</div>
        )}

        {/* Whose pieces this reading actually rested on. Sits directly under the reading
            because the two are one claim: a synthesis that leans on two of six voices looks
            identical to one that integrates all six until the interface says which. */}
        {!loading && result?.grounding && (
          <WhoseWords fragmentIds={result.grounding.fragmentIds} />
        )}

        {/* the name — a secondary handle, below the reading (the reading is the point) */}
        {!loading && (
          <div className="mt-5 flex flex-wrap items-center gap-2.5 border-t border-line pt-4">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">
              {m.emoji} {t("assemble.namePrompt")}
            </span>
            <input
              value={nameDraft}
              onChange={(e) => onNameDraft(e.target.value)}
              placeholder={t("assemble.namePlaceholder")}
              className="min-w-[180px] flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm font-semibold text-ink outline-none focus:border-accent/50"
            />
            <button
              onClick={onAcceptName}
              disabled={!nameDraft.trim()}
              className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-white transition enabled:hover:opacity-95 disabled:bg-line disabled:text-ink-faint"
            >
              {named && named === nameDraft.trim() ? `✓ ${t("assemble.namedBy")}` : t("assemble.useName")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RealQuestion({
  value,
  edited,
  loading,
  onChange,
  label,
  editLabel,
  placeholder,
}: {
  value: string;
  /** true once the team has actually rewritten the AI's draft */
  edited: boolean;
  loading: boolean;
  onChange: (v: string) => void;
  label: string;
  editLabel: string;
  placeholder: string;
}) {
  const [editing, setEditing] = useState(false);
  // accent-BORDERED, not accent-FILLED: a full accent wash here made three stacked accent
  // zones so nothing anchored. A left rule keeps it distinct but quieter, letting the
  // decision box below (the culminating action) read as the emphasis.
  return (
    <div className="animate-fade-up rounded-xl2 border border-line border-l-[3px] border-l-accent bg-paper-card p-5 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-sm">
          ❓
        </span>
        <span className="text-[13px] font-bold text-ink">{label}</span>
        {/* the AI drafts this question; the team rewrites it. Saying so is what makes the
            rewrite discoverable — people left it untouched when it read as a fixed output. */}
        <VoiceTag who={edited ? "team" : "ai"} />
      </div>
      {loading ? (
        <div className="mt-2 text-sm text-ink-faint">…</div>
      ) : editing ? (
        <textarea
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          rows={2}
          placeholder={placeholder}
          className="mt-2 w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-lg font-medium text-ink outline-none focus:border-accent/50"
        />
      ) : (
        // styled as an actual editable surface — it read as static AI output before,
        // so people never discovered the question was theirs to rewrite.
        <button
          onClick={() => setEditing(true)}
          className="mt-1.5 block w-full rounded-lg border border-dashed border-accent/40 px-3 py-2 text-left transition hover:border-accent hover:bg-paper/60"
        >
          <span className="text-balance text-lg font-semibold leading-snug text-ink">
            {value || placeholder}
          </span>
          <span className="ml-2 whitespace-nowrap text-[11px] font-medium text-accent">✎ {editLabel}</span>
        </button>
      )}
    </div>
  );
}

/**
 * The last step: turn the AI's reframed question into the team's OWN next move.
 * Deliberately quieter and ink-toned (not accent) — the reframing was the AI's,
 * but the decision is the team's, and the UI should make that ownership legible.
 * The tool proposes a question; it never fills in the answer (WATSE v5).
 */
function NextStep({
  value,
  onChange,
  onCommit,
  decisionPrompt,
  realQuestion,
  cruxTitle,
  tensions,
  pieces = [],
  spine = [],
  lang,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
  /** the original decision this session is about; distinct from the answer draft in `value` */
  decisionPrompt: string;
  realQuestion: string;
  cruxTitle?: string;
  /** `why` is the team's own sentence about the tension; `retyped` marks one they insisted on */
  tensions: Array<{ a: string; b: string; why?: string; retyped?: boolean }>;
  /** the pieces themselves, so a suggested direction can rest on what people wrote */
  pieces?: Array<{ title: string; body: string; role?: string }>;
  /** causal chains root→symptom */
  spine?: string[][];
  lang: "en" | "ko";
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const has = !!value.trim();

  // grounded starting DIRECTIONS — the AI's help right before the team decides. Like Seeds
  // at the input step: a handle to react to, not a decision authored for them. Off by
  // default; the team asks. Picking one prefills the box and hands the pen back.
  const [dirLoading, setDirLoading] = useState(false);
  const [directions, setDirections] = useState<Array<{ direction: string; because: string }> | null>(null);
  const loadDirections = async () => {
    setDirLoading(true);
    try {
      const { fetchDirections } = await import("@/lib/api");
      const { directions: d } = await fetchDirections(
        decisionPrompt,
        realQuestion,
        cruxTitle,
        tensions,
        lang,
        pieces,
        spine
      );
      setDirections(d);
    } finally {
      setDirLoading(false);
    }
  };
  const pickDirection = (d: string) => {
    onChange(d);
    setDirections(null);
    setEditing(true);
  };

  // The decision text is stored on every keystroke, but the decision_written EVENT only
  // fired on blur — so someone who typed their next move and closed the tab left no trace
  // in the log. Commit on the way out too. (Idempotent: the log tolerates a repeat.)
  const committed = useRef("");
  const latestValue = useRef(value);
  const commitRef = useRef(onCommit);
  latestValue.current = value;
  commitRef.current = onCommit;
  useEffect(() => {
    const flush = () => {
      const v = latestValue.current.trim();
      if (v && v !== committed.current) {
        committed.current = v;
        commitRef.current(v);
      }
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  return (
    // The culminating action. Before a decision exists it's the ONE thing left to do, so it
    // gets the strongest presence on the screen — an accent ring + a clear "last step" badge
    // so it can't be scrolled past unseen. Once written, it settles into a calm confirmed
    // state (ink-toned) so it reads as done rather than still-demanding-attention.
    // the #watse-next-move anchor now lives on the wrapping <section> (used by both the rail
    // and TradeOffPanel.onRevise); this card no longer carries the id to avoid a duplicate.
    <div
      className={[
        "animate-fade-up rounded-xl2 p-5 shadow-lift transition",
        has && !editing
          // written: still the screen's product, so it keeps a quiet accent presence (left
          // rule + faint wash) rather than going fully neutral and disappearing into chrome.
          ? "border border-line border-l-[3px] border-l-accent bg-gradient-to-br from-accent-soft/20 to-paper-card"
          // empty/editing: the ONE thing left to do — strongest treatment so it can't be missed.
          : "border-2 border-accent bg-gradient-to-br from-accent-soft/40 to-paper-card ring-4 ring-accent/10",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm text-white shadow-sm">
          🎯
        </span>
        <span className="text-[13px] font-bold text-ink">{t("decide.label")}</span>
        {!has && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            {t("decide.badge")}
          </span>
        )}
      </div>
      {editing || !has ? (
        <>
          <p className="mt-2 text-[13px] font-medium leading-relaxed text-ink-soft">{t("decide.leadIn")}</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-faint">{t("decide.hint")}</p>
          <textarea
            autoFocus={editing}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => {
              setEditing(false);
              const v = value.trim();
              if (v && v !== committed.current) {
                committed.current = v;
                onCommit(v);
              }
            }}
            rows={2}
            placeholder={t("decide.placeholder")}
            className="mt-2 w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-base font-medium text-ink outline-none focus:border-ink/40"
          />
          {!has && (
            <button
              onClick={() => setEditing(true)}
              className="mt-2 rounded-full border border-ink/20 px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-ink/40 hover:text-ink"
            >
              ✎ {t("decide.add")}
            </button>
          )}

          {/* the AI's help right before deciding — grounded starting directions, opt-in.
              It hands the pen back: pick one → it prefills the box → you rewrite it. */}
          {directions === null ? (
            <div className="mt-3 border-t border-line pt-3">
              <span className="text-[12px] text-ink-faint">{t("decide.stuck")} </span>
              <button
                onClick={loadDirections}
                disabled={dirLoading}
                className="text-[12px] font-semibold text-accent underline-offset-2 transition hover:underline disabled:opacity-60"
              >
                💡 {dirLoading ? t("decide.directionsLoading") : t("decide.getDirections")}
              </button>
            </div>
          ) : (
            <div className="mt-3 border-t border-line pt-3">
              <p className="text-[11px] leading-snug text-ink-faint">{t("decide.directionsHint")}</p>
              <ul className="mt-2 space-y-2">
                {directions.map((d, i) => (
                  <li key={i} className="rounded-lg border border-line bg-paper-sunken/40 p-3">
                    <div className="text-[13px] font-semibold text-ink">{d.direction}</div>
                    {d.because && <div className="mt-0.5 text-[11px] leading-snug text-ink-faint">{d.because}</div>}
                    <button
                      onClick={() => pickDirection(d.direction)}
                      className="mt-2 rounded-full border border-accent/40 px-3 py-1 text-[11px] font-medium text-accent transition hover:bg-accent hover:text-white"
                    >
                      {t("decide.useDirection")} →
                    </button>
                  </li>
                ))}
              </ul>
              <button
                onClick={loadDirections}
                disabled={dirLoading}
                className="mt-2 text-[11px] font-medium text-ink-faint transition hover:text-ink disabled:opacity-60"
              >
                ↻ {dirLoading ? t("decide.directionsLoading") : t("decide.directionsAgain")}
              </button>
            </div>
          )}
        </>
      ) : (
        <button onClick={() => setEditing(true)} className="mt-3 block text-left">
          <span className="text-balance text-lg font-semibold leading-snug text-ink">{value}</span>
          <span className="ml-2 whitespace-nowrap text-[11px] font-medium text-ink-soft">✎ {t("decide.edit")}</span>
          <div className="mt-2 text-[11px] font-medium text-ink-faint">✓ {t("decide.saved")}</div>
        </button>
      )}
    </div>
  );
}

function NamePanel({
  suggested,
  note,
  draft,
  named,
  loading,
  onDraft,
  onAccept,
  onRedo,
}: {
  suggested: string;
  note: string;
  draft: string;
  named?: string;
  loading: boolean;
  onDraft: (v: string) => void;
  onAccept: () => void;
  onRedo: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="animate-fade-up rounded-xl2 border border-line bg-paper-card p-5 shadow-card">
      <div className="text-sm font-semibold text-ink">{t("assemble.namePrompt")}</div>
      {loading ? (
        <div className="mt-3 text-sm text-ink-faint">{t("assemble.naming")}</div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {suggested && (
            <span className="rounded-full bg-accent-soft px-2 py-1 text-[11px] font-medium text-accent">
              {t("assemble.aiSuggested")}: {suggested}
            </span>
          )}
          <input
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            placeholder={t("assemble.namePlaceholder")}
            className="min-w-[200px] flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm font-medium text-ink outline-none focus:border-ink/40"
          />
          <button
            onClick={onAccept}
            disabled={!draft.trim()}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition enabled:hover:opacity-95 disabled:bg-line disabled:text-ink-faint"
          >
            {named && named === draft.trim() ? `✓ ${t("assemble.namedBy")}` : t("assemble.useName")}
          </button>
          <button onClick={onRedo} className="text-xs font-medium text-accent hover:underline">
            ↻ {t("mirror.redo")}
          </button>
        </div>
      )}
      {note && !loading && <div className="mt-2 text-xs text-ink-soft">{note}</div>}
    </div>
  );
}

/**
 * The trade-off the written decision commits to — mirrored off the tensions the team
 * themselves kept. It invents no cost: it names which kept `tension` (or `separate`) the
 * decision leans on and what the other side gives up, in the team's own fragment titles.
 * Fires once, on demand, and logs tradeoff_shown for the exposure-vs-action question.
 */
function TradeOffPanel({ decision, cluster, onRevise }: { decision: string; cluster: { fragmentIds: string[] }; onRevise: () => void }) {
  const { t, lang } = useI18n();
  const fragments = useSession((s) => s.fragments);
  const bridges = useSession((s) => s.bridges);
  const logEvent = useSession((s) => s.logEvent);
  // Which links the team re-typed INTO a tension, recovered from the event log — see the
  // same lookup in MirrorScreen. A tension the team argued the AI into is the one they are
  // surest is real, so it deserves priority when naming what a decision costs.
  const events = useSession((s) => s.events);
  const bridgeHistory = useMemo(() => bridgeEditsFrom(events), [events]);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<{ tension: string; favors: string; cost: string; groundedBridgeId?: string } | null>(null);
  const [opened, setOpened] = useState(false);
  // the contest: how the team answered the named cost — the actual boundary-work signal
  const [stance, setStance] = useState<"accepted" | "relocated" | "rejected" | null>(null);
  const [note, setNote] = useState("");
  const [noteFor, setNoteFor] = useState<"relocated" | "rejected" | null>(null);

  const answer = (s: "accepted" | "relocated" | "rejected", text: string) => {
    setStance(s);
    setNoteFor(null);
    logEvent({ type: "tradeoff_answered", stance: s, cost: res?.cost ?? "", note: text.trim() });
  };

  // If the team REVISES their decision, the old cost no longer describes it — reset so the
  // panel re-runs against the new decision instead of showing a stale, already-answered cost.
  useEffect(() => {
    setRes(null);
    setStance(null);
    setNote("");
    setNoteFor(null);
    setOpened(false);
  }, [decision]);

  const title = (id: string) => fragments.find((f) => f.id === id)?.title ?? "?";
  const inCluster = (b: (typeof bridges)[number]) =>
    cluster.fragmentIds.includes(b.fragmentAId) && cluster.fragmentIds.includes(b.fragmentBId);
  const touchesCluster = (b: (typeof bridges)[number]) =>
    cluster.fragmentIds.includes(b.fragmentAId) || cluster.fragmentIds.includes(b.fragmentBId);
  // Carry each tension's id so the named cost can be traced back to the exact link it was
  // read off, and `retyped` so a tension the team INSISTED on (they overruled the AI to call
  // it a trade-off) outranks one they merely accepted when both fit the decision equally.
  const tensions = bridges
    .filter((b) => b.relationType === "tension" && inCluster(b))
    .map((b) => ({
      id: b.id,
      a: title(b.fragmentAId),
      b: title(b.fragmentBId),
      why: b.explanation,
      evidenceA: b.evidenceA,
      evidenceB: b.evidenceB,
      retyped: Boolean(bridgeHistory.get(b.id)?.retyped),
    }));
  const separations = bridges
    // A boundary commonly crosses the component edge precisely because it refuses to join
    // the two pieces. Keep it when either endpoint belongs to the elephant being read.
    .filter((b) => b.relationType === "separate" && touchesCluster(b))
    .map((b) => ({
      id: b.id,
      a: title(b.fragmentAId),
      b: title(b.fragmentBId),
      why: b.explanation,
      evidenceA: b.evidenceA,
      evidenceB: b.evidenceB,
    }));

  // The pieces behind the titles. Two 3-word titles are not enough to name a cost that is
  // recognisably THIS team's: a tension the team drew themselves reaches the model with empty
  // evidence (store.ts writes `evidenceA`/`evidenceB` as "" for a manual bridge), so without
  // this the whole prompt is titles plus one line of explanation. Same shape the directions
  // path sends. A/B measured: the model went from citing a kept tension in 0/8 runs to 4/8.
  const pieces = cluster.fragmentIds
    .map((id) => fragments.find((f) => f.id === id))
    .filter((f): f is NonNullable<typeof f> => Boolean(f))
    .map((f) => ({ title: f.title, body: f.body, role: f.authorRole }));

  const reveal = async () => {
    setOpened(true);
    setLoading(true);
    try {
      const { fetchTradeOff } = await import("@/lib/api");
      const r = await fetchTradeOff(decision, tensions, separations, lang, pieces);
      setRes(r);
      if (r.tension || r.cost) {
        logEvent({ type: "tradeoff_shown", tension: r.tension, favors: r.favors, cost: r.cost, groundedBridgeId: r.groundedBridgeId });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!opened) {
    return (
      <button
        onClick={reveal}
        className="flex w-full animate-fade-up items-center gap-2 rounded-xl border border-dashed border-ink/25 bg-paper-sunken/40 px-4 py-2.5 text-left text-[13px] font-medium text-ink transition hover:border-ink/50 hover:bg-paper-sunken/70"
      >
        <span className="text-base leading-none">⚖️</span>
        <span>{t("trade.label")}</span>
        <span className="ml-auto text-ink-faint">→</span>
      </button>
    );
  }

  return (
    <div className="animate-fade-up rounded-xl2 border border-ink/15 bg-paper-card p-5 shadow-card">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
        ⚖️ {t("trade.label")} <VoiceTag who="ai" />
      </div>
      {/* say WHY this appeared — it shows up the moment a decision is written, which reads
          as unrelated chrome without this line. */}
      <p className="mt-1 text-[12px] leading-snug text-ink-faint">{t("trade.why")}</p>
      {loading ? (
        <div className="mt-2 text-sm text-ink-faint">{t("trade.checking")}</div>
      ) : res && (res.tension || res.cost) ? (
        <>
          {res.tension && <div className="mt-2 text-sm font-medium text-ink">{res.tension}</div>}
          {/* The two sides are set AGAINST each other, not merely listed side by side: one
              side is taken and the other gives way, and the layout should make that visible
              at a glance. Spatially juxtaposing conflicting values is what stops a team
              nodding past a cost it would otherwise rationalise away — and this panel exists
              to be argued with, so the cost has to land before the contest buttons do. */}
          <div className="mt-2.5 grid items-stretch gap-0 sm:grid-cols-[1fr_auto_1fr]">
            {res.favors && (
              <div className="rounded-l-lg rounded-r-lg border border-accent/30 bg-accent-soft/30 px-3 py-2.5 sm:rounded-r-none">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-accent">
                  ▲ {t("trade.favors")}
                </div>
                <div className="mt-0.5 text-[13px] font-medium leading-snug text-ink">{res.favors}</div>
              </div>
            )}
            <div
              aria-hidden
              className="my-1 flex items-center justify-center px-2 text-[11px] font-semibold text-ink-faint sm:my-0 sm:border-y sm:border-line"
            >
              {t("trade.versus")}
            </div>
            {res.cost && (
              <div className="rounded-l-lg rounded-r-lg border border-tension/30 bg-tension/5 px-3 py-2.5 sm:rounded-l-none">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-tension">
                  ▼ {t("trade.cost")}
                </div>
                <div className="mt-0.5 text-[13px] font-medium leading-snug text-ink">{res.cost}</div>
              </div>
            )}
          </div>
          <p className="mt-2.5 text-[11px] leading-snug text-ink-faint">{t("trade.grounded")}</p>

          {/* THE CONTEST — is the AI's named cost right? Contesting it is the boundary work
              we actually study: the team renegotiating what their decision gives up. */}
          {stance ? (
            <div className="mt-3 rounded-lg border border-line bg-paper-sunken/50 px-3 py-2.5">
              <div className="text-[13px] text-ink">
                {t(`trade.answered.${stance}` as Parameters<typeof t>[0])}
                {note.trim() && <span className="text-ink-soft"> — “{note.trim()}”</span>}
              </div>
              {/* the contest had a consequence: offer to act on it, so it isn't a dead end.
                  Relocate/reject especially imply the decision may need another look. */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={onRevise}
                  className="rounded-full border border-ink/25 px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-ink hover:text-ink"
                >
                  ✎ {t("trade.revise")}
                </button>
                {/* not a dead end: look at a different cost, keeping the answer just given */}
                <button
                  onClick={() => { setStance(null); setNote(""); reveal(); }}
                  className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-faint transition hover:border-ink/40 hover:text-ink"
                >
                  ↻ {t("trade.another")}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 border-t border-line pt-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                {t("trade.ask")}
              </div>
              {noteFor ? (
                <div className="mt-2">
                  <textarea
                    autoFocus
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder={t("trade.notePlaceholder")}
                    className="w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => answer(noteFor, note)}
                      disabled={!note.trim()}
                      className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-paper transition enabled:hover:opacity-90 disabled:bg-line disabled:text-ink-faint"
                    >
                      {noteFor === "relocated" ? t("trade.relocate") : t("trade.reject")}
                    </button>
                    <button
                      onClick={() => { setNoteFor(null); setNote(""); }}
                      className="rounded-full px-3 py-1.5 text-xs font-medium text-ink-faint transition hover:text-ink"
                    >
                      ←
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => answer("accepted", "")}
                    className="rounded-full border border-line bg-paper-card px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-accent hover:text-accent"
                  >
                    {t("trade.accept")}
                  </button>
                  <button
                    onClick={() => setNoteFor("relocated")}
                    className="rounded-full border border-line bg-paper-card px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-ink hover:text-ink"
                  >
                    {t("trade.relocate")}
                  </button>
                  <button
                    onClick={() => setNoteFor("rejected")}
                    className="rounded-full border border-line bg-paper-card px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-tension hover:text-tension"
                  >
                    {t("trade.reject")}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        // a cost is always named now; an empty result means the call failed
        <div className="mt-2 flex items-center gap-2 text-[13px] leading-snug text-ink-faint">
          <span>⚠︎ {t("common.aiFailed")}</span>
          <button onClick={reveal} className="rounded-full border border-line px-2.5 py-1 text-[12px] font-medium text-ink-soft transition hover:text-ink">
            ↻ {t("common.retry")}
          </button>
        </div>
      )}
    </div>
  );
}
