"use client";

// Interactive exam card: questions inline, submit grades through the fuzzy
// engine, result breaks down by skill. Keys never reach the client before
// grading.

import { useState } from "react";
import { Check, X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import type { ExamClient, ExamResult } from "@/lib/agent/types";
import { Btn, Card } from "./ui";

const SKILL_TONE: Record<string, string> = {
  grammar: "text-[#9dc0ff] border-[var(--rah-primary)]/30 bg-[var(--rah-primary)]/[0.08]",
  vocabulary: "text-[#ffd08a] border-[#ffb02e]/30 bg-[#ffb02e]/[0.08]",
  collocation: "text-[#9de6fb] border-[var(--rah-accent)]/30 bg-[var(--rah-accent)]/[0.08]",
  writing: "text-[#7fe0ac] border-[#3ccb7f]/30 bg-[#3ccb7f]/[0.08]",
  reading: "text-[#ffa3b1] border-[#ff6b81]/30 bg-[#ff6b81]/[0.08]",
  listening: "text-[#d8b4fe] border-[#a78bfa]/30 bg-[#a78bfa]/[0.08]",
};

export function ExamCard({ exam, onDone }: { exam: ExamClient; onDone?: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ExamResult | null>(null);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);

  const answered = Object.values(answers).filter((v) => v.trim()).length;
  const progress = Math.round((answered / exam.count) * 100);

  const submit = async () => {
    setGrading(true);
    setError(null);
    try {
      const r = await fetch("/api/exam/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId: exam.id, answers }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Grading failed");
      setResult(j as ExamResult);
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGrading(false);
    }
  };

  if (result) {
    const tone = result.pct >= 85 ? "text-[#7fe0ac]" : result.pct >= 60 ? "text-[#ffd08a]" : "text-[#ffa3b1]";
    return (
      <div className="rah-pop mt-2 flex max-w-[95%] flex-col gap-3 self-start">
        <Card className="w-[640px] max-w-full p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">{exam.title} — graded</div>
            <div className={`text-2xl font-black ${tone}`}>{result.pct}%</div>
          </div>
          <div className="mt-1 text-xs font-semibold text-[#8b96a9]">
            {result.correct} of {result.total} correct · {result.answered} answered
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {result.bySkill.map((s) => (
              <div key={s.skill} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 font-bold capitalize text-[#a9b4c6]">{s.skill}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#232b3a]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--rah-primary)] to-[var(--rah-accent)]"
                    style={{ width: `${Math.round((s.correct / Math.max(1, s.total)) * 100)}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right font-bold text-[#e7ecf5]">
                  {s.correct}/{s.total}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-[#c4cddc]">{result.headline}</p>
          <button
            onClick={() => setShowWhy((v) => !v)}
            className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--rah-primary)] hover:underline"
          >
            {showWhy ? "Hide" : "Show"} item-by-item review <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showWhy ? "rotate-180" : ""}`} />
          </button>
          {showWhy && (
            <div className="mt-3 flex flex-col gap-2">
              {result.verdicts.map((v, i) => {
                const item = exam.items.find((it) => it.id === v.itemId);
                return (
                  <div key={v.itemId} className="rounded-2xl border border-white/[0.06] bg-[#141924] p-3 text-xs">
                    <div className="flex items-start gap-2">
                      {v.correct ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#3ccb7f]" />
                      ) : (
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-[#ff6b81]" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="leading-relaxed text-[#c4cddc]">
                          <span className="mr-1 font-bold text-[#8b96a9]">{i + 1}.</span>
                          {item?.q ?? v.itemId}
                        </div>
                        {!v.correct && (
                          <div className="mt-1.5 leading-relaxed">
                            <span className="text-[#ff8ba0] line-through">{v.given || "(blank)"}</span>
                            <span className="mx-1.5 text-[#5c6678]">{"->"}</span>
                            <span className="font-black text-[#7fe0ac]">{v.key}</span>
                          </div>
                        )}
                        <div className="mt-1 leading-relaxed text-[#8b96a9]">{v.why}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="rah-pop mt-2 flex max-w-[95%] flex-col self-start">
      <Card className="w-[640px] max-w-full p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">{exam.title}</div>
            <div className="text-xs font-semibold text-[#8b96a9]">
              {exam.count} questions · about {exam.spec.minutes} min · mixed: {exam.spec.targetSkills.join(", ")}
            </div>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[var(--rah-primary)]/40 text-[11px] font-black text-[#9dc0ff]">
            {progress}%
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          {exam.items.map((it, idx) => (
            <div key={it.id} className="rounded-2xl border border-white/[0.06] bg-[#141924] p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm leading-relaxed text-[#e7ecf5]">
                  <span className="mr-1.5 font-black text-[var(--rah-primary)]">{idx + 1}.</span>
                  {it.q}
                </p>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${SKILL_TONE[it.skill] ?? SKILL_TONE.vocabulary}`}>
                  {it.skill}
                </span>
              </div>
              {it.type === "mcq" && it.choices ? (
                <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {it.choices.map((c) => {
                    const active = answers[it.id] === c;
                    return (
                      <button
                        key={c}
                        onClick={() => setAnswers((a) => ({ ...a, [it.id]: c }))}
                        className={`rounded-xl border px-3 py-2 text-left text-sm transition-all ${
                          active
                            ? "border-[var(--rah-primary)] bg-[var(--rah-primary)]/[0.14] font-bold text-[#dbe7ff]"
                            : "border-[#2a3242] text-[#b7c1d3] hover:border-[#3a465c] hover:bg-white/[0.03]"
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <input
                  value={answers[it.id] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [it.id]: e.target.value }))}
                  placeholder={it.type === "rewrite" ? "Write the full sentence" : it.type === "cloze" ? "Fill the blank" : "Short answer"}
                  className="mt-3 min-h-10 w-full rounded-xl border-2 border-[#2a3242] bg-[var(--rah-bg)] px-3 text-sm text-[#f2f5fa] outline-none transition-colors placeholder:text-[#5c6678] focus:border-[var(--rah-primary)]"
                />
              )}
            </div>
          ))}
        </div>

        {error && <div className="mt-3 rounded-2xl border border-[#ff6b81]/25 bg-[#ff6b81]/[0.07] p-3 text-xs text-[#ffc9d2]">{error}</div>}

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-[#8b96a9]">
            {answered}/{exam.count} answered · blank counts against you, synonyms do not
          </span>
          <Btn variant="go" onClick={submit} disabled={grading || answered === 0} className="min-h-11 px-5 text-xs">
            {grading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {grading ? "Grading" : "Submit for grading"}
          </Btn>
        </div>
      </Card>
    </div>
  );
}
