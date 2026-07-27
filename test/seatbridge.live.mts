/**
 * DO THE PROPOSED BRIDGES ACTUALLY CROSS PEOPLE?  — kept as the NEGATIVE result.
 *
 * RESULT (gpt-4.1, 5 runs each, table below): asking the prompt to prefer cross-seat links
 * did NOTHING. Baseline 64% cross-seat / 2.8 of 4 seats; with the instruction 58% / 2.4 —
 * no effect, slightly worse, within noise. The quietest seat (jae) appeared in 0/5 baseline
 * runs and 1/5 instructed runs.
 *
 * That instruction has since been removed. The fix that worked is structural and lives in
 * src/app/api/bridges/route.ts (`selectForSeatCoverage`): overshoot the model's ask, then
 * select for seat coverage server-side — 100% cross-seat, 4.0 of 4 seats, jae 5/5. See
 * test/seatselect.live.mts.
 *
 * This file stays because the null is the argument: it is the local replication of
 * HiddenBench's finding that these failures "persist across prompting strategies", and it is
 * why the mechanism is not a prompt. Re-run it before anyone proposes fixing this with words.
 *
 * The last prompt-only fix (CROSS THE SEATS, in namePrompt) measured 3.0 seats before and
 * 3.0 after — no effect. HiddenBench (Li, Naito & Shirado, ICML 2026) explains why: these
 * failures "persist across prompting strategies". So this change gets measured at the point
 * it claims to act — which bridges the model proposes — before it is believed.
 *
 * The table is built so the DECOY is tempting: Rae holds three pieces that plausibly link to
 * each other, and three other people hold one piece each. A model optimizing "grow one
 * connected group" can satisfy itself entirely inside Rae's three notes and never reach
 * anyone else. That is exactly the real failure this is meant to fix.
 *
 * Metric: share of proposed bridges that join two DIFFERENT people's pieces, and how many
 * distinct seats the proposals bring into the picture.
 *
 * Usage: OPENAI_API_KEY=... npx tsx test/seatbridge.live.mts [model] [runs]
 */
import OpenAI from "openai";
import { bridgePrompt } from "../src/lib/prompts.ts";
import type { Fragment } from "../src/lib/types.ts";

const MODEL = process.argv[2] || "gpt-4.1";
const RUNS = Number(process.argv[3] || 5);

const F = (id: string, seat: string, title: string, body: string): Fragment =>
  ({ id, title, body, authorRole: seat, authorName: seat, x: 0.5, y: 0.5 });

// Rae's three pieces are all about the same contract story — genuinely linkable to each
// other, which is what makes the monologue tempting. The cross-seat links are the ones that
// carry information no single person holds.
const fragments = [
  F("f1", "rae", "Vendor contract", "The renewal we signed in March fixes the seat count until next March. Adding seats mid-term needs a new negotiation."),
  F("f2", "rae", "Renewal terms", "The March renewal also locked the per-seat price, which is why finance liked it."),
  F("f3", "rae", "Procurement queue", "Any new negotiation with this vendor takes about six weeks to get through legal."),
  F("f4", "tae", "Onboarding calls", "New accounts are waiting nine days for a setup call. Two churned last month while waiting."),
  F("f5", "min", "Q3 numbers", "Conversion on the trial tier is down eleven percent quarter over quarter."),
  F("f6", "jae", "Thursday sync", "The three of us spent most of Thursday re-explaining the same workflow to different people."),
];

const seatOf = (id: string) => fragments.find((f) => f.id === id)?.authorName ?? "?";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function run(prompt: string) {
  const c = await client.chat.completions.create({
    model: MODEL, messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }, temperature: 0.4,
  });
  const parsed = JSON.parse(c.choices[0]?.message?.content ?? "{}") as {
    bridges?: Array<{ fragmentAId: string; fragmentBId: string; relationType: string }>;
  };
  const bridges = (parsed.bridges ?? []).filter(
    (b) => seatOf(b.fragmentAId) !== "?" && seatOf(b.fragmentBId) !== "?"
  );
  const cross = bridges.filter((b) => seatOf(b.fragmentAId) !== seatOf(b.fragmentBId));
  const seats = new Set<string>();
  for (const b of cross) { seats.add(seatOf(b.fragmentAId)); seats.add(seatOf(b.fragmentBId)); }
  return { total: bridges.length, cross: cross.length, seats: seats.size, bridges };
}

console.log(`\nmodel=${MODEL}  runs=${RUNS}  table: 6 pieces, 4 people (Rae holds 3)\n`);
let tCross = 0, tAll = 0, tSeats = 0;
for (let i = 0; i < RUNS; i++) {
  const r = await run(bridgePrompt(fragments, "en", 4));
  tCross += r.cross; tAll += r.total; tSeats += r.seats;
  const shape = r.bridges
    .map((b) => `${seatOf(b.fragmentAId)}→${seatOf(b.fragmentBId)}`)
    .join("  ");
  console.log(`[${i + 1}] ${r.cross}/${r.total} cross-seat · ${r.seats} seats reached   ${shape}`);
}
console.log("\n" + "═".repeat(66));
console.log(`cross-seat share : ${tAll ? Math.round((tCross / tAll) * 100) : 0}%  (${tCross}/${tAll})`);
console.log(`avg seats reached: ${(tSeats / RUNS).toFixed(1)} of 4`);
console.log("═".repeat(66));
