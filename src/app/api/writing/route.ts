import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiJson, writingSystem } from "@/lib/ai";
import { buildProfile, bumpDaily, touchStreak } from "@/lib/server";
import { awardXp, progressQuest } from "@/lib/arcade";
import { recordMistakes } from "@/lib/mistakes";
import { noteTagOutcome } from "@/lib/mastery";
import { screenText, findingsBlock, mergeRuleErrors } from "@/lib/languagetool";
import { contentScope } from "@/lib/scope";

import { aiRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface WritingResult {
  level: string;
  scores: { task: number; organization: number; range: number; accuracy: number };
  verdict: string;
  errors: { bad: string; good: string; fa: string; type: string }[];
  upgrades: { plain: string; c1: string; fa: string }[];
  next_focus: string;
}

export const WRITING_PROMPTS = [
  "Some people think remote work makes teams stronger. Others say it destroys them. What is your position, and what would change your mind?",
  "Describe a decision you made that looked wrong at first but turned out right. What did it teach you?",
  "Your city wants to spend money on either fast internet or public parks. Argue for one, then steelman the other side.",
  "Write a short email to a client explaining a one week delay. Be honest, keep the relationship, offer a fix.",
  "Is it better to master one skill or collect many shallow ones? Take a side and defend it with examples.",
];

export async function GET(req: Request) {
  const scope = await contentScope(req);
  // Revision history (audit P2): /api/writing?id=N returns the full chain -
  // the submission, its parent, and every ancestor, oldest first.
  const id = Number(new URL(req.url).searchParams.get("id") ?? 0);
  if (id > 0) {
    const chain: { id: number; prompt: string; revision: number; result: WritingResult | null; at: Date; text?: string }[] = [];
    let cur = await db.writingSub.findFirst({ where: { id, ...scope } });
    let guard = 0;
    while (cur && guard++ < 25) {
      chain.push({ id: cur.id, prompt: cur.prompt, revision: cur.revision, result: safeParse(cur.result), at: cur.at, text: cur.text });
      if (!cur.parentId) break;
      cur = await db.writingSub.findFirst({ where: { id: cur.parentId, ...scope } });
    }
    if (chain.length === 0) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    return NextResponse.json({ chain: chain.reverse() });
  }
  const rows = await db.writingSub.findMany({ where: scope, orderBy: { id: "desc" }, take: 10 });
  return NextResponse.json({
    prompts: WRITING_PROMPTS,
    recent: rows.map((r) => ({ id: r.id, prompt: r.prompt, revision: r.revision, parentId: r.parentId, result: safeParse(r.result), at: r.at })),
  });
}

export async function POST(req: Request) {
  // Abuse limit (audit P1-6): AI calls cost real money - 30/min per client IP.
  const rl = aiRateLimit(req);
  if (!rl.ok) return rl.response!;

  const { prompt, text, revisingId } = await req.json();
  const body = String(text ?? "").trim();
  if (body.length < 60) return NextResponse.json({ error: "Write at least 60 characters so there is something to grade." }, { status: 400 });

  // Revision chain (audit P2): a submission may revise an earlier one of the
  // SAME user - the chain (parentId/revision) is the writing revision history.
  const scope = await contentScope(req);
  let parentId: number | null = null;
  let revision = 1;
  const rid = Number(revisingId ?? 0);
  if (rid > 0) {
    const parent = await db.writingSub.findFirst({ where: { id: rid, ...scope } });
    if (!parent) return NextResponse.json({ error: "The submission to revise was not found." }, { status: 404 });
    parentId = parent.id;
    revision = parent.revision + 1;
  }

  const profile = await buildProfile();

  // Fast path FIRST: the LanguageTool rule engine screens the raw essay for
  // free, deterministically, with offset-accurate findings. Its output grounds
  // the LLM pass (confirm/explain, not hunt typos) and backstops it (real
  // errors the model missed still reach the learner even on a bad AI day).
  const ruleReport = await screenText(body);

  let result: WritingResult;
  try {
    result = await aiJson<WritingResult>(writingSystem(profile), [
      { role: "user", content: `Prompt: ${prompt}\n\nEssay:\n${body}\n\n${findingsBlock(ruleReport)}` },
    ]);
  } catch (e) {
    return NextResponse.json({ error: `The examiner is unreachable: ${(e as Error).message}` }, { status: 502 });
  }

  // Backstop merge: rule-engine ERRORS the model ignored still ship, mapped
  // onto mistake-family tags. Style findings stay out of the error list.
  const { merged: mergedErrors, added } = mergeRuleErrors(result.errors ?? [], ruleReport);
  result.errors = mergedErrors;
  const ruleChecks = ruleReport
    ? {
        engine: "LanguageTool" as const,
        errors: ruleReport.errors.length,
        style: ruleReport.style.length,
        backfilled: added,
      }
    : null;

  await db.writingSub.create({ data: { prompt: String(prompt ?? ""), text: body, result: JSON.stringify({ ...result, ruleChecks }), ...scope, parentId, revision } });
  await bumpDaily("written");
  await awardXp(15, { chainHit: true });
  await progressQuest("write_1", 1);
  await touchStreak();
  // Mistake memory: essay errors feed persistent families by their trap type.
  // The same trap tags debit the mastery ledger - a confirmed production
  // error is the strongest kind of "no" evidence the model can get.
  if (Array.isArray(result.errors) && result.errors.length > 0) {
    const errs = result.errors.map((e) => ({ kind: "writing" as const, tag: String(e.type ?? "none"), wrong: String(e.bad ?? ""), right: String(e.good ?? "") }));
    await recordMistakes(errs);
    await Promise.allSettled(errs.map((e) => noteTagOutcome(e.tag, false)));
  }
  return NextResponse.json({ ...result, ruleChecks });
}

function safeParse(s: string): WritingResult | null {
  try {
    return JSON.parse(s) as WritingResult;
  } catch {
    return null;
  }
}
