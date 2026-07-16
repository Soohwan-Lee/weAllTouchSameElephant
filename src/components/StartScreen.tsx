"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/store";
import { SCENARIOS } from "@/lib/scenarios";
import { Tour } from "./Tour";

export function StartScreen() {
  const { t, lang } = useI18n();
  const loadScenario = useSession((s) => s.loadScenario);
  const reset = useSession((s) => s.reset);
  const [showTour, setShowTour] = useState(false);

  // Blank start must clear any leftover scenario pieces. Returning home (🐘) only
  // sets step "start" without wiping state, so a previously-loaded scenario's
  // fragments/bridges would otherwise bleed into a fresh "blank table."
  const startBlank = () => {
    reset();
    useSession.getState().setStep("gather");
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      {showTour && <Tour onClose={() => setShowTour(false)} />}

      <div className="animate-fade-up text-center">
        <div className="mb-5 text-5xl">🐘</div>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {t("start.heading")}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-ink-faint">
          {t("start.sub")}
        </p>
        <p className="mx-auto mt-5 max-w-lg rounded-xl border border-line bg-paper-card px-4 py-3 text-xs leading-relaxed text-ink-soft">
          {t("start.example")}
        </p>
        <button
          onClick={() => setShowTour(true)}
          className="mt-4 text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          {lang === "ko" ? "어떻게 작동하나요? (30초)" : "How does it work? (30s)"}
        </button>
      </div>

      {/* sample scenarios */}
      <div className="mt-12">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">{t("start.trySample")}</span>
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
            {lang === "ko" ? "추천" : "recommended"}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              onClick={() => loadScenario(sc, lang)}
              className="group flex flex-col rounded-xl2 border border-line bg-paper-card p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-lift"
            >
              <span className="text-2xl">{sc.emoji}</span>
              <span className="mt-3 text-sm font-semibold leading-snug text-ink">
                {sc.title[lang]}
              </span>
              <span className="mt-1.5 text-xs leading-relaxed text-ink-faint">
                {sc.prompt[lang]}
              </span>
              <span className="mt-3 text-xs font-medium text-accent opacity-0 transition group-hover:opacity-100">
                {lang === "ko" ? "이 예시 열기 →" : "Open this example →"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* blank start */}
      <div className="mt-10 flex flex-col items-center gap-3 border-t border-line pt-8">
        <span className="text-xs text-ink-faint">{t("start.orBlank")}</span>
        <button
          onClick={startBlank}
          className="rounded-full border border-ink/15 px-5 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper"
        >
          {t("start.blankBtn")}
        </button>
      </div>
    </div>
  );
}
