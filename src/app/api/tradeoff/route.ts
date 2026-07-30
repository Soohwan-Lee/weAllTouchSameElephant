import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { parseApiRequest } from "@/lib/apiRequest";
import { tradeOffPrompt } from "@/lib/prompts";
// The deterministic matcher lives in src/lib because a route file may only export the HTTP
// handlers and Next's config fields — see the header of src/lib/tradeoff.ts.
import { sampleTradeOff, type Pair } from "@/lib/tradeoff";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

export async function POST(req: NextRequest) {
  type Body = {
    decision?: string;
    tensions?: Pair[];
    separations?: Pair[];
    lang?: "en" | "ko";
    pieces?: Array<{ title?: string; body?: string; role?: string }>;
  };
  const parsedRequest = await parseApiRequest<Body>(req, "tradeoff");
  if ("response" in parsedRequest) return parsedRequest.response;
  const body = parsedRequest.body;
  const lang = body.lang === "ko" ? "ko" : "en";
  const decision = String(body.decision ?? "").slice(0, 400);
  const tensions = Array.isArray(body.tensions) ? body.tensions.slice(0, 60) : [];
  const separations = Array.isArray(body.separations) ? body.separations.slice(0, 60) : [];
  // The team's own prose behind each title — same bound as /api/directions. Only used for the
  // live call; the deterministic sample path matches on titles and needs none of it.
  const pieces = (Array.isArray(body.pieces) ? body.pieces.slice(0, 60) : [])
    .map((p) => ({ title: String(p?.title ?? ""), body: String(p?.body ?? ""), role: p?.role ? String(p.role) : undefined }))
    .filter((p) => p.title || p.body);
  if (!decision.trim()) return NextResponse.json({ error: "no decision" }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ...sampleTradeOff(decision, tensions, separations, lang), mode: "sample" });
  }

  // Mint a citable handle per kept tension/separation so the model must POINT at the one it
  // used instead of paraphrasing it — the difference between a cost we can trace to a link
  // the team confirmed and a cost that merely sounds like one.
  // Number handles over the entries that can actually HAVE one. Using the array index meant a
  // list whose first entry lacked an id produced "[T2]" with no T1 above it — a gap the model
  // reads as a handle it simply wasn't shown, and citing the missing T1 resolves to nothing.
  const withHandles = (list: Pair[], prefix: string) => {
    let n = 0;
    return list.map((p) => ({ ...p, handle: p.id ? `${prefix}${++n}` : undefined }));
  };
  const tensionsH = withHandles(tensions, "T");
  const separationsH = withHandles(separations, "S");
  const handleToId = new Map<string, string>();
  [...tensionsH, ...separationsH].forEach((p) => {
    if (p.handle && p.id) handleToId.set(p.handle, p.id);
  });

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "user", content: tradeOffPrompt(decision, tensionsH, separationsH, lang, pieces) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as Record<string, unknown>;
    // Resolve the cited handle back to a real bridge id. An invented handle resolves to
    // nothing and is simply dropped — the prose still ships, but it is recorded as an
    // untraceable cost rather than being passed off as read off the team's own tension.
    const cited = Array.isArray(parsed.grounds) ? parsed.grounds : [];
    let groundedBridgeId: string | undefined;
    for (const c of cited) {
      const key = String(c).trim().replace(/^\[|\]$/g, "").toUpperCase();
      const id = handleToId.get(key);
      if (id) {
        groundedBridgeId = id;
        break;
      }
    }
    return NextResponse.json({
      tension: String(parsed.tension ?? "").trim().slice(0, 160),
      favors: String(parsed.favors ?? "").trim().slice(0, 160),
      cost: String(parsed.cost ?? "").trim().slice(0, 200),
      mode: "live",
      groundedBridgeId,
    });
  } catch (err) {
    console.error("[tradeoff] LLM error", err);
    return NextResponse.json({ ...sampleTradeOff(decision, tensions, separations, lang), mode: "error" });
  }
}
