"use client";

// BYO Materials (Stage 03 #1): paste real text you actually need to read.
// Rah extracts vocabulary + collocations WITH their source sentence, and the
// cards flow through the SAME review queue + FSRS schedule as the deck.
// Every card carries its source sentence - nothing is context-free.

import { useCallback, useEffect, useState } from "react";
import { FilePlus2, Trash2, FileText, ChevronDown, ExternalLink } from "lucide-react";
import { Btn, Card, Chip, Note } from "./ui";

interface MaterialRow {
  id: string;
  title: string;
  source: string;
  words: number;
  degraded: boolean;
  cards: number;
  createdAt: string;
}

interface MaterialDetail extends Omit<MaterialRow, "cards"> {
  text: string;
  cards: { id: string; front: string; answer: string; context: string; note: string }[];
}

export function MaterialsPanel() {
  const [mats, setMats] = useState<MaterialRow[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<MaterialDetail | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [expanded, setExpanded] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/materials");
      const j = await r.json();
      setMats(j.materials ?? []);
    } catch {
      // panel stays empty; the view works without it
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (id: string) => {
    if (open === id) {
      setOpen(null);
      setDetail(null);
      return;
    }
    setOpen(id);
    setDetail(null);
    const r = await fetch(`/api/materials?id=${id}`);
    if (r.ok) setDetail(await r.json());
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, source, text }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Import failed.");
      setMsg({
        ok: true,
        text: `${j.created} card${j.created === 1 ? "" : "s"} created from your text${j.degraded ? " (extraction ran in fallback mode)" : ""}. They enter your normal review queue.`,
      });
      setTitle("");
      setSource("");
      setText("");
      setFormOpen(false);
      void load();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    await fetch(`/api/materials?id=${id}`, { method: "DELETE" });
    if (open === id) {
      setOpen(null);
      setDetail(null);
    }
    void load();
  };

  return (
    <div className="flex flex-col gap-3">
      <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-2 text-left">
        <FileText className="h-4 w-4 text-[#9dc0ff]" />
        <span className="text-sm font-black tracking-tight text-[#f2f5fa]">Your materials</span>
        <Chip tone="blue">{mats.length}</Chip>
        <ChevronDown className={`ml-auto h-4 w-4 text-[#7d889c] transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <>
          <Note>
            Paste something you actually need to read - an article, a work email, lecture notes. Rah pulls out the words and
            word-combinations worth learning, every card keeps its original sentence as context, and they review on the same
            schedule as everything else.
          </Note>
          {formOpen ? (
            <Card className="flex flex-col gap-2 p-4">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (e.g. That work email about the deadline)"
                className="rounded-xl border border-white/[0.08] bg-[#111725] px-3 py-2 text-sm text-[#f2f5fa] outline-none placeholder:text-[#5d6879] focus:border-[var(--rah-primary)]/50"
              />
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Where it is from (optional - URL, book, course...)"
                className="rounded-xl border border-white/[0.08] bg-[#111725] px-3 py-2 text-sm text-[#f2f5fa] outline-none placeholder:text-[#5d6879] focus:border-[var(--rah-primary)]/50"
              />
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={7}
                placeholder="Paste the text here (a few paragraphs is ideal)..."
                className="rounded-xl border border-white/[0.08] bg-[#111725] px-3 py-2 text-sm leading-relaxed text-[#f2f5fa] outline-none placeholder:text-[#5d6879] focus:border-[var(--rah-primary)]/50"
              />
              <div className="flex items-center gap-2">
                <Btn onClick={() => void submit()} disabled={busy || text.trim().length < 120}>
                  {busy ? "Extracting..." : "Extract and add to review"}
                </Btn>
                <Btn variant="ghost" onClick={() => setFormOpen(false)}>
                  Cancel
                </Btn>
              </div>
            </Card>
          ) : (
            <div>
              <Btn variant="ghost" onClick={() => setFormOpen(true)}>
                <FilePlus2 className="h-4 w-4" /> Add material
              </Btn>
            </div>
          )}
          {msg && (
            <Note tone={msg.ok ? "emerald" : "rose"}>
              {msg.text}
            </Note>
          )}
          <div className="flex flex-col gap-2">
            {mats.map((m) => (
              <Card key={m.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <button className="min-w-0 flex-1 text-left" onClick={() => void openDetail(m.id)}>
                    <div className="truncate text-sm font-bold text-[#f2f5fa]">{m.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[#7d889c]">
                      <Chip tone="blue">{m.cards} cards</Chip>
                      <span>{m.words} words</span>
                      {m.source ? (
                        <span className="inline-flex items-center gap-0.5 truncate">
                          <ExternalLink className="h-3 w-3" /> {m.source}
                        </span>
                      ) : null}
                      {m.degraded ? <Chip tone="amber">fallback extraction</Chip> : null}
                    </div>
                  </button>
                  <button
                    onClick={() => void remove(m.id)}
                    title="Delete this material and its cards"
                    className="rounded-lg p-1.5 text-[#7d889c] transition-colors hover:bg-[#ff6b6b]/10 hover:text-[#ff6b6b]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {open === m.id && (
                  <div className="mt-3 flex flex-col gap-2 border-t border-white/[0.06] pt-3">
                    {detail === null ? (
                      <span className="text-xs text-[#7d889c]">Loading...</span>
                    ) : (
                      <>
                        {detail.cards.map((c) => (
                          <div key={c.id} className="rounded-xl border border-white/[0.06] bg-[#141924] p-2.5 text-xs">
                            <div className="font-bold text-[#e7ecf5]">{c.answer}</div>
                            {c.note ? <div className="mt-0.5 text-[#a9b4c6]">{c.note}</div> : null}
                            <div className="mt-1.5 italic leading-relaxed text-[#8b96a9]">
                              {"\u201C"}{c.context}{"\u201D"}
                            </div>
                          </div>
                        ))}
                        <details className="text-xs text-[#7d889c]">
                          <summary className="cursor-pointer select-none font-semibold">Show the full text</summary>
                          <p className="mt-2 whitespace-pre-wrap leading-relaxed">{detail.text}</p>
                        </details>
                      </>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
