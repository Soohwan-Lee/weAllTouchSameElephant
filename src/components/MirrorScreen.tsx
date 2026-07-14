"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession, scenarioRevealToResult } from "@/lib/store";
import { getScenario } from "@/lib/scenarios";
import { fetchName } from "@/lib/api";
import { findClusters } from "@/lib/clusters";
import { computeSynthesis } from "@/lib/synthesis";
import type { FacetSummary } from "@/lib/prompts";
import type { NameResult, RevealMode } from "@/lib/types";
import { REVEAL_MODES } from "@/lib/types";
import { PuzzleCanvas } from "./PuzzleCanvas";
import { SynthesisCanvas } from "./SynthesisCanvas";
import { StorySpine } from "./StorySpine";
import { SynthesisSummary } from "./SynthesisSummary";
import { Hint } from "./Hint";

/**
 * The final picture — the assembled elephant.
 *
 * Order matters (WATSE v5 §4.5): people assemble the links first; only here does the
 * AI mirror back a reading. And it hands back the KIND of reading the team asks for —
 * explore (competing readings) / hypothesis (one falsifiable bet) / verdict (the sharpest
 * claim). Crucially, the AI is handed the SHAPE the team built (facets, keystone, tensions),
 * not just a flat list — that's what lets it say something specific, not a generic theme.
 */
export function MirrorScreen() {
  const { t, lang } = useI18n();
  const fragments = useSession((s) => s.fragments);
  const bridges = useSession((s) => s.bridges);
  const scenarioId = useSession((s) => s.scenarioId);
  const assembled = useSession((s) => s.assembled);
  const setAssembled = useSession((s) => s.setAssembled);
  const revealView = useSession((s) => s.revealView);
  const setRevealView = useSession((s) => s.setRevealView);
  const clusterNames = useSession((s) => s.clusterNames);
  const setClusterName = useSession((s) => s.setClusterName);
  const clusterQuestions = useSession((s) => s.clusterQuestions);
  const setClusterQuestion = useSession((s) => s.setClusterQuestion);
  const clusterDecisions = useSession((s) => s.clusterDecisions);
  const setClusterDecision = useSession((s) => s.setClusterDecision);

  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<RevealMode>("explore");
  const [result, setResult] = useState<NameResult | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  // remember whether the shown reveal came from a sample scenario (so we can re-project it on language switch)
  const fromSampleReveal = useRef(false);

  const clusters = findClusters(fragments, bridges, 3);
  const main = clusters[0];
  const byId = (id: string) => fragments.find((f) => f.id === id);

  const named = main ? clusterNames[main.id] : undefined;
  const question = main ? clusterQuestions[main.id] : undefined;
  const decision = main ? clusterDecisions[main.id] : undefined;

  async function reveal(chosen: RevealMode) {
    if (!main) return;
    setMode(chosen);
    setLoading(true);
    setAssembled(true);
    try {
      const synth = computeSynthesis(fragments, bridges, main);
      const keystone = synth.facets.find((f) => f.id === synth.keystoneFacetId);
      const cruxTitle = keystone ? byId(keystone.anchorId)?.title : undefined;

      // hand the AI the SHAPE, not just a list
      const facets: FacetSummary[] = synth.facets.map((f) => ({
        anchor: byId(f.anchorId)?.title ?? "?",
        members: f.fragmentIds.map((id) => byId(id)?.title ?? "?"),
        depth: f.depth,
        supports: f.supports,
        dependsOn: f.dependsOn,
        isKeystone: f.id === synth.keystoneFacetId,
      }));
      const tensions = synth.tensions.map((tn) => {
        const b = bridges.find((x) => x.id === tn.bridgeId);
        return { a: byId(b?.fragmentAId ?? "")?.title ?? "?", b: byId(b?.fragmentBId ?? "")?.title ?? "?" };
      });
      // causal chains as anchor titles (root→symptom) so the model sees the actual spine
      const anchorTitleOf = (fid: string) => {
        const f = synth.facets.find((x) => x.id === fid);
        return f ? byId(f.anchorId)?.title ?? "?" : "?";
      };
      const spine = synth.spine.map((chain) => chain.map(anchorTitleOf));

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
        facets,
        tensions,
        spine,
        wholeness: Math.round(synth.coverage.wholeness * 100),
      };
      let res = await fetchName(input, lang, chosen);
      // sample mode → use the scenario's hand-written, sharper reveal if we have one
      fromSampleReveal.current = false;
      if (res.sample) {
        const sc = getScenario(scenarioId);
        if (sc?.reveal) {
          res = scenarioRevealToResult(sc.reveal, lang, chosen);
          fromSampleReveal.current = true;
        }
      }
      setResult(res);
      if (!nameDraft && res.name) setNameDraft(res.name);
      if (main && res.question && !clusterQuestions[main.id]) setClusterQuestion(main.id, res.question);
    } finally {
      setLoading(false);
    }
  }

  // when the user switches language mid-test, re-project a sample reveal into the new
  // language. Live-AI reveals can't be translated, so they're left as-is.
  useEffect(() => {
    if (!fromSampleReveal.current) return;
    const sc = getScenario(scenarioId);
    if (!sc?.reveal) return;
    const res = scenarioRevealToResult(sc.reveal, lang, mode);
    setResult(res);
    // only refresh the AI-suggested name draft if the team hasn't accepted a name yet
    if (!named) setNameDraft(res.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

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
          <div className="flex h-full flex-col items-center justify-center rounded-xl2 border border-dashed border-line bg-paper-sunken/40 p-6 text-center">
            <div className="text-4xl">🐘</div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-faint">{t("reveal.pick")}</p>
            <div className="mt-4 w-full max-w-xs space-y-2">
              {REVEAL_MODES.map((m) => (
                <ModeButton
                  key={m}
                  mode={m}
                  disabled={!main || loading}
                  onClick={() => reveal(m)}
                />
              ))}
            </div>
            {!main && <div className="mt-4"><Hint>{t("mirror.lockedGroup")}</Hint></div>}
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {revealView === "crux" ? (
            <>
              {/* THE READING FIRST — the insight is the payoff of assembling the elephant,
                  so it leads. The map, story, and stats are the evidence, and follow. */}
              <RevealResult
                result={result}
                loading={loading}
                mode={mode}
                onPickMode={reveal}
                nameDraft={nameDraft}
                onNameDraft={setNameDraft}
                named={named}
                onAcceptName={() => main && nameDraft.trim() && setClusterName(main.id, nameDraft.trim())}
              />
              <RealQuestion
                value={question ?? ""}
                loading={loading}
                onChange={(v) => main && setClusterQuestion(main.id, v)}
                label={t("crux.realQuestion")}
                editLabel={t("crux.editQuestion")}
                placeholder={lang === "ko" ? "그래서 우리가 먼저 답해야 할 질문은…" : "So the question we must answer first is…"}
              />
              {!loading && !!question && (
                <NextStep
                  value={decision ?? ""}
                  onChange={(v) => main && setClusterDecision(main.id, v)}
                />
              )}

              {/* the evidence behind the reading: the assembled shape you can inspect */}
              <div className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                {t("crux.evidenceHeading")}
              </div>
              <SynthesisCanvas />
              <StorySpine />
              <SynthesisSummary />
            </>
          ) : (
            <>
              <PuzzleCanvas showCenterName={!!named} />
              <NamePanel
                suggested={result?.name ?? ""}
                note={result?.note ?? ""}
                draft={nameDraft}
                named={named}
                loading={loading}
                onDraft={setNameDraft}
                onAccept={() => main && nameDraft.trim() && setClusterName(main.id, nameDraft.trim())}
                onRedo={() => reveal(mode)}
              />
            </>
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

const MODE_META: Record<RevealMode, { emoji: string; titleKey: string; subKey: string }> = {
  explore: { emoji: "🧭", titleKey: "reveal.explore", subKey: "reveal.explore.sub" },
  hypothesis: { emoji: "💡", titleKey: "reveal.hypothesis", subKey: "reveal.hypothesis.sub" },
  verdict: { emoji: "🎯", titleKey: "reveal.verdict", subKey: "reveal.verdict.sub" },
};

function ModeButton({
  mode,
  disabled,
  onClick,
}: {
  mode: RevealMode;
  disabled: boolean;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const m = MODE_META[mode];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group w-full rounded-xl border border-line bg-paper-card px-4 py-2.5 text-left transition enabled:hover:border-accent/50 enabled:hover:shadow-card disabled:opacity-50"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
        <span>{m.emoji}</span>
        {t(m.titleKey as Parameters<typeof t>[0])}
      </div>
      <div className="mt-0.5 text-[11px] leading-snug text-ink-faint">
        {t(m.subKey as Parameters<typeof t>[0])}
      </div>
    </button>
  );
}

/** The mode-specific reading: readings / hypothesis / verdict, with a mode switcher. */
function RevealResult({
  result,
  loading,
  mode,
  onPickMode,
  nameDraft,
  onNameDraft,
  named,
  onAcceptName,
}: {
  result: NameResult | null;
  loading: boolean;
  mode: RevealMode;
  onPickMode: (m: RevealMode) => void;
  nameDraft: string;
  onNameDraft: (v: string) => void;
  named?: string;
  onAcceptName: () => void;
}) {
  const { t } = useI18n();
  const m = MODE_META[mode];
  return (
    <div className="animate-fade-up overflow-hidden rounded-xl2 border border-accent/40 bg-paper-card shadow-lift">
      {/* big mode tabs — "how would you like to read the whole?" is a first-class choice */}
      <div className="border-b border-line bg-paper-sunken/40 px-4 pt-3">
        <div className="mb-2 text-[11px] font-medium text-ink-faint">{t("reveal.pickHint")}</div>
        <div className="flex flex-wrap gap-1.5">
          {REVEAL_MODES.map((mm) => {
            const meta = MODE_META[mm];
            const active = mm === mode;
            return (
              <button
                key={mm}
                onClick={() => onPickMode(mm)}
                disabled={loading}
                className={[
                  "group flex items-center gap-2 rounded-t-lg border-b-2 px-3.5 py-2 text-left transition disabled:opacity-50",
                  active
                    ? "border-accent bg-paper-card"
                    : "border-transparent hover:bg-paper-card/60",
                ].join(" ")}
              >
                <span className="text-base leading-none">{meta.emoji}</span>
                <span>
                  <span
                    className={[
                      "block text-[13px] font-semibold leading-tight",
                      active ? "text-accent" : "text-ink",
                    ].join(" ")}
                  >
                    {t(meta.titleKey as Parameters<typeof t>[0])}
                  </span>
                  <span className="hidden text-[10px] leading-tight text-ink-faint sm:block">
                    {t(meta.subKey as Parameters<typeof t>[0])}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5">
        {/* THE READING — the star of the screen: big, spacious, easy to read */}
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-ink-faint">
            <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-accent/50" />
            {t("reveal.thinking")}
          </div>
        ) : mode === "explore" ? (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              🧭 {t("reveal.readingsLabel")}
            </div>
            {/* each competing reading as its own card so "several angles" actually reads that way */}
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(result?.readings ?? []).map((r, i) => (
                <div
                  key={i}
                  className="flex flex-col rounded-xl border border-line bg-paper-sunken/40 p-4 transition hover:border-accent/40 hover:shadow-card"
                >
                  <span className="text-[11px] font-bold uppercase tracking-wide text-accent">
                    {t("reveal.angleLabel")} {i + 1}
                  </span>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-ink">{r}</p>
                </div>
              ))}
            </div>
          </div>
        ) : mode === "hypothesis" ? (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              💡 {t("reveal.hypothesisLabel")}
            </div>
            <p className="mt-2 text-balance text-xl font-semibold leading-snug text-ink sm:text-2xl">
              {result?.hypothesis}
            </p>
          </div>
        ) : (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              🎯 {t("reveal.verdictLabel")}
            </div>
            <p className="mt-2 text-balance text-2xl font-semibold leading-snug text-ink sm:text-[26px]">
              {result?.verdict}
            </p>
            <div className="mt-2 text-[12px] italic text-ink-faint">{t("reveal.verdictCaveat")}</div>
          </div>
        )}

        {result?.note && !loading && (
          <div className="mt-3 text-[12px] leading-relaxed text-ink-soft">{result.note}</div>
        )}

        {/* the name — a secondary handle, below the reading (the reading is the point) */}
        {!loading && (
          <div className="mt-5 flex flex-wrap items-center gap-2.5 border-t border-line pt-4">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">
              {m.emoji} {t("assemble.namePrompt")}
            </span>
            <input
              value={nameDraft}
              onChange={(e) => onNameDraft(e.target.value)}
              placeholder={t("assemble.namePlaceholder")}
              className="min-w-[180px] flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm font-semibold text-ink outline-none focus:border-accent/50"
            />
            <button
              onClick={onAcceptName}
              disabled={!nameDraft.trim()}
              className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-white transition enabled:hover:opacity-95 disabled:bg-line disabled:text-ink-faint"
            >
              {named && named === nameDraft.trim() ? `✓ ${t("assemble.namedBy")}` : t("assemble.useName")}
            </button>
          </div>
        )}
      </div>
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

/**
 * The last step: turn the AI's reframed question into the team's OWN next move.
 * Deliberately quieter and ink-toned (not accent) — the reframing was the AI's,
 * but the decision is the team's, and the UI should make that ownership legible.
 * The tool proposes a question; it never fills in the answer (WATSE v5).
 */
function NextStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const has = !!value.trim();
  return (
    <div className="animate-fade-up rounded-xl2 border border-ink/15 bg-paper-card p-5 shadow-card">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
        {t("decide.label")}
      </div>
      {editing || !has ? (
        <>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">{t("decide.hint")}</p>
          <textarea
            autoFocus={editing}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setEditing(false)}
            rows={2}
            placeholder={t("decide.placeholder")}
            className="mt-2 w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-base font-medium text-ink outline-none focus:border-ink/40"
          />
          {!has && (
            <button
              onClick={() => setEditing(true)}
              className="mt-2 rounded-full border border-ink/20 px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-ink/40 hover:text-ink"
            >
              ✎ {t("decide.add")}
            </button>
          )}
        </>
      ) : (
        <button onClick={() => setEditing(true)} className="mt-1.5 block text-left">
          <span className="text-balance text-base font-semibold leading-snug text-ink">{value}</span>
          <span className="ml-2 whitespace-nowrap text-[11px] font-medium text-ink-soft">✎ {t("decide.edit")}</span>
          <div className="mt-2 text-[11px] font-medium text-ink-faint">✓ {t("decide.saved")}</div>
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
