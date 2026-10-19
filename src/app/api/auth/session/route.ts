import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUserWithRequest, destroySession, SESSION_COOKIE, googleConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Who am I? The login gate polls this once per load; every authed tab knows its user.
// Header fallback: embedded contexts that cannot hold cookies still resolve.
export async function GET(req: Request) {
  const user = await getSessionUserWithRequest(req);
  return NextResponse.json({ user, googleConfigured: googleConfigured() });
}

// Sign out: kill the server session (cookie token AND header token), clear the cookie.
export async function DELETE(req: Request) {
  const jar = await cookies();
  await destroySession(jar.get(SESSION_COOKIE)?.value);
  await destroySession(req.headers.get("x-rah-token"));
  jar.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
