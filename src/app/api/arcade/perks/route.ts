import { NextResponse } from "next/server";
import { getPerksView, buyPerk } from "@/lib/arcade";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getPerksView());
}

export async function POST(req: Request) {
  const b = (await req.json()) as { perk?: string };
  if (!b.perk) return NextResponse.json({ ok: false, error: "Missing perk" }, { status: 400 });
  const r = await buyPerk(String(b.perk));
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
