"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/store";
import { fetchSeeds, fetchTalkQuestions, fetchTalkExtract } from "@/lib/api";
import type { CardCandidate, SeedSuggestion } from "@/lib/prompts";
import { ParticipantBar } from "./ParticipantBar";
import {
  PIECE_TYPES,
  PIECE_TYPE_META,
  ROLE_LENSES,
  starterFrame,
  type PieceType,
} from "@/lib/starters";

/** How the person adds pieces — chosen by "how stuck am I?" */
type EntryMode = "write" | "seeds" | "talk";

const ENTRY_MODES: Array<{
  id: EntryMode;
  emoji: string;
  labelKey: "entry.write" | "entry.seeds" | "entry.talk";
  subKey: "entry.writeSub" | "entry.seedsSub" | "entry.talkSub";
}> = [
  { id: "write", emoji: "✍️", labelKey: "entry.write", subKey: "entry.writeSub" },
  { id: "seeds", emoji: "💡", labelKey: "entry.seeds", subKey: "entry.seedsSub" },
  { id: "talk", emoji: "💬", labelKey: "entry.talk", subKey: "entry.talkSub" },
];

export function GatherScreen() {
  const { t, lang } = useI18n();
  const fragments = useSession((s) => s.fragments);
  const addFragment = useSession((s) => s.addFragment);
  const removeFragment = useSession((s) => s.removeFragment);
  const bridges = useSession((s) => s.bridges);
  const setStep = useSession((s) => s.setStep);
  const decisionPrompt = useSession((s) => s.decisionPrompt);
  const setDecisionPrompt = useSession((s) => s.setDecisionPrompt);
  const scenarioId = useSession((s) => s.scenarioId);
  const participants = useSession((s) => s.participants);

  // entry mode: write directly (know what to say) / seeds (pick angles) / talk (figure out)
  // Default to TALK on an empty table. The blank card is the hardest thing in the whole
  // tool, and "write directly" — which hands you exactly that — used to be where everyone
  // landed, with the two easier doors sitting unnoticed beside it. Once pieces exist the
  // person has found their footing, so the fast path (write) becomes the sensible default.
  const [entryMode, setEntryMode] = useState<EntryMode>(() =>
    fragments.length === 0 ? "talk" : "write"
  );

  const [authorName, setAuthorName] = useState("");
  const [authorRole, setAuthorRole] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  // input scaffolding state: chosen piece type, role lens, and which spark question
  const [pieceType, setPieceType] = useState<PieceType | null>(null);
  const [lensId, setLensId] = useState("generic");
  const [qIdx, setQIdx] = useState(0);

  // the decision prompt is read-only when it came from a scenario; editable on a blank table
  const decisionEditable = !scenarioId;

  // when the write form was seeded from a chosen angle, remember the angle to nudge the
  // person to rewrite it in their own words (the angle handle, not any AI-written content).
  const [seededFromAngle, setSeededFromAngle] = useState<string | null>(null);

  // pick a seed → prefill the write form (title = angle draft, body left EMPTY with the
  // nudge as placeholder so the person supplies their own words) and switch to write mode.
  const pickSeed = (angle: string, nudge: string) => {
    setTitle(angle);
    setBody("");
    setPieceType(null);
    setSeededFromAngle(angle);
    setSeedNudge(nudge);
    setEntryMode("write");
  };
  const [seedNudge, setSeedNudge] = useState<string>("");

  // talk-mode state lives here, not in TalkPanel — see TalkState. Switching entry modes
  // unmounts the panel, and a half-finished answer must not die with it.
  const [talkPhase, setTalkPhase] = useState<"intro" | "answer" | "drafts">("intro");
  const [talkQuestions, setTalkQuestions] = useState<string[]>([]);
  const [talkAnswer, setTalkAnswer] = useState("");
  const [talkDrafts, setTalkDrafts] = useState<CardCandidate[]>([]);
  const [talkAdded, setTalkAdded] = useState<Set<number>>(new Set());
  const talkState: TalkState = {
    phase: talkPhase, setPhase: setTalkPhase,
    questions: talkQuestions, setQuestions: setTalkQuestions,
    answer: talkAnswer, setAnswer: setTalkAnswer,
    drafts: talkDrafts, setDrafts: setTalkDrafts,
    added: talkAdded, setAdded: setTalkAdded,
  };

  const lens = ROLE_LENSES.find((l) => l.id === lensId) ?? ROLE_LENSES[0];
  // the spark question: the chosen type's prompt, else the role lens's rotating question
  const sparkQuestion = pieceType
    ? PIECE_TYPE_META[pieceType].prompt[lang]
    : lens.questions[qIdx % lens.questions.length][lang];

  const applyType = (tp: PieceType) => {
    setPieceType(tp);
    if (!body.trim()) setBody(starterFrame(tp, lang));
  };

  // require the person to have actually filled the frame — an unedited "___" skeleton
  // is a template, not their perspective, and must not land on the board.
  const canAdd = title.trim().length > 0 && body.trim().length > 0 && !body.includes("___");
  const canProceed = fragments.length >= 3;

  const submit = () => {
    if (!canAdd) return;
    addFragment(
      {
        authorName: authorName.trim() || "—",
        authorRole: authorRole.trim() || "—",
        title: title.trim(),
        body: body.trim(),
      },
      seededFromAngle ? "seed" : "write"
    );
    setTitle("");
    setBody("");
    setPieceType(null);
    setSeededFromAngle(null);
    setSeedNudge("");
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="animate-fade-up">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{t("gather.heading")}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-faint">{t("gather.hint")}</p>
      </div>

      {/* ---- who's at the table ---- */}
      <div className="mt-5">
        <ParticipantBar />
      </div>

      {/* ---- decision anchor: the one question the pieces are views on ---- */}
      <div className="mt-5 animate-fade-up rounded-xl2 border border-line bg-paper-sunken/40 p-4">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          {t("decision.label")}
        </label>
        {decisionEditable ? (
          <input
            value={decisionPrompt}
            onChange={(e) => setDecisionPrompt(e.target.value)}
            placeholder={t("decision.placeholder")}
            className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3 py-2 text-[15px] font-medium text-ink outline-none transition placeholder:text-line focus:border-ink/40"
          />
        ) : (
          <div className="mt-1 text-[15px] font-semibold text-ink">{decisionPrompt || "—"}</div>
        )}
        <p className="mt-1.5 text-[11px] leading-snug text-ink-faint">{t("decision.hint")}</p>
      </div>

      {/* ---- entry mode: how stuck are you? ---- */}
      <div className="mt-5 animate-fade-up">
        <div className="mb-2 text-[12px] font-medium text-ink-soft">{t("entry.heading")}</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {ENTRY_MODES.map((m) => {
            const active = entryMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setEntryMode(m.id)}
                className={[
                  "rounded-xl border p-3 text-left transition",
                  active
                    ? "border-accent bg-accent-soft/40 shadow-card"
                    : "border-line bg-paper-card hover:border-accent/40",
                ].join(" ")}
              >
                <div className="text-sm font-semibold text-ink">
                  {m.emoji} {t(m.labelKey)}
                </div>
                <div className="mt-0.5 text-[11px] leading-snug text-ink-faint">{t(m.subKey)}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* input card — the panel depends on entry mode */}
        {entryMode === "seeds" ? (
          <SeedsPanel decision={decisionPrompt} lang={lang} onPick={pickSeed} onBack={() => setEntryMode("write")} />
        ) : entryMode === "talk" ? (
          <TalkPanel
            decision={decisionPrompt}
            lang={lang}
            onAddCard={(title, body) => addFragment({ authorName: authorName.trim() || "—", authorRole: authorRole.trim() || "—", title, body }, "talk")}
            onBack={() => setEntryMode("write")}
            talk={talkState}
          />
        ) : (
        <div className="animate-fade-up rounded-xl2 border border-line bg-paper-card p-5 shadow-card">
          {seededFromAngle && (
            <div className="mb-4 rounded-xl border border-accent/30 bg-accent-soft/40 px-3.5 py-2.5 text-[12px] leading-snug text-ink">
              💡 <span className="font-medium">{seededFromAngle}</span> — {t("seeds.picked")}
            </div>
          )}
          {/* ---- scaffolding: kill the blank-card bottleneck ---- */}
          <div className="mb-4 rounded-xl border border-accent/20 bg-accent-soft/25 p-3.5">
            <div className="text-[12px] font-semibold text-ink">💡 {t("scaffold.blankStuck")}</div>

            {/* piece-type chips */}
            <div className="mt-2 text-[11px] font-medium text-ink-soft">{t("scaffold.typeHeading")}</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {PIECE_TYPES.map((tp) => {
                const meta = PIECE_TYPE_META[tp];
                const active = pieceType === tp;
                return (
                  <button
                    key={tp}
                    onClick={() => applyType(tp)}
                    className={[
                      "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                      active
                        ? "border-accent bg-accent text-white"
                        : "border-line bg-paper-card text-ink-soft hover:border-accent/50 hover:text-accent",
                    ].join(" ")}
                  >
                    {meta.emoji} {t(meta.labelKey)}
                  </button>
                );
              })}
            </div>

            {/* role lens */}
            <div className="mt-3 text-[11px] font-medium text-ink-soft">{t("scaffold.lensLabel")}</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ROLE_LENSES.map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    setLensId(l.id);
                    setQIdx(0);
                  }}
                  className={[
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                    lensId === l.id
                      ? "border-ink bg-ink text-paper"
                      : "border-line bg-paper-card text-ink-faint hover:text-ink",
                  ].join(" ")}
                >
                  {l.label[lang]}
                </button>
              ))}
            </div>

            {/* spark question */}
            <div className="mt-3 flex items-start justify-between gap-2 rounded-lg bg-paper-card/70 px-3 py-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-accent">
                  {t("scaffold.promptLabel")}
                </div>
                <div className="mt-0.5 text-[12px] leading-snug text-ink">{sparkQuestion}</div>
              </div>
              {!pieceType && (
                <button
                  onClick={() => setQIdx((i) => i + 1)}
                  className="shrink-0 rounded-full border border-line px-2 py-1 text-[10px] font-medium text-ink-faint transition hover:text-ink"
                >
                  ↻ {t("scaffold.shuffle")}
                </button>
              )}
            </div>
          </div>

          {participants.length > 0 ? (
            <AuthorSwitcher />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("gather.author")} value={authorName} onChange={setAuthorName} placeholder="Jamie" />
              <Field label={t("gather.role")} value={authorRole} onChange={setAuthorRole} placeholder="Sales" />
            </div>
          )}
          <div className="mt-3">
            <Field
              label={t("gather.title")}
              value={title}
              onChange={setTitle}
              placeholder={pieceType ? PIECE_TYPE_META[pieceType].titleHint[lang] : "…"}
            />
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-ink-soft">{t("gather.body")}</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
              }}
              rows={3}
              maxLength={400}
              placeholder={pieceType ? "" : seedNudge || t("scaffold.blankStuck")}
              className="w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition placeholder:text-line focus:border-ink/40"
            />
            {pieceType && body.includes("___") && (
              <p className="mt-1 text-[11px] leading-snug text-accent">✎ {t("scaffold.yourWords")}</p>
            )}
          </div>
          <button
            onClick={submit}
            disabled={!canAdd}
            className="mt-4 w-full rounded-full bg-ink py-2.5 text-sm font-medium text-paper transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-faint"
          >
            + {t("gather.add")}
          </button>
        </div>
        )}

        {/* fragment list */}
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-sm font-medium text-ink">
              {fragments.length}{" "}
              <span className="text-ink-faint">{t("gather.count")}</span>
            </span>
          </div>

          {fragments.length === 0 ? (
            <div className="rounded-xl2 border border-dashed border-line bg-paper-sunken/50 p-8 text-center text-sm text-ink-faint">
              {t("gather.empty")}
            </div>
          ) : (
            <ul className="space-y-2.5">
              {fragments.map((f) => (
                <li
                  key={f.id}
                  className="group animate-fade-up rounded-xl border border-line bg-paper-card p-4 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-ink">{f.title}</div>
                      <div className="mt-1 text-sm leading-relaxed text-ink-soft">{f.body}</div>
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                        {(() => {
                          const color = participants.find((p) => p.id === f.authorId)?.color;
                          return color ? (
                            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                          ) : null;
                        })()}
                        {f.authorName} · {f.authorRole}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        // removing a piece silently took its confirmed links with it —
                        // name that cost before it happens, since it can drop the team
                        // back below the connect gate for no visible reason.
                        const linked = bridges.filter(
                          (b) => b.fragmentAId === f.id || b.fragmentBId === f.id
                        ).length;
                        if (linked > 0 && !confirm(t("gather.removeWarn").replace("{n}", String(linked)))) return;
                        removeFragment(f.id);
                      }}
                      className="shrink-0 rounded-md px-2 py-1 text-[11px] text-ink-faint opacity-60 transition hover:bg-paper-sunken hover:text-tension group-hover:opacity-100"
                    >
                      {t("gather.remove")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* proceed */}
      <div className="sticky bottom-4 mt-8 flex justify-center">
        <button
          onClick={() => setStep("connect")}
          disabled={!canProceed}
          className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white shadow-lift transition enabled:hover:opacity-95 disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-faint disabled:shadow-none"
        >
          {canProceed
            ? `${t("gather.toConnect")} →`
            : t("gather.needMoreN")
                .replace("{n}", String(fragments.length))
                .replace("{r}", String(3 - fragments.length))}
        </button>
      </div>
    </div>
  );
}

/**
 * Who is entering THIS card — switchable right at the input, not only up in the ParticipantBar.
 * A co-located session passes one keyboard around, so the author changes far more often than
 * the roster does; making the switch reachable from the form is what keeps attribution honest.
 */
function AuthorSwitcher() {
  const { t } = useI18n();
  const participants = useSession((s) => s.participants);
  const activeId = useSession((s) => s.activeParticipantId);
  const setActive = useSession((s) => s.setActiveParticipant);
  const active = participants.find((p) => p.id === activeId) ?? null;
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-line bg-paper-sunken/50 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className="text-ink-faint">{t("people.adding")}</span>
        {active ? (
          <>
            <span
              className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
              style={{ backgroundColor: active.color }}
            />
            <span className="font-semibold text-ink">{active.name}</span>
            <span className="text-ink-faint">· {active.role}</span>
          </>
        ) : (
          <span className="font-medium text-ink-faint">{t("people.anon")}</span>
        )}
        <button
          onClick={() => setOpen((o) => !o)}
          className="ml-auto rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-medium text-ink-soft transition hover:border-accent hover:text-accent"
        >
          {open ? "▴" : "▾"} {t("people.switch")}
        </button>
      </div>

      {open && (
        <div className="mt-2 border-t border-line pt-2">
          <div className="text-[11px] text-ink-faint">{t("people.switchHint")}</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {participants.map((p) => {
              const on = p.id === activeId;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setActive(p.id);
                    setOpen(false);
                  }}
                  className={[
                    "flex items-center gap-1.5 rounded-full border py-1 pl-2 pr-2.5 text-[12px] transition",
                    on ? "border-transparent text-white" : "border-line bg-paper text-ink-soft hover:border-ink/30",
                  ].join(" ")}
                  style={on ? { backgroundColor: p.color } : undefined}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: on ? "rgba(255,255,255,0.9)" : p.color }}
                  />
                  <span className="font-semibold">{p.name}</span>
                  <span className={on ? "text-white/80" : "text-ink-faint"}>· {p.role}</span>
                </button>
              );
            })}
            {/* an unattributed piece stays possible even with a roster present */}
            <button
              onClick={() => {
                setActive(null);
                setOpen(false);
              }}
              className={[
                "rounded-full border px-2.5 py-1 text-[12px] font-medium transition",
                activeId === null
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-paper text-ink-faint hover:text-ink",
              ].join(" ")}
            >
              {t("people.anon")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-soft">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition placeholder:text-line focus:border-ink/40"
      />
    </div>
  );
}

/**
 * SEEDS panel — for the person stuck on a blank card. Fetches short possible ANGLES on the
 * decision (each a doorway, not a finished view) and lets them pick one. Picking prefills the
 * write form and hands control back to the person, who must supply their own words.
 */
function SeedsPanel({
  decision,
  lang,
  onPick,
  onBack,
}: {
  decision: string;
  lang: "en" | "ko";
  onPick: (angle: string, nudge: string) => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const [seeds, setSeeds] = useState<SeedSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [asked, setAsked] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const { seeds: s, mode } = await fetchSeeds(decision, lang, 5);
      // a failed call used to land the person on a silent empty list with no message
      if (mode === "error" || s.length === 0) {
        setFailed(true);
        return;
      }
      setSeeds(s);
      setAsked(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-up rounded-xl2 border border-line bg-paper-card p-5 shadow-card">
      <p className="text-[12px] leading-snug text-ink-soft">{t("seeds.intro")}</p>

      {failed && (
        <div className="mt-3 rounded-lg border border-tension/40 bg-tension/5 px-3 py-2 text-[12px] leading-snug text-ink">
          ⚠︎ {t("common.aiFailed")}
        </div>
      )}

      {!asked ? (
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition enabled:hover:opacity-90 disabled:bg-line disabled:text-ink-faint"
          >
            💡 {loading ? t("seeds.loading") : t("seeds.get")}
          </button>
          <button
            onClick={onBack}
            className="rounded-full px-3 py-2 text-xs font-medium text-ink-faint transition hover:text-ink"
          >
            ← {t("entry.write")}
          </button>
        </div>
      ) : (
        <>
          <ul className="mt-4 space-y-2">
            {seeds.map((s, i) => (
              <li
                key={`${s.angle}-${i}`}
                className="animate-fade-up rounded-xl border border-line bg-paper p-3.5 transition hover:border-accent/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink">{s.angle}</div>
                    <div className="mt-1 text-[13px] leading-snug text-ink-soft">{s.nudge}</div>
                  </div>
                  <button
                    onClick={() => onPick(s.angle, s.nudge)}
                    className="shrink-0 rounded-full border border-accent/40 px-3 py-1.5 text-[11px] font-medium text-accent transition hover:bg-accent hover:text-white"
                  >
                    {t("seeds.pick")} →
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition enabled:hover:text-ink disabled:text-line"
            >
              ↻ {loading ? t("seeds.loading") : t("seeds.regen")}
            </button>
            <button
              onClick={onBack}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-ink-faint transition hover:text-ink"
            >
              ← {t("entry.write")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * TALK panel — for the person who can't yet name what they see. The AI asks a few questions;
 * the person answers in their OWN words; the AI extracts card DRAFTS from that answer, which
 * the person edits before adding. Extraction paraphrases their words — it never invents a view.
 */
/** Talk-mode state, owned by GatherScreen so it survives entry-mode switches. */
interface TalkState {
  phase: "intro" | "answer" | "drafts";
  setPhase: (p: "intro" | "answer" | "drafts") => void;
  questions: string[];
  setQuestions: (q: string[]) => void;
  answer: string;
  setAnswer: (a: string) => void;
  drafts: CardCandidate[];
  setDrafts: (d: CardCandidate[] | ((prev: CardCandidate[]) => CardCandidate[])) => void;
  added: Set<number>;
  setAdded: (s: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
}

function TalkPanel({
  decision,
  lang,
  onAddCard,
  onBack,
  talk,
}: {
  decision: string;
  lang: "en" | "ko";
  onAddCard: (title: string, body: string) => void;
  onBack: () => void;
  talk: TalkState;
}) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  // phase/questions/answer/drafts live in the PARENT: they used to be local state, so
  // clicking any entry-mode button unmounted this panel and silently destroyed a long
  // answer and any drafts not yet added. Switching modes must not cost you your words.
  const { phase, setPhase, questions, setQuestions, answer, setAnswer, drafts, setDrafts, added, setAdded } = talk;

  const start = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const { questions: qs, mode } = await fetchTalkQuestions(decision, lang);
      if (mode === "error" || qs.length === 0) {
        setFailed(true);
        return;
      }
      setQuestions(qs);
      setPhase("answer");
    } finally {
      setLoading(false);
    }
  };

  const extract = async () => {
    if (answer.trim().length < 8) return;
    setLoading(true);
    setFailed(false);
    try {
      const { cards, mode } = await fetchTalkExtract(decision, answer.trim(), lang);
      // don't drop them into an empty "drafts" screen when the call simply failed —
      // their answer is still in the box and retrying must stay possible.
      if (mode === "error") {
        setFailed(true);
        return;
      }
      setDrafts(cards);
      setAdded(new Set());
      setPhase("drafts");
    } finally {
      setLoading(false);
    }
  };

  const editDraft = (i: number, patch: Partial<CardCandidate>) =>
    setDrafts((d) => d.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const restart = () => {
    setPhase("intro");
    setQuestions([]);
    setAnswer("");
    setDrafts([]);
    setAdded(new Set());
  };

  return (
    <div className="animate-fade-up rounded-xl2 border border-line bg-paper-card p-5 shadow-card">
      {failed && (
        <div className="mb-3 rounded-lg border border-tension/40 bg-tension/5 px-3 py-2 text-[12px] leading-snug text-ink">
          ⚠︎ {t("common.aiFailed")}
        </div>
      )}
      {phase === "intro" && (
        <>
          <p className="text-[12px] leading-snug text-ink-soft">{t("talk.intro")}</p>
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={start}
              disabled={loading}
              className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition enabled:hover:opacity-90 disabled:bg-line disabled:text-ink-faint"
            >
              💬 {loading ? t("talk.loadingQ") : t("talk.start")}
            </button>
            <button onClick={onBack} className="rounded-full px-3 py-2 text-xs font-medium text-ink-faint transition hover:text-ink">
              ← {t("entry.write")}
            </button>
          </div>
        </>
      )}

      {phase === "answer" && (
        <>
          <ul className="space-y-1.5">
            {questions.map((q, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-snug text-ink">
                <span className="text-accent">•</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
          <label className="mt-4 block text-[11px] font-medium text-ink-soft">{t("talk.answerLabel")}</label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={5}
            maxLength={1200}
            placeholder={t("talk.answerPlaceholder")}
            className="mt-1 w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition placeholder:text-line focus:border-ink/40"
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={extract}
              disabled={loading || answer.trim().length < 8}
              className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition enabled:hover:opacity-95 disabled:bg-line disabled:text-ink-faint"
            >
              {loading ? t("talk.extracting") : `${t("talk.extract")} →`}
            </button>
            <button onClick={onBack} className="rounded-full px-3 py-2 text-xs font-medium text-ink-faint transition hover:text-ink">
              ← {t("entry.write")}
            </button>
          </div>
        </>
      )}

      {phase === "drafts" && (
        <>
          {drafts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line bg-paper-sunken/40 p-5 text-center text-[13px] text-ink-faint">
              {t("talk.noDrafts")}
            </div>
          ) : (
            <>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                {t("talk.draftsHeading")}
              </div>
              <ul className="mt-2 space-y-3">
                {drafts.map((c, i) => (
                  <li key={i} className="animate-fade-up rounded-xl border border-line bg-paper p-3">
                    <input
                      value={c.title}
                      onChange={(e) => editDraft(i, { title: e.target.value })}
                      className="w-full rounded-md border border-line bg-paper-card px-2.5 py-1.5 text-sm font-semibold text-ink outline-none focus:border-ink/40"
                    />
                    <textarea
                      value={c.body}
                      onChange={(e) => editDraft(i, { body: e.target.value })}
                      rows={2}
                      className="mt-1.5 w-full resize-none rounded-md border border-line bg-paper-card px-2.5 py-1.5 text-[13px] text-ink-soft outline-none focus:border-ink/40"
                    />
                    <button
                      onClick={() => {
                        if (added.has(i) || !c.title.trim() || !c.body.trim()) return;
                        onAddCard(c.title.trim(), c.body.trim());
                        setAdded((s) => new Set(s).add(i));
                      }}
                      disabled={added.has(i) || !c.title.trim() || !c.body.trim()}
                      className="mt-2 rounded-full border border-accent/40 px-3 py-1.5 text-[11px] font-medium text-accent transition enabled:hover:bg-accent enabled:hover:text-white disabled:border-line disabled:text-ink-faint"
                    >
                      {added.has(i) ? `✓ ${t("decide.saved")}` : `+ ${t("talk.addDraft")}`}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="mt-3 flex items-center gap-2">
            <button onClick={restart} className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:text-ink">
              ↻ {t("talk.restart")}
            </button>
            <button onClick={onBack} className="rounded-full px-3 py-1.5 text-xs font-medium text-ink-faint transition hover:text-ink">
              ← {t("entry.write")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
