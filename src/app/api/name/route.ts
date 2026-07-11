import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { namePrompt, type NameInput } from "@/lib/prompts";
import type { NameResult, RevealMode } from "@/lib/types";
import { REVEAL_MODES } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

/** Deterministic fallback (no API key / error) — shape-aware but modest. */
function localName(input: NameInput, lang: "en" | "ko", mode: RevealMode): NameResult {
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
  const crux = input.cruxTitle;
  const note =
    lang === "ko"
      ? `${input.fragments.length}개 조각이 이 하나로 모였어요.`
      : `${input.fragments.length} fragments gathered into one.`;
  const question =
    lang === "ko"
      ? crux
        ? `그래서 진짜 질문은: “${crux}”을(를) 먼저 풀면 나머지도 풀릴까요?`
        : `그래서 진짜 질문은: 이 중에서 무엇을 먼저 풀어야 할까요?`
      : crux
      ? `So the real question is: if we resolve “${crux}” first, does the rest follow?`
      : `So the real question is: which of these should we resolve first?`;

  const base = { name, note, question, mode };
  if (mode === "explore") {
    return {
      ...base,
      readings: crux
        ? lang === "ko"
          ? [`어쩌면 이건 “${crux}”에 관한 이야기예요.`, "어쩌면 여러 증상이 겹친 것일 수도 있어요."]
          : [`Maybe this is really about “${crux}.”`, "Or maybe it's several symptoms overlapping."]
        : lang === "ko"
        ? ["어쩌면 하나의 뿌리가 있어요.", "어쩌면 별개의 문제들이 겹친 것일 수도요."]
        : ["Maybe there's one root.", "Or maybe separate issues just overlap."],
    };
  }
  if (mode === "hypothesis") {
    return {
      ...base,
      hypothesis:
        lang === "ko"
          ? crux
            ? `어쩌면 진짜 핵심은 “${crux}”이고, 그렇다면 다른 조각들도 여기서 갈라져 나올 거예요.`
            : "어쩌면 하나의 뿌리가 나머지를 만들고 있어요."
          : crux
          ? `Maybe the real core is “${crux}” — and if so, the other pieces branch from it.`
          : "Maybe one root is producing the rest.",
    };
  }
  return {
    ...base,
    verdict:
      lang === "ko"
        ? crux
          ? `핵심은 “${crux}”이고, 나머지는 그 증상이에요.`
          : "이것들은 하나의 핵심이 낳은 여러 얼굴이에요."
        : crux
        ? `The core is “${crux}” — the rest are its symptoms.`
        : "These are all faces of one core.",
  };
}

function pickMode(v: unknown): RevealMode {
  return REVEAL_MODES.includes(v as RevealMode) ? (v as RevealMode) : "explore";
}

export async function POST(req: NextRequest) {
  let body: { input?: NameInput; lang?: "en" | "ko"; mode?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const input = body.input;
  const lang = body.lang === "ko" ? "ko" : "en";
  const mode = pickMode(body.mode);
  if (!input || !input.fragments?.length) {
    return NextResponse.json({ error: "no input" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Signal the client to use the scenario's hand-written reveal (sample mode).
    return NextResponse.json({ ...localName(input, lang, mode), mode, sample: true });
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: namePrompt(input, lang, mode) }],
      response_format: { type: "json_object" },
      // verdict wants commitment (lower temp); explore wants range (higher).
      temperature: mode === "verdict" ? 0.35 : mode === "hypothesis" ? 0.55 : 0.7,
    });
    const text = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const name = String(parsed.name ?? "").trim().slice(0, 60);
    if (!name) return NextResponse.json({ ...localName(input, lang, mode), mode });
    const question =
      String(parsed.question ?? "").trim().slice(0, 220) || localName(input, lang, mode).question;

    const out: Record<string, unknown> = {
      name,
      note: String(parsed.note ?? "").slice(0, 140),
      question,
      mode,
    };
    if (mode === "explore") {
      const readings = Array.isArray(parsed.readings)
        ? parsed.readings.map((r) => String(r).slice(0, 200)).filter(Boolean).slice(0, 3)
        : [];
      out.readings = readings.length ? readings : localName(input, lang, mode).readings;
    } else if (mode === "hypothesis") {
      out.hypothesis =
        String(parsed.hypothesis ?? "").trim().slice(0, 240) ||
        localName(input, lang, mode).hypothesis;
    } else {
      out.verdict =
        String(parsed.verdict ?? "").trim().slice(0, 240) || localName(input, lang, mode).verdict;
    }
    return NextResponse.json(out);
  } catch (err) {
    console.error("[name] LLM error", err);
    return NextResponse.json({ ...localName(input, lang, mode), mode });
  }
}
