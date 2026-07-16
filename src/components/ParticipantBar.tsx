"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/store";

/**
 * "Who's at the table?" — add people and pick the active one. The active participant
 * stamps their name + id on the pieces and bridges they contribute, so the "team" is
 * modeled as distinct voices instead of one anonymous keyboard. Locally-modeled now;
 * the seam a future per-device build attaches to.
 */
export function ParticipantBar() {
  const { t } = useI18n();
  const participants = useSession((s) => s.participants);
  const activeId = useSession((s) => s.activeParticipantId);
  const addParticipant = useSession((s) => s.addParticipant);
  const removeParticipant = useSession((s) => s.removeParticipant);
  const setActive = useSession((s) => s.setActiveParticipant);

  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  const add = () => {
    if (!name.trim()) return;
    addParticipant(name, role);
    setName("");
    setRole("");
  };

  return (
    <div className="animate-fade-up rounded-xl2 border border-line bg-paper-card p-4 shadow-card">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-ink">👥 {t("people.heading")}</span>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-ink-faint">{t("people.hint")}</p>

      {/* existing people as selectable chips */}
      {participants.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {participants.map((p) => {
            const active = p.id === activeId;
            return (
              <div
                key={p.id}
                className={[
                  "group flex items-center gap-1.5 rounded-full border py-1 pl-2 pr-1 text-[12px] transition",
                  active ? "border-transparent text-white" : "border-line bg-paper text-ink-soft hover:border-ink/30",
                ].join(" ")}
                style={active ? { backgroundColor: p.color } : undefined}
              >
                <button onClick={() => setActive(p.id)} className="flex items-center gap-1.5" title={t("people.adding")}>
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: active ? "rgba(255,255,255,0.9)" : p.color }}
                  />
                  <span className="font-semibold">{p.name}</span>
                  <span className={active ? "text-white/80" : "text-ink-faint"}>· {p.role}</span>
                </button>
                <button
                  onClick={() => removeParticipant(p.id)}
                  className={[
                    "rounded-full px-1 text-[11px] leading-none opacity-0 transition group-hover:opacity-100",
                    active ? "text-white/80 hover:text-white" : "text-ink-faint hover:text-tension",
                  ].join(" ")}
                  aria-label={t("people.remove")}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-ink-faint">{t("people.empty")}</p>
      )}

      {/* add a person */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={t("people.namePlaceholder")}
          className="w-28 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[13px] text-ink outline-none transition placeholder:text-line focus:border-ink/40"
        />
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={t("people.rolePlaceholder")}
          className="w-32 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[13px] text-ink outline-none transition placeholder:text-line focus:border-ink/40"
        />
        <button
          onClick={add}
          disabled={!name.trim()}
          className="rounded-full border border-line px-3 py-1.5 text-[12px] font-medium text-ink-soft transition enabled:hover:border-accent enabled:hover:text-accent disabled:text-line"
        >
          + {t("people.add")}
        </button>
      </div>
    </div>
  );
}
