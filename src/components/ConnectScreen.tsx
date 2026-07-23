"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession, scenarioBridgesToProposals } from "@/lib/store";
import { getScenario } from "@/lib/scenarios";
import { countRedundantEdges, largestClusterSize } from "@/lib/clusters";
import { fetchBridges, fetchBlindSpot } from "@/lib/api";
import { BridgeCard } from "./BridgeCard";
import { Hint } from "./Hint";
import { ManualConnect } from "./ManualConnect";

export function ConnectScreen() {
  const { t, lang } = useI18n();
  const fragments = useSession((s) => s.fragments);
  const tray = useSession((s) => s.tray);
  const bridges = useSession((s) => s.bridges);
  const scenarioId = useSession((s) => s.scenarioId);
  const rejectedPairKeys = useSession((s) => s.rejectedPairKeys);
  const addProposals = useSession((s) => s.addProposals);
  const unconfirmBridge = useSession((s) => s.unconfirmBridge);
  const undoRejection = useSession((s) => s.undoRejection);
  const setStep = useSession((s) => s.setStep);

  const [loading, setLoading] = useState(false);
  const [emptyResult, setEmptyResult] = useState(false);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<string | null>(null);

  const byId = (id: string) => fragments.find((f) => f.id === id);
  // gate on the biggest connected GROUP, not the raw bridge count (see largestClusterSize).
  const biggestGroup = largestClusterSize(fragments, bridges);
  const canMirror = biggestGroup >= 3;
  const groupNeed = Math.max(0, 3 - biggestGroup);

  async function suggest() {
    setLoading(true);
    setEmptyResult(false);
    setFailed(false);
    try {
      // scale the ask to the table: more pieces → more bridges per round (cap 6)
      const max = Math.min(6, Math.max(3, Math.round(fragments.length / 2)));
      const { bridges: proposals, mode: apiMode } = await fetchBridges(fragments, lang, max);
      // a failed call on a blank table used to render as "no strong connections found",
      // sending people off to edit perfectly good pieces to fix a network error.
      if (apiMode === "error" && !getScenario(scenarioId)) {
        setFailed(true);
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
      setLoading(false);
    }
  }

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

      <BlindSpotLine />

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

          {/* group progress — the REAL gate: one connected group of >= 3 pieces.
              This is what fixes the "3 links but nothing assembles" dead-end. */}
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
            {tray.length === 0 && !loading && !emptyResult && (
              <div className="rounded-xl border border-dashed border-line bg-paper-sunken/40 p-6 text-center text-sm text-ink-faint">
                {t("connect.trayEmpty")}
              </div>
            )}
            {failed && (
              <div className="rounded-xl border border-tension/40 bg-tension/5 p-4 text-center text-[13px] leading-snug text-ink">
                ⚠︎ {t("common.aiFailed")}
                <button
                  onClick={suggest}
                  className="mt-2 block w-full rounded-full border border-line py-1.5 text-[12px] font-medium text-ink-soft transition hover:text-ink"
                >
                  ↻ {t("common.retry")}
                </button>
              </div>
            )}
            {emptyResult && tray.length === 0 && (
              <div className="rounded-xl border border-dashed border-line bg-paper-sunken/40 p-6 text-center text-sm text-ink-faint">
                {moreAvailable ? t("connect.none") : t("connect.allDone")}
              </div>
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
          {canMirror ? `${t("mirror.reveal")} →` : t("mirror.lockedGroup")}
        </button>
      </div>
    </div>
  );
}

/**
 * A quiet blind-spot check, woven into Connect rather than spotlit. The person asks "what
 * angle are we missing?"; the AI names a SEAT and a question grounded in what's present; the
 * person then adds their OWN piece from that seat (the angle is a handle, never a written
 * perspective). Filling it flows straight into the existing gather form via pendingAngle.
 */
function BlindSpotLine() {
  const { t, lang } = useI18n();
  const fragments = useSession((s) => s.fragments);
  const decisionPrompt = useSession((s) => s.decisionPrompt);
  const setStep = useSession((s) => s.setStep);
  const setPendingAngle = useSession((s) => s.setPendingAngle);
  const logEvent = useSession((s) => s.logEvent);

  const [loading, setLoading] = useState(false);
  const [spot, setSpot] = useState<{ angle: string; rationale: string; question: string } | null>(null);
  const [exhausted, setExhausted] = useState(false); // ran out of distinct angles
  const [hidden, setHidden] = useState(false); // user closed it (re-openable)
  // every angle already shown, so "show another" and "not a gap" ask for a NEW one.
  // Dismissing an angle no longer kills the feature — it just moves to the next.
  const [seen, setSeen] = useState<string[]>([]);

  if (fragments.length < 2 || hidden) {
    // once hidden, offer a discreet way back — never a dead end
    return fragments.length < 2 ? null : (
      <div className="mt-6">
        <button
          onClick={() => { setHidden(false); setExhausted(false); }}
          className="text-[13px] font-medium text-accent underline-offset-2 transition hover:underline"
        >
          🔍 {t("blind.reopen")}
        </button>
      </div>
    );
  }

  const check = async (excluding: string[]) => {
    setLoading(true);
    setExhausted(false);
    try {
      const pieces = fragments.map((f) => ({ title: f.title, body: f.body, role: f.authorRole }));
      const res = await fetchBlindSpot(decisionPrompt, pieces, lang, excluding);
      if (!res.angle) {
        // nothing new to surface — either well-covered, or we've named them all
        setSpot(null);
        setExhausted(true);
        return;
      }
      setSpot({ angle: res.angle, rationale: res.rationale, question: res.question });
      setSeen((prev) => (prev.includes(res.angle) ? prev : [...prev, res.angle]));
      logEvent({ type: "blindspot_shown", angle: res.angle, rationale: res.rationale });
    } finally {
      setLoading(false);
    }
  };

  const fill = () => {
    if (!spot) return;
    // hand the seat to the gather form; the person writes the perspective there
    setPendingAngle(spot.angle);
    setStep("gather");
  };

  // "not a gap" logs the refusal AND asks for a different angle — it doesn't end the feature
  const dismissThis = () => {
    if (spot) logEvent({ type: "blindspot_dismissed", angle: spot.angle });
    check(spot ? [...seen, spot.angle] : seen);
  };

  return (
    <div className="mt-6">
      {/* the invitation — a real card that says what it does and why, not a thin link.
          A blind spot is only useful while pieces can still be added, so it earns a
          visible place here on Connect. */}
      {!spot && !exhausted && (
        <div className="animate-fade-up overflow-hidden rounded-xl2 border border-accent/30 bg-gradient-to-br from-accent-soft/40 to-paper-card shadow-card">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xl">
              🔍
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink">{t("blind.check")}</div>
              <p className="mt-0.5 text-[12px] leading-snug text-ink-faint">{t("blind.checkSub")}</p>
            </div>
            <button
              onClick={() => check(seen)}
              disabled={loading}
              className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition enabled:hover:opacity-95 disabled:opacity-60"
            >
              {loading ? `${t("blind.checking")}` : `${t("blind.check")} →`}
            </button>
          </div>
        </div>
      )}

      {exhausted && (
        <div className="animate-fade-up flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper-sunken/50 px-4 py-3 text-[13px] text-ink-soft">
          <span className="text-base">✓</span>
          <span className="flex-1">{seen.length ? t("blind.exhausted") : t("blind.none")}</span>
          <button onClick={() => setHidden(true)} className="rounded-full px-2 py-1 text-ink-faint transition hover:text-ink">
            {t("blind.hide")}
          </button>
        </div>
      )}

      {spot && (
        <div className="animate-fade-up overflow-hidden rounded-xl2 border border-accent/40 bg-paper-card shadow-card">
          {/* header band so the result reads as a distinct, considered suggestion */}
          <div className="flex items-center justify-between gap-2 border-b border-accent/20 bg-accent-soft/30 px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">🔍</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">{t("blind.found")}</span>
            </div>
            <button onClick={() => setHidden(true)} className="text-[11px] font-medium text-ink-faint transition hover:text-ink">
              {t("blind.hide")}
            </button>
          </div>
          <div className="p-4">
            {/* the seat, as a headline */}
            <div className="text-base font-semibold text-ink">{spot.angle}</div>

            {/* why it reads as missing — grounded in who's present */}
            <div className="mt-2 rounded-lg bg-paper-sunken/50 px-3 py-2 text-[12px] leading-snug text-ink-soft">
              <span className="font-semibold text-ink-faint">{t("blind.why")}</span>
              <br />
              {spot.rationale}
            </div>

            {/* a question to write from — the AI asks, the person answers */}
            {spot.question && (
              <div className="mt-2.5 flex gap-2 text-[13px] leading-snug text-ink">
                <span className="text-accent">“</span>
                <span className="italic">{spot.question}</span>
              </div>
            )}

            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              {/* primary: write from this seat */}
              <button
                onClick={fill}
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
              >
                + {t("blind.fill")}
              </button>
              {/* secondary, neutral: ask for a different angle (loops, doesn't kill) */}
              <button
                onClick={() => check(seen)}
                disabled={loading}
                className="rounded-full border border-line px-3 py-2 text-xs font-medium text-ink-soft transition enabled:hover:border-ink enabled:hover:text-ink disabled:opacity-60"
              >
                ↻ {loading ? t("blind.checking") : t("blind.another")}
              </button>
              {/* not a gap → logs the refusal AND moves on to a different seat */}
              <button
                onClick={dismissThis}
                disabled={loading}
                className="rounded-full px-3 py-2 text-xs font-medium text-ink-faint transition hover:text-ink disabled:opacity-60"
              >
                {t("blind.dismiss")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
