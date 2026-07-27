"use client";

import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/store";

/**
 * Whose pieces this reading was actually read off.
 *
 * Individual sensemaking tools cite back to *documents*, because their sources are artifacts
 * the single user is sovereign over. Here the sources are the people in the room, so the
 * citation has to resolve to a person: seeing "read from Rae's and Bo's pieces" under a
 * reading is a different social act from seeing a footnote. It tells the people cited that
 * their contribution survived the synthesis, and — more usefully — tells everyone NOT listed
 * that the AI's reading did not rest on theirs.
 *
 * That second half is the point. A synthesis that quietly leans on two of six voices looks
 * identical to one that integrates all six, unless the interface says which. Naming the
 * sources makes an unbalanced reading contestable instead of invisible.
 *
 * The ids come from the server-verified grounding trace, so a fabricated citation can never
 * put a name here — the handle has to have resolved to a real piece on this table.
 */
export function WhoseWords({ fragmentIds }: { fragmentIds: string[] }) {
  const { t } = useI18n();
  const fragments = useSession((s) => s.fragments);
  if (!fragmentIds?.length) return null;

  const cited = fragmentIds
    .map((id) => fragments.find((f) => f.id === id))
    .filter(Boolean) as typeof fragments;
  if (!cited.length) return null;

  // one chip per PERSON, not per piece: two pieces from the same seat is one voice leaned on,
  // and listing the seat twice would overstate how many perspectives the reading covers.
  const seats = new Map<string, { label: string; titles: string[] }>();
  for (const f of cited) {
    const key = f.authorName || f.authorRole || "—";
    if (!seats.has(key)) seats.set(key, { label: key, titles: [] });
    seats.get(key)!.titles.push(f.title);
  }

  const uncited = fragments.length - cited.length;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="text-ink-faint">{t("whose.readFrom")}</span>
      {[...seats.values()].map((s) => (
        <span
          key={s.label}
          title={s.titles.join(" · ")}
          className="rounded-full border border-line bg-paper-sunken px-2 py-0.5 font-medium text-ink-soft"
        >
          {s.label}
        </span>
      ))}
      {uncited > 0 && (
        // Saying what the reading did NOT rest on is the half that makes it contestable.
        <span className="text-ink-faint">{t("whose.notFrom").replace("{n}", String(uncited))}</span>
      )}
    </div>
  );
}
