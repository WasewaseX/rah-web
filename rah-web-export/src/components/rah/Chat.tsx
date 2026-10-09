"use client";

// Coach chat: Socratic turns with elaborated Farsi corrections.
// Powered by the built-in AI, no configuration anywhere.

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Trash2, Sparkles, ArrowRight } from "lucide-react";
import { Btn, Card, FA, Note, Spinner } from "./ui";
import type { AppState } from "./App";

interface Correction {
  wrong: string;
  right: string;
  fa: string;
  trap: string;
}
interface CoachMsg {
  reply: string;
  corrections: Correction[];
  fa_note: string;
}
interface Msg {
  id: number;
  role: string;
  text?: string;
  parsed?: CoachMsg | null;
}

const OPENERS = [
  "Correct this: I have seen him yesterday at the office.",
  "I want to sound more professional in meetings. Where do I start?",
  "Drill me on articles. Quiz me and fix me.",
  "Here is a sentence I need for work: 'لطفاً فردا گزارش را برایم ایمیل کنید'. How do I say it naturally?",
];

export default function ChatView({ state, onChange }: { state: AppState; onChange: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/chat", { cache: "no-store" });
    const j = await r.json();
    setMsgs(j.messages ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  const send = async (text?: string) => {
    const m = (text ?? input).trim();
    if (!m || busy) return;
    setInput("");
    setBusy(true);
    setError(null);
    setMsgs((prev) => [...prev, { id: Date.now(), role: "user", text: m }]);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: m }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "The coach did not answer.");
      setMsgs((prev) => [...prev, { id: Date.now() + 1, role: "coach", parsed: j }]);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    await fetch("/api/chat", { method: "DELETE" });
    setMsgs([]);
    onChange();
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3.5">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4e8cff] to-[#2f62c4] text-white shadow-[0_8px_20px_-6px_rgba(78,140,255,.55)]">
            <Sparkles className="h-5 w-5" />
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#1a1f2b] bg-[#2fc273]" />
          </div>
          <div>
            <div className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Your coach is already here</div>
            <div className="text-xs text-[#8b96a9]">
              Built in, running now. Knows your level ({state.learner.level === "?" ? "unmeasured" : state.learner.level}) and your recent leaks.
            </div>
          </div>
        </div>
        {msgs.length > 0 && (
          <Btn variant="ghost" onClick={reset} className="text-xs">
            <Trash2 className="h-4 w-4" /> Clear
          </Btn>
        )}
      </Card>

      <Card className="flex max-h-[55vh] min-h-80 flex-col gap-4 overflow-y-auto">
        {loading && <Spinner />}
        {!loading && msgs.length === 0 && (
          <div className="py-6 text-center">
            <p className="text-base font-extrabold tracking-tight text-[#f2f5fa]">The coach makes you produce before it explains.</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-[#a9b4c6]">
              Expect short turns, one correction at a time, and every fix explained in Farsi. Try one of these:
            </p>
            <div className="mt-5 flex flex-col items-center gap-2">
              {OPENERS.map((o) => (
                <button
                  key={o}
                  onClick={() => send(o)}
                  className="w-full max-w-md rounded-2xl border-2 border-[#2a3242] px-4 py-3 text-left text-sm leading-relaxed text-[#b7c1d3] transition-all hover:border-[#4e8cff]/60 hover:bg-[#4e8cff]/[0.07] hover:text-[#dbe3f0]"
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m) =>
          m.role === "user" ? (
            <div
              key={m.id}
              className="rah-pop self-end rounded-3xl rounded-br-lg bg-gradient-to-br from-[#4e8cff] to-[#3a6fd6] px-[18px] py-3 text-sm leading-relaxed text-white shadow-[0_10px_28px_-14px_rgba(78,140,255,.65)] sm:max-w-[80%]"
            >
              {m.text}
            </div>
          ) : (
            <div key={m.id} className="rah-pop flex max-w-[92%] flex-col gap-2 self-start">
              <div className="rounded-3xl rounded-bl-lg border border-white/[0.06] bg-[#212836] px-[18px] py-3 text-sm leading-relaxed text-[#e7ecf5]">
                {m.parsed?.reply ?? "..."}
              </div>
              {(m.parsed?.corrections?.length ?? 0) > 0 && (
                <div className="flex flex-col gap-2">
                  {m.parsed!.corrections.map((c, i) => (
                    <div key={i} className="rounded-2xl border border-[#ffb02e]/25 bg-[#ffb02e]/[0.06] p-3.5 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[#ff8ba0] line-through">{c.wrong}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-[#5c6678]" />
                        <span className="font-black text-[#7fe0ac]">{c.right}</span>
                      </div>
                      <FA className="mt-1.5 block text-xs leading-loose">{c.fa}</FA>
                      {c.trap && c.trap !== "none" && (
                        <span className="mt-1.5 inline-block rounded-full border border-white/[0.08] bg-white/[0.05] px-2 py-0.5 text-[10px] font-bold text-[#8b96a9]">
                          {c.trap.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {m.parsed?.fa_note && (
                <FA className="self-start rounded-2xl border border-white/[0.05] bg-[#141924] px-3.5 py-2 text-xs">{m.parsed.fa_note}</FA>
              )}
            </div>
          ),
        )}
        {busy && (
          <div className="self-start">
            <Spinner label="Coach is thinking" />
          </div>
        )}
        <div ref={bottomRef} />
      </Card>

      {error && <Note tone="rose">{error}</Note>}

      <form
        className="flex gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Write in English. Mistakes are the point."
          className="min-h-12 flex-1 rounded-2xl border-2 border-[#2a3242] bg-[#141924] px-4 text-sm text-[#f2f5fa] outline-none transition-colors placeholder:text-[#5c6678] focus:border-[#4e8cff]"
        />
        <Btn type="submit" variant="go" disabled={!input.trim() || busy} className="px-4">
          <Send className="h-4 w-4" />
        </Btn>
      </form>
    </div>
  );
}
