import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { blindSpotPrompt, type BlindSpot } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

type Piece = { title: string; body: string; role: string };

/**
 * Deterministic fallback — genuinely grounded, no model. If every piece comes from a
 * "making/running/cost" seat and nobody speaks for the people affected, THAT is the blind
 * spot, and we can say so from the role tags alone. This keeps sample mode honest: it names
 * a real gap in the roles present, it doesn't invent a perspective.
 */
function sampleBlindSpot(pieces: Piece[], lang: "en" | "ko"): BlindSpot {
  const roles = pieces.map((p) => (p.role || "").toLowerCase());
  const has = (needles: string[]) => roles.some((r) => needles.some((n) => r.includes(n)));
  const ko = lang === "ko";

  // The rationale is BUILT FROM THE ACTUAL ROLES ON THE TABLE, not a canned line — so it
  // cites "3 of 4 pieces are from a cost/engineering seat", never a generic "did you think
  // of the user?". A reviewer's complaint about premortem-template genericness dies here.
  const named = [...new Set(pieces.map((p) => p.role).filter((r) => r && r !== "—"))];
  const rolesPhrase = named.length
    ? named.join(", ")
    : ko
    ? "역할 표시가 없는 자리"
    : "unlabeled seats";
  const ground = ko
    ? `조각 ${pieces.length}개가 ${rolesPhrase} 자리에서 나왔는데, `
    : `${pieces.length} pieces come from ${rolesPhrase} — `;

  // the affected/user seat is the one teams most often leave empty
  const hasUserVoice = has(["user", "customer", "resident", "사용자", "고객", "주민", "이용", "affected", "당사자"]);
  if (!hasUserVoice && pieces.length > 0) {
    return ko
      ? {
          angle: "이걸 실제로 쓸/겪을 사람",
          rationale: ground + "정작 이 결정을 매일 겪게 될 당사자의 자리는 비어 있어요.",
          question: "이 결정으로 매일 영향을 받는 사람은 무엇을 가장 아쉬워할까요?",
        }
      : {
          angle: "The person who lives with it",
          rationale: ground + "no one is sitting in the seat of the person who'd actually live with this decision.",
          question: "What would the person affected day-to-day find most lacking here?",
        };
  }

  // otherwise nudge toward the longer horizon, which short decisions tend to skip
  return ko
    ? {
        angle: "1년 뒤의 우리",
        rationale: ground + "이 결정이 시간이 지나 무엇을 남길지는 아무도 적지 않았어요.",
        question: "이 결정이 1년 뒤에도 옳았다고 말하려면 그 사이 무엇이 참이어야 할까요?",
      }
    : {
        angle: "Us, a year from now",
        rationale: ground + "no one has named what this decision leaves behind over time.",
        question: "For this to still look right in a year, what would have to hold true in between?",
      };
}

export async function POST(req: NextRequest) {
  let body: { decision?: string; pieces?: Piece[]; lang?: "en" | "ko" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const lang = body.lang === "ko" ? "ko" : "en";
  const pieces = Array.isArray(body.pieces) ? body.pieces.slice(0, 30) : [];
  const decision = String(body.decision ?? "").slice(0, 300);
  if (!pieces.length) return NextResponse.json({ error: "no pieces" }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ ...sampleBlindSpot(pieces, lang), mode: "sample" });

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: blindSpotPrompt(decision, pieces, lang) }],
      response_format: { type: "json_object" },
      temperature: 0.6,
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as Record<string, unknown>;
    const angle = String(parsed.angle ?? "").trim().slice(0, 60);
    if (!angle) return NextResponse.json({ angle: "", rationale: "", question: "", mode: "live" });
    const rationale = String(parsed.rationale ?? "").trim().slice(0, 200);

    // A rationale that names no role actually on the table is exactly the generic
    // "did you consider the user?" the review warned about. If the model returns one, fall
    // back to the graph-grounded template — which cites the real roles by construction.
    const presentRoles = [...new Set(pieces.map((p) => (p.role || "").toLowerCase()).filter((r) => r && r !== "—"))];
    const citesARole =
      presentRoles.length === 0 || presentRoles.some((r) => rationale.toLowerCase().includes(r));
    if (!citesARole) {
      const grounded = sampleBlindSpot(pieces, lang);
      return NextResponse.json({ angle, rationale: grounded.rationale, question: String(parsed.question ?? "").trim().slice(0, 200) || grounded.question, mode: "live" });
    }

    return NextResponse.json({
      angle,
      rationale,
      question: String(parsed.question ?? "").trim().slice(0, 200),
      mode: "live",
    });
  } catch (err) {
    console.error("[blindspot] LLM error", err);
    return NextResponse.json({ ...sampleBlindSpot(pieces, lang), mode: "error" });
  }
}
