import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser, destroySession, SESSION_COOKIE, googleConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Who am I? The login gate polls this once per load; every authed tab knows its user.
export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({ user, googleConfigured: googleConfigured() });
}

// Sign out: kill the server session, clear the cookie.
export async function DELETE() {
  const jar = await cookies();
  await destroySession(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
