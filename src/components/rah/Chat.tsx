"use client";

// Coach chat: an agent with 22 skills, not a chatbot. Steps show the work,
// exams render inline, bands render inline, plugins act on the app itself.

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Trash2, Sparkles, ArrowRight, Wrench } from "lucide-react";
import { Btn, Card, FA, Note, Spinner } from "./ui";
import { ExamCard } from "./ExamCard";
import { AssessCard } from "./AssessCard";
import { applyTheme } from "@/lib/theme-bus";
import type { AppState } from "./App";
import type { CoachEnvelope, Correction } from "@/lib/agent/types";

interface Msg {
  id: number;
  role: string;
  text?: string;
  parsed?: CoachEnvelope | null;
}

const OPENERS = [
  "Generate an exam",
  "/deep",
  "Assess my level",
  "Theme ocean",
  "Drill me on collocations with take and get",
];

function Steps({ steps }: { steps: NonNullable<CoachEnvelope["steps"]> }) {
  const [open, setOpen] = useState(false);
  if (steps.length === 0) return null;
  return (
    <div className="flex flex-col">
      <button
        onClick={() => setOpen((v) => !v)}
        className="self-start rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-[#8b96a9] transition-colors hover:text-[#dbe3f0]"
      >
        <Wrench className="mr-1 inline h-3 w-3" />
        {steps.length} step{steps.length > 1 ? "s" : ""}
      </button>
      {open && (
        <div className="mt-1.5 flex flex-col gap-1 self-start rounded-2xl border border-white/[0.05] bg-[#141924] px-3 py-2">
          {steps.map((s, i) => (
            <div key={i} className="text-[11px] leading-snug text-[#8b96a9]">
              <span className="font-bold text-[#a9b4c6]">{s.label}</span>
              {s.detail ? ` — ${s.detail}` : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Corrections({ corrections }: { corrections: Correction[] }) {
  if (corrections.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {corrections.map((c, i) => (
        <div key={i} className="rounded-2xl border border-[#ffb02e]/25 bg-[#ffb02e]/[0.06] p-3.5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[#ff8ba0] line-through">{c.wrong}</span>
            <ArrowRight className="h-3.5 w-3.5 text-[#5c6678]" />
            <span className="font-black text-[#7fe0ac]">{c.right}</span>
          </div>
          {c.fa && (
            <FA className="mt-1.5 block text-xs leading-loose">{c.fa}</FA>
          )}
          {c.trap && c.trap !== "none" && (
            <span className="mt-1.5 inline-block rounded-full border border-white/[0.08] bg-white/[0.05] px-2 py-0.5 text-[10px] font-bold text-[#8b96a9]">
              {c.trap.replace(/_/g, " ")}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ChatView({ state, onChange }: { state: AppState; onChange: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const DEEP_PHASES = [
    "Routing your request",
    "Gathering evidence",
    "Mining patterns",
    "Synthesizing",
    "Almost there",
  ];

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
  }, [msgs, busy, phase]);

  // Progressive phase labels while a long turn runs: the agent shows its work.
  useEffect(() => {
    if (!busy) {
      setPhase(0);
      return;
    }
    const t = setInterval(() => setPhase((p) => Math.min(p + 1, DEEP_PHASES.length - 1)), 7000);
    return () => clearInterval(t);
  }, [busy]);

  const runActions = (env: CoachEnvelope) => {
    for (const a of env.actions ?? []) {
      if (a.type === "theme" && a.tokens) applyTheme(a.tokens);
      if (a.type === "navigate" && a.view) {
        window.history.pushState(null, "", `#${a.view}`);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      }
      if (a.type === "focus") onChange();
    }
  };

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
      const env = j as CoachEnvelope;
      setMsgs((prev) => [...prev, { id: Date.now() + 1, role: "coach", parsed: env }]);
      runActions(env);
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
          <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--rah-primary)] to-[#2f62c4] text-white shadow-[0_8px_20px_-6px_rgba(78,140,255,.55)]">
            <Sparkles className="h-5 w-5" />
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--rah-surface)] bg-[#2fc273]" />
          </div>
          <div>
            <div className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">The coach runs skills</div>
            <div className="text-xs text-[#8b96a9]">
              Exams, level bands, deep analysis, themes, drills. Try /skills for the directory.
            </div>
          </div>
        </div>
        {msgs.length > 0 && (
          <Btn variant="ghost" onClick={reset} className="text-xs">
            <Trash2 className="h-4 w-4" /> Clear
          </Btn>
        )}
      </Card>

      <Card className="flex max-h-[58vh] min-h-80 flex-col gap-4 overflow-y-auto">
        {loading && <Spinner />}
        {!loading && msgs.length === 0 && (
          <div className="py-6 text-center">
            <p className="text-base font-extrabold tracking-tight text-[#f2f5fa]">Twenty-two skills. One coach. No scripts.</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-[#a9b4c6]">
              Ask for an exam, a level probe, a 30-second deep analysis, a theme change, or just talk. Start with:
            </p>
            <div className="mt-5 flex flex-col items-center gap-2">
              {OPENERS.map((o) => (
                <button
                  key={o}
                  onClick={() => send(o)}
                  className="w-full max-w-md rounded-2xl border-2 border-[#2a3242] px-4 py-3 text-left text-sm leading-relaxed text-[#b7c1d3] transition-all hover:border-[var(--rah-primary)]/60 hover:bg-[var(--rah-primary)]/[0.07] hover:text-[#dbe3f0]"
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
              className="rah-pop self-end rounded-3xl rounded-br-lg bg-gradient-to-br from-[var(--rah-primary)] to-[#3a6fd6] px-[18px] py-3 text-sm leading-relaxed text-white shadow-[0_10px_28px_-14px_rgba(78,140,255,.65)] sm:max-w-[80%]"
            >
              {m.text}
            </div>
          ) : (
            <div key={m.id} className="rah-pop flex max-w-[92%] flex-col gap-2 self-start">
              <div className="whitespace-pre-wrap rounded-3xl rounded-bl-lg border border-white/[0.06] bg-[#212836] px-[18px] py-3 text-sm leading-relaxed text-[#e7ecf5]">
                {m.parsed?.reply ?? "..."}
              </div>
              {m.parsed?.steps && m.parsed.steps.length > 0 && <Steps steps={m.parsed.steps} />}
              <Corrections corrections={m.parsed?.corrections ?? []} />
              {m.parsed?.fa_note && (
                <FA className="self-start rounded-2xl border border-white/[0.05] bg-[#141924] px-3.5 py-2 text-xs">{m.parsed.fa_note}</FA>
              )}
              {m.parsed?.exam && <ExamCard exam={m.parsed.exam} onDone={onChange} />}
              {m.parsed?.result && !m.parsed?.exam && <ExamResultInline result={m.parsed.result} title="Graded" />}
              {m.parsed?.assessment && <AssessCard data={m.parsed.assessment} />}
            </div>
          ),
        )}
        {busy && (
          <div className="self-start">
            <Spinner label={`${DEEP_PHASES[phase]}...`} />
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
          placeholder="Ask, drill, or /slash. The coach picks the right skill."
          className="min-h-12 flex-1 rounded-2xl border-2 border-[#2a3242] bg-[var(--rah-bg)] px-4 text-sm text-[#f2f5fa] outline-none transition-colors placeholder:text-[#5c6678] focus:border-[var(--rah-primary)]"
        />
        <Btn type="submit" variant="go" disabled={!input.trim() || busy} className="px-4">
          <Send className="h-4 w-4" />
        </Btn>
      </form>
    </div>
  );
}

function ExamResultInline({ result, title }: { result: NonNullable<CoachEnvelope["result"]>; title: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#141924] p-4 text-sm">
      <div className="text-xs font-bold uppercase tracking-wider text-[#8b96a9]">{title}</div>
      <div className="mt-1 font-black text-[#f2f5fa]">
        {result.correct}/{result.total} ({result.pct}%)
      </div>
      <p className="mt-1.5 leading-relaxed text-[#c4cddc]">{result.headline}</p>
    </div>
  );
}
