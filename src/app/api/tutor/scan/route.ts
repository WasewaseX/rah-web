import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiJson, scanSystem } from "@/lib/ai";
import { collectEvidence } from "@/lib/tutor";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  const row = await db.tutorReport.findFirst({ where: { kind: "scan" }, orderBy: { at: "desc" } });
  return NextResponse.json({ report: row ? JSON.parse(row.data) : null, at: row?.at ?? null });
}

export async function POST() {
  const evidence = await collectEvidence();
  const history = await db.tutorReport.findFirst({ where: { kind: "scan" }, orderBy: { at: "desc" } });
  const previous = history ? { band: safeBand(history.data), at: history.at } : null;

  const system = scanSystem();
  const user =
    "Evidence blob:\n" +
    JSON.stringify({ ...evidence, previousScan: previous }) +
    "\n\nProduce the diagnostic report JSON now.";

  let report: unknown;
  try {
    report = await aiJson(system, [{ role: "user", content: user }]);
  } catch (e) {
    return NextResponse.json({ error: `Scan failed: ${(e as Error).message}` }, { status: 502 });
  }

  const saved = await db.tutorReport.create({ data: { kind: "scan", data: JSON.stringify(report) } });
  // Keep the last 10 scans; older diagnostics are noise.
  const old = await db.tutorReport.findMany({ where: { kind: "scan" }, orderBy: { at: "desc" }, skip: 10 });
  for (const o of old) await db.tutorReport.delete({ where: { id: o.id } });

  return NextResponse.json({ report, at: saved.at });
}

function safeBand(data: string): string | null {
  try {
    return (JSON.parse(data) as { band?: string }).band ?? null;
  } catch {
    return null;
  }
}
