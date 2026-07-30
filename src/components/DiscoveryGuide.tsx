"use client";

import { useI18n } from "@/lib/i18n";
import { discoveryProgress, type DiscoveryNext } from "@/lib/discovery";
import { useSession } from "@/lib/store";

const NEXT_KEY: Record<
  DiscoveryNext,
  | "discovery.next.collect"
  | "discovery.next.cross"
  | "discovery.next.cause"
  | "discovery.next.challenge"
  | "discovery.next.reflect"
> = {
  collect: "discovery.next.collect",
  cross: "discovery.next.cross",
  cause: "discovery.next.cause",
  challenge: "discovery.next.challenge",
  reflect: "discovery.next.reflect",
};

export function DiscoveryGuide() {
  const { t } = useI18n();
  const fragments = useSession((state) => state.fragments);
  const bridges = useSession((state) => state.bridges);
  const participants = useSession((state) => state.participants);
  const setStep = useSession((state) => state.setStep);
  const progress = discoveryProgress(fragments, bridges, participants);

  return (
    <section
      className="mb-4 rounded-xl border border-accent/25 bg-accent-soft/20 p-4"
      aria-labelledby="watse-discovery-guide"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="watse-discovery-guide" className="text-[12px] font-semibold text-ink">
            {t("discovery.heading")}
          </h3>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-ink-soft">
            {t(NEXT_KEY[progress.next])}
          </p>
        </div>
        {progress.next === "collect" && (
          <button
            type="button"
            onClick={() => setStep("gather")}
            className="min-h-11 rounded-full border border-accent/35 bg-paper px-3.5 py-2 text-[11px] font-semibold text-accent transition hover:bg-accent hover:text-white"
          >
            {t("discovery.backToGather")} →
          </button>
        )}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-4" aria-label={t("discovery.signals")}>
        <Signal
          done={
            progress.participantTotal < 2 ||
            progress.contributed === progress.participantTotal
          }
          label={t("discovery.signal.voices")}
          value={
            progress.participantTotal > 1
              ? `${progress.contributed}/${progress.participantTotal}`
              : "—"
          }
        />
        <Signal
          done={progress.crossSeatLinks > 0 || progress.participantTotal < 2}
          label={t("discovery.signal.cross")}
          value={String(progress.crossSeatLinks)}
        />
        <Signal
          done={progress.causalLinks > 0}
          label={t("discovery.signal.cause")}
          value={String(progress.causalLinks)}
        />
        <Signal
          done={progress.challengeLinks > 0}
          label={t("discovery.signal.challenge")}
          value={String(progress.challengeLinks)}
        />
      </div>
      <p className="mt-2 text-[10px] leading-snug text-ink-faint">{t("discovery.notScore")}</p>
    </section>
  );
}

function Signal({ done, label, value }: { done: boolean; label: string; value: string }) {
  return (
    <div
      className={[
        "flex min-h-11 items-center justify-between rounded-lg border px-2.5 py-2 text-[10px]",
        done ? "border-accent/20 bg-paper text-ink-soft" : "border-line bg-paper/60 text-ink-faint",
      ].join(" ")}
    >
      <span>{label}</span>
      <span className={done ? "font-semibold text-accent" : "font-medium"}>
        {done ? "✓ " : ""}
        {value}
      </span>
    </div>
  );
}
