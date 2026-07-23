"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const [revealFailed, setRevealFailed] = useState(false);
  // remember whether the shown reveal came from a sample scenario (so we can re-project it on language switch)
  const fromSampleReveal = useRef(false);
  // one cached reading per reveal mode, so the three can be compared without re-fetching
  const cachedByMode = useRef<Partial<Record<RevealMode, NameResult>>>({});
  // the AI's ORIGINAL name/question, kept so we can log accept-vs-override (the key
  // boundary-work signal: did the team keep the AI's framing or change it?).
  const aiName = useRef("");
  const aiQuestion = useRef("");
  const logEvent = useSession((s) => s.logEvent);
  const clusters = findClusters(fragments, bridges, 3);
  const main = clusters[0];
  const byId = (id: string) => fragments.find((f) => f.id === id);

  const named = main ? clusterNames[main.id] : undefined;
  const question = main ? clusterQuestions[main.id] : undefined;
  const decision = main ? clusterDecisions[main.id] : undefined;

  // the core + kept tensions, in fragment titles — shared by decision-directions and trade-off
  const shape = useMemo(() => {
    if (!main) return { cruxTitle: undefined as string | undefined, tensions: [] as Array<{ a: string; b: string }> };
    const synth = computeSynthesis(fragments, bridges, main);
    const keystone = synth.facets.find((f) => f.id === synth.keystoneFacetId);
    const cruxTitle = keystone ? byId(keystone.anchorId)?.title : undefined;
    const tensions = synth.tensions.map((tn) => {
      const b = bridges.find((x) => x.id === tn.bridgeId);
      return { a: byId(b?.fragmentAId ?? "")?.title ?? "?", b: byId(b?.fragmentBId ?? "")?.title ?? "?" };
    });
    return { cruxTitle, tensions };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [main?.id, fragments, bridges]);

  async function reveal(chosen: RevealMode, force = false) {
    if (!main) return;
    setMode(chosen);
    setAssembled(true);
    logEvent({ type: "reveal_mode_chosen", mode: chosen });

    // Switching modes used to re-fetch and overwrite, so going verdict → explore → verdict
    // cost two API calls and lost the first verdict. The whole point of three modes is to
    // hold them side by side, so serve a mode you've already seen from cache.
    const cached = cachedByMode.current[chosen];
    if (cached && !force) {
      setResult(cached);
      if (cached.name) aiName.current = cached.name;
      if (cached.question) aiQuestion.current = cached.question;
      return;
    }

    setLoading(true);
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
      // a failed reveal used to render as an assembled screen with a blank reading and no
      // explanation. Say the call failed and leave the board where it was.
      if (res.error) {
        setRevealFailed(true);
        setAssembled(false);
        return;
      }
      setRevealFailed(false);
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
      cachedByMode.current[chosen] = res;
      // Record the shape AND the reading, unconditionally — not only if someone later
      // presses "Use this name". This is what the team was looking at when they argued.
      logEvent({
        type: "reveal_computed",
        mode: chosen,
        fragmentCount: clusterFrags.length,
        bridgeCount: clusterBridges.length,
        wholeness: input.wholeness,
        keystoneTitle: cruxTitle,
        facets: facets.map((f) => ({ anchor: f.anchor, members: f.members, depth: f.depth })),
        spine,
        tensionCount: tensions.length,
        aiName: res.name,
        aiNote: res.note,
        aiQuestion: res.question,
        aiReadings: res.readings,
        aiHypothesis: res.hypothesis,
        aiVerdict: res.verdict,
        sample: fromSampleReveal.current,
      });
      // capture the AI's originals so we can later detect if the team overrode them
      if (res.name) aiName.current = res.name;
      if (res.question) aiQuestion.current = res.question;
      if (!nameDraft && res.name) setNameDraft(res.name);
      if (main && res.question && !clusterQuestions[main.id]) setClusterQuestion(main.id, res.question);
    } finally {
      setLoading(false);
    }
  }

  // Accept the framing: commit the name, and log both name + question as accepted with
  // their AI originals so a researcher can tell "kept the AI's framing" from "overrode it".
  const acceptFraming = () => {
    if (!main || !nameDraft.trim()) return;
    const finalName = nameDraft.trim();
    setClusterName(main.id, finalName);
    logEvent({
      type: "name_accepted",
      aiOriginal: aiName.current,
      humanFinal: finalName,
      changed: aiName.current.trim() !== finalName,
    });
    const finalQuestion = (clusterQuestions[main.id] ?? "").trim();
    if (finalQuestion || aiQuestion.current) {
      logEvent({
        type: "question_accepted",
        aiOriginal: aiQuestion.current,
        humanFinal: finalQuestion,
        changed: aiQuestion.current.trim() !== finalQuestion,
      });
    }
  };

  // The cache describes ONE board. If the team goes back and edits the pieces or links,
  // every cached reading is about a shape that no longer exists — drop them all.
  // (also on language change: a cached English reading must not be served in Korean)
  useEffect(() => {
    cachedByMode.current = {};
  }, [fragments, bridges, lang]);

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
          <div className="flex items-center gap-2">
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
            {revealFailed && (
              <div className="mt-4 w-full max-w-xs rounded-lg border border-tension/40 bg-tension/5 px-3 py-2 text-[12px] leading-snug text-ink">
                ⚠︎ {t("common.aiFailed")}
              </div>
            )}
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
                onAcceptName={acceptFraming}
              />
              <RealQuestion
                value={question ?? ""}
                loading={loading}
                onChange={(v) => main && setClusterQuestion(main.id, v)}
                label={t("crux.realQuestion")}
                editLabel={t("crux.editQuestion")}
                placeholder={lang === "ko" ? "우리가 먼저 답해야 할 것은…" : "What we must answer first is…"}
              />
              {!loading && !!question && (
                <NextStep
                  value={decision ?? ""}
                  onChange={(v) => main && setClusterDecision(main.id, v)}
                  onCommit={(v) => logEvent({ type: "decision_written", text: v })}
                  realQuestion={question ?? ""}
                  cruxTitle={shape.cruxTitle}
                  tensions={shape.tensions}
                  lang={lang}
                />
              )}

              {/* the cost the decision commits to — read off the team's own kept tensions.
                  Only after a decision exists, since it mirrors THAT decision. */}
              {!loading && !!(decision ?? "").trim() && main && (
                <TradeOffPanel
                  decision={decision ?? ""}
                  cluster={main}
                  onRevise={() => {
                    const el = document.getElementById("watse-next-move");
                    el?.scrollIntoView({ behavior: "smooth", block: "center" });
                    // the saved decision renders as a button (click to edit); open it, then
                    // focus the textarea it reveals on the next frame.
                    const ta = el?.querySelector("textarea");
                    if (ta) ta.focus();
                    else {
                      (el?.querySelector("button") as HTMLButtonElement | null)?.click();
                      requestAnimationFrame(() => el?.querySelector("textarea")?.focus());
                    }
                  }}
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
                onAccept={acceptFraming}
                onRedo={() => reveal(mode, true)}
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
  // accent-BORDERED, not accent-FILLED: a full accent wash here made three stacked accent
  // zones so nothing anchored. A left rule keeps it distinct but quieter, letting the
  // decision box below (the culminating action) read as the emphasis.
  return (
    <div className="animate-fade-up rounded-xl2 border border-line border-l-[3px] border-l-accent bg-paper-card p-5 shadow-card">
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
        // styled as an actual editable surface — it read as static AI output before,
        // so people never discovered the question was theirs to rewrite.
        <button
          onClick={() => setEditing(true)}
          className="mt-1.5 block w-full rounded-lg border border-dashed border-accent/40 px-3 py-2 text-left transition hover:border-accent hover:bg-paper/60"
        >
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
function NextStep({
  value,
  onChange,
  onCommit,
  realQuestion,
  cruxTitle,
  tensions,
  lang,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
  realQuestion: string;
  cruxTitle?: string;
  tensions: Array<{ a: string; b: string }>;
  lang: "en" | "ko";
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const has = !!value.trim();

  // grounded starting DIRECTIONS — the AI's help right before the team decides. Like Seeds
  // at the input step: a handle to react to, not a decision authored for them. Off by
  // default; the team asks. Picking one prefills the box and hands the pen back.
  const [dirLoading, setDirLoading] = useState(false);
  const [directions, setDirections] = useState<Array<{ direction: string; because: string }> | null>(null);
  const loadDirections = async () => {
    setDirLoading(true);
    try {
      const { fetchDirections } = await import("@/lib/api");
      const { directions: d } = await fetchDirections(value, realQuestion, cruxTitle, tensions, lang);
      setDirections(d);
    } finally {
      setDirLoading(false);
    }
  };
  const pickDirection = (d: string) => {
    onChange(d);
    setDirections(null);
    setEditing(true);
  };

  // The decision text is stored on every keystroke, but the decision_written EVENT only
  // fired on blur — so someone who typed their next move and closed the tab left no trace
  // in the log. Commit on the way out too. (Idempotent: the log tolerates a repeat.)
  const committed = useRef("");
  useEffect(() => {
    const flush = () => {
      const v = value.trim();
      if (v && v !== committed.current) {
        committed.current = v;
        onCommit(v);
      }
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [value, onCommit]);

  return (
    // the culminating action — given real presence (ink-toned, elevated) so it reads as the
    // emphasis, without borrowing the accent that the AI-suggestion zones use.
    <div id="watse-next-move" className="animate-fade-up rounded-xl2 border-2 border-ink/20 bg-paper-card p-5 shadow-lift">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink">
        {t("decide.label")}
      </div>
      {editing || !has ? (
        <>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">{t("decide.hint")}</p>
          <textarea
            autoFocus={editing}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => {
              setEditing(false);
              const v = value.trim();
              if (v && v !== committed.current) {
                committed.current = v;
                onCommit(v);
              }
            }}
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

          {/* the AI's help right before deciding — grounded starting directions, opt-in.
              It hands the pen back: pick one → it prefills the box → you rewrite it. */}
          {directions === null ? (
            <div className="mt-3 border-t border-line pt-3">
              <span className="text-[12px] text-ink-faint">{t("decide.stuck")} </span>
              <button
                onClick={loadDirections}
                disabled={dirLoading}
                className="text-[12px] font-semibold text-accent underline-offset-2 transition hover:underline disabled:opacity-60"
              >
                💡 {dirLoading ? t("decide.directionsLoading") : t("decide.getDirections")}
              </button>
            </div>
          ) : (
            <div className="mt-3 border-t border-line pt-3">
              <p className="text-[11px] leading-snug text-ink-faint">{t("decide.directionsHint")}</p>
              <ul className="mt-2 space-y-2">
                {directions.map((d, i) => (
                  <li key={i} className="rounded-lg border border-line bg-paper-sunken/40 p-3">
                    <div className="text-[13px] font-semibold text-ink">{d.direction}</div>
                    {d.because && <div className="mt-0.5 text-[11px] leading-snug text-ink-faint">{d.because}</div>}
                    <button
                      onClick={() => pickDirection(d.direction)}
                      className="mt-2 rounded-full border border-accent/40 px-3 py-1 text-[11px] font-medium text-accent transition hover:bg-accent hover:text-white"
                    >
                      {t("decide.useDirection")} →
                    </button>
                  </li>
                ))}
              </ul>
              <button
                onClick={loadDirections}
                disabled={dirLoading}
                className="mt-2 text-[11px] font-medium text-ink-faint transition hover:text-ink disabled:opacity-60"
              >
                ↻ {dirLoading ? t("decide.directionsLoading") : t("decide.directionsAgain")}
              </button>
            </div>
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

/**
 * The trade-off the written decision commits to — mirrored off the tensions the team
 * themselves kept. It invents no cost: it names which kept `tension` (or `separate`) the
 * decision leans on and what the other side gives up, in the team's own fragment titles.
 * Fires once, on demand, and logs tradeoff_shown for the exposure-vs-action question.
 */
function TradeOffPanel({ decision, cluster, onRevise }: { decision: string; cluster: { fragmentIds: string[] }; onRevise: () => void }) {
  const { t, lang } = useI18n();
  const fragments = useSession((s) => s.fragments);
  const bridges = useSession((s) => s.bridges);
  const logEvent = useSession((s) => s.logEvent);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<{ tension: string; favors: string; cost: string } | null>(null);
  const [opened, setOpened] = useState(false);
  // the contest: how the team answered the named cost — the actual boundary-work signal
  const [stance, setStance] = useState<"accepted" | "relocated" | "rejected" | null>(null);
  const [note, setNote] = useState("");
  const [noteFor, setNoteFor] = useState<"relocated" | "rejected" | null>(null);

  const answer = (s: "accepted" | "relocated" | "rejected", text: string) => {
    setStance(s);
    setNoteFor(null);
    logEvent({ type: "tradeoff_answered", stance: s, cost: res?.cost ?? "", note: text.trim() });
  };

  // If the team REVISES their decision, the old cost no longer describes it — reset so the
  // panel re-runs against the new decision instead of showing a stale, already-answered cost.
  useEffect(() => {
    setRes(null);
    setStance(null);
    setNote("");
    setNoteFor(null);
    setOpened(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision]);

  const title = (id: string) => fragments.find((f) => f.id === id)?.title ?? "?";
  const inCluster = (b: (typeof bridges)[number]) =>
    cluster.fragmentIds.includes(b.fragmentAId) && cluster.fragmentIds.includes(b.fragmentBId);
  const tensions = bridges
    .filter((b) => b.relationType === "tension" && inCluster(b))
    .map((b) => ({ a: title(b.fragmentAId), b: title(b.fragmentBId) }));
  const separations = bridges
    .filter((b) => b.relationType === "separate" && inCluster(b))
    .map((b) => ({ a: title(b.fragmentAId), b: title(b.fragmentBId) }));

  const reveal = async () => {
    setOpened(true);
    setLoading(true);
    try {
      const { fetchTradeOff } = await import("@/lib/api");
      const r = await fetchTradeOff(decision, tensions, separations, lang);
      setRes(r);
      if (r.tension || r.cost) {
        logEvent({ type: "tradeoff_shown", tension: r.tension, favors: r.favors, cost: r.cost });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!opened) {
    return (
      <button
        onClick={reveal}
        className="flex w-full animate-fade-up items-center gap-2 rounded-xl border border-dashed border-ink/25 bg-paper-sunken/40 px-4 py-2.5 text-left text-[13px] font-medium text-ink transition hover:border-ink/50 hover:bg-paper-sunken/70"
      >
        <span className="text-base leading-none">⚖️</span>
        <span>{t("trade.label")}</span>
        <span className="ml-auto text-ink-faint">→</span>
      </button>
    );
  }

  return (
    <div className="animate-fade-up rounded-xl2 border border-ink/15 bg-paper-card p-5 shadow-card">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
        ⚖️ {t("trade.label")}
      </div>
      {/* say WHY this appeared — it shows up the moment a decision is written, which reads
          as unrelated chrome without this line. */}
      <p className="mt-1 text-[12px] leading-snug text-ink-faint">{t("trade.why")}</p>
      {loading ? (
        <div className="mt-2 text-sm text-ink-faint">{t("trade.checking")}</div>
      ) : res && (res.tension || res.cost) ? (
        <>
          {res.tension && <div className="mt-2 text-sm font-medium text-ink">{res.tension}</div>}
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {res.favors && (
              <div className="rounded-lg bg-accent-soft/30 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-accent">{t("trade.favors")}</div>
                <div className="mt-0.5 text-[13px] leading-snug text-ink">{res.favors}</div>
              </div>
            )}
            {res.cost && (
              <div className="rounded-lg bg-tension/5 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-tension">{t("trade.cost")}</div>
                <div className="mt-0.5 text-[13px] leading-snug text-ink">{res.cost}</div>
              </div>
            )}
          </div>
          <p className="mt-2.5 text-[11px] leading-snug text-ink-faint">{t("trade.grounded")}</p>

          {/* THE CONTEST — is the AI's named cost right? Contesting it is the boundary work
              we actually study: the team renegotiating what their decision gives up. */}
          {stance ? (
            <div className="mt-3 rounded-lg border border-line bg-paper-sunken/50 px-3 py-2.5">
              <div className="text-[13px] text-ink">
                {t(`trade.answered.${stance}` as Parameters<typeof t>[0])}
                {note.trim() && <span className="text-ink-soft"> — “{note.trim()}”</span>}
              </div>
              {/* the contest had a consequence: offer to act on it, so it isn't a dead end.
                  Relocate/reject especially imply the decision may need another look. */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={onRevise}
                  className="rounded-full border border-ink/25 px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-ink hover:text-ink"
                >
                  ✎ {t("trade.revise")}
                </button>
                {/* not a dead end: look at a different cost, keeping the answer just given */}
                <button
                  onClick={() => { setStance(null); setNote(""); reveal(); }}
                  className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-faint transition hover:border-ink/40 hover:text-ink"
                >
                  ↻ {t("trade.another")}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 border-t border-line pt-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                {t("trade.ask")}
              </div>
              {noteFor ? (
                <div className="mt-2">
                  <textarea
                    autoFocus
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder={t("trade.notePlaceholder")}
                    className="w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => answer(noteFor, note)}
                      disabled={!note.trim()}
                      className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-paper transition enabled:hover:opacity-90 disabled:bg-line disabled:text-ink-faint"
                    >
                      {noteFor === "relocated" ? t("trade.relocate") : t("trade.reject")}
                    </button>
                    <button
                      onClick={() => { setNoteFor(null); setNote(""); }}
                      className="rounded-full px-3 py-1.5 text-xs font-medium text-ink-faint transition hover:text-ink"
                    >
                      ←
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => answer("accepted", "")}
                    className="rounded-full border border-line bg-paper-card px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-accent hover:text-accent"
                  >
                    {t("trade.accept")}
                  </button>
                  <button
                    onClick={() => setNoteFor("relocated")}
                    className="rounded-full border border-line bg-paper-card px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-ink hover:text-ink"
                  >
                    {t("trade.relocate")}
                  </button>
                  <button
                    onClick={() => setNoteFor("rejected")}
                    className="rounded-full border border-line bg-paper-card px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-tension hover:text-tension"
                  >
                    {t("trade.reject")}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        // a cost is always named now; an empty result means the call failed
        <div className="mt-2 flex items-center gap-2 text-[13px] leading-snug text-ink-faint">
          <span>⚠︎ {t("common.aiFailed")}</span>
          <button onClick={reveal} className="rounded-full border border-line px-2.5 py-1 text-[12px] font-medium text-ink-soft transition hover:text-ink">
            ↻ {t("common.retry")}
          </button>
        </div>
      )}
    </div>
  );
}
