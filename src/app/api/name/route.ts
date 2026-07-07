import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { namePrompt, type NameInput } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

/** Deterministic fallback name from the shared words across fragment titles. */
function localName(
  input: NameInput,
  lang: "en" | "ko"
): { name: string; note: string; question: string } {
  // pick the most frequent meaningful word across titles as a rough handle
  const stop = new Set([
    "the", "a", "an", "of", "to", "and", "or", "for", "on", "in", "is", "are",
    "our", "we", "us", "it", "this", "that", "with", "가", "이", "은", "는", "을", "를", "에", "의",
  ]);
  const counts = new Map<string, number>();
  for (const f of input.fragments) {
    for (const w of f.title.toLowerCase().split(/\s+/)) {
      const clean = w.replace(/[^\p{L}\p{N}]/gu, "");
      if (clean.length < 3 || stop.has(clean)) continue;
      counts.set(clean, (counts.get(clean) ?? 0) + 1);
    }
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const name = top
    ? top.charAt(0).toUpperCase() + top.slice(1)
    : lang === "ko"
    ? "우리의 공통 주제"
    : "Our shared theme";
  const note =
    lang === "ko"
      ? `${input.fragments.length}개 조각이 이 하나로 모였어요.`
      : `${input.fragments.length} fragments gathered into one.`;
  const crux = input.cruxTitle;
  const question =
    lang === "ko"
      ? crux
        ? `그래서 진짜 질문은: “${crux}”을(를) 먼저 풀면 나머지도 풀릴까요?`
        : `그래서 진짜 질문은: 이 중에서 무엇을 먼저 풀어야 할까요?`
      : crux
      ? `So the real question is: if we resolve “${crux}” first, does the rest follow?`
      : `So the real question is: which of these should we resolve first?`;
  return { name, note, question };
}

export async function POST(req: NextRequest) {
  let body: { input?: NameInput; lang?: "en" | "ko" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const input = body.input;
  const lang = body.lang === "ko" ? "ko" : "en";
  if (!input || !input.fragments?.length) {
    return NextResponse.json({ error: "no input" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ...localName(input, lang), mode: "sample" });
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: namePrompt(input, lang) }],
      response_format: { type: "json_object" },
      temperature: 0.5,
    });
    const text = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text) as { name?: unknown; note?: unknown; question?: unknown };
    const name = String(parsed.name ?? "").trim().slice(0, 60);
    if (!name) return NextResponse.json({ ...localName(input, lang), mode: "fallback" });
    const question = String(parsed.question ?? "").trim().slice(0, 200) || localName(input, lang).question;
    return NextResponse.json({
      name,
      note: String(parsed.note ?? "").slice(0, 120),
      question,
      mode: "live",
    });
  } catch (err) {
    console.error("[name] LLM error", err);
    return NextResponse.json({ ...localName(input, lang), mode: "error" });
  }
}
