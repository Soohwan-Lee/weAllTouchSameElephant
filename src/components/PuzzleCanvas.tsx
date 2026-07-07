"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/store";
import { RELATION_META } from "@/lib/relation";
import { findClusters } from "@/lib/clusters";
import type { Fragment } from "@/lib/types";

/**
 * The "table": fragment cards positioned on a board, with confirmed bridges
 * drawn as lines between them. When `assembled` is on, the largest connected
 * cluster gathers into a ring around a named center — the "elephant" reveal.
 */
export function PuzzleCanvas({ showCenterName = false }: { showCenterName?: boolean }) {
  const { t } = useI18n();
  const fragments = useSession((s) => s.fragments);
  const bridges = useSession((s) => s.bridges);
  const assembled = useSession((s) => s.assembled);
  const clusterNames = useSession((s) => s.clusterNames);
  const moveFragment = useSession((s) => s.moveFragment);

  const boardRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const clusters = useMemo(() => findClusters(fragments, bridges, 3), [fragments, bridges]);
  const mainCluster = clusters[0];

  // When assembled, compute a ring layout for the main cluster's fragments.
  const ringPos = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    if (!assembled || !mainCluster) return map;
    const ids = mainCluster.fragmentIds;
    const cx = 0.5;
    const cy = 0.52;
    const r = ids.length <= 4 ? 0.3 : 0.34;
    ids.forEach((id, i) => {
      const a = (i / ids.length) * Math.PI * 2 - Math.PI / 2;
      map.set(id, { x: cx + Math.cos(a) * r * 0.9, y: cy + Math.sin(a) * r });
    });
    return map;
  }, [assembled, mainCluster]);

  const posOf = (f: Fragment) => ringPos.get(f.id) ?? { x: f.x, y: f.y };

  const onPointerDown = (id: string) => (e: React.PointerEvent) => {
    if (assembled) return; // locked during the reveal
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragId(id);
  };

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragId || !boardRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();
      const x = Math.min(0.94, Math.max(0.06, (e.clientX - rect.left) / rect.width));
      const y = Math.min(0.92, Math.max(0.08, (e.clientY - rect.top) / rect.height));
      moveFragment(dragId, x, y);
    },
    [dragId, moveFragment]
  );

  const byId = (id: string) => fragments.find((f) => f.id === id);
  const clusterName = mainCluster ? clusterNames[mainCluster.id] : undefined;
  const inMain = (id: string) => !!mainCluster && mainCluster.fragmentIds.includes(id);

  return (
    <div
      ref={boardRef}
      onPointerMove={onPointerMove}
      onPointerUp={() => setDragId(null)}
      onPointerLeave={() => setDragId(null)}
      className="table-surface relative h-[460px] w-full overflow-hidden rounded-xl2 border border-line sm:h-[540px]"
    >
      {/* halo behind the assembled ring */}
      {assembled && mainCluster && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 animate-draw-in rounded-full"
          style={{
            left: "50%",
            top: "52%",
            width: "70%",
            height: "78%",
            background:
              "radial-gradient(closest-side, rgba(47,111,107,0.10), rgba(47,111,107,0.02) 70%, transparent)",
          }}
        />
      )}

      {/* bridge lines */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        {bridges.map((b) => {
          const a = byId(b.fragmentAId);
          const c = byId(b.fragmentBId);
          if (!a || !c) return null;
          const pa = posOf(a);
          const pc = posOf(c);
          const meta = RELATION_META[b.relationType];
          const mx = (pa.x + pc.x) / 2;
          const my = (pa.y + pc.y) / 2;
          return (
            <g key={b.id} className="animate-draw-in" style={{ transition: "all 0.6s ease" }}>
              <line
                x1={`${pa.x * 100}%`}
                y1={`${pa.y * 100}%`}
                x2={`${pc.x * 100}%`}
                y2={`${pc.y * 100}%`}
                stroke={meta.stroke}
                strokeWidth={2}
                strokeDasharray={meta.dash}
                strokeLinecap="round"
                opacity={assembled ? 0.55 : 0.75}
                style={{ transition: "all 0.6s ease" }}
              />
              {!assembled && (
                <foreignObject x={`${mx * 100 - 6}%`} y={`${my * 100 - 2}%`} width="12%" height="4%">
                  <div className="flex justify-center">
                    <span
                      className="whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white"
                      style={{ backgroundColor: meta.color }}
                    >
                      {t(meta.shortKey)}
                    </span>
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}
      </svg>

      {/* center name label (the elephant) */}
      {assembled && mainCluster && showCenterName && (
        <div
          className="pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
          style={{ left: "50%", top: "52%" }}
        >
          <div className="animate-fade-up rounded-2xl border border-accent/30 bg-paper-card/95 px-5 py-3 text-center shadow-lift backdrop-blur">
            <div className="text-[10px] font-medium uppercase tracking-wide text-accent">🐘</div>
            <div className="mt-0.5 max-w-[200px] text-balance text-base font-semibold leading-tight text-ink">
              {clusterName || "…"}
            </div>
            <div className="mt-1 text-[10px] text-ink-faint">
              {mainCluster.fragmentIds.length} {t("assemble.fromCount")} ·{" "}
              {mainCluster.bridgeIds.length} {t("assemble.bridgesCount")}
            </div>
          </div>
        </div>
      )}

      {/* fragment cards */}
      {fragments.map((f) => {
        const p = posOf(f);
        return (
          <FragmentCard
            key={f.id}
            f={f}
            x={p.x}
            y={p.y}
            dimmed={assembled && !inMain(f.id)}
            animated={assembled}
            dragging={dragId === f.id}
            onPointerDown={onPointerDown(f.id)}
          />
        );
      })}

      {fragments.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-faint">
          {t("canvas.empty")}
        </div>
      )}
    </div>
  );
}

function FragmentCard({
  f,
  x,
  y,
  dimmed,
  animated,
  dragging,
  onPointerDown,
}: {
  f: Fragment;
  x: number;
  y: number;
  dimmed: boolean;
  animated: boolean;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        transition: animated ? "left 0.6s ease, top 0.6s ease, opacity 0.4s ease" : undefined,
      }}
      className={[
        "absolute w-36 -translate-x-1/2 -translate-y-1/2 touch-none select-none rounded-xl border bg-paper-card p-3 shadow-card sm:w-40",
        dragging ? "z-20 cursor-grabbing border-ink/30 shadow-lift" : "border-line",
        animated ? "" : "cursor-grab hover:shadow-lift",
        dimmed ? "opacity-40" : "opacity-100",
      ].join(" ")}
    >
      <div className="text-[13px] font-semibold leading-snug text-ink">{f.title}</div>
      <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink-soft">{f.body}</div>
      <div className="mt-2 truncate text-[10px] font-medium uppercase tracking-wide text-ink-faint">
        {f.authorName} · {f.authorRole}
      </div>
    </div>
  );
}
