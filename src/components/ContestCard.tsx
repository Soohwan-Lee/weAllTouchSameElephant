"use client";

import { useI18n } from "@/lib/i18n";
import { RELATION_META } from "@/lib/relation";
import type { Bridge, ContestProposal, Fragment } from "@/lib/types";

/**
 * A link the team confirmed, beside how the same two cards read to a pass that saw nothing
 * else. The AI did not challenge anything — it typed two pieces, and the server noticed the
 * answers differ.
 *
 * Deliberately quieter than a BridgeCard: dashed border, no filled accent button, no colored
 * relation chip of its own. A proposal is an offer, and looks like one; this is a question
 * about work the team has already done, and pressing it visually would make it read as a
 * correction. Chiang et al. (IUI 2024, DOI 10.1145/3640543.3645199) found the open-question
 * form is what moved group accuracy where declarations did not.
 *
 * "Keep as is" comes FIRST and carries no penalty — Johnson et al. (CHI 2026,
 * arXiv:2602.14407) found people pay a social cost to reject an AI, so dismissing this has to
 * be the frictionless path, not the reluctant one.
 */
export function ContestCard({
  contest,
  bridge,
  fragA,
  fragB,
  onKeep,
  onRevisit,
}: {
  contest: ContestProposal;
  bridge: Bridge;
  fragA?: Fragment;
  fragB?: Fragment;
  onKeep: () => void;
  onRevisit: () => void;
}) {
  const { t } = useI18n();
  const current = RELATION_META[bridge.relationType];
  const suggested = RELATION_META[contest.suggestedType];
  // Composed here, not authored by the model: the blind pass supplies only its reading and its
  // one sentence on how the pieces relate, and the template makes it an open question.
  const question = t("contest.question")
    .replace("{type}", t(suggested.shortKey))
    .replace("{because}", contest.because);

  return (
    <div className="animate-fade-up rounded-xl border border-dashed border-line bg-paper-sunken/40 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        {t("contest.heading")}
      </div>

      {/* the link in question, as the team left it */}
      <div className="mt-2.5 flex items-center gap-2 text-xs">
        <span className="max-w-[42%] truncate rounded-md bg-paper px-2 py-1 font-medium text-ink-soft">
          {fragA?.title ?? "?"}
        </span>
        <span className="text-ink-faint">↔</span>
        <span className="max-w-[42%] truncate rounded-md bg-paper px-2 py-1 font-medium text-ink-soft">
          {fragB?.title ?? "?"}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-faint">
        <span>{t("contest.currentType")}</span>
        <span className="font-medium" style={{ color: current.color }}>
          {t(current.shortKey)}
        </span>
        <span>· {t("contest.suggests")}</span>
        <span className="font-medium" style={{ color: suggested.color }}>
          {t(suggested.shortKey)}
        </span>
        <span>?</span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-soft">{question}</p>

      <div className="mt-2.5 space-y-1 border-l-2 border-line pl-2.5 text-[11px] text-ink-faint">
        <div>“{contest.evidenceA}”</div>
        <div>“{contest.evidenceB}”</div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={onKeep}
          className="rounded-full border border-line bg-paper px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:border-ink"
        >
          {t("contest.keep")}
        </button>
        <button
          onClick={onRevisit}
          title={t("contest.revisitHint")}
          className="rounded-full px-3 py-1.5 text-xs font-medium text-ink-faint transition hover:text-ink"
        >
          {t("contest.revisit")}
        </button>
      </div>
    </div>
  );
}
