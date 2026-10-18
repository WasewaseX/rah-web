import { NextResponse } from "next/server";
import { googleConfigured, googleAuthUrl } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Start Google OAuth. Only active when the deployment configured credentials;
// otherwise the answer tells the login screen to fall back to the email-code flow
// (which covers gmail addresses with zero setup).
export async function GET(req: Request) {
  if (!googleConfigured()) {
    return NextResponse.json(
      { error: "Google sign-in is not configured on this deployment. Use the email code - it works for gmail too.", fallback: "email_code" },
      { status: 501 },
    );
  }
  const origin = new URL(req.url).origin;
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(googleAuthUrl(origin, state));
  res.cookies.set("rah_oauth_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
