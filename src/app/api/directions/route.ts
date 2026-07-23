import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { directionsPrompt, type DecisionDirection } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

type Pair = { a: string; b: string };

/**
 * Deterministic fallback — starting DIRECTIONS built from the shape, no invention. Each is a
 * handle grounded in the core or a kept tension, never a finished decision. If the team kept
 * tensions, offer to decide across one of them; otherwise offer to act on / test the core.
 */
function sampleDirections(cruxTitle: string | undefined, tensions: Pair[], lang: "en" | "ko"): DecisionDirection[] {
  const ko = lang === "ko";
  const core = cruxTitle ?? (ko ? "핵심" : "the core");
  const out: DecisionDirection[] = [];

  if (tensions[0]) {
    const t = tensions[0];
    out.push(
      ko
        ? { direction: `"${t.a}"를 먼저 정하고 "${t.b}"는 그다음에`, because: `남겨둔 긴장 "${t.a}" ⟷ "${t.b}"에서 한쪽을 먼저 택하는 길이에요.` }
        : { direction: `Settle "${t.a}" first, revisit "${t.b}" after`, because: `takes one side of the kept tension "${t.a}" ⟷ "${t.b}" as the thing to decide first.` }
    );
    out.push(
      ko
        ? { direction: `"${t.a}"와 "${t.b}"를 둘 다 살리는 작은 실험부터`, because: `긴장을 없애지 않고, 작게 시험해 어느 쪽이 실제로 무너지는지 보는 길이에요.` }
        : { direction: `Run a small test that honors both "${t.a}" and "${t.b}"`, because: `keeps the tension alive and lets reality, not argument, show which side gives.` }
    );
  }
  out.push(
    ko
      ? { direction: `"${core}"를 먼저 결정하고 나머지는 그 뒤에`, because: `이게 나머지를 끌고 가는 뿌리라면, 여기부터 정해야 아래가 따라와요.` }
      : { direction: `Decide "${core}" first; let the rest follow`, because: `if this is the root the rest hang on, naming it first is what unblocks them.` }
  );
  return out.slice(0, 3);
}

export async function POST(req: NextRequest) {
  let body: {
    decision?: string;
    realQuestion?: string;
    cruxTitle?: string;
    tensions?: Pair[];
    lang?: "en" | "ko";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const lang = body.lang === "ko" ? "ko" : "en";
  const decision = String(body.decision ?? "").slice(0, 400);
  const realQuestion = String(body.realQuestion ?? "").slice(0, 400);
  const cruxTitle = body.cruxTitle ? String(body.cruxTitle).slice(0, 120) : undefined;
  const tensions = Array.isArray(body.tensions) ? body.tensions.slice(0, 12) : [];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ directions: sampleDirections(cruxTitle, tensions, lang), mode: "sample" });
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: directionsPrompt(decision, realQuestion, cruxTitle, tensions, lang) }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as Record<string, unknown>;
    const directions = Array.isArray(parsed.directions)
      ? parsed.directions
          .map((d) => {
            const o = d as Record<string, unknown>;
            return { direction: String(o.direction ?? "").trim().slice(0, 160), because: String(o.because ?? "").trim().slice(0, 200) };
          })
          .filter((d) => d.direction)
          .slice(0, 3)
      : [];
    return NextResponse.json({
      directions: directions.length ? directions : sampleDirections(cruxTitle, tensions, lang),
      mode: "live",
    });
  } catch (err) {
    console.error("[directions] LLM error", err);
    return NextResponse.json({ directions: sampleDirections(cruxTitle, tensions, lang), mode: "error" });
  }
}
