"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession, scenarioBridgesToProposals, bridgeEditsFrom } from "@/lib/store";
import { getScenario } from "@/lib/scenarios";
import {
  countRedundantEdges,
  largestClusterSize,
  largestRevealGroupSize,
  seatCoverage,
} from "@/lib/clusters";
import { fetchBridges } from "@/lib/api";
import { BridgeCard } from "./BridgeCard";
import { ContestCard } from "./ContestCard";
import { Hint } from "./Hint";
import { ManualConnect } from "./ManualConnect";
import type { ContestProposal } from "@/lib/types";
import { createRequestGate } from "@/lib/requestGate";
import { settledPairKey } from "@/lib/settledPairs";

export function ConnectScreen() {
  const { t, lang } = useI18n();
  const fragments = useSession((s) => s.fragments);
  const tray = useSession((s) => s.tray);
  const bridges = useSession((s) => s.bridges);
  const decisionPrompt = useSession((s) => s.decisionPrompt);
  const scenarioId = useSession((s) => s.scenarioId);
  const rejectedPairKeys = useSession((s) => s.rejectedPairKeys);
  const addProposals = useSession((s) => s.addProposals);
  const unconfirmBridge = useSession((s) => s.unconfirmBridge);
  const undoRejection = useSession((s) => s.undoRejection);
  const contests = useSession((s) => s.contests);
  const recordContest = useSession((s) => s.recordContest);
  const setStep = useSession((s) => s.setStep);

  const [loading, setLoading] = useState(false);
  const [emptyResult, setEmptyResult] = useState(false);
  const [insufficient, setInsufficient] = useState(false);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<string | null>(null);
  // At most one live second look at a time — the server returns at most one per round, and a
  // stack of them would be the tool arguing rather than asking.
  //
  // Held WITH the id of the bridge it was raised against. Resolving by pair alone was wrong:
  // a team can take a link back and re-draw the same two cards, and the stale question would
  // silently re-attach to a link it was never about — and then un-confirm THAT one.
  const [contest, setContest] = useState<{ proposal: ContestProposal; bridgeId: string } | null>(
    null
  );
  // Which "suggest" round this is. The server uses it to space second looks out (at most one
  // every other round) and to rotate which link gets looked at.
  const [round, setRound] = useState(0);
  const requestGate = useRef(createRequestGate());
  useEffect(() => () => requestGate.current.cancel(), []);

  const byId = (id: string) => fragments.find((f) => f.id === id);
  // gate on the biggest connected GROUP, not the raw bridge count (see largestClusterSize).
  const biggestGroup = largestRevealGroupSize(fragments, bridges);
  const canMirror = biggestGroup >= 3;
  const boundaryOnlyReady = canMirror && largestClusterSize(fragments, bridges) < 3;
  const revealLabel = boundaryOnlyReady ? t("mirror.revealBoundary") : t("mirror.reveal");
  const groupNeed = Math.max(0, 3 - biggestGroup);
  // How many PEOPLE the shape reaches. The gate above counts pieces, which is a different
  // question: three linked pieces can all belong to one person, and then the reveal reads
  // one voice. Shown but never enforced — a team may have good reason to leave a piece out,
  // and blocking on it would make the tool a supervisor rather than a mirror.
  const seats = seatCoverage(fragments, bridges);

  async function suggest() {
    // `loading` is a rendered snapshot and two clicks can arrive before it flips true.
    // Close a synchronous gate first so one gesture can create at most one server round.
    const requestToken = requestGate.current.begin();
    if (requestToken === null) return;
    setLoading(true);
    setEmptyResult(false);
    setInsufficient(false);
    setFailed(false);
    try {
      // scale the ask to the table: more pieces → more bridges per round (cap 6)
      const max = Math.min(6, Math.max(3, Math.round(fragments.length / 2)));
      // Tell the AI what this team has already settled. Without it, a "find more" round is
      // indistinguishable from the first one: it could re-offer a pair they just dismissed,
      // or re-suggest a link they already confirmed — the tool visibly forgetting their work.
      // The corrections matter most: where they re-typed a proposal, the AI's read of that
      // relation was wrong, and it should carry that lesson into the next round.
      const edits = bridgeEditsFrom(useSession.getState().events);
      const context = {
        settledPairKeys: [
          ...bridges.map((bridge) =>
            settledPairKey(bridge.fragmentAId, bridge.fragmentBId)
          ),
          ...tray.map((bridge) =>
            settledPairKey(bridge.fragmentAId, bridge.fragmentBId)
          ),
          ...rejectedPairKeys,
        ],
        confirmed: bridges.map((b) => {
          const h = edits.get(b.id);
          const aiType = h?.aiRelationType;
          return {
            aId: b.fragmentAId,
            bId: b.fragmentBId,
            relationType: b.relationType,
            retyped: Boolean(h?.retyped),
            aiRelationType: aiType && aiType !== b.relationType ? aiType : undefined,
            // `createdBy` decides eligibility for a second look — a hand-drawn link must never
            // be one, since un-confirming it deletes it. The evidence travels so the server can
            // tell a genuine re-reading from the model handing back the link's own snippets.
            createdBy: b.createdBy,
            evidenceA: b.evidenceA,
            evidenceB: b.evidenceB,
          };
        }),
        rejectedPairs: [...rejectedPairKeys].map((k) => {
          const [aId, bId] = k.split("::");
          return { aId, bId };
        }),
        // Pairs whose link the AI has already questioned once and the team answered. Asking
        // the same question again would be pressing them, so the server drops these.
        contested: contests.map((c) => ({ aId: c.aId, bId: c.bId })),
        round,
      };
      const {
        bridges: proposals,
        mode: apiMode,
        contest: raised,
      } = await fetchBridges(fragments, lang, max, context, decisionPrompt);
      if (!requestGate.current.isCurrent(requestToken)) return;
      // a failed call on a blank table used to render as "no strong connections found",
      // sending people off to edit perfectly good pieces to fix a network error.
      if (apiMode === "error" && !getScenario(scenarioId)) {
        setFailed(true);
        return;
      }
      setRound((value) => value + 1);
      // Set before the branches below: a round can find no new bridges and still have a fair
      // question about an existing link, and that question is the round's only useful output
      // when it happens. Only ever replaced by a fresh one, never stacked.
      //
      // Bound to the bridge id as it stands right now, so the question stays attached to the
      // exact link it was asked about rather than to whatever later occupies that pair.
      if (raised) {
        const target = bridges.find(
          (b) =>
            (b.fragmentAId === raised.aId && b.fragmentBId === raised.bId) ||
            (b.fragmentAId === raised.bId && b.fragmentBId === raised.aId)
        );
        if (target) setContest({ proposal: raised, bridgeId: target.id });
      }
      // The server checked the proposals against the cards and none survived. Falling through
      // to the scenario's pre-baked bridges here would hand back links the live table cannot
      // support and hide the one thing worth saying — that the cards need more substance.
      if (apiMode === "insufficient") {
        setMode("live");
        setInsufficient(true);
        return;
      }
      let added = 0;
      if (apiMode === "live" && proposals.length) {
        setMode("live");
        added = addProposals(proposals);
      } else {
        // sample mode (or empty/error) → use the scenario's pre-baked bridges
        setMode(apiMode === "live" ? "live" : "sample");
        const sc = getScenario(scenarioId);
        if (sc) {
          const baked = scenarioBridgesToProposals(sc.sampleBridges, lang);
          added = addProposals(baked);
        }
      }
      if (added === 0) setEmptyResult(true);
    } finally {
      if (requestGate.current.finish(requestToken)) setLoading(false);
    }
  }

  // The exact link a live contest was raised against, by id. The team can take that link back
  // themselves between rounds — and even re-draw the same two cards — so matching on identity
  // is what keeps a stale question from re-attaching to a link it was never about. If the
  // original link is gone, the question is about nothing and the card goes with it.
  const contestBridge = contest
    ? bridges.find((b) => b.id === contest.bridgeId) ?? null
    : null;

  const usedPairs = bridges.length + tray.length + rejectedPairKeys.size;
  const totalPairs = (fragments.length * (fragments.length - 1)) / 2;
  const moreAvailable = usedPairs < totalPairs;

  // connection budget: how many confirmed edges are "extra" (restate an existing path).
  // Zero extra with pieces connected = a clean tree; extras are additional claims, not glue.
  const extraEdges = countRedundantEdges(bridges);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="animate-fade-up">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{t("connect.heading")}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-faint">{t("connect.hint")}</p>
      </div>

      {bridges.length === 0 && tray.length === 0 && (
        <div className="mt-4 animate-fade-up">
          <Hint tone="nudge">
            {lang === "ko"
              ? "먼저 오른쪽의 “연결 제안받기”를 눌러보세요. AI가 어떤 조각들이 이어질지 알려줄 거예요."
              : "Start by pressing “Suggest connections” on the right — the AI will show which pieces might link."}
          </Hint>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* board (with draw-your-own-connection mode) */}
        <div>
          <ManualConnect />
        </div>

        {/* tray */}
        <div className="flex flex-col">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">{t("connect.tray")}</span>
            <span className="text-xs text-ink-faint">
              {bridges.length} {t("bridge.confirmedCount")}
            </span>
          </div>

          {/* reveal-target progress: either one connected shape or one explicit boundary
              constellation. Both need 3 pieces; only the former counts as assembly. */}
          {/* shown from the start: the gate that blocks the proceed button must be legible
              BEFORE you've guessed your way past it, not only after the first confirm. */}
          {fragments.length > 0 && (
            <div
              className={[
                "mb-3 rounded-lg border px-3 py-2",
                canMirror ? "border-accent/30 bg-accent-soft/40" : "border-line bg-paper-sunken/50",
              ].join(" ")}
            >
              <div className="flex items-center justify-between text-[11px] font-medium">
                <span className="text-ink-soft">{t("group.label")}</span>
                <span className={canMirror ? "text-accent" : "text-ink-faint"}>
                  {biggestGroup} {t("group.piecesShort")}
                </span>
              </div>
              <div className="mt-1.5 flex gap-1">
                {Array.from({ length: Math.max(3, biggestGroup) }).map((_, i) => (
                  <div
                    key={i}
                    className={[
                      "h-1.5 flex-1 rounded-full",
                      i < biggestGroup ? (canMirror ? "bg-accent" : "bg-ink/40") : "bg-line",
                    ].join(" ")}
                  />
                ))}
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-ink-faint">
                {canMirror ? t("group.ready") : t("group.needMore").replace("{n}", String(groupNeed))}
              </p>
            </div>
          )}

          {/* Whose pieces are in the shape. Only meaningful once more than one person has
              put something on the table — on a solo table it would be noise. */}
          {seats.total > 1 && !boundaryOnlyReady && (
            <div className="mb-3 rounded-lg border border-line bg-paper-sunken/50 px-3 py-2">
              <div className="flex items-center justify-between text-[11px] font-medium">
                <span className="text-ink-soft">{t("seats.label")}</span>
                <span className={seats.isolated.length ? "text-ink-faint" : "text-accent"}>
                  {t("seats.count")
                    .replace("{n}", String(seats.connected))
                    .replace("{total}", String(seats.total))}
                </span>
              </div>
              {seats.isolated.length > 0 ? (
                <>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-ink-faint">{t("seats.notLinked")}</span>
                    {seats.isolated.map((s) => (
                      <span
                        key={s}
                        className="rounded-full border border-dashed border-line px-2 py-0.5 text-ink-faint"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-snug text-ink-faint">{t("seats.why")}</p>
                </>
              ) : (
                <p className="mt-1.5 text-[11px] leading-snug text-ink-faint">{t("seats.allIn")}</p>
              )}
            </div>
          )}
          {boundaryOnlyReady && (
            <div className="mb-3 rounded-lg border border-dashed border-tension/30 bg-tension/5 px-3 py-2 text-[11px] leading-snug text-ink-soft">
              {t("seats.boundaryOnly")}
            </div>
          )}

          {extraEdges > 0 && (
            <div className="mb-3 rounded-md bg-amber-50/60 px-2.5 py-1.5 text-[11px] leading-snug text-amber-800">
              ⚖︎ {extraEdges} {t("budget.extra")}
            </div>
          )}

          <button
            onClick={suggest}
            disabled={loading}
            className="mb-4 w-full rounded-full bg-ink py-2.5 text-sm font-medium text-paper transition enabled:hover:opacity-90 disabled:opacity-60"
          >
            {loading
              ? t("connect.thinking")
              : tray.length || bridges.length
              ? `✨ ${t("connect.findMore")}`
              : `✨ ${t("connect.find")}`}
          </button>

          <div className="flex-1 space-y-3">
            {/* The one place the AI questions the team's own work. Rendered above the
                proposals because it is about a decision they already made, and below it
                everything is still just an offer. */}
            {contestBridge && contest && (
              <ContestCard
                contest={contest.proposal}
                bridge={contestBridge}
                fragA={byId(contest.proposal.aId)}
                fragB={byId(contest.proposal.bId)}
                onKeep={() => {
                  recordContest({
                    aId: contest.proposal.aId,
                    bId: contest.proposal.bId,
                    confirmedType: contestBridge.relationType,
                    suggestedType: contest.proposal.suggestedType,
                    outcome: "kept",
                  });
                  setContest(null);
                }}
                onRevisit={() => {
                  recordContest({
                    aId: contest.proposal.aId,
                    bId: contest.proposal.bId,
                    confirmedType: contestBridge.relationType,
                    suggestedType: contest.proposal.suggestedType,
                    outcome: "revisited",
                  });
                  // The existing way back off the board: an AI link returns to the tray as a
                  // proposal, where the team can re-type, rewrite, or dismiss it with the
                  // affordances they already know.
                  unconfirmBridge(contestBridge.id);
                  setContest(null);
                }}
              />
            )}
            {/* The four resting/outcome states used to be one identical grey dashed box, so
                "nothing happened yet", "we need something from you" and "you're done" were
                indistinguishable. Each now carries a glyph, and the two that are not neutral
                carry a border tone: the ask reads heavier (solid), the success reads like the
                success it is — the same accent treatment as the group-ready panel above. */}
            {tray.length === 0 && !loading && !emptyResult && !insufficient && (
              <div className="rounded-xl border border-dashed border-line bg-paper-sunken/40 p-6 text-center text-sm text-ink-faint">
                <span aria-hidden>✨</span> {t("connect.trayEmpty")}
              </div>
            )}
            {failed && (
              <div className="rounded-xl border border-tension/40 bg-tension/5 p-4 text-center text-[13px] leading-snug text-ink">
                <span aria-hidden>⚠︎</span> {t("common.aiFailed")}
                <button
                  onClick={suggest}
                  disabled={loading}
                  className="mt-2 block w-full rounded-full border border-line py-1.5 text-[12px] font-medium text-ink-soft transition hover:text-ink"
                >
                  <span aria-hidden>↻</span> {t("common.retry")}
                </button>
              </div>
            )}
            {/* Not gated on an empty tray: a round can come back "insufficient" while leftovers
                from an earlier round still sit below, and gating it there made that round a
                silent no-op — the user pressed the button and nothing on screen moved. */}
            {insufficient && (
              <div className="rounded-xl border border-line bg-paper-sunken/60 p-6 text-center text-sm leading-snug text-ink-soft">
                <span aria-hidden>✎</span> {t("connect.insufficient")}
                <button
                  onClick={() => setStep("gather")}
                  className="mt-2 block w-full rounded-full border border-line py-1.5 text-[12px] font-medium text-ink-soft transition hover:text-ink"
                >
                  {t("connect.insufficientCta")} →
                </button>
              </div>
            )}
            {/* Same reason as the insufficient notice above: a round that adds no NEW proposals
                while leftovers still sit in the tray was silent — pressed the button, nothing
                moved. Both strings are scoped to the round, so they stay true above a tray
                that still holds cards. */}
            {emptyResult && (
              moreAvailable ? (
                <div className="rounded-xl border border-dashed border-line bg-paper-sunken/40 p-6 text-center text-sm text-ink-faint">
                  <span aria-hidden>○</span> {t("connect.none")}
                </div>
              ) : (
                <div className="rounded-xl border border-accent/30 bg-accent-soft/40 p-6 text-center text-sm leading-snug text-ink-soft">
                  <span aria-hidden>✓</span> {t("connect.allDone")}
                  {/* only when the shape actually qualifies — the proceed button below is
                      gated the same way, and a button that lands on a locked screen is worse
                      than none. */}
                  {canMirror && (
                    <button
                      onClick={() => setStep("mirror")}
                      className="mt-2 block w-full rounded-full border border-accent/40 py-1.5 text-[12px] font-medium text-accent transition hover:bg-accent hover:text-white"
                    >
                      {revealLabel} →
                    </button>
                  )}
                </div>
              )
            )}
            {tray.map((b) => (
              <BridgeCard key={b.id} bridge={b} fragA={byId(b.fragmentAId)} fragB={byId(b.fragmentBId)} />
            ))}
          </div>

          {/* what's already on the board, and the way back off it. Confirming used to be a
              one-way door: a misclick was permanent, and the "extra links" warning above had
              no remedy to point at. */}
          {bridges.length > 0 && (
            <div className="mt-4 rounded-lg border border-line bg-paper-sunken/40 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                {t("bridge.onBoard")}
              </div>
              <ul className="mt-2 space-y-1.5">
                {bridges.map((b) => (
                  <li key={b.id} className="group flex items-start gap-2 text-[12px] leading-snug">
                    <span className="min-w-0 flex-1 text-ink-soft">
                      <span className="font-medium text-ink">{byId(b.fragmentAId)?.title ?? "?"}</span>
                      {" — "}
                      <span className="font-medium text-ink">{byId(b.fragmentBId)?.title ?? "?"}</span>
                    </span>
                    <button
                      onClick={() => unconfirmBridge(b.id)}
                      title={t("bridge.unconfirmHint")}
                      className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-ink-faint opacity-60 transition hover:bg-paper hover:text-tension group-hover:opacity-100"
                    >
                      {t("bridge.unconfirm")}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* pairs the team dismissed — blocked from future AI rounds until taken back */}
          {rejectedPairKeys.size > 0 && (
            <div className="mt-3 text-[11px] leading-snug text-ink-faint">
              {t("bridge.dismissedCount").replace("{n}", String(rejectedPairKeys.size))}{" "}
              <button
                onClick={() => rejectedPairKeys.forEach((k) => undoRejection(k))}
                className="font-medium text-accent underline-offset-2 hover:underline"
              >
                {t("bridge.undoAllRejections")}
              </button>
            </div>
          )}

          {mode && (
            <div className="mt-4 text-center text-[11px] text-ink-faint">
              {mode === "live" ? `● ${t("common.liveMode")}` : `○ ${t("common.sampleMode")}`}
            </div>
          )}
        </div>
      </div>

      {/* proceed */}
      <div className="sticky bottom-4 mt-8 flex justify-center">
        <button
          onClick={() => setStep("mirror")}
          disabled={!canMirror}
          className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white shadow-lift transition enabled:hover:opacity-95 disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-faint disabled:shadow-none"
        >
          {canMirror ? `${revealLabel} →` : t("mirror.lockedGroup")}
        </button>
      </div>
    </div>
  );
}
