// Simple in-memory daily limiter per IP.
// Good enough to stop casual abuse on a single instance; replace with Supabase/Upstash
// when user accounts and the Pro plan are added (serverless instances don't share memory).
const hits = new Map<string, { day: string; count: number }>();

export function rateLimit(key: string, limit: number) {
  const day = new Date().toISOString().slice(0, 10);
  const entry = hits.get(key);
  if (!entry || entry.day !== day) {
    hits.set(key, { day, count: 1 });
    return { ok: true, remaining: limit - 1 };
  }
  if (entry.count >= limit) return { ok: false, remaining: 0 };
  entry.count += 1;
  return { ok: true, remaining: limit - entry.count };
}

export function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
