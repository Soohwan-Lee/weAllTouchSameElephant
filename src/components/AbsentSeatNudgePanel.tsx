"use client";

import { useI18n } from "@/lib/i18n";
import type { Participant } from "@/lib/types";

interface AbsentSeatNudgePanelProps {
  participants: Participant[];
  contributionCount: Map<string, number>;
  missingContributors: Participant[];
  startEvidenceTurn: (participantId: string) => void;
}

export function AbsentSeatNudgePanel({
  participants,
  contributionCount,
  missingContributors,
  startEvidenceTurn,
}: AbsentSeatNudgePanelProps) {
  const { t } = useI18n();

  if (participants.length <= 1) return null;

  return (
    <section
      className={[
        "mt-4 rounded-xl2 border p-4",
        missingContributors.length
          ? "border-accent/25 bg-accent-soft/20"
          : "border-line bg-paper-sunken/40",
      ].join(" ")}
      aria-labelledby="watse-first-round-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="watse-first-round-heading" className="text-[12px] font-semibold text-ink">
            {t("round.heading")}
          </h3>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-ink-faint">
            {t(missingContributors.length ? "round.hint" : "round.ready")}
          </p>
        </div>
        {missingContributors.length > 0 && (
          <span className="rounded-full border border-accent/25 bg-paper px-2.5 py-1 text-[10px] font-medium text-accent">
            {missingContributors.length} · {t("round.missing")}
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {participants.map((participant) => {
          const count = contributionCount.get(participant.id) ?? 0;
          return (
            <button
              key={participant.id}
              type="button"
              onClick={() => startEvidenceTurn(participant.id)}
              title={t("round.addEvidence")}
              className={[
                "flex min-h-11 items-center gap-2 rounded-full border px-3 py-2 text-left text-[11px] transition",
                count
                  ? "border-line bg-paper text-ink-soft hover:border-accent/40"
                  : "border-dashed border-accent/40 bg-paper-card text-ink hover:border-accent",
              ].join(" ")}
            >
              <span
                className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: participant.color }}
                aria-hidden
              />
              <span className="font-medium">{participant.name}</span>
              <span className={count ? "text-accent" : "text-ink-faint"}>
                {count ? `✓ ${count}` : "+"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
