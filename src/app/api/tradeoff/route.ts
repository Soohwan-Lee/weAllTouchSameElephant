import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { parseApiRequest } from "@/lib/apiRequest";
import { tradeOffPrompt, type TradeOff } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

/** A kept tension / separation. `id` is the real bridge id; `retyped` marks a relation the
 *  team changed INTO a tension after the AI proposed something else. */
type Pair = {
  a: string;
  b: string;
  id?: string;
  retyped?: boolean;
  why?: string;
  evidenceA?: string;
  evidenceB?: string;
};

/**
 * Words too generic to signal that a decision actually touches a tension's side. Includes
 * common light verbs (start/do/make/keep…): a decision and a tension can share "start"
 * without the decision being ABOUT that tension, which caused false matches (a hiring
 * decision snapping onto a "just start vs prove ROI" tension merely because both said
 * "start"). Only content words should carry a match.
 */
const STOP = new Set([
  "the","a","an","and","or","but","to","of","in","on","for","with","by","we","our","us","you",
  "will","would","should","must","can","do","does","did","is","are","be","been","that","this",
  "it","then","than","one","two","first","now","next","any","all","not","no","yes","from","at",
  "start","begin","make","made","get","got","keep","kept","take","took","go","going","put",
  "use","using","try","let","just","only","more","less","some","each","who","what","when","how",
  "그리고","그러나","우리","우리는","이","그","저","것","수","를","을","은","는","이가","에","의","로",
  "먼저","일단","그냥","지금","다시","좀","더","것을","한다","하고","해서","위해","대해","같은",
]);

/** significant tokens of a piece of text — lowercased words of length >= 2, minus stopwords */
function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 2 && !STOP.has(w))
  );
}

/**
 * How many significant tokens a tension side shares with the decision text.
 *
 * Exact set matching is not enough for Korean, which is agglutinative: the decision
 * "먼저 ROI부터 증명한다" and the tension side "ROI 증명" are plainly about the same thing, but
 * tokenize to {roi부터, 증명한다} and {roi, 증명} — zero exact overlap, so the decision looked
 * unrelated to a tension it obviously leans on and fell through to the opportunity-cost
 * branch. English split on spaces and happened to work, which is exactly how this stayed
 * hidden.
 *
 * So a side token also counts when it is a prefix of a decision token (or vice versa) with
 * the longer one at least 2 characters — enough to absorb particles and verb endings
 * (ROI/ROI부터, 증명/증명한다) without letting short fragments match everything. The threshold
 * is on the SIDE token's length, so a 1-character side token still requires an exact hit.
 */
function overlapScore(decisionTokens: Set<string>, sideTitle: string): number {
  let n = 0;
  for (const w of tokens(sideTitle)) {
    if (decisionTokens.has(w)) {
      n++;
      continue;
    }
    if (w.length < 2) continue;
    for (const d of decisionTokens) {
      if (d.length >= 2 && (d.startsWith(w) || w.startsWith(d))) {
        n++;
        break;
      }
    }
  }
  return n;
}

/**
 * Deterministic fallback — always names ONE cost, never "no trade-off", but now GROUNDED in
 * the decision text instead of blindly grabbing tensions[0]. That old behavior invented a
 * favors/gives-way split even for a decision that had nothing to do with any kept tension
 * (e.g. a joke "we sit still" still produced "leans toward X, Y gives way") — exactly the
 * out-of-context result to fix.
 *
 * Logic: only mirror a kept tension back when the decision actually LEANS toward one of its
 * sides — measured by real word-overlap between the decision and each side's title. Pick the
 * tension whose favored side the decision most clearly picks up, and only if that signal
 * clears a floor. Otherwise (a decision that engages no tension, or is too thin to read),
 * fall back to the honest OPPORTUNITY cost of committing at all — no fabricated favors/against.
 */
function sampleTradeOff(
  decision: string,
  tensions: Pair[],
  separations: Pair[],
  lang: "en" | "ko"
): TradeOff {
  const ko = lang === "ko";
  const decTokens = tokens(decision);

  // find the tension the decision most clearly leans on: a side whose title shares real words
  // with the decision. `favors` = that side; `cost` = the OTHER side (what gives way).
  let best: { tension: Pair; favors: string; against: string; score: number } | null = null;
  for (const t of [...tensions, ...separations]) {
    const sA = overlapScore(decTokens, t.a);
    const sB = overlapScore(decTokens, t.b);
    // the decision leans toward whichever side it echoes more; skip a tie of 0 (no signal)
    if (sA === 0 && sB === 0) continue;
    const favors = sA >= sB ? t.a : t.b;
    const against = sA >= sB ? t.b : t.a;
    // A tension the team RE-TYPED into a tension is one they explicitly insisted was a real
    // trade-off, overruling the AI's softer reading. Between two tensions the decision
    // touches about equally, that one is the more honest cost to surface — so it breaks the
    // tie. It never manufactures a match on its own: a tension with no word overlap is still
    // skipped above, so this only ranks candidates the decision already engages.
    const score = Math.max(sA, sB) + (t.retyped ? 0.5 : 0);
    if (!best || score > best.score) best = { tension: t, favors, against, score };
  }

  // Require at least ONE genuine shared term — otherwise the decision doesn't engage the
  // tension and forcing a favors/against split is the exact context-free bug we're fixing.
  // The re-typed bonus is deliberately fractional so it can only ever ORDER candidates that
  // already cleared this bar; it can never lift a tension the decision never touched.
  if (best && Math.floor(best.score) >= 1) {
    return ko
      ? {
          tension: `"${best.tension.a}" ⟷ "${best.tension.b}"`,
          favors: `"${best.favors}" 쪽`,
          cost: `그만큼 "${best.against}"은(는) 뒤로 밀립니다.`,
          groundedBridgeId: best.tension.id,
        }
      : {
          tension: `"${best.tension.a}" vs "${best.tension.b}"`,
          favors: `the "${best.favors}" side`,
          cost: `"${best.against}" is what gives way.`,
          groundedBridgeId: best.tension.id,
        };
  }

  // no tension the decision actually engages → the honest opportunity cost of committing.
  return ko
    ? {
        tension: "이 방향에 시간을 쓰는 것",
        favors: "지금 이 결정에 팀의 시간과 집중을 씁니다",
        cost: "여기에 쓰는 시간·집중은, 아직 열어둘 수 있었던 다른 선택지에서 빠져나갑니다.",
      }
    : {
        tension: "Spending time on this path",
        favors: "puts the team's time and attention on this decision now",
        cost: "the time and attention this takes is pulled from the other options you could have kept open.",
      };
}

export async function POST(req: NextRequest) {
  type Body = {
    decision?: string;
    tensions?: Pair[];
    separations?: Pair[];
    lang?: "en" | "ko";
  };
  const parsedRequest = await parseApiRequest<Body>(req, "tradeoff");
  if ("response" in parsedRequest) return parsedRequest.response;
  const body = parsedRequest.body;
  const lang = body.lang === "ko" ? "ko" : "en";
  const decision = String(body.decision ?? "").slice(0, 400);
  const tensions = Array.isArray(body.tensions) ? body.tensions.slice(0, 60) : [];
  const separations = Array.isArray(body.separations) ? body.separations.slice(0, 60) : [];
  if (!decision.trim()) return NextResponse.json({ error: "no decision" }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ...sampleTradeOff(decision, tensions, separations, lang), mode: "sample" });
  }

  // Mint a citable handle per kept tension/separation so the model must POINT at the one it
  // used instead of paraphrasing it — the difference between a cost we can trace to a link
  // the team confirmed and a cost that merely sounds like one.
  // Number handles over the entries that can actually HAVE one. Using the array index meant a
  // list whose first entry lacked an id produced "[T2]" with no T1 above it — a gap the model
  // reads as a handle it simply wasn't shown, and citing the missing T1 resolves to nothing.
  const withHandles = (list: Pair[], prefix: string) => {
    let n = 0;
    return list.map((p) => ({ ...p, handle: p.id ? `${prefix}${++n}` : undefined }));
  };
  const tensionsH = withHandles(tensions, "T");
  const separationsH = withHandles(separations, "S");
  const handleToId = new Map<string, string>();
  [...tensionsH, ...separationsH].forEach((p) => {
    if (p.handle && p.id) handleToId.set(p.handle, p.id);
  });

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "user", content: tradeOffPrompt(decision, tensionsH, separationsH, lang) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as Record<string, unknown>;
    // Resolve the cited handle back to a real bridge id. An invented handle resolves to
    // nothing and is simply dropped — the prose still ships, but it is recorded as an
    // untraceable cost rather than being passed off as read off the team's own tension.
    const cited = Array.isArray(parsed.grounds) ? parsed.grounds : [];
    let groundedBridgeId: string | undefined;
    for (const c of cited) {
      const key = String(c).trim().replace(/^\[|\]$/g, "").toUpperCase();
      const id = handleToId.get(key);
      if (id) {
        groundedBridgeId = id;
        break;
      }
    }
    return NextResponse.json({
      tension: String(parsed.tension ?? "").trim().slice(0, 160),
      favors: String(parsed.favors ?? "").trim().slice(0, 160),
      cost: String(parsed.cost ?? "").trim().slice(0, 200),
      mode: "live",
      groundedBridgeId,
    });
  } catch (err) {
    console.error("[tradeoff] LLM error", err);
    return NextResponse.json({ ...sampleTradeOff(decision, tensions, separations, lang), mode: "error" });
  }
}
