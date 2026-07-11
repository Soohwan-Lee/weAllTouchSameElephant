"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/store";
import { RELATION_META } from "@/lib/relation";
import { findClusters } from "@/lib/clusters";
import { computeSynthesis, type Facet } from "@/lib/synthesis";
import type { Fragment } from "@/lib/types";

/**
 * SYNTHESIS CANVAS — the assembled elephant.
 *
 * Instead of "one node crowned the bottleneck," this shows the SHAPE the pieces make:
 * pieces fuse into facets (sides of the elephant), the facets are arranged root→symptom
 * along the dependency spine, live tensions stay visible as their own strand, and the
 * keystone facet (the one most others rest on) gets a gentle halo — a starting point to
 * argue with, not a verdict.
 *
 * Grounded in: Cronin & Weingart (integrate differences, keep them) · Kolko (forge
 * connections into a bigger picture) · WATSE v5 Puzzle Table (assemble, then mirror).
 */
export function SynthesisCanvas() {
  const { t } = useI18n();
  const fragments = useSession((s) => s.fragments);
  const bridges = useSession((s) => s.bridges);

  const clusters = useMemo(() => findClusters(fragments, bridges, 3), [fragments, bridges]);
  const main = clusters[0];

  const synth = useMemo(() => {
    if (!main) return null;
    return computeSynthesis(fragments, bridges, main);
  }, [fragments, bridges, main]);

  const byId = (id: string) => fragments.find((f) => f.id === id);

  // Lay out facets as columns by depth (root pressures left → symptoms right).
  // Within a column, stack facets; within a facet, cluster its pieces tightly so
  // they visibly read as "one side."
  const layout = useMemo(() => {
    const posByFragment = new Map<string, { x: number; y: number }>();
    const facetBox = new Map<
      string,
      { x: number; y: number; w: number; h: number }
    >();
    if (!synth || !main) return { posByFragment, facetBox };

    const cols = new Map<number, Facet[]>();
    synth.facets.forEach((f) => {
      if (!cols.has(f.depth)) cols.set(f.depth, []);
      cols.get(f.depth)!.push(f);
    });
    const depths = [...cols.keys()].sort((a, b) => a - b);
    const nCols = Math.max(1, depths.length);

    depths.forEach((depth, ci) => {
      const facetsHere = cols.get(depth)!;
      const colX = nCols === 1 ? 0.5 : 0.16 + (ci / (nCols - 1)) * 0.68;
      const nRows = facetsHere.length;
      facetsHere.forEach((facet, ri) => {
        const bandY = nRows === 1 ? 0.5 : 0.2 + (ri / (nRows - 1)) * 0.6;
        const members = facet.fragmentIds;
        // arrange a facet's members in a small tight cluster around (colX, bandY)
        const spread = members.length === 1 ? 0 : 0.055;
        members.forEach((id, mi) => {
          const a = members.length === 1 ? 0 : (mi / members.length) * Math.PI * 2;
          const jitterX = members.length === 1 ? 0 : Math.cos(a) * spread;
          const jitterY = members.length === 1 ? 0 : Math.sin(a) * spread * 1.3;
          posByFragment.set(id, {
            x: Math.min(0.93, Math.max(0.07, colX + jitterX)),
            y: Math.min(0.9, Math.max(0.12, bandY + jitterY)),
          });
        });
        facetBox.set(facet.id, {
          x: colX,
          y: bandY,
          w: members.length === 1 ? 0.14 : 0.2,
          h: members.length === 1 ? 0.14 : 0.24,
        });
      });
    });
    return { posByFragment, facetBox };
  }, [synth, main]);

  if (!main || !synth) return null;

  const { posByFragment, facetBox } = layout;
  const posOf = (id: string) => posByFragment.get(id) ?? { x: 0.5, y: 0.5 };
  const hasFlow = synth.flow.length > 0;
  const facetOf = (id: string) => synth.facets.find((f) => f.fragmentIds.includes(id));

  return (
    <div className="table-surface relative h-[480px] w-full overflow-hidden rounded-xl2 border border-line sm:h-[560px]">
      {/* column labels only when there's an actual root→symptom flow */}
      {hasFlow && (
        <>
          <div className="absolute left-4 top-3 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
            ← {t("synth.roots")}
          </div>
          <div className="absolute right-4 top-3 text-right text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
            {t("synth.symptoms")} →
          </div>
        </>
      )}

      {/* facet halos — the "sides of the elephant" */}
      {synth.facets.map((facet) => {
        const box = facetBox.get(facet.id);
        if (!box || facet.fragmentIds.length < 2) return null;
        const isKeystone = facet.id === synth.keystoneFacetId;
        return (
          <div
            key={`halo_${facet.id}`}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-[40%] animate-draw-in"
            style={{
              left: `${box.x * 100}%`,
              top: `${box.y * 100}%`,
              width: `${box.w * 130}%`,
              height: `${box.h * 130}%`,
              background: isKeystone
                ? "radial-gradient(closest-side, rgba(47,111,107,0.16), rgba(47,111,107,0.04) 70%, transparent)"
                : "radial-gradient(closest-side, rgba(120,120,140,0.08), transparent 72%)",
              boxShadow: isKeystone ? "0 0 0 1.5px rgba(47,111,107,0.22)" : undefined,
            }}
          />
        );
      })}

      {/* bridge lines: fusing links draw the facet together; tensions stay dashed & live */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <marker id="synth-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#6b6ba8" />
          </marker>
        </defs>
        {bridges.map((b) => {
          const a = byId(b.fragmentAId);
          const c = byId(b.fragmentBId);
          if (!a || !c) return null;
          const pa = posOf(a.id);
          const pc = posOf(c.id);
          if (!posByFragment.has(a.id) || !posByFragment.has(c.id)) return null;
          const meta = RELATION_META[b.relationType];
          const directed = b.relationType === "dependency";
          const tension = b.relationType === "tension";
          return (
            <line
              key={b.id}
              x1={`${pa.x * 100}%`}
              y1={`${pa.y * 100}%`}
              x2={`${pc.x * 100}%`}
              y2={`${pc.y * 100}%`}
              stroke={meta.stroke}
              strokeWidth={directed ? 2.2 : tension ? 1.8 : 1.4}
              strokeDasharray={meta.dash}
              strokeLinecap="round"
              opacity={directed ? 0.65 : tension ? 0.7 : 0.35}
              markerEnd={directed ? "url(#synth-arrow)" : undefined}
            />
          );
        })}
      </svg>

      {/* fragment cards */}
      {main.fragmentIds.map((id) => {
        const f = byId(id);
        const p = posOf(id);
        if (!f) return null;
        const facet = facetOf(id);
        const isAnchor = facet?.anchorId === id;
        const inKeystone = !!facet && facet.id === synth.keystoneFacetId;
        return (
          <SynthCard
            key={id}
            f={f}
            x={p.x}
            y={p.y}
            isAnchor={isAnchor}
            inKeystone={inKeystone}
            keystoneLabel={t("synth.keystone")}
          />
        );
      })}

      {!hasFlow && synth.facets.length > 1 && (
        <div className="absolute bottom-3 left-1/2 max-w-md -translate-x-1/2 rounded-lg bg-paper-card/90 px-3 py-2 text-center text-[11px] text-ink-faint shadow-card backdrop-blur">
          {t("synth.noFlow")}
        </div>
      )}
    </div>
  );
}

function SynthCard({
  f,
  x,
  y,
  isAnchor,
  inKeystone,
  keystoneLabel,
}: {
  f: Fragment;
  x: number;
  y: number;
  isAnchor: boolean;
  inKeystone: boolean;
  keystoneLabel: string;
}) {
  return (
    <div
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, transition: "left 0.6s ease, top 0.6s ease" }}
      className={[
        "absolute w-36 -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-paper-card p-2.5 sm:w-40",
        inKeystone && isAnchor
          ? "z-10 border-accent/50 shadow-lift ring-2 ring-accent/25"
          : inKeystone
          ? "z-[9] border-accent/30 shadow-card"
          : "border-line shadow-card",
      ].join(" ")}
    >
      {inKeystone && isAnchor && (
        <div className="mb-1 -mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-accent">
          🗝️ {keystoneLabel}
        </div>
      )}
      <div className="text-[12.5px] font-semibold leading-snug text-ink">{f.title}</div>
      <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink-soft">{f.body}</div>
      <div className="mt-1.5 truncate text-[10px] font-medium uppercase tracking-wide text-ink-faint">
        {f.authorRole}
      </div>
    </div>
  );
}
