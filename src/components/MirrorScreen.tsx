"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/store";
import { fetchName } from "@/lib/api";
import { findClusters } from "@/lib/clusters";
import { PuzzleCanvas } from "./PuzzleCanvas";
import { Hint } from "./Hint";

export function MirrorScreen() {
  const { t, lang } = useI18n();
  const fragments = useSession((s) => s.fragments);
  const bridges = useSession((s) => s.bridges);
  const assembled = useSession((s) => s.assembled);
  const setAssembled = useSession((s) => s.setAssembled);
  const clusterNames = useSession((s) => s.clusterNames);
  const setClusterName = useSession((s) => s.setClusterName);

  const [loading, setLoading] = useState(false);
  const [suggested, setSuggested] = useState<string>("");
  const [draft, setDraft] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const clusters = findClusters(fragments, bridges, 3);
  const main = clusters[0];

  const byId = (id: string) => fragments.find((f) => f.id === id);
  const looseTitles = fragments
    .filter((f) => !main || !main.fragmentIds.includes(f.id))
    .map((f) => f.title);

  async function gather() {
    if (!main) return;
    setLoading(true);
    setAssembled(true);
    try {
      const clusterFrags = main.fragmentIds.map(byId).filter(Boolean) as typeof fragments;
      const clusterBridges = bridges.filter(
        (b) => main.fragmentIds.includes(b.fragmentAId) && main.fragmentIds.includes(b.fragmentBId)
      );
      const input = {
        fragments: clusterFrags.map((f) => ({ title: f.title, body: f.body })),
        bridges: clusterBridges.map((b) => ({
          aTitle: byId(b.fragmentAId)?.title ?? "?",
          bTitle: byId(b.fragmentBId)?.title ?? "?",
          relationType: b.relationType,
        })),
      };
      const { name, note: n } = await fetchName(input, lang);
      setSuggested(name);
      setDraft(name);
      setNote(n);
    } finally {
      setLoading(false);
    }
  }

  const accept = () => {
    if (main && draft.trim()) setClusterName(main.id, draft.trim());
  };
  const named = main ? clusterNames[main.id] : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="animate-fade-up">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{t("mirror.heading")}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-faint">{t("mirror.hint")}</p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* the board (with center name when named) */}
        <div>
          <PuzzleCanvas showCenterName={!!named} />
          {assembled && named && (
            <p className="mt-3 text-center text-sm font-medium text-accent animate-fade-up">
              ✨ {t("assemble.reveal")}
            </p>
          )}
        </div>

        {/* the naming panel */}
        <div>
          {!assembled ? (
            <div className="flex h-full flex-col items-center justify-center rounded-xl2 border border-dashed border-line bg-paper-sunken/40 p-8 text-center">
              <div className="text-4xl">🐘</div>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-faint">
                {t("assemble.hint")}
              </p>
              <button
                onClick={gather}
                disabled={!main || loading}
                className="mt-5 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper shadow-lift transition enabled:hover:opacity-90 disabled:opacity-50"
              >
                🐘 {t("assemble.cta")}
              </button>
            </div>
          ) : (
            <div className="animate-fade-up rounded-xl2 border border-line bg-paper-card p-5 shadow-card">
              <div className="text-sm font-semibold text-ink">{t("assemble.namePrompt")}</div>

              {loading ? (
                <div className="mt-4 text-sm text-ink-faint">{t("assemble.naming")}</div>
              ) : (
                <>
                  {suggested && (
                    <div className="mt-3 rounded-lg border border-accent/20 bg-accent-soft/60 p-3">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-accent">
                        {t("assemble.aiSuggested")}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-ink">{suggested}</div>
                      {note && <div className="mt-1 text-xs text-ink-soft">{note}</div>}
                    </div>
                  )}

                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={t("assemble.namePlaceholder")}
                    className="mt-3 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm font-medium text-ink outline-none transition placeholder:text-line focus:border-ink/40"
                  />

                  <button
                    onClick={accept}
                    disabled={!draft.trim()}
                    className="mt-3 w-full rounded-full bg-accent py-2.5 text-sm font-semibold text-white transition enabled:hover:opacity-95 disabled:bg-line disabled:text-ink-faint"
                  >
                    {named && named === draft.trim() ? `✓ ${t("assemble.namedBy")}` : t("assemble.useName")}
                  </button>
                </>
              )}

              {/* loose fragments nudge */}
              {looseTitles.length > 0 && (
                <div className="mt-4 border-t border-line pt-3">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                    {t("mirror.separate")}
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {looseTitles.map((titleText, i) => (
                      <li key={i} className="text-xs text-ink-soft">
                        · {titleText} <span className="text-ink-faint">— {t("assemble.loose")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => {
                    setAssembled(false);
                    setSuggested("");
                    setDraft("");
                  }}
                  className="text-xs font-medium text-ink-faint transition hover:text-ink"
                >
                  ← {t("assemble.scatter")}
                </button>
                {suggested && !loading && (
                  <button
                    onClick={gather}
                    className="ml-auto text-xs font-medium text-accent hover:underline"
                  >
                    ↻ {t("mirror.redo")}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {!main && (
        <div className="mt-6">
          <Hint>{t("mirror.locked")}</Hint>
        </div>
      )}
    </div>
  );
}
