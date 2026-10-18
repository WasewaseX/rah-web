import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyLoginCode, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { email, code } = await req.json().catch(() => ({ email: "", code: "" }));
  const result = await verifyLoginCode(String(email ?? ""), String(code ?? ""));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, result.token!, sessionCookieOptions());
  return NextResponse.json({ ok: true, user: { email: result.user!.email, name: result.user!.name, provider: result.user!.provider } });
}
