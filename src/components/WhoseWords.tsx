"use client";

import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/store";
import { seatOf } from "@/lib/clusters";

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
 * This row reports PRESENCE only. It used to also name the seats the reading missed, which
 * put absence on screen three times over — here, in "Left out of the shape", and in "In the
 * shape, but not used above" — each computed over a different scope, so the three could
 * contradict each other within one scroll. Absence now belongs to those panels alone: they
 * scope it correctly, name the pieces, and offer somewhere to go. Keeping the positive half
 * here still does the social work of telling people their contribution survived.
 *
 * The ids come from the server-verified grounding trace, so a fabricated citation can never
 * put a name here — the handle has to have resolved to a real piece on this table.
 */
/** The display name for a seat. Shares one definition of "whose piece is this" with the graph
 *  layer, so the panel on Connect and the names under the reading can't drift apart; the only
 *  difference is that an unattributed piece shows a dash here instead of its synthetic id. */
const label = (f: { authorName: string; authorRole: string; id: string }) => {
  const s = seatOf(f as Parameters<typeof seatOf>[0]);
  return s.startsWith("__anon_") ? "—" : s;
};

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
    const key = label(f);
    if (!seats.has(key)) seats.set(key, { label: key, titles: [] });
    seats.get(key)!.titles.push(f.title);
  }

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
    </div>
  );
}
