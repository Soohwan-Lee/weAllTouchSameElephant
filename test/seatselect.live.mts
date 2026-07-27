/**
 * DOES THE SELECTION RULE DO WHAT THE PROMPT COULD NOT?
 *
 * test/seatbridge.live.mts measured the prompt-only version of this fix and found nothing:
 * 64% cross-seat before, 58% after. This measures the same table through the actual route —
 * overshoot the ask, then select for seat coverage server-side — against the same baseline.
 *
 * Runs the real POST handler, so what is measured is what ships.
 *
 * Usage: OPENAI_API_KEY=... npx tsx test/seatselect.live.mts [model] [runs]
 */
import { POST } from "../src/app/api/bridges/route.ts";
import type { Bridge, Fragment } from "../src/lib/types.ts";

const MODEL = process.argv[2] || "gpt-4.1";
const RUNS = Number(process.argv[3] || 5);
process.env.OPENAI_MODEL = MODEL;

const F = (id: string, seat: string, title: string, body: string): Fragment =>
  ({ id, title, body, authorRole: seat, authorName: seat, x: 0.5, y: 0.5 });

// identical table to seatbridge.live.mts, so the numbers are comparable
const fragments = [
  F("f1", "rae", "Vendor contract", "The renewal we signed in March fixes the seat count until next March. Adding seats mid-term needs a new negotiation."),
  F("f2", "rae", "Renewal terms", "The March renewal also locked the per-seat price, which is why finance liked it."),
  F("f3", "rae", "Procurement queue", "Any new negotiation with this vendor takes about six weeks to get through legal."),
  F("f4", "tae", "Onboarding calls", "New accounts are waiting nine days for a setup call. Two churned last month while waiting."),
  F("f5", "min", "Q3 numbers", "Conversion on the trial tier is down eleven percent quarter over quarter."),
  F("f6", "jae", "Thursday sync", "The three of us spent most of Thursday re-explaining the same workflow to different people."),
];
const seatOf = (id: string) => fragments.find((f) => f.id === id)?.authorName ?? "?";

async function once() {
  const req = new Request("http://local/api/bridges", {
    method: "POST",
    headers: { "content-type": "application/json" },
    // max 3 — the tray size a team actually sees
    body: JSON.stringify({ fragments, lang: "en", max: 3 }),
  });
  const res = await POST(req as never);
  const { bridges } = (await res.json()) as { bridges: Bridge[] };
  const cross = bridges.filter((b) => seatOf(b.fragmentAId) !== seatOf(b.fragmentBId));
  const seats = new Set<string>();
  for (const b of cross) { seats.add(seatOf(b.fragmentAId)); seats.add(seatOf(b.fragmentBId)); }
  return { bridges, cross: cross.length, total: bridges.length, seats };
}

console.log(`\nmodel=${MODEL}  runs=${RUNS}  table: 6 pieces, 4 people (Rae holds 3)`);
console.log(`BASELINE to beat (prompt-only, same table): 64% cross-seat, 2.8/4 seats\n`);
let tCross = 0, tAll = 0, tSeats = 0, jaeSeen = 0;
for (let i = 0; i < RUNS; i++) {
  const r = await once();
  tCross += r.cross; tAll += r.total; tSeats += r.seats.size;
  if (r.seats.has("jae")) jaeSeen++;
  const shape = r.bridges.map((b) => `${seatOf(b.fragmentAId)}→${seatOf(b.fragmentBId)}`).join("  ");
  console.log(`[${i + 1}] ${r.cross}/${r.total} cross-seat · ${r.seats.size} seats   ${shape}`);
}
console.log("\n" + "═".repeat(66));
console.log(`cross-seat share : ${tAll ? Math.round((tCross / tAll) * 100) : 0}%  (${tCross}/${tAll})`);
console.log(`avg seats reached: ${(tSeats / RUNS).toFixed(1)} of 4`);
console.log(`jae (quietest seat) reached: ${jaeSeen}/${RUNS} runs   ← baseline was 0/5`);
console.log("═".repeat(66));
