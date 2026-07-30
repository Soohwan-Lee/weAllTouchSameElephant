interface Bucket {
  count: number;
  resetAt: number;
}

const buckets: Map<string, Bucket> =
  (globalThis as typeof globalThis & { __watseRateLimits?: Map<string, Bucket> })
    .__watseRateLimits ?? new Map();
(globalThis as typeof globalThis & { __watseRateLimits?: Map<string, Bucket> })
  .__watseRateLimits = buckets;

export function requestClientKey(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "local"
  );
}

export function checkRateLimit(
  scope: string,
  client: string,
  now = Date.now(),
  limit = 30,
  windowMs = 60_000
): { allowed: boolean; retryAfterSeconds: number } {
  const key = `${scope}:${client}`;
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }
  current.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
