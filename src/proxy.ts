import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserWithRequest } from "@/lib/auth";

/**
 * API auth gate (Task 90) - closes the anonymous-read hole.
 *
 * FOUND BY THE ROUND-2 AUDIT DRIVE: the deployment-lock era folded anonymous
 * callers into the singleton learner (`contentUserId()` falls back to "me" by
 * design), so on the PUBLIC preview URL anyone could read /api/state,
 * /api/review/queue (the actual cards), /api/progress history, goals,
 * curriculum, flow items and the arcade view without any session. Some routes
 * (shop, workspace, coach-agent, admin) enforced auth; most did not - an
 * inconsistent posture. The UI always authenticates (it renders the login
 * gate until /api/auth/session says otherwise), so server-side enforcement
 * costs the app nothing and protects the learner on a public edge.
 *
 * Deny-by-default: every /api path requires a valid session EXCEPT the
 * public allowlist below. Validation is REAL (the hashed-session DB lookup
 * via the same resolver the routes use), not a cookie-presence check -
 * this runs on the Node.js middleware runtime, not the edge.
 *
 * Public by contract:
 *   /api/version        - the freshness beacon + data tripwire, polled by
 *                         deploy tooling and external monitors (anonymous by
 *                         design since Task 60).
 *   /api/auth/*         - the login legs themselves (request-code, verify,
 *                         session check, logout, OAuth start/callback).
 * Anonymous AI abuse therefore dies at 401 BEFORE the rate limiter - zero
 * model tokens spent on unauthenticated traffic, stricter than the old
 * "rate-limit then 429" posture for this private deployment.
 */

const PUBLIC_PREFIXES = ["/api/version", "/api/auth/"];

export const config = {
  // Next 16: proxy ALWAYS runs on the Node.js runtime - real session
  // validation (hashed-token DB lookup) works natively here.
  matcher: ["/api/:path*"],
};

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next();
  }
  try {
    const user = await getSessionUserWithRequest(req as unknown as Request);
    if (user) return NextResponse.next();
  } catch {
    /* fall through to the refusal - auth must fail closed */
  }
  return NextResponse.json(
    { error: "Sign in to use Rah." },
    { status: 401 },
  );
}
