// Shared abuse limiter for AI/speech endpoints (audit P1-6).
//
// In-memory sliding window, keyed by user id when signed in and by IP
// otherwise (single-node deployment - the same honesty rules as the auth
// IP throttle; a restart clears it). Generous for real learning use, brutal
// for scripted abuse: AI routes cost real money per call.
//
// Usage in a route:
//   const rl = await aiRateLimit(req, user?.id);
//   if (!rl.ok) return rl.response; // 429 + Retry-After + honest message

const buckets = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_MIN_USER = 40; // signed-in: 40 AI calls/min - nobody learns faster than that
const MAX_PER_MIN_IP = 15; // anonymous: tighter

function hit(key: string, max: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= max) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - hits[0])) / 1000);
    buckets.set(key, hits); // keep pruning state even when refusing
    return { ok: false, retryAfter: Math.max(1, retryAfter) };
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= WINDOW_MS)) buckets.delete(k);
    }
  }
  return { ok: true, retryAfter: 0 };
}

export interface RateLimitResult {
  ok: boolean;
  response?: Response;
}

export function aiRateLimit(req: Request, userId?: string | null): RateLimitResult {
  const ip = clientIp(req);
  // Loopback / direct local access is EXEMPT: the dev toolchain (battery, E2E)
  // shares 127.0.0.1 and would lock itself out; production traffic arrives
  // through a proxy that sets x-forwarded-for to the real client IP. The
  // deployment lock (Task 48) bounds the blast radius of direct-access abuse.
  if (!userId && (ip === "loopback" || ip.startsWith("127.") || ip === "::1" || ip.startsWith("::ffff:127."))) {
    return { ok: true };
  }
  const max = userId ? MAX_PER_MIN_USER : MAX_PER_MIN_IP;
  const key = userId ? `u:${userId}` : `ip:${ip}`;
  const r = hit(key, max);
  if (r.ok) return { ok: true };
  return {
    ok: false,
    response: new Response(
      JSON.stringify({ error: `Too many AI requests - slow down a little and try again in ${r.retryAfter}s.` }),
      {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": String(r.retryAfter) },
      },
    ),
  };
}

export function clientIp(req: Request): string {
  const xff = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  return xff || req.headers.get("x-real-ip") || "loopback";
}
