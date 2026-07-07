"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/store";
import { RELATION_META } from "@/lib/relation";
import { RELATION_TYPES, type Bridge, type Fragment, type RelationType } from "@/lib/types";

export function BridgeCard({ bridge, fragA, fragB }: { bridge: Bridge; fragA?: Fragment; fragB?: Fragment }) {
  const { t } = useI18n();
  const confirmBridge = useSession((s) => s.confirmBridge);
  const rejectBridge = useSession((s) => s.rejectBridge);

  const [editing, setEditing] = useState(false);
  const [rel, setRel] = useState<RelationType>(bridge.relationType);
  const [explanation, setExplanation] = useState(bridge.explanation);

  const meta = RELATION_META[bridge.relationType];

  return (
    <div className="animate-fade-up rounded-xl border border-line bg-paper-card p-4 shadow-card">
      {/* the two endpoints */}
      <div className="flex items-center gap-2 text-xs">
        <span className="max-w-[42%] truncate rounded-md bg-paper-sunken px-2 py-1 font-medium text-ink">
          {fragA?.title ?? "?"}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
          style={{ backgroundColor: meta.color }}
        >
          {t(meta.shortKey)}
        </span>
        <span className="max-w-[42%] truncate rounded-md bg-paper-sunken px-2 py-1 font-medium text-ink">
          {fragB?.title ?? "?"}
        </span>
      </div>

      {!editing ? (
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">{bridge.explanation}</p>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {RELATION_TYPES.map((r) => (
              <button
                key={r}
                onClick={() => setRel(r)}
                className={[
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                  rel === r ? "border-transparent text-white" : "border-line text-ink-faint hover:text-ink",
                ].join(" ")}
                style={rel === r ? { backgroundColor: RELATION_META[r].color } : undefined}
              >
                {t(RELATION_META[r].shortKey)}
              </button>
            ))}
          </div>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
          />
        </div>
      )}

      {/* evidence */}
      {!editing && (bridge.evidenceA || bridge.evidenceB) && (
        <div className="mt-2.5 space-y-1 border-l-2 border-line pl-2.5 text-[11px] text-ink-faint">
          {bridge.evidenceA && <div>“{bridge.evidenceA}”</div>}
          {bridge.evidenceB && <div>“{bridge.evidenceB}”</div>}
        </div>
      )}

      {/* actions */}
      <div className="mt-4 flex items-center gap-2">
        {!editing ? (
          <>
            <button
              onClick={() => confirmBridge(bridge.id)}
              className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-white transition hover:opacity-95"
            >
              ✓ {t("bridge.confirm")}
            </button>
            <button
              onClick={() => setEditing(true)}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-ink hover:text-ink"
            >
              {t("bridge.edit")}
            </button>
            <button
              onClick={() => rejectBridge(bridge.id)}
              className="ml-auto rounded-full px-3 py-1.5 text-xs font-medium text-ink-faint transition hover:text-tension"
            >
              {t("bridge.reject")}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => {
                confirmBridge(bridge.id, { relationType: rel, explanation: explanation.trim() });
              }}
              className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-paper transition hover:opacity-90"
            >
              {t("bridge.save")}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setRel(bridge.relationType);
                setExplanation(bridge.explanation);
              }}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:text-ink"
            >
              {t("bridge.cancel")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
