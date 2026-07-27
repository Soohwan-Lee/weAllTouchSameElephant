import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { bridgePrompt, type BridgeContext } from "@/lib/prompts";
import type { BridgeProposal, Fragment, RelationType } from "@/lib/types";
import { RELATION_TYPES } from "@/lib/types";

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
    const conf = Number(b.confidence);
    out.push({
      fragmentAId: a,
      fragmentBId: c,
      relationType: rel,
      explanation: String(b.explanation ?? "").slice(0, 400),
      evidenceA: String(b.evidenceA ?? "").slice(0, 200),
      evidenceB: String(b.evidenceB ?? "").slice(0, 200),
      confidence: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0.6,
    });
  }
  return out;
}

export async function POST(req: NextRequest) {
  let body: {
    fragments?: Fragment[];
    lang?: "en" | "ko";
    max?: number;
    context?: BridgeContext;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const fragments = body.fragments ?? [];
  const lang = body.lang === "ko" ? "ko" : "en";
  const max = Math.min(6, Math.max(1, body.max ?? 3));
  // What the team has already confirmed or dismissed — so a later round proposes something
  // new instead of re-offering work they have already done or refused.
  const context: BridgeContext | undefined = body.context
    ? {
        confirmed: Array.isArray(body.context.confirmed) ? body.context.confirmed.slice(0, 40) : [],
        rejectedPairs: Array.isArray(body.context.rejectedPairs)
          ? body.context.rejectedPairs.slice(0, 40)
          : [],
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

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: bridgePrompt(fragments, lang, max, context) }],
      response_format: { type: "json_object" },
      temperature: 0.4,
    });
    const text = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text);
    // Telling the model not to re-propose settled pairs is a request; enforcing it here is
    // not. A pair the team already connected or explicitly dismissed must never come back,
    // however the model behaves — re-offering refused work is the most visible way this tool
    // could tell a team their decisions did not count.
    const settled = new Set<string>();
    for (const c of context?.confirmed ?? []) settled.add([c.aId, c.bId].sort().join("|"));
    for (const r of context?.rejectedPairs ?? []) settled.add([r.aId, r.bId].sort().join("|"));
    const bridges = sanitize(parsed, fragments)
      .filter((b) => !settled.has([b.fragmentAId, b.fragmentBId].sort().join("|")))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, max);
    return NextResponse.json({ bridges, mode: "live" });
  } catch (err) {
    console.error("[bridges] LLM error", err);
    return NextResponse.json({ bridges: [], mode: "error" });
  }
}
