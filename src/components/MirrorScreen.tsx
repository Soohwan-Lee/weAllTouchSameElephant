"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/store";
import { fetchName } from "@/lib/api";
import { findClusters } from "@/lib/clusters";
import { computeSynthesis } from "@/lib/synthesis";
import { PuzzleCanvas } from "./PuzzleCanvas";
import { SynthesisCanvas } from "./SynthesisCanvas";
import { SynthesisSummary } from "./SynthesisSummary";
import { Hint } from "./Hint";

/**
 * The final picture — the assembled elephant. Two views:
 *  - "synthesis" (default): pieces fused into facets along the root→symptom spine,
 *    live tensions kept, keystone haloed. GOAL: see the ONE shape the pieces make.
 *  - "assembly": the loose ring of connected pieces + one name.
 *    GOAL: the "we're one elephant" belonging beat.
 *
 * Order matters (WATSE v5 §4.5): people assemble the links first; only here does the
 * AI mirror back a NAME + the highest-leverage QUESTION. The AI never authors the shape.
 */
export function MirrorScreen() {
  const { t, lang } = useI18n();
  const fragments = useSession((s) => s.fragments);
  const bridges = useSession((s) => s.bridges);
  const assembled = useSession((s) => s.assembled);
  const setAssembled = useSession((s) => s.setAssembled);
  const revealView = useSession((s) => s.revealView);
  const setRevealView = useSession((s) => s.setRevealView);
  const clusterNames = useSession((s) => s.clusterNames);
  const setClusterName = useSession((s) => s.setClusterName);
  const clusterQuestions = useSession((s) => s.clusterQuestions);
  const setClusterQuestion = useSession((s) => s.setClusterQuestion);

  const [loading, setLoading] = useState(false);
  const [suggested, setSuggested] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [note, setNote] = useState("");

  const clusters = findClusters(fragments, bridges, 3);
  const main = clusters[0];
  const byId = (id: string) => fragments.find((f) => f.id === id);

  const named = main ? clusterNames[main.id] : undefined;
  const question = main ? clusterQuestions[main.id] : undefined;

  async function reveal() {
    if (!main) return;
    setLoading(true);
    setAssembled(true);
    try {
      const synth = computeSynthesis(fragments, bridges, main);
      // hand the AI the keystone side's anchor as the "crux" hint (a starting point)
      const keystone = synth.facets.find((f) => f.id === synth.keystoneFacetId);
      const cruxTitle = keystone ? byId(keystone.anchorId)?.title : undefined;
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
        cruxTitle,
      };
      const { name, note: n, question: q } = await fetchName(input, lang);
      setSuggested(name);
      setNameDraft(name);
      setNote(n);
      if (main && q && !clusterQuestions[main.id]) setClusterQuestion(main.id, q);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="animate-fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">{t("mirror.heading")}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-faint">{t("mirror.hint")}</p>
        </div>
        {assembled && (
          <div className="flex items-center rounded-full border border-line bg-paper-card p-0.5 text-xs font-semibold">
            <button
              onClick={() => setRevealView("crux")}
              className={[
                "rounded-full px-3 py-1.5 transition",
                revealView === "crux" ? "bg-ink text-paper" : "text-ink-faint hover:text-ink",
              ].join(" ")}
            >
              🐘 {t("crux.viewFlow")}
            </button>
            <button
              onClick={() => setRevealView("assembly")}
              className={[
                "rounded-full px-3 py-1.5 transition",
                revealView === "assembly" ? "bg-ink text-paper" : "text-ink-faint hover:text-ink",
              ].join(" ")}
            >
              🔗 {t("crux.viewAssembly")}
            </button>
          </div>
        )}
      </div>

      {!assembled ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <PuzzleCanvas />
          <div className="flex h-full flex-col items-center justify-center rounded-xl2 border border-dashed border-line bg-paper-sunken/40 p-8 text-center">
            <div className="text-4xl">🐘</div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-faint">{t("assemble.hint")}</p>
            <button
              onClick={reveal}
              disabled={!main || loading}
              className="mt-5 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper shadow-lift transition enabled:hover:opacity-90 disabled:opacity-50"
            >
              🐘 {t("assemble.cta")}
            </button>
            {!main && <div className="mt-4"><Hint>{t("mirror.locked")}</Hint></div>}
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {/* the picture */}
          {revealView === "crux" ? (
            <SynthesisCanvas />
          ) : (
            <PuzzleCanvas showCenterName={!!named} />
          )}

          {/* the payoff */}
          {revealView === "crux" ? (
            <>
              <SynthesisSummary />
              <RealQuestion
                value={question ?? ""}
                loading={loading}
                onChange={(v) => main && setClusterQuestion(main.id, v)}
                label={t("crux.realQuestion")}
                editLabel={t("crux.editQuestion")}
                placeholder={lang === "ko" ? "그래서 우리가 먼저 답해야 할 질문은…" : "So the question we must answer first is…"}
              />
            </>
          ) : (
            <NamePanel
              suggested={suggested}
              note={note}
              draft={nameDraft}
              named={named}
              loading={loading}
              onDraft={setNameDraft}
              onAccept={() => main && nameDraft.trim() && setClusterName(main.id, nameDraft.trim())}
              onRedo={reveal}
            />
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => setAssembled(false)}
              className="text-xs font-medium text-ink-faint transition hover:text-ink"
            >
              ← {t("assemble.scatter")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RealQuestion({
  value,
  loading,
  onChange,
  label,
  editLabel,
  placeholder,
}: {
  value: string;
  loading: boolean;
  onChange: (v: string) => void;
  label: string;
  editLabel: string;
  placeholder: string;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="animate-fade-up rounded-xl2 border border-accent/30 bg-accent-soft/50 p-5 shadow-card">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-accent">{label}</div>
      {loading ? (
        <div className="mt-2 text-sm text-ink-faint">…</div>
      ) : editing ? (
        <textarea
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          rows={2}
          placeholder={placeholder}
          className="mt-2 w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-lg font-medium text-ink outline-none focus:border-accent/50"
        />
      ) : (
        <button onClick={() => setEditing(true)} className="mt-1.5 block text-left">
          <span className="text-balance text-lg font-semibold leading-snug text-ink">
            {value || placeholder}
          </span>
          <span className="ml-2 whitespace-nowrap text-[11px] font-medium text-accent">✎ {editLabel}</span>
        </button>
      )}
    </div>
  );
}

function NamePanel({
  suggested,
  note,
  draft,
  named,
  loading,
  onDraft,
  onAccept,
  onRedo,
}: {
  suggested: string;
  note: string;
  draft: string;
  named?: string;
  loading: boolean;
  onDraft: (v: string) => void;
  onAccept: () => void;
  onRedo: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="animate-fade-up rounded-xl2 border border-line bg-paper-card p-5 shadow-card">
      <div className="text-sm font-semibold text-ink">{t("assemble.namePrompt")}</div>
      {loading ? (
        <div className="mt-3 text-sm text-ink-faint">{t("assemble.naming")}</div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {suggested && (
            <span className="rounded-full bg-accent-soft px-2 py-1 text-[11px] font-medium text-accent">
              {t("assemble.aiSuggested")}: {suggested}
            </span>
          )}
          <input
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            placeholder={t("assemble.namePlaceholder")}
            className="min-w-[200px] flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm font-medium text-ink outline-none focus:border-ink/40"
          />
          <button
            onClick={onAccept}
            disabled={!draft.trim()}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition enabled:hover:opacity-95 disabled:bg-line disabled:text-ink-faint"
          >
            {named && named === draft.trim() ? `✓ ${t("assemble.namedBy")}` : t("assemble.useName")}
          </button>
          <button onClick={onRedo} className="text-xs font-medium text-accent hover:underline">
            ↻ {t("mirror.redo")}
          </button>
        </div>
      )}
      {note && !loading && <div className="mt-2 text-xs text-ink-soft">{note}</div>}
    </div>
  );
}
