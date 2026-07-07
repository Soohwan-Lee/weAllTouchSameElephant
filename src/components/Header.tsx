"use client";

import { useI18n } from "@/lib/i18n";
import { useSession, type Step } from "@/lib/store";

const STEP_ORDER: Step[] = ["gather", "connect", "mirror"];

export function Header() {
  const { t, lang, setLang } = useI18n();
  const step = useSession((s) => s.step);
  const setStep = useSession((s) => s.setStep);
  const reset = useSession((s) => s.reset);
  const fragments = useSession((s) => s.fragments);
  const bridges = useSession((s) => s.bridges);

  const idx = STEP_ORDER.indexOf(step as Step);
  const canConnect = fragments.length >= 3;
  const canMirror = bridges.length >= 3;

  const stepKey = (s: Step) =>
    s === "gather" ? "step.gather" : s === "connect" ? "step.connect" : "step.mirror";

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <button
          onClick={() => setStep("start")}
          className="flex items-center gap-2 text-left"
          aria-label="Home"
        >
          <span className="text-xl leading-none">🐘</span>
          <span className="hidden text-sm font-semibold tracking-tight text-ink sm:block">
            We All Touch the Same Elephant
          </span>
        </button>

        {step !== "start" && (
          <nav className="ml-2 hidden items-center gap-1 md:flex">
            {STEP_ORDER.map((s, i) => {
              const active = s === step;
              const reachable =
                s === "gather" || (s === "connect" && canConnect) || (s === "mirror" && canMirror);
              return (
                <button
                  key={s}
                  disabled={!reachable}
                  onClick={() => reachable && setStep(s)}
                  className={[
                    "rounded-full px-3 py-1 text-xs font-medium transition",
                    active
                      ? "bg-ink text-paper"
                      : reachable
                      ? "text-ink-faint hover:bg-paper-sunken hover:text-ink"
                      : "cursor-not-allowed text-line",
                  ].join(" ")}
                >
                  {t(stepKey(s) as never)}
                </button>
              );
            })}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-2">
          {step !== "start" && (
            <button
              onClick={() => {
                if (confirm(lang === "ko" ? "테이블을 초기화할까요?" : "Reset the table?")) reset();
              }}
              className="rounded-full px-3 py-1 text-xs font-medium text-ink-faint transition hover:text-tension"
            >
              {t("common.reset")}
            </button>
          )}
          <div
            className="flex items-center rounded-full border border-line bg-paper-card p-0.5 text-xs font-semibold"
            role="group"
            aria-label="Language"
          >
            <button
              onClick={() => setLang("en")}
              aria-pressed={lang === "en"}
              className={[
                "rounded-full px-2.5 py-1 transition",
                lang === "en" ? "bg-ink text-paper" : "text-ink-faint hover:text-ink",
              ].join(" ")}
            >
              EN
            </button>
            <button
              onClick={() => setLang("ko")}
              aria-pressed={lang === "ko"}
              className={[
                "rounded-full px-2.5 py-1 transition",
                lang === "ko" ? "bg-ink text-paper" : "text-ink-faint hover:text-ink",
              ].join(" ")}
            >
              한국어
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
