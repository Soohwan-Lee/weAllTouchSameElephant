"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/store";
import { fetchBlindSpot } from "@/lib/api";

/**
 * "Who's missing from the table?" — lives in GATHER, where adding a piece is the actual act.
 * It used to sit on Connect, which meant filling a gap bounced you back a screen; here the
 * seat and the write form are on the same page, so filling it is a natural next add.
 *
 * The AI names a SEAT and a question grounded in the pieces present; the person writes their
 * OWN piece from that seat (the angle is a handle, never a written perspective — the one
 * research-integrity line WATSE holds). Filling aims the gather form via onFill(angle).
 */
export function BlindSpotFinder({ onFill }: { onFill: (angle: string) => void }) {
  const { t, lang } = useI18n();
  const fragments = useSession((s) => s.fragments);
  const decisionPrompt = useSession((s) => s.decisionPrompt);
  const logEvent = useSession((s) => s.logEvent);

  const [loading, setLoading] = useState(false);
  const [spot, setSpot] = useState<{ angle: string; rationale: string; question: string } | null>(null);
  const [exhausted, setExhausted] = useState(false); // ran out of distinct angles
  // every angle already shown, so "show another" / "not a gap" ask for a NEW one
  const [seen, setSeen] = useState<string[]>([]);

  // need at least a couple of pieces before "who's missing?" has anything to reason from
  if (fragments.length < 2) return null;

  const check = async (excluding: string[]) => {
    setLoading(true);
    setExhausted(false);
    try {
      const pieces = fragments.map((f) => ({ title: f.title, body: f.body, role: f.authorRole }));
      const res = await fetchBlindSpot(decisionPrompt, pieces, lang, excluding);
      if (!res.angle) {
        setSpot(null);
        setExhausted(true);
        return;
      }
      setSpot({ angle: res.angle, rationale: res.rationale, question: res.question });
      setSeen((prev) => (prev.includes(res.angle) ? prev : [...prev, res.angle]));
      logEvent({ type: "blindspot_shown", angle: res.angle, rationale: res.rationale });
    } finally {
      setLoading(false);
    }
  };

  const fill = () => {
    if (!spot) return;
    onFill(spot.angle); // aims the gather write form at this seat — no page change
    setSpot(null); // collapse back to the invitation so the person can find another later
  };

  // "not a gap" logs the refusal AND asks for a different angle — never ends the feature
  const dismissThis = () => {
    if (spot) logEvent({ type: "blindspot_dismissed", angle: spot.angle });
    check(spot ? [...seen, spot.angle] : seen);
  };

  return (
    <div className="animate-fade-up">
      {/* the invitation — a real, visible card. On Gather this is a first-class way to add
          a piece (from a seat the AI spotted is empty), not a footnote. */}
      {!spot && (
        <div className="overflow-hidden rounded-xl2 border border-accent/40 bg-gradient-to-br from-accent-soft/50 to-paper-card shadow-card">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-2xl">
              🪑
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink">{t("blind.check")}</div>
              <p className="mt-0.5 text-[12px] leading-snug text-ink-faint">
                {exhausted && seen.length ? t("blind.exhausted") : t("blind.checkSub")}
              </p>
            </div>
            <button
              onClick={() => check(seen)}
              disabled={loading}
              className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition enabled:hover:opacity-95 disabled:opacity-60"
            >
              {loading ? t("blind.checking") : exhausted && seen.length ? `↻ ${t("blind.another")}` : `${t("blind.check")} →`}
            </button>
          </div>
        </div>
      )}

      {spot && (
        <div className="overflow-hidden rounded-xl2 border border-accent/40 bg-paper-card shadow-lift">
          {/* header band so the result reads as a distinct, considered suggestion */}
          <div className="flex items-center justify-between gap-2 border-b border-accent/20 bg-accent-soft/40 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">🪑</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">{t("blind.found")}</span>
            </div>
            <button onClick={() => setSpot(null)} className="text-[11px] font-medium text-ink-faint transition hover:text-ink">
              {t("blind.hide")}
            </button>
          </div>
          <div className="p-4">
            {/* the seat, as a headline */}
            <div className="text-base font-semibold text-ink">{spot.angle}</div>

            {/* why it reads as missing — grounded in who's present */}
            <div className="mt-2 rounded-lg bg-paper-sunken/50 px-3 py-2 text-[12px] leading-snug text-ink-soft">
              <span className="font-semibold text-ink-faint">{t("blind.why")}</span>
              <br />
              {spot.rationale}
            </div>

            {/* a question to write from — the AI asks, the person answers */}
            {spot.question && (
              <div className="mt-2.5 flex gap-2 text-[13px] leading-snug text-ink">
                <span className="text-accent">“</span>
                <span className="italic">{spot.question}</span>
              </div>
            )}

            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              {/* primary: write from this seat — fills the form right here on Gather */}
              <button
                onClick={fill}
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
              >
                + {t("blind.fill")}
              </button>
              {/* secondary: a different seat (loops, doesn't kill) */}
              <button
                onClick={() => check(seen)}
                disabled={loading}
                className="rounded-full border border-line px-3 py-2 text-xs font-medium text-ink-soft transition enabled:hover:border-ink enabled:hover:text-ink disabled:opacity-60"
              >
                ↻ {loading ? t("blind.checking") : t("blind.another")}
              </button>
              {/* not a gap → logs the refusal AND moves on to a different seat */}
              <button
                onClick={dismissThis}
                disabled={loading}
                className="rounded-full px-3 py-2 text-xs font-medium text-ink-faint transition hover:text-ink disabled:opacity-60"
              >
                {t("blind.dismiss")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
