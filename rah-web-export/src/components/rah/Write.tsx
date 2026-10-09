"use client";

// Writing lab: pick a prompt, write, get CEFR four-dimension grading,
// error corrections with the Farsi why, and concrete C1 upgrades.

import { useCallback, useEffect, useState } from "react";
import { PenLine, ArrowRight } from "lucide-react";
import { Btn, Card, Chip, FA, Note, ScoreRow, Spinner } from "./ui";
import type { AppState } from "./App";

interface Result {
  level: string;
  scores: { task: number; organization: number; range: number; accuracy: number };
  verdict: string;
  errors: { bad: string; good: string; fa: string; type: string }[];
  upgrades: { plain: string; c1: string; fa: string }[];
  next_focus: string;
}

export default function WriteView({ state, onChange }: { state: AppState; onChange: () => void }) {
  const [prompts, setPrompts] = useState<string[]>([]);
  const [prompt, setPrompt] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/writing", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setPrompts(j.prompts ?? []))
      .catch(() => setPrompts([]));
  }, []);

  const submit = useCallback(async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompts[prompt] ?? "", text }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Grading failed.");
      setResult(j);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [prompt, prompts, text, onChange]);

  const words = text.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#4cc9f0]/[0.14] text-[#9de6fb]">
            <PenLine className="h-4 w-4" />
          </div>
          <span className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Pick a prompt</span>
          {state.learner.level !== "?" && <Chip tone="blue">graded at {state.learner.level}</Chip>}
        </div>
        <div className="mt-4 flex flex-col gap-2.5">
          {prompts.map((p, i) => (
            <button
              key={i}
              onClick={() => {
                setPrompt(i);
                setResult(null);
              }}
              className={`rounded-2xl border-2 px-4 py-3.5 text-left text-sm leading-relaxed transition-all active:scale-[.995] ${
                prompt === i
                  ? "border-[#4cc9f0] bg-[#4cc9f0]/[0.08] font-semibold text-[#f2f5fa]"
                  : "border-[#2a3242] text-[#a9b4c6] hover:border-[#3f4c63] hover:bg-white/[0.03]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={9}
          placeholder="Write 120 to 200 words. Push for range: collocations, hedging, discourse markers. The examiner rewards risk taken with control."
          className="w-full resize-none rounded-2xl border-2 border-[#2a3242] bg-[#141924] p-4 text-sm leading-relaxed text-[#e7ecf5] outline-none transition-colors placeholder:text-[#5c6678] focus:border-[#4cc9f0]"
        />
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs font-semibold text-[#7d889c]">{words} words</span>
          <Btn onClick={submit} disabled={busy || words < 12}>
            {busy ? "Grading" : "Grade my essay"}
          </Btn>
        </div>
      </Card>

      {busy && (
        <Card>
          <Spinner label="The examiner scores task, organization, range, accuracy" />
        </Card>
      )}
      {error && <Note tone="rose">{error}</Note>}

      {result && (
        <>
          <div className="rah-rise">
            <Card>
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">CEFR result</span>
                <Chip tone="blue">{result.level}</Chip>
              </div>
              <div className="mt-5 flex flex-col gap-3.5">
                <ScoreRow name="Task" value={result.scores.task} />
                <ScoreRow name="Organization" value={result.scores.organization} tone="cyan" />
                <ScoreRow name="Range" value={result.scores.range} tone="cyan" />
                <ScoreRow name="Accuracy" value={result.scores.accuracy} tone={result.scores.accuracy < 6 ? "rose" : "emerald"} />
              </div>
              <p className="mt-5 text-sm leading-relaxed text-[#a9b4c6]">{result.verdict}</p>
              {result.next_focus && (
                <div className="mt-4">
                  <Note tone="amber">Next: {result.next_focus}</Note>
                </div>
              )}
            </Card>
          </div>

          {result.errors.length > 0 && (
            <div className="rah-rise">
              <Card>
                <div className="mb-4 text-sm font-extrabold tracking-tight text-[#f2f5fa]">Corrections, most important first</div>
                <div className="flex flex-col gap-3">
                  {result.errors.map((e, i) => (
                    <div key={i} className="rounded-2xl border border-[#ffb02e]/25 bg-[#ffb02e]/[0.06] p-3.5 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[#ff8ba0] line-through">{e.bad}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-[#5c6678]" />
                        <span className="font-black text-[#7fe0ac]">{e.good}</span>
                      </div>
                      <FA className="mt-1.5 block text-xs leading-loose">{e.fa}</FA>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {result.upgrades.length > 0 && (
            <div className="rah-rise">
              <Card>
                <div className="mb-4 text-sm font-extrabold tracking-tight text-[#f2f5fa]">B2 to C1 upgrades</div>
                <div className="flex flex-col gap-3">
                  {result.upgrades.map((u, i) => (
                    <div key={i} className="rounded-2xl border border-[#4cc9f0]/25 bg-[#4cc9f0]/[0.06] p-3.5 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[#8b96a9]">{u.plain}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-[#5c6678]" />
                        <span className="font-black text-[#9de6fb]">{u.c1}</span>
                      </div>
                      <FA className="mt-1.5 block text-xs leading-loose">{u.fa}</FA>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
