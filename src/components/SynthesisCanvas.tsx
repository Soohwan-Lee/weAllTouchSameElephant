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
 * The unit here is the SIDE, not the card. Each facet is a soft, named body (a blob with
 * its own label); the member cards sit INSIDE it as small chips, so the eye reads "one
 * side called X" before it reads individual pieces. Sides flow left→right along the causal
 * spine (root → symptom) as thick rivers, not thin strings. The ROOT gets real visual
 * weight — the source the rest grow from, even when it holds few pieces.
 *
 * Design intent (author feedback): stop looking like "a few cards on strings." Cards were
 * carrying too much text; the picture read as a node-link diagram. Now the cards are quiet
 * chips and the tinted, labelled bodies + flowing rivers carry the "we assembled one thing"
 * payoff.
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
    const facetCenter = new Map<
      string,
      { x: number; y: number; r: number; color: string; labelY: number }
    >();
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
      colorOf.set(
        f.id,
        f.id === synth.keystoneFacetId ? FACET_COLORS[0] : FACET_COLORS[ci2++ % FACET_COLORS.length || 1]
      );
    });

    // a chip is ~132px wide / ~52px tall in board space; keep members from overlapping
    const CHIP_W = 132;
    const CHIP_H = 58;
    // leave a band at the top for the side labels so they never clip the board edge
    const TOP_BAND = 54;
    depths.forEach((depth, ci) => {
      const here = cols.get(depth)!;
      const cx = nCols === 1 ? BOARD_W / 2 : padX + (ci / (nCols - 1)) * usableW;
      const nRows = here.length;
      here.forEach((facet, ri) => {
        const n = facet.fragmentIds.length;
        // ring radius must be big enough that n chips don't collide (chips are wide, short)
        const minChord = CHIP_W * 1.04;
        const ringR = n <= 1 ? 0 : Math.max(62, minChord / (2 * Math.sin(Math.PI / n)));
        // blob radius wraps the ring + half a chip
        const r = (n <= 1 ? 70 : ringR + CHIP_H * 0.9) + (facet.id === synth.keystoneFacetId ? 12 : 0);
        // spread rows inside the usable height, but keep each blob + its label on-board
        const usableTop = TOP_BAND + r;
        const usableBot = BOARD_H - r - 24;
        const cy =
          nRows === 1
            ? Math.max(usableTop, Math.min(usableBot, BOARD_H / 2))
            : usableTop + ((usableBot - usableTop) * ri) / (nRows - 1);
        const labelY = Math.max(22, cy - r - 6); // the side's name sits just above the body

        const clampX = (x: number) => Math.min(BOARD_W - 78, Math.max(78, x));
        const clampY = (y: number) => Math.min(BOARD_H - 46, Math.max(56, y));
        facetCenter.set(facet.id, { x: cx, y: cy, r, color: colorOf.get(facet.id)!, labelY });

        facet.fragmentIds.forEach((id, mi) => {
          if (n === 1) {
            pos.set(id, { x: clampX(cx), y: clampY(cy) });
          } else {
            const a = (mi / n) * Math.PI * 2 - Math.PI / 2;
            pos.set(id, {
              x: clampX(cx + Math.cos(a) * ringR),
              y: clampY(cy + Math.sin(a) * ringR * 0.9),
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
  const anchorTitle = (facet: Facet) => byId(facet.anchorId)?.title ?? "";

  // a flowing river between two facet centers (root → symptom), entering/leaving edges
  const flowPath = (from: string, to: string) => {
    const a = facetCenter.get(from);
    const b = facetCenter.get(to);
    if (!a || !b) return null;
    // start/end at the blob rims, not centers, so the river connects bodies not points
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    // if the two bodies already overlap (or nearly touch), the connection is implied by
    // the touching blobs — a tiny river stub would just look like a floating dash.
    if (dist < a.r * 0.82 + b.r * 0.82 + 80) return null;
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const ax = a.x + Math.cos(ang) * (a.r * 0.82);
    const ay = a.y + Math.sin(ang) * (a.r * 0.82);
    const bx = b.x - Math.cos(ang) * (b.r * 0.82);
    const by = b.y - Math.sin(ang) * (b.r * 0.82);
    const mx = (ax + bx) / 2;
    return { d: `M ${ax} ${ay} C ${mx} ${ay}, ${mx} ${by}, ${bx} ${by}`, from: a, to: b };
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
            <feGaussianBlur stdDeviation="12" />
          </filter>
          {/* per-side radial gradient so each body has depth, brighter core → soft edge */}
          {synth.facets.map((f) => {
            const c = facetCenter.get(f.id);
            if (!c) return null;
            const isRoot = f.id === synth.keystoneFacetId;
            return (
              <radialGradient key={`g_${f.id}`} id={`side_${f.id}`} cx="50%" cy="45%" r="65%">
                <stop offset="0%" stopColor={c.color} stopOpacity={isRoot ? 0.42 : 0.3} />
                <stop offset="100%" stopColor={c.color} stopOpacity={isRoot ? 0.16 : 0.1} />
              </radialGradient>
            );
          })}
          {/* river gradients: colored by the upstream side, fading downstream */}
          {synth.flow.map((fl, i) => {
            const a = facetCenter.get(fl.from);
            const b = facetCenter.get(fl.to);
            if (!a || !b) return null;
            return (
              <linearGradient
                key={`rg_${i}`}
                id={`river_${i}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor={a.color} stopOpacity="0.55" />
                <stop offset="100%" stopColor={b.color} stopOpacity="0.28" />
              </linearGradient>
            );
          })}
        </defs>

        {/* 1. rivers UNDER everything (root → symptom), colored by source side */}
        {synth.flow.map((fl, i) => {
          const p = flowPath(fl.from, fl.to);
          if (!p) return null;
          return (
            <path
              key={`flow_${i}`}
              d={p.d}
              fill="none"
              stroke={`url(#river_${i})`}
              strokeWidth={14}
              strokeLinecap="round"
              className="animate-draw-in"
            />
          );
        })}

        {/* 2. facet blobs — each side as one soft, named body */}
        {synth.facets.map((facet) => {
          const c = facetCenter.get(facet.id);
          if (!c) return null;
          const isRoot = facet.id === synth.keystoneFacetId;
          const members = facet.fragmentIds;
          // build a soft blob from overlapping circles at each member point (metaball-ish)
          const circles =
            members.length === 1
              ? [{ x: c.x, y: c.y, r: c.r * 0.9 }]
              : members.map((id) => {
                  const p = posOf(id);
                  return { x: p.x, y: p.y, r: 92 };
                });
          return (
            <g key={`blob_${facet.id}`} className="animate-draw-in">
              <g filter="url(#blob-soft)">
                {/* connective tissue: fat rounded links between members */}
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
                        stroke={`url(#side_${facet.id})`}
                        strokeWidth={c.r * 0.85}
                        strokeLinecap="round"
                      />
                    );
                  })}
                {circles.map((ci, k) => (
                  <circle key={k} cx={ci.x} cy={ci.y} r={ci.r} fill={`url(#side_${facet.id})`} />
                ))}
              </g>
              {/* crisp rim so the body has an edge, not just a smudge */}
              {members.length === 1 && (
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={c.r * 0.9}
                  fill="none"
                  stroke={c.color}
                  strokeOpacity={isRoot ? 0.34 : 0.2}
                  strokeWidth={isRoot ? 2 : 1.25}
                />
              )}
            </g>
          );
        })}

        {/* 3. tensions across the map (kept alive — dashed) */}
        {bridges.map((b) => {
          if (b.relationType !== "tension") return null;
          if (!pos.has(b.fragmentAId) || !pos.has(b.fragmentBId)) return null;
          const pa = posOf(b.fragmentAId);
          const pc = posOf(b.fragmentBId);
          return (
            <line
              key={b.id}
              x1={pa.x}
              y1={pa.y}
              x2={pc.x}
              y2={pc.y}
              stroke={RELATION_META.tension.stroke}
              strokeWidth={2}
              strokeDasharray="7 5"
              strokeOpacity={0.7}
              strokeLinecap="round"
            />
          );
        })}

        {/* 4. side labels — the blob's NAME, so the body is the unit, not the cards */}
        {synth.facets.map((facet) => {
          const c = facetCenter.get(facet.id);
          if (!c) return null;
          const isRoot = facet.id === synth.keystoneFacetId;
          const label = anchorTitle(facet);
          if (!label) return null;
          return (
            <text
              key={`lbl_${facet.id}`}
              x={c.x}
              y={c.labelY}
              textAnchor="middle"
              className="animate-draw-in"
              style={{
                fontSize: isRoot ? 19 : 16,
                fontWeight: 700,
                fill: c.color,
                letterSpacing: "-0.01em",
                paintOrder: "stroke",
                stroke: "#fbfbfa",
                strokeWidth: 4,
              }}
            >
              {isRoot ? `🌱 ${label}` : label}
            </text>
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

      {/* member chips — quiet, title-only; the body/label carries the meaning */}
      {main.fragmentIds.map((id) => {
        const f = byId(id);
        const p = posOf(id);
        if (!f) return null;
        const facet = facetOf(id);
        const isAnchor = facet?.anchorId === id;
        const inRoot = !!facet && facet.id === synth.keystoneFacetId;
        return (
          <SynthChip
            key={id}
            f={f}
            xPct={(p.x / BOARD_W) * 100}
            yPct={(p.y / BOARD_H) * 100}
            isAnchor={isAnchor}
            inRoot={inRoot}
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

/**
 * A member chip — deliberately quiet. Title only + a small role dot on hover-title.
 * The old card showed title + 2 lines of body + role, which made the map read like a
 * node-link diagram of busy cards. The full text still lives in the assembly view and
 * the summary; here the chip just marks "this piece belongs to this side."
 */
function SynthChip({
  f,
  xPct,
  yPct,
  isAnchor,
  inRoot,
}: {
  f: Fragment;
  xPct: number;
  yPct: number;
  isAnchor: boolean;
  inRoot: boolean;
}) {
  return (
    <div
      title={`${f.title} — ${f.body} · ${f.authorRole}`}
      style={{ left: `${xPct}%`, top: `${yPct}%`, transition: "left 0.6s ease, top 0.6s ease" }}
      className={[
        "absolute flex max-w-[9rem] -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border bg-paper-card/95 px-2.5 py-1.5 backdrop-blur-sm",
        inRoot && isAnchor
          ? "z-10 border-accent/60 shadow-lift ring-2 ring-accent/20"
          : inRoot
          ? "z-[9] border-accent/30 shadow-card"
          : "border-line shadow-card",
      ].join(" ")}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: inRoot ? "#2f6f6b" : "#a1a1aa" }}
        aria-hidden
      />
      <span className="truncate text-[11px] font-semibold leading-tight text-ink">{f.title}</span>
    </div>
  );
}
