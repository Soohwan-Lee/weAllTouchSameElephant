"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession, scenarioBridgesToProposals } from "@/lib/store";
import { getScenario } from "@/lib/scenarios";
import { countRedundantEdges, largestClusterSize } from "@/lib/clusters";
import { fetchBridges } from "@/lib/api";
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
  const setStep = useSession((s) => s.setStep);

  const [loading, setLoading] = useState(false);
  const [emptyResult, setEmptyResult] = useState(false);
  const [mode, setMode] = useState<string | null>(null);

  const byId = (id: string) => fragments.find((f) => f.id === id);
  // gate on the biggest connected GROUP, not the raw bridge count (see largestClusterSize).
  const biggestGroup = largestClusterSize(fragments, bridges);
  const canMirror = biggestGroup >= 3;
  const groupNeed = Math.max(0, 3 - biggestGroup);

  async function suggest() {
    setLoading(true);
    setEmptyResult(false);
    try {
      // scale the ask to the table: more pieces → more bridges per round (cap 6)
      const max = Math.min(6, Math.max(3, Math.round(fragments.length / 2)));
      const { bridges: proposals, mode: apiMode } = await fetchBridges(fragments, lang, max);
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
          {bridges.length > 0 && (
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
            {emptyResult && tray.length === 0 && (
              <div className="rounded-xl border border-dashed border-line bg-paper-sunken/40 p-6 text-center text-sm text-ink-faint">
                {moreAvailable ? t("connect.none") : t("connect.allDone")}
              </div>
            )}
            {tray.map((b) => (
              <BridgeCard key={b.id} bridge={b} fragA={byId(b.fragmentAId)} fragB={byId(b.fragmentBId)} />
            ))}
          </div>

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
