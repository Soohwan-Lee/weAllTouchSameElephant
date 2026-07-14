"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/store";
import {
  PIECE_TYPES,
  PIECE_TYPE_META,
  ROLE_LENSES,
  starterFrame,
  type PieceType,
} from "@/lib/starters";

export function GatherScreen() {
  const { t, lang } = useI18n();
  const fragments = useSession((s) => s.fragments);
  const addFragment = useSession((s) => s.addFragment);
  const removeFragment = useSession((s) => s.removeFragment);
  const setStep = useSession((s) => s.setStep);

  const [authorName, setAuthorName] = useState("");
  const [authorRole, setAuthorRole] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  // input scaffolding state: chosen piece type, role lens, and which spark question
  const [pieceType, setPieceType] = useState<PieceType | null>(null);
  const [lensId, setLensId] = useState("generic");
  const [qIdx, setQIdx] = useState(0);

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
    addFragment({
      authorName: authorName.trim() || "—",
      authorRole: authorRole.trim() || "—",
      title: title.trim(),
      body: body.trim(),
    });
    setTitle("");
    setBody("");
    setPieceType(null);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="animate-fade-up">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{t("gather.heading")}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-faint">{t("gather.hint")}</p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* input card */}
        <div className="animate-fade-up rounded-xl2 border border-line bg-paper-card p-5 shadow-card">
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

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("gather.author")} value={authorName} onChange={setAuthorName} placeholder="Jamie" />
            <Field label={t("gather.role")} value={authorRole} onChange={setAuthorRole} placeholder="Sales" />
          </div>
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
              placeholder={pieceType ? "" : t("scaffold.blankStuck")}
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
                      <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                        {f.authorName} · {f.authorRole}
                      </div>
                    </div>
                    <button
                      onClick={() => removeFragment(f.id)}
                      className="shrink-0 rounded-md px-2 py-1 text-[11px] text-ink-faint opacity-0 transition hover:bg-paper-sunken hover:text-tension group-hover:opacity-100"
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
          {canProceed ? `${t("gather.toConnect")} →` : t("gather.needMore")}
        </button>
      </div>
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
