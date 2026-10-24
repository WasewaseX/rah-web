"use client";

// Writing lab: pick a prompt, write, get CEFR four-dimension grading,
// error corrections with the Farsi why, and concrete C1 upgrades.
//
// Grammarly RE (Task 85) - the live revision layer:
//  - "Check as I write": debounced LanguageTool pre-flight while typing
//    (deterministic rule engine, no AI cost), underlines rendered in a
//    mirrored highlight layer behind the textarea, findings listed below
//    with per-finding accept (deterministic splice at offset) / ignore.
//  - Register goal chips (exam / work / casual): a declared prompt input
//    for the grader, stored in the result as provenance.
//  - The graded result carries a "practice estimate" average with the
//    standing claim-precision label (not an official CEFR grade).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PenLine, ArrowRight, SpellCheck2 } from "lucide-react";
import { Btn, Card, Chip, FA, Note, ScoreRow, Spinner } from "./ui";
import { clearWriteDraft, loadWriteDraft, saveWriteDraft } from "@/lib/write-draft";
import type { AppState } from "./App";

interface Result {
  level: string;
  scores: { task: number; organization: number; range: number; accuracy: number };
  verdict: string;
  errors: { bad: string; good: string; fa: string; type: string }[];
  upgrades: { plain: string; c1: string; fa: string }[];
  next_focus: string;
  ruleChecks?: { engine: string; errors: number; style: number; backfilled: number } | null;
  goal?: string | null;
}

interface GcFinding {
  offset: number;
  length: number;
  excerpt: string;
  message: string;
  ruleId: string;
  category: string;
  replacements: string[];
  kind: "error" | "style";
}

interface GcReport {
  engine: string;
  errors: Omit<GcFinding, "kind">[];
  style: Omit<GcFinding, "kind">[];
  summary: string;
}

const GOALS = [
  { k: "exam", label: "Exam board", hint: "strict academic register" },
  { k: "work", label: "Workplace", hint: "concise professional" },
  { k: "casual", label: "Casual", hint: "natural rhythm, loose register" },
];

// Mirrored highlight layer: identical metrics to the textarea (p-4, text-sm,
// leading-relaxed, pre-wrap, break-words), transparent text, underline/backing
// only. The textarea scrolls; the layer follows via scrollTop sync.
function HighlightLayer({ text, findings, scrollRef }: { text: string; findings: GcFinding[]; scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const valid = findings
    .filter((f) => f.offset >= 0 && f.length > 0 && f.offset + f.length <= text.length)
    .sort((a, b) => a.offset - b.offset);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  valid.forEach((f, i) => {
    if (f.offset < cursor) return; // overlap guard: first finding wins
    if (f.offset > cursor) parts.push(<span key={`t${i}`}>{text.slice(cursor, f.offset)}</span>);
    parts.push(
      <span
        key={`f${i}`}
        className={
          f.kind === "error"
            ? "rounded-sm bg-[#ff8ba0]/[0.16] shadow-[inset_0_-2px_0_0_#ff8ba0]"
            : "rounded-sm bg-[#9de6fb]/[0.14] shadow-[inset_0_-2px_0_0_#9de6fb]"
        }
      >
        {text.slice(f.offset, f.offset + f.length)}
      </span>,
    );
    cursor = f.offset + f.length;
  });
  parts.push(<span key="tail">{text.slice(cursor)}</span>);
  return (
    <div
      ref={scrollRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words p-4 text-sm leading-relaxed text-transparent"
    >
      {parts}
    </div>
  );
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
  // Grammarly RE (Task 85): live rule-engine pre-flight + register goal.
  const [checkOn, setCheckOn] = useState(true);
  const [gc, setGc] = useState<GcReport | null>(null);
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const [goalSel, setGoalSel] = useState<string>("");
  // Draft autosave (Task 94): the unsent draft survives reloads/offline blips
  // on this device. Restored once on mount, saved debounced, cleared when the
  // server accepts the submission. The indicator is honest: "saved on this
  // device", never "synced".
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const draftSeq = useRef(0);
  const checkSeq = useRef(0);
  const layerRef = useRef<HTMLDivElement | null>(null);

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

  // Draft autosave: restore-once on mount, then debounced saves. The draft
  // store is device-local by design - nothing here claims a submission or a
  // sync; the server only ever receives the draft when the learner submits.
  useEffect(() => {
    const d = loadWriteDraft(window.localStorage);
    if (d) {
      setText(d.text);
      setGoalSel(d.goalSel);
      if (d.revisingId !== null) setRevisingId(d.revisingId);
      setDraftSavedAt(d.at);
      setDraftRestored(true);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      const mine = ++draftSeq.current;
      const at = Date.now();
      const ok = saveWriteDraft({ text, goalSel, revisingId, at }, window.localStorage);
      if (ok && mine === draftSeq.current) {
        setDraftSavedAt(text.trim().length > 0 ? at : null);
        if (text.trim().length === 0) setDraftRestored(false);
      }
    }, 500);
    return () => clearTimeout(id);
  }, [text, goalSel, revisingId]);

  // Live pre-flight: 1.2s after typing goes idle, screen the CURRENT text.
  // Stale responses are dropped by sequence number; errors are silent (the
  // grader backstop still catches everything at submission time).
  useEffect(() => {
    if (!checkOn || busy) return;
    const t = text;
    if (t.trim().length < 20) {
      setGc(null);
      return;
    }
    const id = setTimeout(() => {
      const mine = ++checkSeq.current;
      fetch("/api/grammar-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: GcReport | null) => {
          if (j && checkSeq.current === mine) setGc(j);
        })
        .catch(() => {});
    }, 1200);
    return () => clearTimeout(id);
  }, [text, checkOn, busy]);

  // Task 89 perf: this rebuild ran on EVERY render (every keystroke) even when
  // neither the check response nor the ignore set changed. The mirror layer
  // must follow the text per keystroke (inherent), but the finding merge does
  // not - it is keyed to the response and the user's ignore decisions only.
  const allFindings: GcFinding[] = useMemo(
    () =>
      gc
        ? [
            ...gc.errors.map((f) => ({ ...f, kind: "error" as const })),
            ...gc.style.map((f) => ({ ...f, kind: "style" as const })),
          ].filter((f) => !ignored.has(`${f.ruleId}:${f.excerpt}`))
        : [],
    [gc, ignored],
  );
  const visibleFindings = allFindings.slice(0, 12);

  const applyReplacement = useCallback((f: GcFinding, rep: string) => {
    setText((t) => t.slice(0, f.offset) + rep + t.slice(f.offset + f.length));
    setGc(null); // stale offsets die immediately; the debounce re-screens
  }, []);

  const ignoreFinding = useCallback((f: GcFinding) => {
    setIgnored((s) => new Set(s).add(`${f.ruleId}:${f.excerpt}`));
  }, []);

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
      setGc(null);
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
        body: JSON.stringify({ prompt: prompts[prompt] ?? "", text, revisingId: revisingId ?? undefined, goal: goalSel || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Grading failed.");
      setResult(j);
      setRevisingId(null);
      setGc(null);
      // The server now holds the content - the local draft cache's job is done.
      clearWriteDraft(window.localStorage);
      setDraftSavedAt(null);
      setDraftRestored(false);
      onChange();
      loadRecent();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [prompt, prompts, text, goalSel, onChange, revisingId, loadRecent]);

  const words = text.trim().split(/\s+/).filter(Boolean).length;
  // Practice estimate (claim-precision rule): one honest average of the four
  // criteria, always labeled an estimate - grading is not yet validated
  // against expert-reviewed responses and exam-specific rubrics.
  const estimate = result
    ? (Number(result.scores.task || 0) + Number(result.scores.organization || 0) + Number(result.scores.range || 0) + Number(result.scores.accuracy || 0)) / 4
    : 0;

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
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[#7d889c]">Register goal:</span>
          {GOALS.map((g) => (
            <button
              key={g.k}
              onClick={() => setGoalSel(goalSel === g.k ? "" : g.k)}
              title={g.hint}
              className={
                "rounded-full border px-3 py-1 text-xs font-semibold transition-colors " +
                (goalSel === g.k
                  ? "border-[var(--rah-accent)] bg-[var(--rah-accent)]/[0.12] text-[#f2f5fa]"
                  : "border-[#2a3242] text-[#a9b4c6] hover:border-[#3f4c63]")
              }
            >
              {g.label}
            </button>
          ))}
          <span className="text-[11px] text-white/35">{goalSel ? GOALS.find((g) => g.k === goalSel)?.hint : "optional - scales how strictly register is judged"}</span>
        </div>
        <div className="relative rounded-2xl border-2 border-[#2a3242] bg-[#141924] transition-colors focus-within:border-[var(--rah-accent)]">
          {checkOn && <HighlightLayer text={text} findings={allFindings} scrollRef={layerRef} />}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onScroll={(e) => {
              if (layerRef.current) layerRef.current.scrollTop = e.currentTarget.scrollTop;
            }}
            rows={9}
            placeholder="Write 120 to 200 words. Push for range: collocations, hedging, discourse markers. The examiner rewards risk taken with control."
            className="relative z-10 w-full resize-none bg-transparent p-4 text-sm leading-relaxed text-[#e7ecf5] outline-none placeholder:text-[#5c6678]"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[#7d889c]">{words} words</span>
            <button
              onClick={() => setCheckOn((v) => !v)}
              className={
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors " +
                (checkOn ? "border-[#7fe0ac]/40 text-[#7fe0ac]" : "border-[#2a3242] text-[#7d889c]")
              }
              title="Deterministic LanguageTool screening while you type - no AI, nothing leaves the draft"
            >
              <SpellCheck2 className="h-3.5 w-3.5" />
              Check as I write {checkOn ? "on" : "off"}
            </button>
          </div>
          <Btn onClick={submit} disabled={busy || words < 12}>
            {busy ? "Grading" : revisingId !== null ? "Grade this revision" : "Grade my essay"}
          </Btn>
        </div>
        {/* Draft autosave honesty line (Task 94): states exactly what the local
            cache is - a device-local draft, not a submission or a sync. */}
        {draftSavedAt !== null && (
          <div className="text-[11px] text-[#7d889c]">
            {draftRestored ? "Restored your unsent draft" : "Draft saved"} on this device
            {" · "}
            {new Date(draftSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            {" · nothing was submitted or sent"}
          </div>
        )}
        {checkOn && gc && visibleFindings.length > 0 && (
          <div className="mt-4 rounded-2xl border border-[#2a3242] bg-[#10151f] p-3.5">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold tracking-tight text-[#f2f5fa]">Live check</span>
              <span className="text-[11px] text-[#7d889c]">{gc.summary} - deterministic rule engine, no AI, your draft stays yours</span>
            </div>
            <div className="flex flex-col gap-2">
              {visibleFindings.map((f, i) => (
                <div key={`${f.ruleId}-${f.offset}-${i}`} className="rounded-xl border border-[#2a3242] p-2.5 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={"rounded-full px-2 py-0.5 text-[10px] font-bold uppercase " + (f.kind === "error" ? "bg-[#3a1a1f] text-[#ff9db1]" : "bg-[#12283a] text-[#9de6fb]")}>
                      {f.category.replace(/_/g, " ")}
                    </span>
                    {f.kind === "error" && <span className="text-xs text-[#ff9db1] line-through">{f.excerpt}</span>}
                    {f.kind === "style" && <span className="text-xs text-[#9de6fb]">{f.excerpt}</span>}
                  </div>
                  <div className="mt-1 text-xs leading-relaxed text-[#a9b4c6]">{f.message}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {f.replacements.slice(0, 2).map((rep) => (
                      <button
                        key={rep}
                        onClick={() => applyReplacement(f, rep)}
                        className="rounded-full bg-[#173a26] px-2.5 py-1 text-xs font-bold text-[#7fe0ac] transition-transform active:scale-95"
                        title="Splice this replacement into your text at the exact spot"
                      >
                        {rep}
                      </button>
                    ))}
                    <button onClick={() => ignoreFinding(f)} className="text-[11px] font-semibold text-[#7d889c] hover:text-white/70 hover:underline">
                      ignore
                    </button>
                  </div>
                </div>
              ))}
              {allFindings.length > 12 && (
                <div className="text-[11px] text-white/40">+{allFindings.length - 12} more appear as you fix these.</div>
              )}
            </div>
          </div>
        )}
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">CEFR result</span>
                <div className="flex items-center gap-2">
                  {result.goal && <Chip tone="cyan">{result.goal} register</Chip>}
                  <Chip tone="blue">{result.level}</Chip>
                  <Chip tone="amber">practice estimate ≈ {estimate.toFixed(1)}/10</Chip>
                </div>
              </div>
              <div className="mt-5 flex flex-col gap-3.5">
                <ScoreRow name="Task" value={result.scores.task} />
                <ScoreRow name="Organization" value={result.scores.organization} tone="cyan" />
                <ScoreRow name="Range" value={result.scores.range} tone="cyan" />
                <ScoreRow name="Accuracy" value={result.scores.accuracy} tone={result.scores.accuracy < 6 ? "rose" : "emerald"} />
              </div>
              <p className="mt-5 text-sm leading-relaxed text-[#a9b4c6]">{result.verdict}</p>
              <div className="mt-4">
                <Note tone="blue">
                  Practice estimate, not an official CEFR grade: grading is not yet validated against expert-reviewed responses and exam-specific rubrics.
                </Note>
              </div>
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
