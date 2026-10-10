import { NextResponse } from "next/server";
import { skillCatalog, getSetting } from "@/lib/skills";

export const dynamic = "force-dynamic";

export async function GET() {
  const theme = await getSetting("theme");
  const effect = (await getSetting("effect")) ?? "aurora";
  return NextResponse.json({ skills: skillCatalog(), theme: theme ? JSON.parse(theme) : null, effect });
}
