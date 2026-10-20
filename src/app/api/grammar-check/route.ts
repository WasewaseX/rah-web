// Standalone rule-engine endpoint: deterministic LanguageTool screening with
// the error/style split. Used by any surface that wants a non-generative
// grammar opinion (chat coaching, writing pre-flight, future teachers).

import { NextResponse } from "next/server";
import { screenText } from "@/lib/languagetool";

import { aiRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Abuse limit (audit P1-6): AI calls cost real money - 30/min per client IP.
  const rl = aiRateLimit(req);
  if (!rl.ok) return rl.response!;

  const { text } = await req.json().catch(() => ({ text: "" }));
  const body = String(text ?? "").trim();
  if (body.length < 20) {
    return NextResponse.json({ error: "Give me at least 20 characters of English to check." }, { status: 400 });
  }
  const report = await screenText(body);
  if (!report) {
    return NextResponse.json({ error: "Rule engine unreachable; try again shortly." }, { status: 503 });
  }
  return NextResponse.json({
    engine: report.engine,
    errors: report.errors.map((f) => ({
      excerpt: f.excerpt, message: f.message, ruleId: f.ruleId, category: f.category,
      severity: f.severity, replacements: f.replacements, trapTag: f.trapTag,
    })),
    style: report.style.map((f) => ({
      excerpt: f.excerpt, message: f.message, ruleId: f.ruleId, category: f.category,
      severity: f.severity, replacements: f.replacements,
    })),
    summary: `${report.errors.length} error(s), ${report.style.length} style note(s)`,
  });
}
