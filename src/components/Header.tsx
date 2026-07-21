"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession, type Step } from "@/lib/store";
import { downloadSession } from "@/lib/download";
import { largestClusterSize } from "@/lib/clusters";

const STEP_ORDER: Step[] = ["gather", "connect", "mirror"];

export function Header() {
  const { t, lang, setLang } = useI18n();
  const step = useSession((s) => s.step);
  const setStep = useSession((s) => s.setStep);
  const reset = useSession((s) => s.reset);
  const fragments = useSession((s) => s.fragments);
  const bridges = useSession((s) => s.bridges);
  const participants = useSession((s) => s.participants);

  const idx = STEP_ORDER.indexOf(step as Step);
  const canConnect = fragments.length >= 3;
  // an "elephant" needs one connected GROUP of >= 3 pieces, not merely 3 bridges —
  // three bridges scattered across separate pairs never form a group of 3.
  const canMirror = largestClusterSize(fragments, bridges) >= 3;

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
          // shown on mobile too (it was md:flex): below 768px the logo was the ONLY way
          // back, and the logo strands you on the start screen.
          <nav className="ml-1 flex items-center gap-0.5 sm:ml-2 sm:gap-1">
            {STEP_ORDER.map((s, i) => {
              const active = s === step;
              const reachable =
                s === "gather" || (s === "connect" && canConnect) || (s === "mirror" && canMirror);
              // a greyed-out step used to give no reason at all for being unreachable
              const why = reachable
                ? undefined
                : s === "connect"
                ? t("gather.needMore")
                : t("mirror.lockedGroup");
              return (
                <button
                  key={s}
                  disabled={!reachable}
                  title={why}
                  onClick={() => reachable && setStep(s)}
                  className={[
                    "rounded-full px-2 py-1 text-xs font-medium transition sm:px-3",
                    active
                      ? "bg-ink text-paper"
                      : reachable
                      ? "text-ink-faint hover:bg-paper-sunken hover:text-ink"
                      : "cursor-not-allowed text-line",
                  ].join(" ")}
                >
                  {/* full label on wide screens, just the step number on phones */}
                  <span className="hidden md:inline">{t(stepKey(s) as never)}</span>
                  <span className="md:hidden">{i + 1}</span>
                </button>
              );
            })}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Who is acting, on EVERY screen. This lived only in Gather, so every confirm,
              reject, name and decision in the second half of a session was stamped with
              whoever happened to be selected while the pieces were being written. */}
          {step !== "start" && participants.length > 0 && <ActorChip />}
          {step !== "start" && (
            <button
              onClick={downloadSession}
              title={t("export.hint")}
              className="rounded-full border border-line bg-paper-card px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:border-accent hover:text-accent"
            >
              ⤓<span className="ml-1 hidden sm:inline">{t("export.button")}</span>
            </button>
          )}
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

/**
 * The active actor, switchable from anywhere. Attribution is only as good as remembering
 * to switch, and during Connect/Mirror there was previously nothing to switch WITH — so
 * "who confirmed this bridge" defaulted to whoever wrote the last fragment.
 */
function ActorChip() {
  const { t } = useI18n();
  const participants = useSession((s) => s.participants);
  const activeId = useSession((s) => s.activeParticipantId);
  const setActive = useSession((s) => s.setActiveParticipant);
  const active = participants.find((p) => p.id === activeId) ?? null;
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={t("people.switchHint")}
        className="flex items-center gap-1.5 rounded-full border border-line bg-paper-card px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:border-accent"
      >
        <span
          className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
          style={{ backgroundColor: active?.color ?? "transparent" }}
        />
        <span className="max-w-[7rem] truncate">{active?.name ?? t("people.anon")}</span>
        <span className="text-ink-faint">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1.5 w-56 rounded-xl border border-line bg-paper-card p-2 shadow-lift">
            <div className="px-1.5 pb-1.5 text-[11px] leading-snug text-ink-faint">
              {t("people.switchHint")}
            </div>
            {participants.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setActive(p.id);
                  setOpen(false);
                }}
                className={[
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition",
                  p.id === activeId ? "bg-paper-sunken font-semibold text-ink" : "text-ink-soft hover:bg-paper-sunken",
                ].join(" ")}
              >
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: p.color }}
                />
                <span className="truncate">{p.name}</span>
                <span className="ml-auto shrink-0 text-ink-faint">{p.role}</span>
              </button>
            ))}
            <button
              onClick={() => {
                setActive(null);
                setOpen(false);
              }}
              className={[
                "mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs transition",
                activeId === null ? "bg-paper-sunken font-semibold text-ink" : "text-ink-faint hover:bg-paper-sunken",
              ].join(" ")}
            >
              {t("people.anon")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
