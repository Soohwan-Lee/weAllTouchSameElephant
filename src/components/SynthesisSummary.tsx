"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/store";
import { RELATION_META } from "@/lib/relation";
import { findClusters } from "@/lib/clusters";
import { computeSynthesis, type Facet } from "@/lib/synthesis";
import type { Fragment } from "@/lib/types";

/**
 * SYNTHESIS SUMMARY — the payoff, written in plain language.
 *
 * Reads the assembled shape back to the team: how many facets ("sides of the same thing")
 * the pieces fused into, which side the rest rest on (keystone), which tensions are kept
 * alive rather than resolved away, and what's still floating. This is the "we were all
 * touching the same elephant" beat — grounded in confirmed links, never an AI verdict.
 */
export function SynthesisSummary() {
  const { t } = useI18n();
  const fragments = useSession((s) => s.fragments);
  const bridges = useSession((s) => s.bridges);

  const clusters = useMemo(() => findClusters(fragments, bridges, 3), [fragments, bridges]);
  const main = clusters[0];
  const synth = useMemo(
    () => (main ? computeSynthesis(fragments, bridges, main) : null),
    [fragments, bridges, main]
  );

  if (!main || !synth) return null;

  const byId = (id: string) => fragments.find((f) => f.id === id);
  const titleOf = (id: string) => byId(id)?.title ?? "?";
  const pct = Math.round(synth.coverage.wholeness * 100);

  // facets worth naming as "sides": those that fused ≥2 pieces
  const realFacets = synth.facets.filter((f) => f.fragmentIds.length >= 2);
  const keystone = synth.facets.find((f) => f.id === synth.keystoneFacetId) ?? null;

  return (
    <div className="animate-fade-up space-y-4 rounded-xl2 border border-line bg-paper-card p-5 shadow-card">
      {/* header + at-a-glance stats */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-ink">{t("synth.heading")}</div>
        <div className="flex items-center gap-4 text-[11px] text-ink-faint">
          <Stat label={t("synth.facetLabel")} value={`${realFacets.length || synth.facets.length}`} />
          <Stat label={t("synth.tensionLabel")} value={`${synth.coverage.tensionCount}`} />
          <Stat label={t("synth.wholenessLabel")} value={`${pct}%`} accent />
        </div>
      </div>

      {/* the facets: "these were facets of the same thing" */}
      {realFacets.length > 0 && (
        <div>
          <div className="text-[12px] leading-relaxed text-ink-soft">{t("synth.facetIntro")}</div>
          <div className="mt-2 space-y-2">
            {realFacets.map((facet) => (
              <FacetRow
                key={facet.id}
                facet={facet}
                titleOf={titleOf}
                isKeystone={facet.id === synth.keystoneFacetId}
                anchorTitle={titleOf(facet.anchorId)}
              />
            ))}
          </div>
        </div>
      )}

      {/* keystone callout */}
      {keystone && keystone.fragmentIds.length >= 1 && synth.facets.length > 1 && (
        <div className="rounded-lg border border-accent/25 bg-accent-soft/40 px-3 py-2">
          <span className="text-[11px] font-semibold text-accent">🗝️ {t("synth.keystoneIntro")}</span>{" "}
          <span className="text-[12px] font-medium text-ink">“{titleOf(keystone.anchorId)}”</span>
        </div>
      )}

      {/* live tensions — kept, not resolved */}
      {synth.tensions.length > 0 && (
        <div>
          <div className="text-[12px] leading-relaxed text-ink-soft">{t("synth.tensionIntro")}</div>
          <ul className="mt-1.5 space-y-1">
            {synth.tensions.map((tn) => {
              const b = bridges.find((x) => x.id === tn.bridgeId);
              if (!b) return null;
              return (
                <li key={tn.bridgeId} className="flex items-start gap-2 text-[12px] text-ink">
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: RELATION_META.tension.color }}
                  />
                  <span>
                    <span className="font-medium">“{titleOf(b.fragmentAId)}”</span>{" "}
                    <span className="text-ink-faint">↔</span>{" "}
                    <span className="font-medium">“{titleOf(b.fragmentBId)}”</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* still-loose fragments */}
      {synth.looseFragmentIds.length > 0 && (
        <div>
          <div className="text-[12px] leading-relaxed text-ink-faint">{t("synth.looseIntro")}</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {synth.looseFragmentIds.map((id) => (
              <span
                key={id}
                className="rounded-full border border-dashed border-line bg-paper-sunken/50 px-2.5 py-1 text-[11px] text-ink-soft"
              >
                {titleOf(id)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={accent ? "text-sm font-bold text-accent" : "text-sm font-bold text-ink"}>
        {value}
      </span>
      <span className="uppercase tracking-wide">{label}</span>
    </div>
  );
}

function FacetRow({
  facet,
  titleOf,
  isKeystone,
  anchorTitle,
}: {
  facet: Facet;
  titleOf: (id: string) => string;
  isKeystone: boolean;
  anchorTitle: string;
}) {
  const { t } = useI18n();
  const others = facet.fragmentIds.filter((id) => id !== facet.anchorId);
  return (
    <div
      className={[
        "rounded-lg border px-3 py-2",
        isKeystone ? "border-accent/30 bg-accent-soft/30" : "border-line bg-paper-sunken/30",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold text-ink">“{anchorTitle}”</span>
        <span className="text-[10px] text-ink-faint">
          {facet.fragmentIds.length} {facet.fragmentIds.length === 1 ? t("synth.pieceOne") : t("synth.piecesMany")}
        </span>
      </div>
      {others.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {others.map((id) => (
            <span
              key={id}
              className="rounded-full bg-paper px-2 py-0.5 text-[11px] text-ink-soft ring-1 ring-line"
            >
              {titleOf(id)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
