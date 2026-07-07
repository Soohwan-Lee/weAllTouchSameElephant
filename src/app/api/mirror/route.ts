import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { mirrorPrompt, type MirrorInput } from "@/lib/prompts";
import type { MirrorReflection } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter(Boolean).slice(0, 12);
}

/** Deterministic reflection used in sample mode / on error — no new claims. */
function localMirror(input: MirrorInput, lang: "en" | "ko"): MirrorReflection {
  const connected: string[] = [];
  const tensions: string[] = [];
  for (const b of input.bridges) {
    const line =
      lang === "ko"
        ? `“${b.aTitle}”와(과) “${b.bTitle}”이(가) 이어졌어요.`
        : `“${b.aTitle}” and “${b.bTitle}” came together.`;
    if (b.relationType === "tension") {
      tensions.push(
        lang === "ko"
          ? `“${b.aTitle}”와(과) “${b.bTitle}” 사이에 긴장이 남아 있어요.`
          : `“${b.aTitle}” and “${b.bTitle}” are still in tension.`
      );
    } else {
      connected.push(line);
    }
  }
  const separate = input.looseTitles.map((t) =>
    lang === "ko" ? `“${t}”은(는) 아직 따로 있어요.` : `“${t}” is still on its own.`
  );
  return { connected, tensions, separate };
}

export async function POST(req: NextRequest) {
  let body: { input?: MirrorInput; lang?: "en" | "ko" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const input = body.input;
  const lang = body.lang === "ko" ? "ko" : "en";
  if (!input) return NextResponse.json({ error: "no input" }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ reflection: localMirror(input, lang), mode: "sample" });
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: mirrorPrompt(input, lang) }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });
    const text = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const reflection: MirrorReflection = {
      connected: toStringArray(parsed.connected),
      tensions: toStringArray(parsed.tensions),
      separate: toStringArray(parsed.separate),
    };
    // guard: if the model returned nothing usable, fall back to the local mirror
    if (!reflection.connected.length && !reflection.tensions.length && !reflection.separate.length) {
      return NextResponse.json({ reflection: localMirror(input, lang), mode: "fallback" });
    }
    return NextResponse.json({ reflection, mode: "live" });
  } catch (err) {
    console.error("[mirror] LLM error", err);
    return NextResponse.json({ reflection: localMirror(input, lang), mode: "error" });
  }
}
