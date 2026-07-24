"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/store";
import { findClusters } from "@/lib/clusters";
import { computeSynthesis } from "@/lib/synthesis";

/**
 * SYNTHESIS SUMMARY — the at-a-glance stat header for the evidence section.
 *
 * Deliberately SLIM: it reads back only the headline numbers (facets / tensions / wholeness)
 * and the keystone callout. The per-side breakdown, the kept tensions, and the loose pieces
 * used to be duplicated here AND in StorySpine — the same three lists twice. StorySpine owns
 * those now (as interactive, inspectable cards); this is the "big numbers" strip that sits
 * above it, the BI headline-metric pattern.
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

  const realFacets = synth.facets.filter((f) => f.fragmentIds.length >= 2);
  const keystone = synth.facets.find((f) => f.id === synth.keystoneFacetId) ?? null;
  const showKeystone = keystone && keystone.fragmentIds.length >= 1 && synth.facets.length > 1;

  return (
    <div className="animate-fade-up rounded-xl2 border border-line bg-paper-card p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13px] font-semibold text-ink">{t("synth.heading")}</div>
        <div className="flex items-center gap-4 text-[11px] text-ink-faint">
          <Stat label={t("synth.facetLabel")} value={`${realFacets.length || synth.facets.length}`} />
          <Stat label={t("synth.tensionLabel")} value={`${synth.coverage.tensionCount}`} />
          <Stat label={t("synth.wholenessLabel")} value={`${pct}%`} accent />
        </div>
      </div>

      {/* keystone callout — the one interpretive line worth keeping up here */}
      {showKeystone && (
        <div className="mt-3 rounded-lg border border-accent/25 bg-accent-soft/40 px-3 py-2">
          <span className="text-[11px] font-semibold text-accent">🗝️ {t("synth.keystoneIntro")}</span>{" "}
          <span className="text-[12px] font-medium text-ink">“{titleOf(keystone!.anchorId)}”</span>
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
