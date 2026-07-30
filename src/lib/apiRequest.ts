import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, requestClientKey, utf8ByteLength } from "./rateLimit";

const MAX_BODY_BYTES = 256 * 1024;

export async function parseApiRequest<T>(
  req: NextRequest,
  scope: string
): Promise<{ body: T } | { response: NextResponse }> {
  const rate = checkRateLimit(scope, requestClientKey(req.headers));
  if (!rate.allowed) {
    return {
      response: NextResponse.json(
        { error: "too many requests" },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        }
      ),
    };
  }

  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return { response: NextResponse.json({ error: "request too large" }, { status: 413 }) };
  }

  let text: string;
  try {
    text = await req.text();
  } catch {
    return { response: NextResponse.json({ error: "bad request" }, { status: 400 }) };
  }
  if (utf8ByteLength(text) > MAX_BODY_BYTES) {
    return { response: NextResponse.json({ error: "request too large" }, { status: 413 }) };
  }
  try {
    return { body: JSON.parse(text) as T };
  } catch {
    return { response: NextResponse.json({ error: "bad request" }, { status: 400 }) };
  }
}
