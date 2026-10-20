import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { googleConfigured, exchangeGoogleCode, upsertGoogleUser, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const fail = (msg: string) => NextResponse.redirect(`${origin}/?authError=${encodeURIComponent(msg)}`);

  if (!googleConfigured()) return fail("Google sign-in is not configured");
  if (!code) return fail("Google did not return an authorization code");

  const jar = await cookies();
  const expected = jar.get("rah_oauth_state")?.value;
  if (!state || !expected || state !== expected) return fail("OAuth state mismatch - start the sign-in again");
  jar.delete("rah_oauth_state");

  const profile = await exchangeGoogleCode(code, origin);
  if (!profile) return fail("Google token exchange failed");

  let user;
  try {
    user = await upsertGoogleUser(profile);
  } catch (e) {
    // The deployment lock refuses a second account - surface it as a real
    // message instead of a 500.
    return fail(e instanceof Error ? e.message : "Sign-in failed");
  }
  const token = randomBytes(32).toString("hex");
  const { db } = await import("@/lib/db");
  const { hashToken } = await import("@/lib/auth");
  await db.session.create({
    data: {
      token: hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    },
  });

  const res = NextResponse.redirect(origin);
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
