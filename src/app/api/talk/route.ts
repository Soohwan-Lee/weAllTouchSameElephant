import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { talkQuestionsPrompt, talkExtractPrompt, type CardCandidate } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

/** Generic facilitator questions when there's no key/decision. */
function sampleQuestions(lang: "en" | "ko"): string[] {
  return lang === "ko"
    ? [
        "이 문제에서 당신이 직접 부딪히는 부분은 무엇인가요?",
        "다른 사람은 놓치는데 당신은 보는 게 있다면?",
        "이게 잘못되면 당신에게 무슨 일이 생기나요?",
      ]
    : [
        "What part of this do you deal with directly?",
        "What do you see that others on the team might miss?",
        "If this goes wrong, what happens to you or your work?",
      ];
}

/** No-key extract fallback: split the person's own answer into sentence-sized drafts.
 *  This is NOT AI paraphrase — it's the person's exact words chunked, which they then edit. */
function sampleExtract(answer: string): CardCandidate[] {
  const parts = answer
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8)
    .slice(0, 4);
  return parts.map((p) => {
    const words = p.split(/\s+/);
    const title = words.slice(0, 5).join(" ") + (words.length > 5 ? "…" : "");
    return { title: title.slice(0, 60), body: p.slice(0, 400) };
  });
}

function sanitizeQuestions(raw: unknown): string[] {
  const arr =
    raw && typeof raw === "object" && Array.isArray((raw as { questions?: unknown }).questions)
      ? ((raw as { questions: unknown[] }).questions as unknown[])
      : [];
  return arr
    .map((q) => String(q ?? "").trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, 3);
}

function sanitizeCards(raw: unknown): CardCandidate[] {
  const arr =
    raw && typeof raw === "object" && Array.isArray((raw as { cards?: unknown }).cards)
      ? ((raw as { cards: unknown[] }).cards as unknown[])
      : [];
  const out: CardCandidate[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const title = String(c.title ?? "").trim().slice(0, 60);
    const body = String(c.body ?? "").trim().slice(0, 400);
    if (!title || !body) continue;
    out.push({ title, body });
  }
  return out.slice(0, 5);
}

export async function POST(req: NextRequest) {
  let body: { action?: "questions" | "extract"; decision?: string; answer?: string; lang?: "en" | "ko" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const action = body.action === "extract" ? "extract" : "questions";
  const decision = String(body.decision ?? "").trim();
  const answer = String(body.answer ?? "").trim();
  const lang = body.lang === "ko" ? "ko" : "en";
  const apiKey = process.env.OPENAI_API_KEY;

  // ---- questions ----
  if (action === "questions") {
    if (!apiKey || !decision) {
      return NextResponse.json({ questions: sampleQuestions(lang), mode: "sample" });
    }
    try {
      const client = new OpenAI({ apiKey });
      const completion = await client.chat.completions.create({
        model: MODEL,
        messages: [{ role: "user", content: talkQuestionsPrompt(decision, lang) }],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });
      const qs = sanitizeQuestions(JSON.parse(completion.choices[0]?.message?.content ?? "{}"));
      return qs.length
        ? NextResponse.json({ questions: qs, mode: "live" })
        : NextResponse.json({ questions: sampleQuestions(lang), mode: "sample" });
    } catch (err) {
      console.error("[talk/questions] LLM error", err);
      return NextResponse.json({ questions: sampleQuestions(lang), mode: "sample" });
    }
  }

  // ---- extract ----
  if (!answer) return NextResponse.json({ cards: [], mode: "empty" });
  if (!apiKey) {
    return NextResponse.json({ cards: sampleExtract(answer), mode: "sample" });
  }
  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: talkExtractPrompt(decision, answer, lang) }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });
    const cards = sanitizeCards(JSON.parse(completion.choices[0]?.message?.content ?? "{}"));
    return cards.length
      ? NextResponse.json({ cards, mode: "live" })
      : NextResponse.json({ cards: sampleExtract(answer), mode: "sample" });
  } catch (err) {
    console.error("[talk/extract] LLM error", err);
    return NextResponse.json({ cards: sampleExtract(answer), mode: "sample" });
  }
}
