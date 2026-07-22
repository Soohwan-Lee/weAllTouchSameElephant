import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { tradeOffPrompt, type TradeOff } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

type Pair = { a: string; b: string };

/** Deterministic fallback — read the first kept tension straight back, no invention. */
function sampleTradeOff(tensions: Pair[], separations: Pair[], lang: "en" | "ko"): TradeOff {
  const ko = lang === "ko";
  const t = tensions[0] ?? separations[0];
  if (!t) {
    return ko
      ? { tension: "", favors: "", cost: "이 결정이 무엇을 포기하는지는 남겨둔 긴장이 없어 아직 드러나지 않아요." }
      : { tension: "", favors: "", cost: "No kept tension yet, so what this decision gives up isn't visible here." };
  }
  return ko
    ? {
        tension: `"${t.a}" ⟷ "${t.b}"`,
        favors: `"${t.a}" 쪽`,
        cost: `"${t.b}"이(가) 뒤로 밀립니다.`,
      }
    : {
        tension: `"${t.a}" vs "${t.b}"`,
        favors: `the "${t.a}" side`,
        cost: `"${t.b}" is what gives way.`,
      };
}

export async function POST(req: NextRequest) {
  let body: {
    decision?: string;
    tensions?: Pair[];
    separations?: Pair[];
    lang?: "en" | "ko";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const lang = body.lang === "ko" ? "ko" : "en";
  const decision = String(body.decision ?? "").slice(0, 400);
  const tensions = Array.isArray(body.tensions) ? body.tensions.slice(0, 12) : [];
  const separations = Array.isArray(body.separations) ? body.separations.slice(0, 12) : [];
  if (!decision.trim()) return NextResponse.json({ error: "no decision" }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ...sampleTradeOff(tensions, separations, lang), mode: "sample" });
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: tradeOffPrompt(decision, tensions, separations, lang) }],
      response_format: { type: "json_object" },
      temperature: 0.4,
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as Record<string, unknown>;
    return NextResponse.json({
      tension: String(parsed.tension ?? "").trim().slice(0, 160),
      favors: String(parsed.favors ?? "").trim().slice(0, 160),
      cost: String(parsed.cost ?? "").trim().slice(0, 200),
      mode: "live",
    });
  } catch (err) {
    console.error("[tradeoff] LLM error", err);
    return NextResponse.json({ ...sampleTradeOff(tensions, separations, lang), mode: "error" });
  }
}
