import { NextResponse } from "next/server";
import { getLeagueView } from "@/lib/arcade";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getLeagueView());
}
