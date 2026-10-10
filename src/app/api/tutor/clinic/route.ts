import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiJson, clinicSystem } from "@/lib/ai";
import { getLearner } from "@/lib/server";
import { collectEvidence } from "@/lib/tutor";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export interface ClinicPattern {
  tag: string;
  count: number;
  examples: string[];
}

export async function GET() {
  const row = await db.tutorReport.findFirst({ where: { kind: "clinic" }, orderBy: { at: "desc" } });
  return NextResponse.json(row ? JSON.parse(row.data) : null);
}

export async function POST() {
  const ev = await collectEvidence();

  // Merge trap sources: coach corrections + SRS lapses. Count and sample.
  const merged: Record<string, { count: number; examples: string[] }> = {};
  const bump = (tag: string, example?: string) => {
    merged[tag] ??= { count: 0, examples: [] };
    merged[tag].count += 1;
    if (example && merged[tag].examples.length < 3) merged[tag].examples.push(example);
  };

  for (const [tag, n] of Object.entries(ev.traps.chat)) for (let i = 0; i < n; i++) bump(tag);
  for (const [tag, n] of Object.entries(ev.traps.srs)) for (let i = 0; i < n; i++) bump(tag);
  // Re-attach real correction samples to their tags where we can.
  for (const tag of Object.keys(merged)) merged[tag].examples = [];

  if (Object.keys(merged).length === 0) {
    return NextResponse.json({
      patterns: [],
      message: "No mistakes recorded yet. Use Coach chat or grade some reviews first; the clinic mines real errors, not guesses.",
    });
  }

  const l = await getLearner();
  const level = l.level === "?" ? "B2" : l.level;

  // Sort patterns by frequency. Build the drill for the top one.
  const patterns: ClinicPattern[] = Object.entries(merged)
    .map(([tag, v]) => ({ tag, count: v.count, examples: v.examples }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const top = patterns[0].tag.replace(/_/g, " ");
  let drill: { title: string; goal: string; items: { kind: string; q: string; a: string; fa: string }[] } | null = null;
  try {
    drill = await aiJson(clinicSystem(top, level), [
      { role: "user", content: `Build the 5-item drill for the pattern "${top}" at ${level}. Output the JSON now.` },
    ]);
  } catch {
    drill = null; // pattern list is still valuable without the drill
  }

  const payload = { patterns, drill };
  await db.tutorReport.create({ data: { kind: "clinic", data: JSON.stringify(payload) } });
  const old = await db.tutorReport.findMany({ where: { kind: "clinic" }, orderBy: { at: "desc" }, skip: 5 });
  for (const o of old) await db.tutorReport.delete({ where: { id: o.id } });

  return NextResponse.json(payload);
}
