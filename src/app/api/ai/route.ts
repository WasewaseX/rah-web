import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLearner, getSettings } from "@/lib/server";
import { chat, smartChat, effectiveProfile, extractJson, listModels, presets, isBuiltin, BUILTIN_PROFILE } from "@/lib/ai";
import { tutorSystem, quizSystem, importSystem, speakEvalSystem } from "@/lib/prompts";

// POST /api/ai  { action: "discover" | "test" | "tutor" | "quiz" | "import" | "speak_eval" }
// Every action runs on the built-in engine by default. A configured BYO
// provider takes the wheel and silently falls back to the engine if it fails.
export async function POST(req: Request) {
  const body = await req.json();
  const action: string = body.action ?? "";

  if (action === "discover") {
    const p = await effectiveProfile();
    if (isBuiltin(p)) {
      return NextResponse.json({ ok: true, models: [BUILTIN_PROFILE.model], managed: true, error: "" });
    }
    const out = await listModels(p);
    if (out.ok) {
      const s = await getSettings();
      await db.aiSettings.update({
        where: { id: "main" },
        data: { discovered: JSON.stringify(out.models.slice(0, 200)) },
      });
    }
    return NextResponse.json(out);
  }

  if (action === "test") {
    const p = await effectiveProfile();
    const started = Date.now();
    const out = await chat(p, "Reply with the single word: ready", [{ role: "user", content: "ping" }], 10);
    const ms = Date.now() - started;
    const result = { ok: out.ok, ms, error: out.error, at: new Date().toISOString() };
    if (!isBuiltin(p)) {
      await db.aiSettings.update({ where: { id: "main" }, data: { lastTest: JSON.stringify(result) } });
    }
    return NextResponse.json(result);
  }

  if (action === "tutor") {
    const learner = await getLearner();
    const history = (body.history ?? []).slice(-12);
    const out = await smartChat(
      tutorSystem({
        level: learner.level,
        diagnosis: JSON.parse(learner.diagnosis || "{}"),
        streak: learner.streak,
      }),
      history,
      900,
      true
    );
    if (!out.ok) return NextResponse.json({ ok: false, error: out.error, fallback: true });
    const parsed = extractJson(out.text);
    if (!parsed) {
      return NextResponse.json({ ok: false, error: "the engine did not return the expected JSON envelope", fallback: true, raw: out.text.slice(0, 500) });
    }
    return NextResponse.json({ ok: true, turn: parsed });
  }

  if (action === "speak_eval") {
    const learner = await getLearner();
    const transcript: string = String(body.transcript ?? "").slice(0, 4000);
    const prompt: string = String(body.prompt ?? "").slice(0, 600);
    const seconds: number = Number(body.seconds ?? 0);
    if (!transcript.trim()) {
      return NextResponse.json({ ok: false, error: "nothing to evaluate", fallback: true });
    }
    const out = await smartChat(
      speakEvalSystem({
        level: learner.level,
        diagnosis: JSON.parse(learner.diagnosis || "{}"),
        streak: learner.streak,
      }),
      [{ role: "user", content: `Speaking prompt: ${prompt}\nSpoken for about ${Math.round(seconds)} seconds.\nTranscript (speech-to-text, punctuation is approximate):\n\n${transcript}` }],
      1200,
      true
    );
    if (!out.ok) return NextResponse.json({ ok: false, error: out.error, fallback: true });
    const parsed = extractJson(out.text);
    if (!parsed) return NextResponse.json({ ok: false, error: "the engine returned an unreadable evaluation", fallback: true });
    return NextResponse.json({ ok: true, eval: parsed });
  }

  if (action === "quiz") {
    const learner = await getLearner();
    const text = String(body.text ?? "").slice(0, 12000);
    const out = await smartChat(quizSystem(learner.level), [{ role: "user", content: text }], 2000, true);
    if (!out.ok) return NextResponse.json({ ok: false, error: out.error, fallback: true });
    const parsed = extractJson(out.text);
    if (!parsed) return NextResponse.json({ ok: false, error: "the engine returned invalid JSON", fallback: true });
    return NextResponse.json({ ok: true, quiz: parsed });
  }

  if (action === "import") {
    const learner = await getLearner();
    const text = String(body.text ?? "").slice(0, 12000);
    const out = await smartChat(importSystem(learner.level), [{ role: "user", content: text }], 2000, true);
    if (!out.ok) return NextResponse.json({ ok: false, error: out.error, fallback: true });
    const parsed = extractJson(out.text);
    if (!parsed) return NextResponse.json({ ok: false, error: "the engine returned invalid JSON", fallback: true });
    const cards = (parsed.cards ?? []) as Record<string, string>[];
    const created: string[] = [];
    for (const c of cards.slice(0, 12)) {
      if (!c.prompt || !c.answer) continue;
      const uc = await db.userCard.create({
        data: {
          learnerId: learner.id,
          kind: c.kind === "ef" || c.kind === "fae" ? c.kind : "cloze",
          prompt: String(c.prompt),
          answer: String(c.answer),
          en: String(c.en ?? c.answer),
          fa: String(c.fa ?? ""),
          note: String(c.note ?? ""),
          level: c.level === "C1" ? "C1" : learner.level,
        },
      });
      created.push("u_" + uc.id);
    }
    return NextResponse.json({ ok: true, created: created.length, cards });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
