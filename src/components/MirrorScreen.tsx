"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/store";
import { fetchMirror } from "@/lib/api";
import { PuzzleCanvas } from "./PuzzleCanvas";
import type { MirrorReflection } from "@/lib/types";

export function MirrorScreen() {
  const { t, lang } = useI18n();
  const fragments = useSession((s) => s.fragments);
  const bridges = useSession((s) => s.bridges);

  const [loading, setLoading] = useState(false);
  const [reflection, setReflection] = useState<MirrorReflection | null>(null);

  const byId = (id: string) => fragments.find((f) => f.id === id);

  async function reveal() {
    setLoading(true);
    try {
      const connectedIds = new Set<string>();
      bridges.forEach((b) => {
        connectedIds.add(b.fragmentAId);
        connectedIds.add(b.fragmentBId);
      });
      const looseTitles = fragments.filter((f) => !connectedIds.has(f.id)).map((f) => f.title);
      const input = {
        fragments,
        bridges: bridges.map((b) => ({
          aTitle: byId(b.fragmentAId)?.title ?? "?",
          bTitle: byId(b.fragmentBId)?.title ?? "?",
          relationType: b.relationType,
          explanation: b.explanation,
        })),
        looseTitles,
      };
      const { reflection: r } = await fetchMirror(input, lang);
      setReflection(r);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="animate-fade-up">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{t("mirror.heading")}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-faint">{t("mirror.hint")}</p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <PuzzleCanvas />

        <div>
          {!reflection ? (
            <div className="flex h-full flex-col items-center justify-center rounded-xl2 border border-dashed border-line bg-paper-sunken/40 p-8 text-center">
              <div className="text-3xl">🐘</div>
              <p className="mt-3 max-w-xs text-sm text-ink-faint">
                {lang === "ko"
                  ? "여러분이 이은 연결을 하나의 모양으로 비춰드릴게요."
                  : "Let's reflect the connections you made back as one shape."}
              </p>
              <button
                onClick={reveal}
                disabled={loading}
                className="mt-5 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition enabled:hover:opacity-90 disabled:opacity-60"
              >
                {loading ? t("mirror.thinking") : t("mirror.reveal")}
              </button>
            </div>
          ) : (
            <div className="animate-fade-up rounded-xl2 border border-line bg-paper-card p-5 shadow-card">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-paper-sunken px-2.5 py-1 text-[11px] font-medium text-ink-faint">
                🪞 {t("mirror.draftLabel")}
              </div>

              <MirrorSection title={t("mirror.connected")} items={reflection.connected} tone="connected" />
              <MirrorSection title={t("mirror.tensions")} items={reflection.tensions} tone="tension" />
              <MirrorSection title={t("mirror.separate")} items={reflection.separate} tone="separate" />

              <button
                onClick={reveal}
                disabled={loading}
                className="mt-4 text-xs font-medium text-accent hover:underline disabled:opacity-60"
              >
                ↻ {t("mirror.redo")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MirrorSection({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "connected" | "tension" | "separate";
}) {
  if (!items.length) return null;
  const dot =
    tone === "tension" ? "bg-tension" : tone === "separate" ? "bg-line" : "bg-overlap";
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">{title}</div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-soft">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
