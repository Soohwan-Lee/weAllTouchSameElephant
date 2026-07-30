"use client";

import { useI18n } from "@/lib/i18n";

interface PreRevealCheckpointCardProps {
  checkpointComplete: boolean;
  checkpointEditing: boolean;
  hypothesisDraft: string;
  setHypothesisDraft: (val: string) => void;
  falsifierDraft: string;
  setFalsifierDraft: (val: string) => void;
  saveCheckpoint: (skipped: boolean) => void;
  setCheckpointEditing: (editing: boolean) => void;
  savedPreReveal?: { hypothesis: string; disconfirmingEvidence: string; skipped: boolean } | null;
}

export function PreRevealCheckpointCard({
  checkpointComplete,
  checkpointEditing,
  hypothesisDraft,
  setHypothesisDraft,
  falsifierDraft,
  setFalsifierDraft,
  saveCheckpoint,
  setCheckpointEditing,
  savedPreReveal,
}: PreRevealCheckpointCardProps) {
  const { t } = useI18n();

  if (!checkpointComplete || checkpointEditing) {
    return (
      <div className="mt-4 w-full max-w-sm rounded-xl border border-accent/25 bg-paper-card p-4 text-left">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-accent">
          {t("checkpoint.eyebrow")}
        </div>
        <h3 className="mt-1 text-sm font-semibold text-ink">{t("checkpoint.heading")}</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
          {t("checkpoint.hint")}
        </p>
        <label className="mt-3 block text-[11px] font-medium text-ink-soft">
          {t("checkpoint.hypothesis")}
          <textarea
            value={hypothesisDraft}
            onChange={(event) => setHypothesisDraft(event.target.value)}
            rows={2}
            maxLength={400}
            placeholder={t("checkpoint.hypothesisPlaceholder")}
            className="mt-1 w-full resize-y rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition placeholder:text-line focus:border-accent"
          />
        </label>
        <label className="mt-3 block text-[11px] font-medium text-ink-soft">
          {t("checkpoint.falsifier")}
          <textarea
            value={falsifierDraft}
            onChange={(event) => setFalsifierDraft(event.target.value)}
            rows={2}
            maxLength={300}
            placeholder={t("checkpoint.falsifierPlaceholder")}
            className="mt-1 w-full resize-y rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition placeholder:text-line focus:border-accent"
          />
        </label>
        <button
          type="button"
          disabled={!hypothesisDraft.trim() || !falsifierDraft.trim()}
          onClick={() => saveCheckpoint(false)}
          className="mt-3 min-h-11 w-full rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white transition enabled:hover:opacity-95 disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-faint"
        >
          {t("checkpoint.save")} →
        </button>
        <button
          type="button"
          onClick={() => saveCheckpoint(true)}
          className="mt-1 min-h-11 w-full rounded-full px-4 py-2 text-[11px] font-medium text-ink-faint transition hover:text-ink"
        >
          {t("checkpoint.skip")}
        </button>
      </div>
    );
  }

  if (checkpointComplete) {
    return (
      <div className="mt-4 w-full max-w-sm rounded-xl border border-line bg-paper-card p-3 text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-ink">
            {savedPreReveal?.skipped
              ? t("checkpoint.skipped")
              : t("checkpoint.saved")}
          </span>
          <button
            type="button"
            onClick={() => setCheckpointEditing(true)}
            className="min-h-11 rounded-full px-2.5 py-2 text-[10px] font-medium text-accent hover:underline"
          >
            {t("checkpoint.edit")}
          </button>
        </div>
        {!savedPreReveal?.skipped && (
          <>
            <p className="mt-1 text-[11px] leading-snug text-ink-soft">
              {savedPreReveal?.hypothesis}
            </p>
            <p className="mt-1 text-[10px] leading-snug text-ink-faint">
              {t("checkpoint.falsifierShort")}:{" "}
              {savedPreReveal?.disconfirmingEvidence}
            </p>
          </>
        )}
      </div>
    );
  }

  return null;
}

