import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyLoginCode, SESSION_COOKIE, EMBED_COOKIE, sessionCookieOptions, callerWantsEmbedFallback } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { email, code } = await req.json().catch(() => ({ email: "", code: "" }));
  const result = await verifyLoginCode(String(email ?? ""), String(code ?? ""));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, result.token!, sessionCookieOptions());

  const embedded = callerWantsEmbedFallback(req);
  if (embedded) {
    // Preview iframes / cookie-blocking browsers: ALSO set the partitioned
    // SameSite=None cookie. Prod+HTTPS only (browsers reject None without
    // Secure; in dev the header fallback below still covers these callers).
    if (process.env.NODE_ENV === "production") {
      jar.set(EMBED_COOKIE, result.token!, sessionCookieOptions(true));
    }
  }
  // The raw token rides in the body ONLY for embedded callers that declare
  // the fallback (x-rah-embed: 1) - normal logins receive NO browser-readable
  // credential; the httpOnly cookie is the only thing they need.
  return NextResponse.json({
    ok: true,
    ...(embedded ? { token: result.token } : {}),
    user: { email: result.user!.email, name: result.user!.name, provider: result.user!.provider },
  });
}
