import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { blindTypePrompt, bridgePrompt, type BridgeContext } from "@/lib/prompts";
import type { BridgeProposal, Fragment, RelationType } from "@/lib/types";
import { RELATION_TYPES } from "@/lib/types";
import { seatOf } from "@/lib/clusters";
import { filterToVerifiedEvidence } from "@/lib/evidence";
import { contestFromBlindReading, pickContestTarget, surfaceContests } from "@/lib/contest";
import { settledPairKey, settledPairSet } from "@/lib/settledPairs";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

function sanitize(raw: unknown, fragments: Fragment[]): BridgeProposal[] {
  const ids = new Set(fragments.map((f) => f.id));
  const out: BridgeProposal[] = [];
  const arr =
    raw && typeof raw === "object" && Array.isArray((raw as { bridges?: unknown }).bridges)
      ? ((raw as { bridges: unknown[] }).bridges as unknown[])
      : [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const b = item as Record<string, unknown>;
    const a = String(b.fragmentAId ?? "");
    const c = String(b.fragmentBId ?? "");
    const rel = String(b.relationType ?? "") as RelationType;
    if (!ids.has(a) || !ids.has(c) || a === c) continue;
    if (!RELATION_TYPES.includes(rel)) continue;
    out.push({
      fragmentAId: a,
      fragmentBId: c,
      relationType: rel,
      explanation: String(b.explanation ?? "").slice(0, 400),
      evidenceA: String(b.evidenceA ?? "").slice(0, 200),
      evidenceB: String(b.evidenceB ?? "").slice(0, 200),
    });
  }
  return out;
}

/**
 * WHICH proposals survive to the tray — a selection rule, not a request to the model.
 *
 * Asking the prompt to prefer cross-seat links was measured and did nothing: 64% cross-seat
 * before, 58% after (test/seatbridge.live.mts, gpt-4.1, 5 runs each). That matches HiddenBench
 * (Li, Naito & Shirado, ICML 2026), where collective-reasoning failures "persist across
 * prompting strategies" — and where the intervention that DID work (0.037 → 0.800) was
 * structural rather than instructional. So the rule lives here, where compliance is not
 * optional, and the prompt keeps only the honesty guard.
 *
 * The rule is max-min, the objective two independent literatures converge on: Alsobay et al.
 * (CSCW 2026, N=1,475) found LLM facilitation helped by "raising the minimum level of
 * engagement", and the collective-dialogues bridging rule (Konya, Schirch, Irwin & Ovadya)
 * ranks by the LOWEST agreement across groups. Here the minimum being raised is the seat with
 * no link to anyone else's piece.
 *
 * Greedy, in one pass over the model's own order (which stays the tie-break, since it leads
 * with its sharpest links): repeatedly take the proposal that brings in a seat not yet in the
 * picture; then any cross-seat proposal; then the rest. This never invents or reorders on
 * quality — every returned bridge is one the model actually proposed, and the team still
 * confirms or rejects each one.
 */
function selectForSeatCoverage(
  candidates: BridgeProposal[],
  fragments: Fragment[],
  context: BridgeContext | undefined,
  max: number
): BridgeProposal[] {
  // one definition of "whose piece is this", shared with the graph layer — three copies of
  // this expression with three different fallbacks is how the seat count and the seat panel
  // quietly start disagreeing.
  // `seatOf` gives an unattributed piece its own synthetic seat so it never merges with other
  // unattributed ones. That is right for counting, but wrong here: two anonymous pieces would
  // read as "crossing seats" and win the ranking on a table that has no seats at all. Blank
  // means unknown, and unknown must not earn the cross-seat bonus.
  const seatFor = (id: string) => {
    const f = fragments.find((x) => x.id === id);
    if (!f) return "";
    const s = seatOf(f);
    return s.startsWith("__anon_") ? "" : s;
  };
  // Seats already reaching someone else's piece — those are not the minimum to raise.
  const heard = new Set<string>();
  for (const c of context?.confirmed ?? []) {
    if (c.relationType === "separate") continue; // a boundary joins nobody
    const a = seatFor(c.aId);
    const b = seatFor(c.bId);
    if (a && b && a !== b) { heard.add(a); heard.add(b); }
  }

  const picked: BridgeProposal[] = [];
  const taken = new Set<number>();
  while (picked.length < max) {
    let best = -1;
    let bestGain = -1;
    for (let i = 0; i < candidates.length; i++) {
      if (taken.has(i)) continue;
      const c = candidates[i];
      const a = seatFor(c.fragmentAId);
      const b = seatFor(c.fragmentBId);
      // gain 2: brings in a seat nobody has reached · 1: crosses seats · 0: same seat
      const crosses = a && b && a !== b;
      const gain = !crosses ? 0 : (!heard.has(a) || !heard.has(b)) ? 2 : 1;
      if (gain > bestGain) { bestGain = gain; best = i; }
      if (bestGain === 2) break; // can't beat it; keep the model's order among equals
    }
    if (best < 0) break;
    const c = candidates[best];
    taken.add(best);
    picked.push(c);
    const a = seatFor(c.fragmentAId);
    const b = seatFor(c.fragmentBId);
    if (a && b && a !== b) { heard.add(a); heard.add(b); }
  }
  return picked;
}

export async function POST(req: NextRequest) {
  let body: {
    fragments?: Fragment[];
    lang?: "en" | "ko";
    max?: number;
    context?: BridgeContext;
    decision?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const fragments = body.fragments ?? [];
  const lang = body.lang === "ko" ? "ko" : "en";
  const max = Math.min(6, Math.max(1, body.max ?? 3));
  const decision = String(body.decision ?? "").slice(0, 400);
  // What the team has already confirmed or dismissed — so a later round proposes something
  // new instead of re-offering work they have already done or refused.
  const context: BridgeContext | undefined = body.context
      ? {
        settledPairKeys: Array.isArray(body.context.settledPairKeys)
          ? body.context.settledPairKeys.map(String).slice(0, 4000)
          : [],
        confirmed: Array.isArray(body.context.confirmed) ? body.context.confirmed.slice(0, 40) : [],
        rejectedPairs: Array.isArray(body.context.rejectedPairs)
          ? body.context.rejectedPairs.slice(0, 40)
          : [],
        contested: Array.isArray(body.context.contested)
          ? body.context.contested.slice(0, 40)
          : [],
        round: Math.max(0, Math.floor(Number(body.context.round) || 0)),
      }
    : undefined;

  if (fragments.length < 2) {
    return NextResponse.json({ bridges: [], mode: "empty" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Signal the client to fall back to the scenario's pre-baked bridges.
    return NextResponse.json({ bridges: [], mode: "sample" });
  }

  // WHICH link, if any, gets a second look this round — decided here, before any model is
  // asked anything. Letting the model volunteer a target produced zero contests across live
  // runs, including on tables with deliberately mistyped links.
  const contestLink = pickContestTarget(context?.confirmed ?? [], context?.contested, context?.round);
  const fragOf = (id: string) => fragments.find((f) => f.id === id);
  const targetA = contestLink && fragOf(contestLink.aId);
  const targetB = contestLink && fragOf(contestLink.bId);

  try {
    const client = new OpenAI({ apiKey });
    // The blind read runs as its own call, alongside the bridge call rather than inside it,
    // because it must NOT see the board: no recorded type, no confirmed-links history, no
    // other cards. That isolation is the entire mechanism — a model that can see what the team
    // decided agrees with it (measured: 0/9 detection), and one that cannot simply reads the
    // cards. Both calls are issued together since neither depends on the other's answer.
    const blindCall =
      contestLink && targetA && targetB
        ? client.chat.completions
            .create({
              model: MODEL,
              messages: [
                {
                  role: "user",
                  content: blindTypePrompt(
                    targetA.title,
                    targetA.body,
                    targetB.title,
                    targetB.body,
                    lang
                  ),
                },
              ],
              response_format: { type: "json_object" },
              temperature: 0.4,
            })
            // A failed second look must never cost the round its bridges.
            .catch(() => null)
        : Promise.resolve(null);

    const [completion, blind] = await Promise.all([
      client.chat.completions.create({
        model: MODEL,
        // Ask for more than we show. A selection rule can only choose among what it is given,
        // and at max=3 the model often returns 3 links that all sit inside one person's pieces —
        // leaving nothing cross-seat to select. The overshoot is what gives the rule a choice;
        // the extras are discarded, never shown.
        messages: [
          { role: "user", content: bridgePrompt(fragments, lang, Math.min(8, max + 3), context, decision) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      }),
      blindCall,
    ]);
    const text = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text);
    // Telling the model not to re-propose settled pairs is a request; enforcing it here is
    // not. A pair the team already connected or explicitly dismissed must never come back,
    // however the model behaves — re-offering refused work is the most visible way this tool
    // could tell a team their decisions did not count.
    const settled = settledPairSet(context);
    const proposed = sanitize(parsed, fragments)
      .filter((b) => !settled.has(settledPairKey(b.fragmentAId, b.fragmentBId)));
    // Every snippet the team will read has to be quotable off the card it is attached to.
    // Dropping happens BEFORE selection so seat coverage chooses among links that can survive
    // being checked, rather than spending a seat on one that gets pulled afterwards.
    const candidates = filterToVerifiedEvidence(proposed, fragments);
    const unquotable = proposed.length - candidates.length;
    if (unquotable > 0) {
      console.log(`[bridges] dropped ${unquotable}/${proposed.length} proposals — evidence not a span of the cited card`);
    }
    const bridges = selectForSeatCoverage(candidates, fragments, context, max);
    // How the blind pass read the same two cards, compared against what the team recorded.
    // Kept entirely off the bridges path — a discrepancy that fails verification must never
    // cost the round a proposal, and it does not count against `max`, because it is a
    // different kind of thing than "here is another link to consider".
    let blindReading: unknown;
    if (blind) {
      try {
        blindReading = JSON.parse(blind.choices[0]?.message?.content ?? "{}");
      } catch {
        blindReading = undefined;
      }
    }
    const wouldSurface = contestLink
      ? contestFromBlindReading(blindReading, fragments, contestLink)
      : undefined;
    // THIS LOG IS THE RESEARCH INSTRUMENT, not a debug aid. Nothing about the second look
    // reaches a screen today (see surfaceContests), so these lines are the only record of how
    // often a cold reading of two cards matches the reading of the people who wrote them —
    // the measurement that decides whether this feature ever surfaces. One line per judged
    // round, whatever the outcome: counting only the disagreements would be counting the
    // numerator alone.
    if (contestLink) {
      const read = (blindReading as { relationType?: string } | undefined)?.relationType ?? "none";
      const agree = read === contestLink.relationType;
      console.log(
        `[bridges] blind ${contestLink.aId}↔${contestLink.bId} recorded=${contestLink.relationType} blind=${read} ` +
          `${agree ? "agree" : "disagree"} would-surface=${wouldSurface ? "yes" : "no"} surfaced=${surfaceContests() ? "yes" : "no"}`
      );
    }
    // Ship-dark: the pipeline runs, the log records, the team sees nothing. The client code
    // that renders and answers a contest stays live and tested so this is one constant away
    // from working rather than something to rebuild.
    const contest = surfaceContests() ? wouldSurface : undefined;
    // The model spoke and nothing it said survived. That is a real state and its own answer:
    // "no strong connections found" reads as a judgment about the cards, so a team told that
    // after every proposal failed verification would go edit pieces that were never the
    // problem. Naming it lets the UI say what would actually help instead.
    //
    // The contest is dropped here on purpose. A round where every proposal failed span
    // verification has demonstrably bad grounding on these cards, and trusting its judgment of
    // an EXISTING link in the same breath would be incoherent — as would telling the team
    // "there isn't enough material to connect anything" beside a confident question about a
    // connection they already made.
    if (!bridges.length && proposed.length) {
      return NextResponse.json({ bridges: [], mode: "insufficient" });
    }
    return NextResponse.json({ bridges, mode: "live", contest });
  } catch (err) {
    console.error("[bridges] LLM error", err);
    return NextResponse.json({ bridges: [], mode: "error" });
  }
}
