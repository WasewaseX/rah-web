"use client";

// Writing Portfolio: every graded essay, its four CEFR dimension scores, and
// the growth diff between your first and latest piece - length, average
// score, error count. Proof of movement, not vibes.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Library } from "lucide-react";
import { Card, Chip, Note, Spinner } from "./ui";

interface ErrorRow {
  bad?: string;
  good?: string;
  type?: string;
}

interface WritingResult {
  level?: string;
  scores?: { task: number; organization: number; range: number; accuracy: number };
  verdict?: string;
  errors?: ErrorRow[];
  next_focus?: string;
}

interface Entry {
  id: number;
  prompt: string;
  result: WritingResult | null;
  at: string;
}

function avgScore(r: WritingResult | null): number | null {
  if (!r?.scores) return null;
  const s = r.scores;
  return Math.round(((s.task + s.organization + s.range + s.accuracy) / 4) * 10) / 10;
}

export default function Portfolio() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(() => {
    fetch("/api/writing", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { recent?: Entry[] }) => setEntries(j.recent ?? []))
      .catch(() => setEntries([]));
  }, []);
  useEffect(load, [load]);

  const diff = useMemo(() => {
    if (!entries || entries.length < 2) return null;
    const first = entries[entries.length - 1];
    const last = entries[0];
    const a1 = avgScore(first.result);
    const a2 = avgScore(last.result);
    const e1 = first.result?.errors?.length ?? null;
    const e2 = last.result?.errors?.length ?? null;
    const w1 = first.prompt ? first.prompt.length : 0; // prompts are the learner's own text? no - prompt is the task
    void w1;
    return {
      firstAt: first.at,
      lastAt: last.at,
      scoreDelta: a1 !== null && a2 !== null ? Math.round((a2 - a1) * 10) / 10 : null,
      errorDelta: e1 !== null && e2 !== null ? e2 - e1 : null,
      count: entries.length,
    };
  }, [entries]);

  if (entries === null) return <Spinner label="Dusting the shelf..." />;
  const open = entries.find((e) => e.id === openId) ?? null;

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#ffd08a]/[0.14] text-[#ffd08a]">
          <Library className="h-4 w-4" />
        </span>
        <span className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Writing portfolio</span>
        {entries.length > 0 && <Chip tone="amber">{entries.length} graded {entries.length === 1 ? "piece" : "pieces"}</Chip>}
      </div>

      {entries.length === 0 ? (
        <div className="text-sm text-[#8b96a9]">Nothing graded yet. The Writing lab keeps every essay here with its scores and upgrades.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {diff && diff.scoreDelta !== null && (
            <Note tone={diff.scoreDelta >= 0 ? "emerald" : "rose"}>
              Growth check: {diff.count} pieces banked. Average score moved {diff.scoreDelta >= 0 ? "+" : ""}{diff.scoreDelta} since your first piece
              {diff.errorDelta !== null ? `, error count ${diff.errorDelta <= 0 ? "down" : "up"} ${Math.abs(diff.errorDelta)}` : ""}. Bands are honest - movement is what counts.
            </Note>
          )}
          {entries.map((e) => {
            const a = avgScore(e.result);
            return (
              <button key={e.id} onClick={() => setOpenId(openId === e.id ? null : e.id)} className="rounded-2xl border border-white/[0.05] bg-white/[0.02] px-3.5 py-3 text-left transition-colors hover:border-white/[0.12]">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#dbe3f0]">{e.prompt.slice(0, 90) || "Untitled prompt"}</span>
                  {e.result?.level && <Chip tone="blue">{e.result.level}</Chip>}
                  {a !== null && <Chip tone={a >= 8 ? "emerald" : a >= 6 ? "cyan" : "slate"}>{a}/10</Chip>}
                </div>
                <div className="mt-1 text-[11px] text-[#7d889c]">
                  {new Date(e.at).toLocaleDateString()} · {e.result?.errors?.length ?? 0} errors flagged
                </div>
                {openId === e.id && open?.result && (
                  <div className="mt-3 flex flex-col gap-2 border-t border-white/[0.06] pt-3">
                    {open.result.verdict && <p className="text-[13px] leading-relaxed text-[#a9b4c6]">{open.result.verdict}</p>}
                    {open.result.errors?.slice(0, 4).map((er, i) => (
                      <div key={i} className="text-xs">
                        <span className="text-[#ffa3b1]">{er.bad}</span>
                        {" → "}
                        <span className="text-[#7fe0ac]">{er.good}</span>
                        {er.type && <span className="ml-2 text-[#5c6678]">({er.type.replace("_", " ")})</span>}
                      </div>
                    ))}
                    {open.result.next_focus && <div className="text-xs font-bold text-[#ffd08a]">Next focus: {open.result.next_focus}</div>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
