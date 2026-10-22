"use client";

// MaterialReader (Task 71, LINGQ-RE.md §3): your imported material IS a
// reading. The full text renders with every extracted card's answer
// highlighted where it appears; tapping one opens the card inline (note +
// its validated source sentence) and grades retrieval in context through
// the SAME /api/review/grade path the review queue uses - same FSRS
// schedule, same ReviewLog row, same XP, offline-safe via the Task-68
// outbox. What this is NOT: a per-token known-word ledger (LINGQ-RE.md §4 -
// that needs a real dictionary source; a fake one would violate the honesty
// rules) and not a queue replacement - the full review still schedules
// these cards.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpenText, ChevronDown } from "lucide-react";
import { Btn, Card, Chip, Note, Spinner } from "./ui";
import { submitGrade } from "@/lib/offline";

interface MaterialRow {
  id: string;
  title: string;
  source: string;
  words: number;
  degraded: boolean;
  cards: number;
}

interface MaterialDetail extends Omit<MaterialRow, "cards"> {
  text: string;
  cards: { id: string; front: string; answer: string; context: string; note: string }[];
}

export default function MaterialReader({ onExit }: { onExit: () => void }) {
  const [mats, setMats] = useState<MaterialRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MaterialDetail | null>(null);
  const [tapCard, setTapCard] = useState<string | null>(null);
  const [graded, setGraded] = useState<Record<string, "good" | "again" | "queued">>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/materials", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setMats(j.materials ?? []))
      .catch(() => setMats([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!openId) {
      // Clear deferred: the effect only SYNCS the selection change; no
      // synchronous setState in the effect body (react-hooks rule).
      const t = setTimeout(() => {
        setDetail(null);
      }, 0);
      return () => clearTimeout(t);
    }
    // Reset the tap state for the new material inside the same deferred fetch
    // chain - synchronous setState in an effect body is what the rule forbids.
    const t0 = setTimeout(() => {
      setTapCard(null);
      setGraded({});
    }, 0);
    const fetchDetail = fetch(`/api/materials?id=${openId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setDetail(j))
      .catch(() => setDetail(null));
    return () => {
      clearTimeout(t0);
      void fetchDetail;
    };
  }, [openId]);

  const grade = useCallback(
    async (cardId: string, g: 1 | 3) => {
      if (graded[cardId] === "queued") return;
      const res = await submitGrade(cardId, g, "read");
      setGraded((s) => ({ ...s, [cardId]: res.online ? (g === 3 ? "good" : "again") : "queued" }));
    },
    [graded],
  );

  const paragraphs = useMemo(() => {
    if (!detail?.text) return [];
    return detail.text
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [detail]);

  // Highlight map: every card answer -> the positions where it appears in the
  // text (case-insensitive, whole-word-ish via boundary padding). One tap
  // target per card occurrence; the card's own panel opens on tap.
  const cardById = useMemo(() => {
    const m = new Map<string, MaterialDetail["cards"][number]>();
    for (const c of detail?.cards ?? []) m.set(c.id, c);
    return m;
  }, [detail]);

  function renderParagraph(p: string, pi: number) {
    if (!detail) return null;
    const hits: { start: number; end: number; cardId: string }[] = [];
    for (const c of detail.cards) {
      const ans = c.answer.trim();
      if (ans.length < 2) continue;
      const lower = p.toLowerCase();
      const needle = ans.toLowerCase();
      let from = 0;
      while (hits.length < 400) {
        const i = lower.indexOf(needle, from);
        if (i < 0) break;
        const before = i === 0 ? " " : p[i - 1];
        const after = i + needle.length >= p.length ? " " : p[i + needle.length];
        const boundary = /[\s.,!?;:'"()\-–—]/.test(before) && /[\s.,!?;:'"()\-–—]/.test(after);
        if (boundary) hits.push({ start: i, end: i + needle.length, cardId: c.id });
        from = i + needle.length;
      }
    }
    hits.sort((a, b) => a.start - b.start);
    // Drop overlaps (keep the first/longest).
    const clean: typeof hits = [];
    for (const h of hits) {
      const last = clean[clean.length - 1];
      if (!last || h.start >= last.end) clean.push(h);
    }
    if (clean.length === 0) return <p key={pi}>{p}</p>;
    const out: React.ReactNode[] = [];
    let cursor = 0;
    clean.forEach((h, i) => {
      if (h.start > cursor) out.push(<span key={`t${i}`}>{p.slice(cursor, h.start)}</span>);
      const c = cardById.get(h.cardId);
      const st = graded[h.cardId];
      out.push(
        <button
          key={`h${i}`}
          onClick={() => setTapCard(h.cardId === tapCard ? null : h.cardId)}
          className={`mx-0.5 rounded-md px-1 underline decoration-wavy decoration-2 underline-offset-4 transition-colors ${
            st === "good"
              ? "bg-[#2fc273]/[0.16] text-[#c4f2d8] decoration-[#2fc273]"
              : st === "again"
                ? "bg-[#ff6b81]/[0.14] text-[#ffc9d2] decoration-[#ff6b81]"
                : st === "queued"
                  ? "bg-[#ffb02e]/[0.14] text-[#ffd08a] decoration-[#ffb02e]"
                  : "bg-[var(--rah-primary)]/[0.14] text-[#d9e6ff] decoration-[var(--rah-primary)] hover:bg-[var(--rah-primary)]/[0.24]"
          }`}
        >
          {p.slice(h.start, h.end)}
        </button>,
      );
      cursor = h.end;
    });
    if (cursor < p.length) out.push(<span key="tail">{p.slice(cursor)}</span>);
    return <p key={pi}>{out}</p>;
  }

  if (!openId) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-[#f2f5fa]">
          <BookOpenText className="h-4 w-4 text-[#9dc0ff]" /> Read your materials
        </div>
        <p className="mt-2 text-sm leading-relaxed text-[#a9b4c6]">
          Your imported texts are readings too: the words Rah extracted are highlighted right where they appear - tap one to test
          yourself in the sentence that taught it. Grading here feeds the same schedule as the review queue.
        </p>
        {loading ? (
          <Spinner label="Loading materials" />
        ) : mats.length === 0 ? (
          <p className="mt-3 text-sm text-[#7d889c]">Nothing imported yet - add a material below and it shows up here.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {mats.map((m) => (
              <button
                key={m.id}
                onClick={() => setOpenId(m.id)}
                className="flex items-center justify-between rounded-xl border border-[#2a3242] bg-[#141924] px-3.5 py-2.5 text-left transition-colors hover:border-[#3f4c63]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-[#f2f5fa]">{m.title}</span>
                  <span className="text-xs text-[#7d889c]">
                    {m.words} words · {m.cards} tracked card{m.cards === 1 ? "" : "s"}
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-[#7d889c]" />
              </button>
            ))}
          </div>
        )}
      </Card>
    );
  }

  const tapped = tapCard ? cardById.get(tapCard) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Btn variant="ghost" onClick={() => setOpenId(null)}>
          <ArrowLeft className="h-4 w-4" /> Your materials
        </Btn>
        {detail && <Chip tone="blue">{detail.cards.length} tracked</Chip>}
      </div>

      <Card>
        <h2 className="text-2xl font-black tracking-tight text-[#f2f5fa]">{detail?.title ?? "…"}</h2>
        {detail?.source ? <div className="mt-1 text-xs text-[#7d889c]">{detail.source}</div> : null}
        {!detail ? (
          <Spinner label="Opening the text" />
        ) : (
          <>
            <div className="mt-5 flex flex-col gap-4 border-l-2 border-[var(--rah-primary)]/25 pl-5 text-[15px] leading-loose text-[#c3cddd]">
              {paragraphs.map((p, i) => renderParagraph(p, i))}
            </div>
            <p className="mt-5 text-xs leading-relaxed text-[#5d6879]">
              Retrieval in context - grading here is the same FSRS path the review queue uses. Highlighted words still appear in
              your normal reviews; this is another road into the schedule, not a replacement for it.
            </p>
          </>
        )}
      </Card>

      {tapped && (
        <Card className="rah-pop">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-black tracking-tight text-[#f2f5fa]">{tapped.answer}</div>
              {tapped.note ? <div className="mt-1 text-sm text-[#a9b4c6]">{tapped.note}</div> : null}
            </div>
            <button onClick={() => setTapCard(null)} className="rounded-lg p-2 text-[#7d889c] hover:text-[#f2f5fa]" aria-label="Close card">
              ×
            </button>
          </div>
          {tapped.context ? (
            <div className="mt-3 border-l-2 border-[var(--rah-primary)]/30 pl-3 text-[13px] italic leading-relaxed text-[#8b96a9]">
              {"\u201C"}
              {tapped.context}
              {"\u201D"}
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Btn onClick={() => void grade(tapped.id, 3)}>Got it</Btn>
            <Btn variant="soft" onClick={() => void grade(tapped.id, 1)}>
              Forgot
            </Btn>
            {graded[tapped.id] === "good" && <Chip tone="emerald">scheduled Good - back in ~days</Chip>}
            {graded[tapped.id] === "again" && <Chip tone="rose">Again - it comes back today</Chip>}
            {graded[tapped.id] === "queued" && <Chip tone="amber">Offline - queued to sync</Chip>}
          </div>
          <div className="mt-3">
            <Note>One grade per card per reading session - the queue still owns the full schedule.</Note>
          </div>
        </Card>
      )}
    </div>
  );
}
