"use client";

// Replay Theater: every graded exam can be stepped through turn by turn -
// the exact item, your exact answer, the verdict and the coaching note. Then
// vs now closes the loop: what the first miss looked like, what the healed
// streak looks like today.

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Film, Play } from "lucide-react";
import { Btn, Card, Chip, Note, Spinner } from "./ui";

interface ExamRow {
  id: string;
  title: string;
  createdAt: string;
  total: number | null;
  correct: number | null;
}

interface ReplayItem {
  id: string;
  type: string;
  skill: string;
  q: string;
  a?: string;
  why?: string;
}

interface ReplayVerdict {
  id: string;
  correct: boolean;
  given?: string;
  rule?: string;
}

interface ReplayBundle {
  id: string;
  title: string;
  spec: { level?: string; minutes?: number };
  items: ReplayItem[];
  result: { verdicts?: ReplayVerdict[]; total?: number; correct?: number } | null;
}

export default function Replay() {
  const [shelf, setShelf] = useState<ExamRow[] | null>(null);
  const [bundle, setBundle] = useState<ReplayBundle | null>(null);
  const [idx, setIdx] = useState(0);

  const loadShelf = useCallback(() => {
    fetch("/api/exam/replay", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { exams: ExamRow[] }) => setShelf(j.exams))
      .catch(() => setShelf([]));
  }, []);
  useEffect(loadShelf, [loadShelf]);

  const open = async (id: string) => {
    const r = await fetch(`/api/exam/replay?id=${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!r.ok) return;
    const j = (await r.json()) as ReplayBundle;
    setBundle(j);
    setIdx(0);
  };

  if (shelf === null) return <Spinner label="Rolling the film..." />;

  if (bundle) {
    const v = bundle.result?.verdicts?.find((x) => x.id === bundle.items[idx]?.id);
    const item = bundle.items[idx];
    return (
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#9de6fb]/[0.14] text-[#9de6fb]">
            <Film className="h-4 w-4" />
          </span>
          <span className="text-sm font-extrabold text-[#f2f5fa]">{bundle.title}</span>
          <Chip tone="cyan">{bundle.result?.correct ?? "?"}/{bundle.result?.total ?? bundle.items.length}</Chip>
          <Btn variant="ghost" className="ml-auto !min-h-9 !px-3 !py-1.5 !text-xs" onClick={() => setBundle(null)}>
            Shelf
          </Btn>
        </div>
        {item ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.1em] text-[#7d889c]">
              <span>Turn {idx + 1} of {bundle.items.length} · {item.skill} · {item.type}</span>
              <span className="flex gap-1">
                <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} className="rounded-lg p-1.5 text-[#8b96a9] hover:bg-white/[0.06] disabled:opacity-30">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={() => setIdx((i) => Math.min(bundle.items.length - 1, i + 1))} disabled={idx === bundle.items.length - 1} className="rounded-lg p-1.5 text-[#8b96a9] hover:bg-white/[0.06] disabled:opacity-30">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </span>
            </div>
            <div className="whitespace-pre-line rounded-2xl bg-white/[0.03] p-3.5 text-[15px] font-semibold leading-relaxed text-[#e7ecf5]">{item.q}</div>
            {v && (
              <div className="flex flex-col gap-1.5 text-[13px]">
                <div className="flex items-center gap-2">
                  <Chip tone={v.correct ? "emerald" : "rose"}>{v.correct ? "you got it" : "missed"}</Chip>
                  {v.given && <span className="text-[#a9b4c6]">your answer: &ldquo;{v.given}&rdquo;</span>}
                </div>
                {!v.correct && item.a && (
                  <div className="text-[#a9b4c6]">
                    key: <span className="font-bold text-[#7fe0ac]">{item.a}</span>
                  </div>
                )}
                {v.rule && <div className="text-xs italic text-[#8b96a9]">{v.rule}</div>}
              </div>
            )}
            {!v && <Note tone="blue">This item has no stored verdict - the exam may predate the memory loop.</Note>}
          </div>
        ) : (
          <div className="text-sm text-[#8b96a9]">No items recorded for this exam.</div>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#9de6fb]/[0.14] text-[#9de6fb]">
          <Film className="h-4 w-4" />
        </span>
        <span className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Replay theater</span>
      </div>
      {shelf.length === 0 ? (
        <div className="text-sm text-[#8b96a9]">No graded exams yet. Take one from the coach, then watch it back here turn by turn.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {shelf.map((e) => (
            <button key={e.id} onClick={() => open(e.id)} className="flex items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-3.5 py-3 text-left transition-colors hover:border-white/[0.12] hover:bg-white/[0.05]">
              <Play className="h-4 w-4 text-[#9de6fb]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-[#dbe3f0]">{e.title}</div>
                <div className="text-[11px] text-[#7d889c]">{new Date(e.createdAt).toLocaleDateString()} {new Date(e.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
              {e.total !== null && <Chip tone={e.correct !== null && e.correct / e.total >= 0.8 ? "emerald" : "rose"}>{e.correct}/{e.total}</Chip>}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
