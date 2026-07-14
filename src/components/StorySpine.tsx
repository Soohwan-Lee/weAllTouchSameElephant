"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/store";
import { RELATION_META } from "@/lib/relation";
import { findClusters } from "@/lib/clusters";
import { computeSynthesis, type Facet, type Synthesis } from "@/lib/synthesis";
import type { Bridge, Fragment } from "@/lib/types";

/**
 * STORY SPINE — the narrative-first reading of the assembled elephant.
 *
 * The old canvas read as "blobs on strings": pretty, but you couldn't actually READ
 * what the team assembled. This makes the causal story the primary artifact — each side
 * is a card in a left→right root→symptom flow, and tapping a card opens the evidence
 * (its pieces + WHY they connect, straight from the confirmed bridges). The visual map
 * stays below as support, but the story is what you read.
 *
 * Grounded in: WATSE 4.6 spine (root→symptom chains) · Kolko synthesis (one readable
 * shape) · the v5 rule that the map reflects what PEOPLE built (every line is a
 * confirmed bridge, shown with its own evidence — nothing is an AI verdict).
 */
export function StorySpine() {
  const { t } = useI18n();
  const fragments = useSession((s) => s.fragments);
  const bridges = useSession((s) => s.bridges);
  const setStep = useSession((s) => s.setStep);

  const clusters = useMemo(() => findClusters(fragments, bridges, 3), [fragments, bridges]);
  const main = clusters[0];
  const synth = useMemo(
    () => (main ? computeSynthesis(fragments, bridges, main) : null),
    [fragments, bridges, main]
  );
  const [openId, setOpenId] = useState<string | null>(null);

  if (!main || !synth) return null;

  const byId = (id: string) => fragments.find((f) => f.id === id);
  const titleOf = (id: string) => byId(id)?.title ?? "?";

  // order facets root→symptom by depth, then by how many they drive
  const ordered = [...synth.facets].sort(
    (a, b) => a.depth - b.depth || b.supports - a.supports
  );
  const singleFacet = synth.facets.length <= 1;

  return (
    <div className="animate-fade-up rounded-xl2 border border-line bg-paper-card p-5 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{t("story.heading")}</h3>
      </div>
      <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-ink-faint">{t("story.sub")}</p>

      {singleFacet ? (
        <div className="mt-4 rounded-lg border border-dashed border-line bg-paper-sunken/40 px-4 py-3 text-[12px] leading-relaxed text-ink-soft">
          {t("story.singleFacet")}
        </div>
      ) : (
        // horizontal root→symptom flow of clickable side-cards
        <div className="mt-4 flex flex-nowrap items-stretch gap-1 overflow-x-auto pb-2">
          {ordered.map((facet, i) => (
            <div key={facet.id} className="flex items-stretch">
              <SideCard
                facet={facet}
                synth={synth}
                isKeystone={facet.id === synth.keystoneFacetId}
                titleOf={titleOf}
                open={openId === facet.id}
                onToggle={() => setOpenId(openId === facet.id ? null : facet.id)}
              />
              {i < ordered.length - 1 && (
                <div className="flex shrink-0 flex-col items-center justify-center px-1 text-ink-faint">
                  <span className="text-lg leading-none">→</span>
                  <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide">
                    {t("story.drives")}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* evidence panel for the open side */}
      {openId && (
        <EvidencePanel
          facet={synth.facets.find((f) => f.id === openId)!}
          synth={synth}
          bridges={bridges}
          byId={byId}
          titleOf={titleOf}
          isKeystone={openId === synth.keystoneFacetId}
          onClose={() => setOpenId(null)}
        />
      )}

      {/* tensions — kept alive */}
      {synth.tensions.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-ink-soft">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: RELATION_META.tension.color }}
            />
            {t("story.tensionHeading")}
          </div>
          <p className="mt-0.5 text-[11px] text-ink-faint">{t("story.tensionHint")}</p>
          <ul className="mt-1.5 space-y-1">
            {synth.tensions.map((tn) => {
              const b = bridges.find((x) => x.id === tn.bridgeId);
              if (!b) return null;
              return (
                <li key={tn.bridgeId} className="text-[12px] text-ink">
                  <span className="font-medium">“{titleOf(b.fragmentAId)}”</span>
                  <span className="mx-1.5 text-ink-faint">↔</span>
                  <span className="font-medium">“{titleOf(b.fragmentBId)}”</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* loose pieces — empty-facet detection: "not yet in the picture" */}
      {synth.looseFragmentIds.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <div className="text-[11px] font-semibold text-ink-soft">⭘ {t("story.looseHeading")}</div>
          <p className="mt-0.5 text-[11px] text-ink-faint">{t("story.looseHint")}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {synth.looseFragmentIds.map((id) => (
              <button
                key={id}
                onClick={() => setStep("connect")}
                className="rounded-full border border-dashed border-line bg-paper-sunken/50 px-2.5 py-1 text-[11px] text-ink-soft transition hover:border-accent/50 hover:text-accent"
              >
                {titleOf(id)} →
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** One "side of the elephant" as a card in the root→symptom flow. */
function SideCard({
  facet,
  synth,
  isKeystone,
  titleOf,
  open,
  onToggle,
}: {
  facet: Facet;
  synth: Synthesis;
  isKeystone: boolean;
  titleOf: (id: string) => string;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const badge = isKeystone
    ? t("story.rootBadge")
    : facet.depth >= synth.maxDepth && synth.maxDepth > 0
    ? t("story.symptomBadge")
    : t("story.middleBadge");
  return (
    <button
      onClick={onToggle}
      className={[
        "flex w-40 shrink-0 flex-col rounded-xl border p-3 text-left transition",
        open ? "ring-2 ring-accent/40" : "",
        isKeystone
          ? "border-accent/50 bg-accent-soft/40 shadow-card"
          : "border-line bg-paper-sunken/40 hover:border-ink/25 hover:shadow-card",
      ].join(" ")}
    >
      <span
        className={[
          "mb-1 inline-flex w-fit items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
          isKeystone ? "bg-accent/15 text-accent" : "bg-ink/5 text-ink-faint",
        ].join(" ")}
      >
        {isKeystone && "🌱"} {badge}
      </span>
      <span className="text-[13px] font-semibold leading-snug text-ink">
        {titleOf(facet.anchorId)}
      </span>
      <span className="mt-1.5 text-[10px] text-ink-faint">
        {facet.fragmentIds.length} {facet.fragmentIds.length === 1 ? t("synth.pieceOne") : t("synth.piecesMany")}
        {" · "}
        {t("story.tapHint")}
      </span>
    </button>
  );
}

/**
 * The evidence panel — the requested "per-piece grounding": the side's pieces in full,
 * plus WHY they connect, taken straight from the confirmed bridge explanations. This is
 * what makes the assembly inspectable rather than an opaque claim.
 */
function EvidencePanel({
  facet,
  synth,
  bridges,
  byId,
  titleOf,
  isKeystone,
  onClose,
}: {
  facet: Facet;
  synth: Synthesis;
  bridges: Bridge[];
  byId: (id: string) => Fragment | undefined;
  titleOf: (id: string) => string;
  isKeystone: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const memberSet = new Set(facet.fragmentIds);
  // bridges whose BOTH ends live inside this side — the reasons these pieces fused
  const withinBridges = bridges.filter(
    (b) => memberSet.has(b.fragmentAId) && memberSet.has(b.fragmentBId)
  );

  return (
    <div className="animate-fade-up mt-3 rounded-xl border border-accent/25 bg-accent-soft/25 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13px] font-semibold text-ink">
          {isKeystone && "🌱 "}“{titleOf(facet.anchorId)}”
        </div>
        <button onClick={onClose} className="text-[11px] font-medium text-ink-faint hover:text-ink">
          ✕ {t("story.close")}
        </button>
      </div>

      {isKeystone && (
        <p className="mt-1 text-[11px] italic leading-relaxed text-accent">{t("story.rootWhy")}</p>
      )}

      {/* the pieces on this side, in full */}
      <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
        {t("story.piecesInSide")}
      </div>
      <div className="mt-1.5 space-y-1.5">
        {facet.fragmentIds.map((id) => {
          const f = byId(id);
          if (!f) return null;
          return (
            <div
              key={id}
              className="rounded-lg border border-line bg-paper-card px-3 py-2"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-[12px] font-semibold text-ink">{f.title}</span>
                <span className="text-[10px] uppercase tracking-wide text-ink-faint">
                  {f.authorName} · {f.authorRole}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">{f.body}</p>
            </div>
          );
        })}
      </div>

      {/* why these connect — the confirmed bridge reasons */}
      {withinBridges.length > 0 && (
        <>
          <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            {t("story.whyConnect")}
          </div>
          <ul className="mt-1.5 space-y-1.5">
            {withinBridges.map((b) => {
              const meta = RELATION_META[b.relationType];
              return (
                <li key={b.id} className="flex items-start gap-2 text-[11px] leading-relaxed">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: meta.color }}
                    aria-hidden
                  />
                  <span className="text-ink-soft">
                    <span className="font-medium text-ink">“{titleOf(b.fragmentAId)}”</span>
                    <span className="mx-1 text-ink-faint">{t(meta.shortKey)}</span>
                    <span className="font-medium text-ink">“{titleOf(b.fragmentBId)}”</span>
                    {b.explanation ? (
                      <span className="mt-0.5 block text-ink-soft">{b.explanation}</span>
                    ) : (
                      <span className="mt-0.5 block italic text-ink-faint">{t("story.noReason")}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
