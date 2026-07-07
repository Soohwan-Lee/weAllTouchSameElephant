"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";

const STEPS = [
  { emoji: "🖐️", titleKey: "tour.1.title", bodyKey: "tour.1.body" },
  { emoji: "🔗", titleKey: "tour.2.title", bodyKey: "tour.2.body" },
  { emoji: "🐘", titleKey: "tour.3.title", bodyKey: "tour.3.body" },
] as const;

export function Tour({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [i, setI] = useState(0);
  const last = i === STEPS.length - 1;
  const step = STEPS[i];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md animate-draw-in rounded-xl2 bg-paper-card p-7 shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-4xl">{step.emoji}</div>
        <h3 className="mt-4 text-lg font-semibold text-ink">{t(step.titleKey)}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t(step.bodyKey)}</p>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEPS.map((_, k) => (
              <span
                key={k}
                className={[
                  "h-1.5 rounded-full transition-all",
                  k === i ? "w-5 bg-ink" : "w-1.5 bg-line",
                ].join(" ")}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {!last && (
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-medium text-ink-faint hover:text-ink"
              >
                {t("tour.skip")}
              </button>
            )}
            <button
              onClick={() => (last ? onClose() : setI(i + 1))}
              className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-paper transition hover:opacity-90"
            >
              {last ? t("tour.done") : t("tour.next")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
