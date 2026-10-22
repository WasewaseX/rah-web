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
  ruleChecks?: { engine: string; errors: number; style: number; backfilled: number } | null;
}

export default function WriteView({ state, onChange }: { state: AppState; onChange: () => void }) {
  const [prompts, setPrompts] = useState<string[]>([]);
  const [recent, setRecent] = useState<{ id: number; revision: number; at: string }[]>([]);
  const [prompt, setPrompt] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Writing revision history (audit P2): revising an earlier submission links
  // the new one to it (parentId) and bumps the revision number server-side.
  const [revisingId, setRevisingId] = useState<number | null>(null);
  // Rubric history (writing-revision workspace): criterion deltas across the
  // chain being revised - shown in the revising banner, honest when absent.
  const [rubric, setRubric] = useState<{ criteria: { key: string; first: number; last: number; delta: number }[]; note: string } | null>(null);
  // What the previous revision actually fixed (Task 83): the honest change
  // summary between the chain's last two graded submissions.
  const [changes, setChanges] = useState<{ fixed: number; remaining: number; introduced: number; fixedExamples: string[] }[] | null>(null);

  const loadRecent = useCallback(() => {
    fetch("/api/writing", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setPrompts(j.prompts ?? []);
        setRecent(j.recent ?? []);
      })
      .catch(() => setPrompts([]));
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const startRevision = useCallback(async (id: number) => {
    setError(null);
    try {
      const r = await fetch(`/api/writing?id=${id}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not load the submission.");
      const chain = j.chain ?? [];
      const last = chain.at(-1);
      if (!last) throw new Error("The submission has no text to revise.");
      setText(last.text ?? "");
      setRevisingId(last.id);
      setRubric(j.rubric ?? null);
      setChanges(j.changes ?? null);
      setResult(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const submit = useCallback(async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompts[prompt] ?? "", text, revisingId: revisingId ?? undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Grading failed.");
      setResult(j);
      setRevisingId(null);
      onChange();
      loadRecent();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [prompt, prompts, text, onChange, revisingId, loadRecent]);

  const words = text.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex flex-col gap-4">
      {revisingId !== null && (
        <Note tone="blue">
          <div className="flex items-center justify-between gap-3">
            <span>Revising submission #{revisingId} - the new grade joins its revision history.</span>
            <button
              onClick={() => {
                setRevisingId(null);
                setRubric(null);
                setChanges(null);
              }}
              className="text-xs font-bold text-[#9dc0ff] hover:underline"
            >
              cancel
            </button>
          </div>
          {rubric && rubric.criteria.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 border-t border-white/10 pt-2">
              {rubric.criteria.map((c) => (
                <span
                  key={c.key}
                  className={
                    "rounded-full px-2 py-0.5 text-[11px] font-bold " +
                    (c.delta > 0
                      ? "bg-[#173a26] text-[#7ee2a8]"
                      : c.delta < 0
                        ? "bg-[#3a1a1f] text-[#ff9db1]"
                        : "bg-white/10 text-white/70")
                  }
                  title={`${c.key}: ${c.first} -> ${c.last}`}
                >
                  {c.key} {c.delta > 0 ? "+" : ""}
                  {c.delta}
                </span>
              ))}
              <span className="text-[11px] text-white/40">{rubric.note}</span>
            </div>
          )}
          {rubric && rubric.criteria.length === 0 && (
            <div className="mt-1 text-[11px] text-white/40">{rubric.note}</div>
          )}
          {changes && changes.length > 0 && (() => {
            const last = changes[changes.length - 1];
            return (
              <div className="mt-1 text-[11px] text-white/50">
                The previous revision fixed {last.fixed} flagged issue{last.fixed === 1 ? "" : "s"}
                {last.remaining > 0 ? `, ${last.remaining} still flagged` : ""}
                {last.introduced > 0 ? `, ${last.introduced} new one${last.introduced === 1 ? "" : "s"} appeared` : ""}.
                {last.fixedExamples.length > 0 ? ` e.g. "${last.fixedExamples[0]}"` : ""}
              </div>
            );
          })()}
        </Note>
      )}
      <Card>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--rah-accent)]/[0.14] text-[#9de6fb]">
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
                  ? "border-[var(--rah-accent)] bg-[var(--rah-accent)]/[0.08] font-semibold text-[#f2f5fa]"
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
          className="w-full resize-none rounded-2xl border-2 border-[#2a3242] bg-[#141924] p-4 text-sm leading-relaxed text-[#e7ecf5] outline-none transition-colors placeholder:text-[#5c6678] focus:border-[var(--rah-accent)]"
        />
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs font-semibold text-[#7d889c]">{words} words</span>
          <Btn onClick={submit} disabled={busy || words < 12}>
            {busy ? "Grading" : revisingId !== null ? "Grade this revision" : "Grade my essay"}
          </Btn>
        </div>
        {recent.length > 0 && (
          <div className="mt-4 border-t border-[#2a3242] pt-3">
            <span className="text-xs font-bold text-[#7d889c]">Revision history - open a past submission to improve it:</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {recent.map((r) => (
                <button
                  key={r.id}
                  onClick={() => startRevision(r.id)}
                  className="rounded-full border border-[#2a3242] px-3 py-1 text-xs font-semibold text-[#a9b4c6] transition-colors hover:border-[var(--rah-accent)] hover:text-[#f2f5fa]"
                >
                  #{r.id} · rev {r.revision}
                </button>
              ))}
            </div>
          </div>
        )}
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
              {result.ruleChecks && (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#8b96a9]">
                  <span className="rounded-full border border-[#5c6678]/40 px-2.5 py-1">
                    Rule engine: {result.ruleChecks.engine}
                  </span>
                  <span className="rounded-full border border-[#ff8ba0]/30 px-2.5 py-1">
                    {result.ruleChecks.errors} error{result.ruleChecks.errors === 1 ? "" : "s"} flagged
                  </span>
                  <span className="rounded-full border border-[#5c6678]/40 px-2.5 py-1">
                    {result.ruleChecks.style} style note{result.ruleChecks.style === 1 ? "" : "s"}
                  </span>
                  {result.ruleChecks.backfilled > 0 && (
                    <span className="rounded-full border border-[#7fe0ac]/30 px-2.5 py-1">
                      {result.ruleChecks.backfilled} caught by rules alone
                    </span>
                  )}
                </div>
              )}
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
                    <div key={i} className="rounded-2xl border border-[var(--rah-accent)]/25 bg-[var(--rah-accent)]/[0.06] p-3.5 text-sm">
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
