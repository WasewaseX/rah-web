// Standalone rule-engine endpoint: deterministic LanguageTool screening with
// the error/style split. Used by any surface that wants a non-generative
// grammar opinion (chat coaching, writing pre-flight, future teachers).
//
// Grammarly RE (Task 85): findings now carry `offset`/`length` so an editor can
// underline and splice them. Offsets are relative to the EXACT text POSTed -
// the route no longer trims before screening (a trim shifted every offset by
// the leading-whitespace width and made splices land in the wrong place); the
// length guard still trims, the screening text does not.

import { NextResponse } from "next/server";
import { screenText } from "@/lib/languagetool";

import { aiRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Abuse limit (audit P1-6): AI calls cost real money - 30/min per client IP.
  const rl = aiRateLimit(req);
  if (!rl.ok) return rl.response!;

  const { text } = await req.json().catch(() => ({ text: "" }));
  const raw = String(text ?? "");
  if (raw.trim().length < 20) {
    return NextResponse.json({ error: "Give me at least 20 characters of English to check." }, { status: 400 });
  }
  const report = await screenText(raw);
  if (!report) {
    return NextResponse.json({ error: "Rule engine unreachable; try again shortly." }, { status: 503 });
  }
  const shape = (f: (typeof report.errors)[number]) => ({
    offset: f.offset, length: f.length, excerpt: f.excerpt, message: f.message,
    ruleId: f.ruleId, category: f.category, severity: f.severity,
    replacements: f.replacements, trapTag: f.trapTag,
  });
  return NextResponse.json({
    engine: report.engine,
    checkedChars: report.checkedChars,
    errors: report.errors.map(shape),
    style: report.style.map(shape),
    summary: `${report.errors.length} error(s), ${report.style.length} style note(s)`,
  });
}
