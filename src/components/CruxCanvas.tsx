"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/store";
import { RELATION_META } from "@/lib/relation";
import { findClusters } from "@/lib/clusters";
import { computeCrux } from "@/lib/crux";
import type { Fragment } from "@/lib/types";

/**
 * The "Crux Map": the main cluster laid out as an upstream→downstream flow.
 * - Fragments are placed in columns by dependency depth (roots left, symptoms right).
 * - Dependency bridges draw directional arrows (A drives B).
 * - The likely crux (most-connected / most-downstream) is elevated and haloed.
 * GOAL: reveal the real bottleneck behind many issues. RATIONALE: direction + degree
 * is a grounded, inspectable signal — not an AI verdict.
 */
export function CruxCanvas() {
  const { t } = useI18n();
  const fragments = useSession((s) => s.fragments);
  const bridges = useSession((s) => s.bridges);
  const cruxOverride = useSession((s) => s.cruxOverride);
  const setCruxOverride = useSession((s) => s.setCruxOverride);

  const clusters = useMemo(() => findClusters(fragments, bridges, 3), [fragments, bridges]);
  const main = clusters[0];

  const layout = useMemo(() => {
    if (!main) return null;
    return computeCrux(fragments, bridges, main, cruxOverride[main.id] ?? null);
  }, [fragments, bridges, main, cruxOverride]);

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    if (!layout || !main) return map;
    // group fragment ids by level (column)
    const cols = new Map<number, string[]>();
    layout.nodes.forEach((n) => {
      if (!cols.has(n.level)) cols.set(n.level, []);
      cols.get(n.level)!.push(n.fragmentId);
    });
    const levels = [...cols.keys()].sort((a, b) => a - b);
    const nCols = Math.max(1, levels.length);
    levels.forEach((lv, ci) => {
      const ids = cols.get(lv)!;
      const x = nCols === 1 ? 0.5 : 0.13 + (ci / (nCols - 1)) * 0.74;
      ids.forEach((id, ri) => {
        const y = ids.length === 1 ? 0.5 : 0.16 + (ri / (ids.length - 1)) * 0.68;
        map.set(id, { x, y });
      });
    });
    return map;
  }, [layout, main]);

  const byId = (id: string) => fragments.find((f) => f.id === id);
  const hasFlow = (layout?.flow.length ?? 0) > 0;

  if (!main || !layout) return null;

  return (
    <div className="table-surface relative h-[460px] w-full overflow-hidden rounded-xl2 border border-line sm:h-[540px]">
      {/* column labels */}
      {hasFlow && (
        <>
          <div className="absolute left-4 top-3 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
            ← {t("crux.upstream")}
          </div>
          <div className="absolute right-4 top-3 text-right text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
            {t("crux.downstream")} →
          </div>
        </>
      )}

      {/* arrows / lines */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#6b6ba8" />
          </marker>
        </defs>
        {bridges.map((b) => {
          const a = byId(b.fragmentAId);
          const c = byId(b.fragmentBId);
          if (!a || !c) return null;
          const pa = positions.get(a.id);
          const pc = positions.get(c.id);
          if (!pa || !pc) return null;
          const meta = RELATION_META[b.relationType];
          const directed = b.relationType === "dependency";
          return (
            <line
              key={b.id}
              x1={`${pa.x * 100}%`}
              y1={`${pa.y * 100}%`}
              x2={`${pc.x * 100}%`}
              y2={`${pc.y * 100}%`}
              stroke={meta.stroke}
              strokeWidth={directed ? 2.2 : 1.6}
              strokeDasharray={meta.dash}
              strokeLinecap="round"
              opacity={directed ? 0.7 : 0.4}
              markerEnd={directed ? "url(#arrow)" : undefined}
            />
          );
        })}
      </svg>

      {/* nodes */}
      {layout.nodes.map((n) => {
        const f = byId(n.fragmentId);
        const p = positions.get(n.fragmentId);
        if (!f || !p) return null;
        return (
          <CruxNodeCard
            key={n.fragmentId}
            f={f}
            x={p.x}
            y={p.y}
            isCrux={n.isCrux}
            degree={n.degree}
            onSetCrux={() => main && setCruxOverride(main.id, n.fragmentId)}
            cruxLabel={t("crux.likely")}
            setLabel={t("crux.setAsCrux")}
            statLabel={t("crux.stat")}
          />
        );
      })}

      {!hasFlow && (
        <div className="absolute bottom-3 left-1/2 max-w-md -translate-x-1/2 rounded-lg bg-paper-card/90 px-3 py-2 text-center text-[11px] text-ink-faint shadow-card backdrop-blur">
          {t("crux.noFlow")}
        </div>
      )}
    </div>
  );
}

function CruxNodeCard({
  f,
  x,
  y,
  isCrux,
  degree,
  onSetCrux,
  cruxLabel,
  setLabel,
  statLabel,
}: {
  f: Fragment;
  x: number;
  y: number;
  isCrux: boolean;
  degree: number;
  onSetCrux: () => void;
  cruxLabel: string;
  setLabel: string;
  statLabel: string;
}) {
  return (
    <div
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, transition: "left 0.5s ease, top 0.5s ease" }}
      className={[
        "group absolute w-40 -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-paper-card p-3 sm:w-44",
        isCrux
          ? "z-10 border-accent/50 shadow-lift ring-2 ring-accent/25"
          : "border-line shadow-card",
      ].join(" ")}
    >
      {isCrux && (
        <div className="mb-1.5 -mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-accent">
          🎯 {cruxLabel}
        </div>
      )}
      <div className="text-[13px] font-semibold leading-snug text-ink">{f.title}</div>
      <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink-soft">{f.body}</div>
      <div className="mt-2 flex items-center justify-between">
        <span className="truncate text-[10px] font-medium uppercase tracking-wide text-ink-faint">
          {f.authorRole}
        </span>
        <span className="text-[10px] text-ink-faint">
          {degree} {statLabel}
        </span>
      </div>
      {!isCrux && (
        <button
          onClick={onSetCrux}
          className="mt-2 w-full rounded-md border border-line py-1 text-[10px] font-medium text-ink-faint opacity-0 transition hover:border-accent hover:text-accent group-hover:opacity-100"
        >
          {setLabel}
        </button>
      )}
    </div>
  );
}
