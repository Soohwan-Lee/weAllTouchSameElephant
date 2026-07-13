"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/store";
import { isReachable } from "@/lib/clusters";
import { RELATION_META } from "@/lib/relation";
import { RELATION_TYPES, type RelationType } from "@/lib/types";
import { PuzzleCanvas } from "./PuzzleCanvas";

/**
 * Wraps the board and adds a "draw your own connection" mode.
 * GOAL: let the team encode a link the AI missed. RATIONALE: humans hold context
 * the model can't see; a manual bridge is the SAME object as an AI bridge, just
 * marked human-made. Gentle guard: requires picking a relation + optional reason,
 * so people connect deliberately rather than linking everything.
 */
export function ManualConnect() {
  const { t } = useI18n();
  const fragments = useSession((s) => s.fragments);
  const bridges = useSession((s) => s.bridges);
  const addManualBridge = useSession((s) => s.addManualBridge);

  const [mode, setMode] = useState(false);
  const [picks, setPicks] = useState<string[]>([]);
  const [rel, setRel] = useState<RelationType>("overlap");
  const [note, setNote] = useState("");

  const byId = (id: string) => fragments.find((f) => f.id === id);
  const ready = picks.length === 2;
  // redundant = the two picks already connect through other pieces, so this edge
  // adds no new glue — only a restated relation. We nudge, we don't block.
  const redundant = ready && isReachable(picks[0], picks[1], bridges);

  const pick = (id: string) => {
    setPicks((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 2) return [cur[1], id];
      return [...cur, id];
    });
  };

  const reset = () => {
    setPicks([]);
    setNote("");
    setRel("overlap");
  };

  const create = () => {
    if (!ready) return;
    const ok = addManualBridge(picks[0], picks[1], rel, note.trim());
    if (ok) {
      reset();
      setMode(false);
    }
  };

  return (
    <div>
      <div className="relative">
        <PuzzleCanvas connectMode={mode} selectedIds={picks} onPickFragment={pick} />

        {/* mode banner overlay */}
        {mode && (
          <div className="absolute inset-x-3 top-3 flex items-center justify-between rounded-lg bg-ink/90 px-3 py-2 text-xs font-medium text-paper shadow-lift backdrop-blur">
            <span>
              {picks.length === 0
                ? t("manual.pickFirst")
                : picks.length === 1
                ? t("manual.pickSecond")
                : `${byId(picks[0])?.title} ↔ ${byId(picks[1])?.title}`}
            </span>
            <button onClick={() => { reset(); setMode(false); }} className="text-paper/70 hover:text-paper">
              ✕ {t("manual.cancel")}
            </button>
          </div>
        )}
      </div>

      {/* controls under the board */}
      {!mode ? (
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-ink-faint">{t("canvas.hintConnect")}</p>
          <button
            onClick={() => setMode(true)}
            className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-accent hover:text-accent"
          >
            {t("manual.start")}
          </button>
        </div>
      ) : ready ? (
        <div className="mt-3 animate-fade-up rounded-xl border border-accent/30 bg-accent-soft/40 p-4">
          {redundant && (
            <div className="mb-3 rounded-lg border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-xs leading-relaxed text-amber-900">
              <span className="font-medium">↩︎ {t("nudge.redundant")}</span>{" "}
              {t("nudge.redundantAsk")}
            </div>
          )}
          <div className="text-sm font-medium text-ink">{t("manual.chooseRelation")}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {RELATION_TYPES.map((r) => (
              <button
                key={r}
                onClick={() => setRel(r)}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  rel === r ? "border-transparent text-white" : "border-line bg-paper-card text-ink-faint hover:text-ink",
                ].join(" ")}
                style={rel === r ? { backgroundColor: RELATION_META[r].color } : undefined}
              >
                {t(RELATION_META[r].shortKey)} · {t(RELATION_META[r].labelKey)}
              </button>
            ))}
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("manual.note")}
            className="mt-3 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={create}
              className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:opacity-95"
            >
              ✓ {redundant ? t("nudge.linkAnyway") : t("manual.create")}
            </button>
            <button
              onClick={reset}
              className="rounded-full px-3 py-2 text-xs font-medium text-ink-faint transition hover:text-ink"
            >
              {t("manual.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-center text-xs text-ink-faint">
          {picks.length === 0 ? t("manual.pickFirst") : t("manual.pickSecond")}
        </p>
      )}
    </div>
  );
}
