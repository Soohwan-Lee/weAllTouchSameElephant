"use client";

import { useRef, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/store";
import { RELATION_META } from "@/lib/relation";
import type { Fragment } from "@/lib/types";

/**
 * The "table": fragment cards positioned on a board, with confirmed bridges
 * drawn as lines between them. Cards are draggable so the team can arrange
 * the emerging shape themselves.
 */
export function PuzzleCanvas() {
  const { t } = useI18n();
  const fragments = useSession((s) => s.fragments);
  const bridges = useSession((s) => s.bridges);
  const moveFragment = useSession((s) => s.moveFragment);

  const boardRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const onPointerDown = (id: string) => (e: React.PointerEvent) => {
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

  return (
    <div
      ref={boardRef}
      onPointerMove={onPointerMove}
      onPointerUp={() => setDragId(null)}
      onPointerLeave={() => setDragId(null)}
      className="table-surface relative h-[460px] w-full overflow-hidden rounded-xl2 border border-line sm:h-[540px]"
    >
      {/* bridge lines */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        {bridges.map((b) => {
          const a = byId(b.fragmentAId);
          const c = byId(b.fragmentBId);
          if (!a || !c) return null;
          const meta = RELATION_META[b.relationType];
          const mx = (a.x + c.x) / 2;
          const my = (a.y + c.y) / 2;
          return (
            <g key={b.id} className="animate-draw-in">
              <line
                x1={`${a.x * 100}%`}
                y1={`${a.y * 100}%`}
                x2={`${c.x * 100}%`}
                y2={`${c.y * 100}%`}
                stroke={meta.stroke}
                strokeWidth={2}
                strokeDasharray={meta.dash}
                strokeLinecap="round"
                opacity={0.75}
              />
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
            </g>
          );
        })}
      </svg>

      {/* fragment cards */}
      {fragments.map((f) => (
        <FragmentCard
          key={f.id}
          f={f}
          dragging={dragId === f.id}
          onPointerDown={onPointerDown(f.id)}
        />
      ))}

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
  dragging,
  onPointerDown,
}: {
  f: Fragment;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%` }}
      className={[
        "absolute w-40 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none select-none rounded-xl border bg-paper-card p-3 shadow-card transition-shadow sm:w-44",
        dragging ? "z-20 cursor-grabbing border-ink/30 shadow-lift" : "border-line hover:shadow-lift",
      ].join(" ")}
    >
      <div className="text-[13px] font-semibold leading-snug text-ink">{f.title}</div>
      <div className="mt-1 line-clamp-3 text-[11px] leading-snug text-ink-soft">{f.body}</div>
      <div className="mt-2 truncate text-[10px] font-medium uppercase tracking-wide text-ink-faint">
        {f.authorName} · {f.authorRole}
      </div>
    </div>
  );
}
