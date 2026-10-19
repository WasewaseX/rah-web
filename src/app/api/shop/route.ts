// Shop: view the wallet + items, buy with gems. Duolingo RE slice.

import { NextResponse } from "next/server";
import { getLearner } from "@/lib/server";
import { shopView, buyItem } from "@/lib/shop";
import { getSessionUserWithRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getSessionUserWithRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const l = await getLearner();
  return NextResponse.json(shopView(l.gems, l.freezes, l.boostUntil));
}

export async function POST(req: Request) {
  const user = await getSessionUserWithRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { item } = await req.json().catch(() => ({ item: "" }));
  const result = await buyItem(String(item ?? ""));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  const l = await getLearner();
  return NextResponse.json({ ...result, shop: shopView(l.gems, l.freezes, l.boostUntil) });
}
