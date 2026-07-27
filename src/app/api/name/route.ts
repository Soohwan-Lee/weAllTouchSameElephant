import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { namePrompt, type NameInput } from "@/lib/prompts";
import type { GroundingTrace, NameResult, RevealMode } from "@/lib/types";
import { REVEAL_MODES, stripQuestionLeadIn } from "@/lib/types";
import {
  buildGroundingTable,
  groundingReport,
  resolveToIds,
  verifyClaim,
  type GroundedClaim,
  type GroundingTable,
} from "@/lib/grounding";
import type { Bridge, Fragment } from "@/lib/types";

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
  // no "so the real question is…" lead-in — the result panel's label already says that.
  const question =
    lang === "ko"
      ? crux
        ? `“${crux}”을(를) 먼저 풀면 나머지도 풀릴까요?`
        : `이 중에서 무엇을 먼저 풀어야 할까요?`
      : crux
      ? `If we resolve “${crux}” first, does the rest follow?`
      : `Which of these should we resolve first?`;

  const base = { name, note, question, mode };
  if (mode === "explore") {
    return {
      ...base,
      readings: crux
        ? lang === "ko"
          ? [`“${crux}”이(가) 나머지를 끌고 가는 축일 수 있어요.`, "겹쳐 보이는 여러 증상이 사실은 따로 놀 수도 있고요."]
          : [`“${crux}” may be the axis the rest turn on.`, "Or these could be separate symptoms that only look like one."]
        : lang === "ko"
        ? ["하나의 뿌리가 나머지를 낳고 있을 수 있어요.", "아니면 별개의 문제들이 우연히 겹친 것일 수도요."]
        : ["One root may be producing the rest.", "Or separate issues just happen to overlap here."],
    };
  }
  if (mode === "hypothesis") {
    return {
      ...base,
      hypothesis:
        lang === "ko"
          ? crux
            ? `“${crux}”이(가) 숨은 뿌리예요 — 맞다면 다른 조각들이 전부 여기서 갈라져 나올 거예요.`
            : "하나의 뿌리가 나머지를 만들고 있어요 — 그렇다면 그것만 건드려도 나머지가 함께 움직일 거예요."
          : crux
          ? `“${crux}” is the hidden root — if so, the other pieces all branch from it.`
          : "One root is producing the rest — if so, moving just it should move the others too.",
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

/**
 * Build the citable table from the request's own pieces and links.
 *
 * Returns null when the caller sent no ids — an older client, or a scenario path that only
 * has titles. In that case the prompt degrades to its previous title-only form and no
 * citations are requested, so nothing breaks; we simply cannot verify that run.
 */
function tableFor(input: NameInput): GroundingTable | null {
  if (!input.fragments.some((f) => f.id)) return null;
  // Only the shape `buildGroundingTable` reads is needed; the rest of Fragment/Bridge is
  // irrelevant here, so synthesize minimal records rather than demanding full objects
  // travel over the wire.
  const frags = input.fragments
    .filter((f) => f.id)
    .map(
      (f) =>
        ({
          id: f.id!,
          title: f.title,
          body: f.body,
          authorRole: f.authorRole ?? "",
          authorName: "",
          x: 0,
          y: 0,
        }) as Fragment
    );
  // Resolve a link's ends by id. Falling back to a title lookup would silently mis-resolve
  // when two pieces share a title, and drop the link entirely when neither matches — the link
  // would vanish from the prompt while its title still appeared in the shape block.
  const titleToId = new Map(frags.map((f) => [f.title, f.id]));
  const endId = (id: string | undefined, title: string) => id ?? titleToId.get(title) ?? "";
  const bridges = input.bridges
    .filter((b) => b.id)
    .map(
      (b) =>
        ({
          id: b.id!,
          fragmentAId: endId(b.aId, b.aTitle),
          fragmentBId: endId(b.bId, b.bTitle),
          relationType: b.relationType,
          explanation: b.explanation ?? "",
          evidenceA: b.evidenceA ?? "",
          evidenceB: b.evidenceB ?? "",
          confidence: 1,
          status: "confirmed",
          createdBy: b.humanDrawn ? "human" : "ai",
        }) as Bridge
    );
  const history = new Map(
    input.bridges
      .filter((b) => b.id && (b.aiRelationType || b.retyped || b.rewritten))
      .map((b) => [
        b.id!,
        { aiRelationType: b.aiRelationType, retyped: b.retyped, edited: b.rewritten },
      ])
  );
  return buildGroundingTable(frags, bridges, history);
}

/**
 * Check every claim in a response against the table and collapse the result into the trace
 * the client stores.
 *
 * Deliberately non-destructive: the caller keeps whatever prose the model produced no matter
 * how the verification lands. A model that cites nothing, or cites only invented handles,
 * yields a trace with `rate: 0` — a recorded fact about that run, not a reason to blank the
 * screen. The trace is the measurement; the prose is still the team's to judge.
 */
function traceFor(
  parsed: Record<string, unknown>,
  mode: RevealMode,
  table: GroundingTable
): GroundingTrace {
  const claims: Array<GroundedClaim<unknown>> = [
    verifyClaim(parsed.name, parsed.nameGrounds, table),
    verifyClaim(parsed.question, parsed.questionGrounds, table),
  ];
  // explore returns several readings, each with its own citation list; verdict/hypothesis one.
  const rg = parsed.readingGrounds;
  if (mode === "explore") {
    const readings = Array.isArray(parsed.readings) ? parsed.readings : [];
    readings.forEach((r, i) => {
      const g = Array.isArray(rg) ? rg[i] : undefined;
      claims.push(verifyClaim(r, g, table));
    });
  } else {
    claims.push(verifyClaim(parsed[mode], rg, table));
  }

  const report = groundingReport(claims);
  const { fragmentIds, bridgeIds } = resolveToIds(report.citedHandles, table);
  return {
    fragmentIds,
    bridgeIds,
    rate: Number(report.rate.toFixed(3)),
    fabricationRate: Number(report.fabricationRate.toFixed(3)),
    claims: report.claims,
  };
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

  const table = tableFor(input);

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: namePrompt(input, lang, mode, table ?? undefined) }],
      response_format: { type: "json_object" },
      // verdict wants commitment (lower temp); explore wants range (higher).
      temperature: mode === "verdict" ? 0.35 : mode === "hypothesis" ? 0.55 : 0.7,
    });
    const text = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const name = String(parsed.name ?? "").trim().slice(0, 60);
    if (!name) return NextResponse.json({ ...localName(input, lang, mode), mode });
    const question =
      stripQuestionLeadIn(String(parsed.question ?? "").trim()).slice(0, 220) ||
      localName(input, lang, mode).question;

    const out: Record<string, unknown> = {
      name,
      note: String(parsed.note ?? "").slice(0, 140),
      question,
      mode,
    };
    if (mode === "explore") {
      const readings = Array.isArray(parsed.readings)
        ? parsed.readings.map((r) => String(r).trim().slice(0, 280)).filter(Boolean).slice(0, 3)
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
    // Verified against the team's own table — see `traceFor`. Never gates the response.
    if (table) out.grounding = traceFor(parsed, mode, table);
    return NextResponse.json(out);
  } catch (err) {
    console.error("[name] LLM error", err);
    return NextResponse.json({ ...localName(input, lang, mode), mode });
  }
}
