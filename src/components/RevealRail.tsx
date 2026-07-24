"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

/**
 * A sticky scroll-spy rail for the final "mirror" screen. The reading → question → decision
 * → trade-off → evidence spine is ONE continuous argument, so tabs (which sever it) are the
 * wrong tool; a rail keeps the whole scroll intact while giving it a spine you can see and
 * jump around — the move that kills the "reading a long report" feeling.
 *
 * "Our move" (the decision) is the anchor of record: always emphasized, even when another
 * section is the one currently in view, so the team's decision stays the centre of gravity.
 *
 * Sections are passed in (not hardcoded) because some only exist conditionally — the decision
 * appears once a question exists, the trade-off once a decision is written.
 */
export interface RailSection {
  id: string;
  labelKey: Parameters<ReturnType<typeof useI18n>["t"]>[0];
  emoji: string;
  /** the decision anchor — always visually emphasized */
  anchor?: boolean;
}

export function RevealRail({ sections }: { sections: RailSection[] }) {
  const { t } = useI18n();
  const [active, setActive] = useState<string | null>(sections[0]?.id ?? null);

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;

    // the section whose top is nearest just-below the sticky header wins "active"
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // top offset accounts for the sticky app header; trigger band sits in the upper third
      { rootMargin: "-72px 0px -55% 0px", threshold: 0 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav aria-label={t("rail.label")} className="sticky top-20 hidden self-start lg:block">
      <ul className="space-y-0.5 border-l border-line">
        {sections.map((s) => {
          const on = active === s.id;
          return (
            <li key={s.id}>
              <button
                onClick={() => jump(s.id)}
                className={[
                  "-ml-px flex w-full items-center gap-2 border-l-2 py-1.5 pl-3 pr-2 text-left text-[12px] transition",
                  s.anchor
                    ? on
                      ? "border-l-accent font-bold text-accent"
                      : "border-l-accent/40 font-semibold text-ink"
                    : on
                    ? "border-l-ink font-semibold text-ink"
                    : "border-l-transparent font-medium text-ink-faint hover:text-ink",
                ].join(" ")}
              >
                <span className="text-[13px] leading-none">{s.emoji}</span>
                <span className="min-w-0 flex-1 truncate">{t(s.labelKey)}</span>
                {s.anchor && (
                  <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
                    {t("rail.here")}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
