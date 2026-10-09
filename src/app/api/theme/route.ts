import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLearner } from "@/lib/server";
import { sanitizeTokens } from "@/lib/agent/theme";

export const dynamic = "force-dynamic";

// Theme plugin persistence. The coach writes through this route too; the
// client reads the active tokens on load so a repaint survives reloads.
export async function GET() {
  const l = await getLearner();
  if (!l.theme) return NextResponse.json({ tokens: null });
  return NextResponse.json({ tokens: sanitizeTokens(JSON.parse(l.theme)) });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (body?.reset) {
    await db.learner.update({ where: { id: "me" }, data: { theme: "" } });
    return NextResponse.json({ tokens: null });
  }
  const tokens = sanitizeTokens(body?.tokens);
  if (!tokens) return NextResponse.json({ error: "no valid tokens" }, { status: 400 });
  await db.learner.update({ where: { id: "me" }, data: { theme: JSON.stringify(tokens) } });
  return NextResponse.json({ tokens });
}
