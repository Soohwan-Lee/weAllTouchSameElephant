"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/store";
import { RELATION_META } from "@/lib/relation";
import { findClusters } from "@/lib/clusters";
import { computeSynthesis, type Facet } from "@/lib/synthesis";
import type { Fragment } from "@/lib/types";

/**
 * SYNTHESIS CANVAS — the assembled elephant, as one organic map.
 *
 * Each facet (a "side of the elephant") is wrapped in a soft blob so it reads as one
 * body, not scattered cards. Blobs flow left→right along the causal spine (root → symptom),
 * joined by curved dependency streams. The ROOT gets real visual weight — it's the source
 * the rest grow from, even when it's small.
 *
 * Grounded in: Cronin & Weingart (integrate, keep differences) · Kolko (forge a bigger
 * picture) · WATSE v5 Puzzle Table (people assemble; the map reflects what they built).
 */

const BOARD_W = 1120;
const BOARD_H = 680;

// facet accent palette (the "sides") — the root uses the app accent (teal).
const FACET_COLORS = ["#2f6f6b", "#6b6ba8", "#9a8248", "#4f8a8b", "#8a5a72", "#5a7a8a"];

export function SynthesisCanvas() {
  const { t } = useI18n();
  const fragments = useSession((s) => s.fragments);
  const bridges = useSession((s) => s.bridges);

  const clusters = useMemo(() => findClusters(fragments, bridges, 3), [fragments, bridges]);
  const main = clusters[0];
  const synth = useMemo(
    () => (main ? computeSynthesis(fragments, bridges, main) : null),
    [fragments, bridges, main]
  );
  const byId = (id: string) => fragments.find((f) => f.id === id);

  // Layout in board pixel space (viewBox) so blobs and curves are easy to compute.
  const layout = useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>();
    const facetCenter = new Map<string, { x: number; y: number; r: number; color: string }>();
    if (!synth || !main) return { pos, facetCenter };

    // group facets into columns by depth (root pressures left → symptoms right)
    const cols = new Map<number, Facet[]>();
    synth.facets.forEach((f) => {
      if (!cols.has(f.depth)) cols.set(f.depth, []);
      cols.get(f.depth)!.push(f);
    });
    const depths = [...cols.keys()].sort((a, b) => a - b);
    const nCols = Math.max(1, depths.length);
    // pad enough that a big facet's ring never crosses the board edge
    const padX = 210;
    const usableW = BOARD_W - padX * 2;

    // assign a stable color per facet (root = teal/accent)
    const colorOf = new Map<string, string>();
    let ci2 = 1;
    synth.facets.forEach((f) => {
      colorOf.set(f.id, f.id === synth.keystoneFacetId ? FACET_COLORS[0] : FACET_COLORS[ci2++ % FACET_COLORS.length || 1]);
    });

    // a card is ~150px wide / ~120px tall in board space; keep members from overlapping
    const CARD_W = 158;
    const CARD_H = 124;
    depths.forEach((depth, ci) => {
      const here = cols.get(depth)!;
      const cx = nCols === 1 ? BOARD_W / 2 : padX + (ci / (nCols - 1)) * usableW;
      const nRows = here.length;
      here.forEach((facet, ri) => {
        const cy = nRows === 1 ? BOARD_H / 2 : (BOARD_H * (ri + 1)) / (nRows + 1);
        const n = facet.fragmentIds.length;
        // ring radius must be big enough that n cards don't collide: chord ≈ 2·rr·sin(π/n) ≥ card
        const minChord = Math.max(CARD_W, CARD_H) * 0.92;
        const ringR = n <= 1 ? 0 : Math.max(70, minChord / (2 * Math.sin(Math.PI / n)));
        // blob radius wraps the ring + half a card
        const r = (n <= 1 ? 64 : ringR + CARD_H * 0.5) + (facet.id === synth.keystoneFacetId ? 10 : 0);
        facetCenter.set(facet.id, { x: cx, y: cy, r, color: colorOf.get(facet.id)! });

        const clampX = (x: number) => Math.min(BOARD_W - 90, Math.max(90, x));
        const clampY = (y: number) => Math.min(BOARD_H - 70, Math.max(70, y));
        facet.fragmentIds.forEach((id, mi) => {
          if (n === 1) {
            pos.set(id, { x: clampX(cx), y: clampY(cy) });
          } else {
            const a = (mi / n) * Math.PI * 2 - Math.PI / 2;
            pos.set(id, {
              x: clampX(cx + Math.cos(a) * ringR),
              y: clampY(cy + Math.sin(a) * ringR),
            });
          }
        });
      });
    });
    return { pos, facetCenter };
  }, [synth, main]);

  if (!main || !synth) return null;

  const { pos, facetCenter } = layout;
  const posOf = (id: string) => pos.get(id) ?? { x: BOARD_W / 2, y: BOARD_H / 2 };
  const hasFlow = synth.flow.length > 0;
  const facetOf = (id: string) => synth.facets.find((f) => f.fragmentIds.includes(id));

  // curved stream between two facet centers (root → symptom)
  const flowPath = (from: string, to: string) => {
    const a = facetCenter.get(from);
    const b = facetCenter.get(to);
    if (!a || !b) return null;
    const mx = (a.x + b.x) / 2;
    return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
  };

  return (
    <div className="table-surface relative w-full overflow-hidden rounded-xl2 border border-line">
      <svg
        viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
        className="block h-auto w-full"
        style={{ aspectRatio: `${BOARD_W} / ${BOARD_H}` }}
      >
        <defs>
          <filter id="blob-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
          <marker id="synth-arrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#6b6ba8" opacity="0.85" />
          </marker>
        </defs>

        {/* 1. curved dependency streams UNDER everything (root → symptom) */}
        {synth.flow.map((fl, i) => {
          const d = flowPath(fl.from, fl.to);
          if (!d) return null;
          return (
            <g key={`flow_${i}`}>
              <path
                d={d}
                fill="none"
                stroke="#6b6ba8"
                strokeWidth={7}
                strokeOpacity={0.14}
                strokeLinecap="round"
                className="animate-draw-in"
              />
              <path
                d={d}
                fill="none"
                stroke="#6b6ba8"
                strokeWidth={2}
                strokeOpacity={0.5}
                strokeLinecap="round"
                markerEnd="url(#synth-arrow)"
                className="animate-draw-in"
              />
            </g>
          );
        })}

        {/* 2. facet blobs — each side as one soft body */}
        {synth.facets.map((facet) => {
          const c = facetCenter.get(facet.id);
          if (!c) return null;
          const isRoot = facet.id === synth.keystoneFacetId;
          const members = facet.fragmentIds;
          // build a soft blob from overlapping circles at each member point (metaball-ish)
          const circles =
            members.length === 1
              ? [{ x: c.x, y: c.y, r: c.r * 0.85 }]
              : members.map((id) => {
                  const p = posOf(id);
                  return { x: p.x, y: p.y, r: 84 };
                });
          return (
            <g key={`blob_${facet.id}`} className="animate-draw-in">
              {/* soft body — a clearly visible tinted "side" */}
              <g filter="url(#blob-soft)">
                {/* connective tissue first (fat rounded links between members) */}
                {circles.length > 1 &&
                  circles.map((ci, k) => {
                    const next = circles[(k + 1) % circles.length];
                    return (
                      <line
                        key={`hull_${k}`}
                        x1={ci.x}
                        y1={ci.y}
                        x2={next.x}
                        y2={next.y}
                        stroke={c.color}
                        strokeWidth={c.r * 0.7}
                        strokeOpacity={isRoot ? 0.3 : 0.2}
                        strokeLinecap="round"
                      />
                    );
                  })}
                {circles.map((ci, k) => (
                  <circle
                    key={k}
                    cx={ci.x}
                    cy={ci.y}
                    r={ci.r}
                    fill={c.color}
                    opacity={isRoot ? 0.32 : 0.22}
                  />
                ))}
              </g>
            </g>
          );
        })}

        {/* 3. within-facet fusing links (faint, hold each side together) */}
        {bridges.map((b) => {
          if (!pos.has(b.fragmentAId) || !pos.has(b.fragmentBId)) return null;
          const fa = facetOf(b.fragmentAId);
          const fb = facetOf(b.fragmentBId);
          const sameFacet = fa && fb && fa.id === fb.id;
          if (!sameFacet && b.relationType !== "tension") return null; // cross-facet deps shown as streams
          const pa = posOf(b.fragmentAId);
          const pc = posOf(b.fragmentBId);
          const meta = RELATION_META[b.relationType];
          const tension = b.relationType === "tension";
          return (
            <line
              key={b.id}
              x1={pa.x}
              y1={pa.y}
              x2={pc.x}
              y2={pc.y}
              stroke={meta.stroke}
              strokeWidth={tension ? 2 : 1.4}
              strokeDasharray={tension ? "7 5" : undefined}
              strokeOpacity={tension ? 0.75 : 0.3}
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* column labels */}
      {hasFlow && (
        <>
          <div className="pointer-events-none absolute left-4 top-3 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
            ← {t("synth.roots")}
          </div>
          <div className="pointer-events-none absolute right-4 top-3 text-right text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
            {t("synth.symptoms")} →
          </div>
        </>
      )}

      {/* fragment cards — absolutely positioned over the SVG in % space */}
      {main.fragmentIds.map((id) => {
        const f = byId(id);
        const p = posOf(id);
        if (!f) return null;
        const facet = facetOf(id);
        const isAnchor = facet?.anchorId === id;
        const inRoot = !!facet && facet.id === synth.keystoneFacetId;
        return (
          <SynthCard
            key={id}
            f={f}
            xPct={(p.x / BOARD_W) * 100}
            yPct={(p.y / BOARD_H) * 100}
            isAnchor={isAnchor}
            inRoot={inRoot}
            rootLabel={t("synth.keystone")}
          />
        );
      })}

      {!hasFlow && synth.facets.length > 1 && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 max-w-md -translate-x-1/2 rounded-lg bg-paper-card/90 px-3 py-2 text-center text-[11px] text-ink-faint shadow-card backdrop-blur">
          {t("synth.noFlow")}
        </div>
      )}
    </div>
  );
}

function SynthCard({
  f,
  xPct,
  yPct,
  isAnchor,
  inRoot,
  rootLabel,
}: {
  f: Fragment;
  xPct: number;
  yPct: number;
  isAnchor: boolean;
  inRoot: boolean;
  rootLabel: string;
}) {
  return (
    <div
      style={{ left: `${xPct}%`, top: `${yPct}%`, transition: "left 0.6s ease, top 0.6s ease" }}
      className={[
        "absolute w-32 -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-paper-card/95 p-2.5 backdrop-blur-sm sm:w-36",
        inRoot && isAnchor
          ? "z-10 border-accent/60 shadow-lift ring-2 ring-accent/25"
          : inRoot
          ? "z-[9] border-accent/30 shadow-card"
          : "border-line shadow-card",
      ].join(" ")}
    >
      {inRoot && isAnchor && (
        <div className="mb-1 -mt-0.5 flex items-center gap-1 text-[9.5px] font-semibold leading-tight text-accent">
          🌱 {rootLabel}
        </div>
      )}
      <div className="text-[12px] font-semibold leading-snug text-ink">{f.title}</div>
      <div className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-ink-soft">{f.body}</div>
      <div className="mt-1 truncate text-[9.5px] font-medium uppercase tracking-wide text-ink-faint">
        {f.authorRole}
      </div>
    </div>
  );
}
