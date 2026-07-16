import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { seedsPrompt, type SeedSuggestion } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

/** Deterministic fallback angles (no API key). Kept generic on purpose — a seed is a
 *  doorway the person fills in, so vantage-neutral prompts are exactly right here. */
function sampleSeeds(lang: "en" | "ko"): SeedSuggestion[] {
  const en: SeedSuggestion[] = [
    { angle: "The daily grind", nudge: "What part of this do you deal with directly that others might not see?", lens: "frontline" },
    { angle: "What people feel", nudge: "Who is affected by this, and what do they complain about most?", lens: "customer" },
    { angle: "The trade-off", nudge: "What are you being forced to give up to get something else here?", lens: "lead" },
    { angle: "What's fragile", nudge: "What's shaky under the surface that could break if this changes?", lens: "builder" },
    { angle: "The quiet worry", nudge: "What are you privately worried about that no one has said out loud?", lens: "anyone" },
  ];
  const ko: SeedSuggestion[] = [
    { angle: "매일의 현장", nudge: "이 문제에서 당신이 직접 부딪히는, 남들은 못 보는 부분은?", lens: "frontline" },
    { angle: "사람들이 느끼는 것", nudge: "누가 영향을 받고, 그들이 가장 자주 불평하는 건 무엇인가요?", lens: "customer" },
    { angle: "트레이드오프", nudge: "여기서 무언가를 얻기 위해 포기하도록 강요받는 것은?", lens: "lead" },
    { angle: "취약한 지점", nudge: "표면 아래에서 흔들리는, 바뀌면 깨질 수 있는 건?", lens: "builder" },
    { angle: "조용한 걱정", nudge: "아무도 소리 내어 말하지 않았지만 당신이 조용히 걱정하는 건?", lens: "anyone" },
  ];
  return lang === "ko" ? ko : en;
}

function sanitize(raw: unknown, max: number): SeedSuggestion[] {
  const arr =
    raw && typeof raw === "object" && Array.isArray((raw as { seeds?: unknown }).seeds)
      ? ((raw as { seeds: unknown[] }).seeds as unknown[])
      : [];
  const out: SeedSuggestion[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    const angle = String(s.angle ?? "").trim().slice(0, 60);
    const nudge = String(s.nudge ?? "").trim().slice(0, 200);
    if (!angle || !nudge) continue;
    out.push({ angle, nudge, lens: String(s.lens ?? "").trim().slice(0, 24) || "anyone" });
  }
  return out.slice(0, max);
}

export async function POST(req: NextRequest) {
  let body: { decision?: string; lang?: "en" | "ko"; max?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const decision = String(body.decision ?? "").trim();
  const lang = body.lang === "ko" ? "ko" : "en";
  const max = Math.min(6, Math.max(3, body.max ?? 5));

  const apiKey = process.env.OPENAI_API_KEY;
  // No key, or no decision to anchor on → deterministic generic angles.
  if (!apiKey || !decision) {
    return NextResponse.json({ seeds: sampleSeeds(lang).slice(0, max), mode: "sample" });
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: seedsPrompt(decision, lang, max) }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });
    const text = completion.choices[0]?.message?.content ?? "{}";
    const seeds = sanitize(JSON.parse(text), max);
    if (!seeds.length) return NextResponse.json({ seeds: sampleSeeds(lang).slice(0, max), mode: "sample" });
    return NextResponse.json({ seeds, mode: "live" });
  } catch (err) {
    console.error("[seeds] LLM error", err);
    return NextResponse.json({ seeds: sampleSeeds(lang).slice(0, max), mode: "sample" });
  }
}
