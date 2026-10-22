"use client";

// The Coach sidebar: a global agent drawer available on EVERY tab.
// Not a chat interface - an agent cockpit. It shows the agent thinking
// (thought -> tool -> observe steps), streams them live over SSE, renders the
// final answer with corrections, and EXECUTES the agent's commands on the app:
// navigate to any view, refresh state, start a review, toast announcements.
// This is the "access anything, show anything on all tabs" surface.

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Send, GraduationCap, Wrench, Eye, BrainCircuit, FileText, ArrowRight, LogOut, FolderOpen, FileDown, Square, Trash2 } from "lucide-react";
import { Chip, Btn } from "./ui";
import { clearRahToken } from "@/lib/rah-fetch";
import { getCoachActivity } from "@/lib/activity-store";
import type { ViewId } from "./App";
import type { AppState } from "./App";

export interface CoachMessage {
  id: number;
  role: "user" | "coach";
  text?: string;
  reply?: string;
  corrections?: { wrong: string; right: string }[];
  commands?: AgentCommand[];
  toolsUsed?: string[];
}

export interface AgentCommand {
  type: "navigate" | "refresh" | "toast" | "open_placement" | "start_review";
  view?: string;
  title?: string;
  desc?: string;
}

interface LiveStep {
  kind: "thought" | "tool" | "observe" | "error";
  label: string;
  detail?: string;
  ok?: boolean;
}

interface WorkspaceFile {
  path: string;
  size: number;
  mtime: number;
  pdf: boolean;
}

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const SUGGESTIONS = [
  "Read my state and decide what I should do right now",
  "Make me a progress report as a PDF",
  "Find my weakest tags and write a 7-day drill plan file",
  "Search the web for B2 listening resources and save the best to a file",
];

// History written before the agent's JSON-repair fix can carry raw turn objects
// as the reply. Scrub them at render: unwrap a nested reply, never show braces.
function scrubHistoryReply(reply: string | undefined): string | undefined {
  const r = (reply ?? "").trim();
  if (!r.startsWith("{") || !/"(thought|tool|final|args|reply)"/.test(r)) return reply;
  const m = r.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (m) {
    try {
      const unwrapped = JSON.parse(`"${m[1]}"`) as string;
      if (unwrapped.trim() && !unwrapped.trim().startsWith("{")) return unwrapped;
    } catch {}
  }
  return "(older turn - the raw agent protocol leaked here; it is fixed now)";
}

export default function CoachSidebar({
  open,
  onOpenChange,
  state,
  view,
  go,
  refresh,
  toast,
  onSignOut,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  state: AppState | null;
  view: string;
  go: (v: ViewId) => void;
  refresh: () => void;
  toast: (t: { title: string; desc: string }) => void;
  onSignOut: () => void;
}) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [steps, setSteps] = useState<LiveStep[]>([]);
  const [running, setRunning] = useState(false);
  const [finalArrived, setFinalArrived] = useState(false);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [wsOpen, setWsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const stopRun = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const loadWorkspace = useCallback(async () => {
    try {
      const r = await fetch("/api/workspace", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { files?: WorkspaceFile[] };
      setFiles(j.files ?? []);
    } catch {
      // workspace list is a nicety
    }
  }, []);

  // Open/download a workspace file through fetch (NOT an <a href>): the fetch
  // wrapper attaches x-rah-token, so this works even where cookies are dropped
  // (preview iframes) - a plain link navigation would 401 there.
  const openFile = useCallback(async (f: WorkspaceFile, download: boolean) => {
    try {
      const r = await fetch(`/api/workspace/file?path=${encodeURIComponent(f.path)}${download ? "&dl=1" : ""}`);
      if (!r.ok) return;
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      if (download) {
        const a = document.createElement("a");
        a.href = url;
        a.download = f.path.split("/").pop() ?? "file";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        window.open(url, "_blank");
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      // download is a nicety; the panel stays usable
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const r = await fetch("/api/chat", { cache: "no-store" });
      if (!r.ok) return;
      const data = (await r.json()) as {
        messages: { id: number; role: string; text?: string; parsed?: { skill?: string; reply?: string; corrections?: { wrong: string; right: string }[]; commands?: AgentCommand[]; toolsUsed?: string[] } }[];
      };
      setMessages(
        data.messages
          .filter((m) => m.role === "user" || (m.parsed && (m.parsed.reply || m.parsed.skill === "agent")))
          .slice(-40)
          .map((m) => ({
            id: m.id,
            role: m.role as "user" | "coach",
            text: m.text,
            reply: scrubHistoryReply(m.parsed?.reply),
            corrections: m.parsed?.corrections,
            commands: m.parsed?.commands,
            toolsUsed: m.parsed?.toolsUsed,
          })),
      );
    } catch {
      // history is a nicety; the sidebar works without it
    }
  }, []);

  useEffect(() => {
    if (open && !startedRef.current) {
      startedRef.current = true;
      void loadHistory();
      void loadWorkspace();
    }
  }, [open, loadHistory, loadWorkspace]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, steps, running]);

  const executeCommand = useCallback(
    (cmd: AgentCommand) => {
      if (cmd.type === "navigate" && cmd.view) {
        const allowed: ViewId[] = ["home", "review", "write", "speak", "listen", "read", "placement", "arcade", "progress"];
        if (allowed.includes(cmd.view as ViewId)) go(cmd.view as ViewId);
      } else if (cmd.type === "open_placement") {
        go("placement");
      } else if (cmd.type === "start_review") {
        go("review");
      } else if (cmd.type === "refresh") {
        refresh();
      } else if (cmd.type === "toast" && cmd.title) {
        toast({ title: cmd.title, desc: cmd.desc ?? "" });
      }
    },
    [go, refresh, toast],
  );

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || running) return;
      setInput("");
      setRunning(true);
      setSteps([]);
      setFinalArrived(false);
      setMessages((m) => [...m, { id: Date.now(), role: "user", text: message }]);

      // Review feature #15: Stop. The controller aborts the fetch; the server
      // sees req.signal fire, closes the loop between steps, and the stopped
      // turn still persists to history.
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const r = await fetch("/api/coach-agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message, view, activity: getCoachActivity() }),
          signal: ctrl.signal,
        });
        if (!r.ok || !r.body) {
          const err = (await r.json().catch(() => ({ error: "Coach unreachable" }))) as { error?: string };
          setSteps([{ kind: "error", label: err.error ?? "Coach unreachable" }]);
          setRunning(false);
          return;
        }
        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let final: { reply?: string; corrections?: { wrong: string; right: string }[]; commands?: AgentCommand[]; toolsUsed?: string[] } | null = null;
        let lastError = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const ev = JSON.parse(line.slice(6)) as {
              type: string; label?: string; detail?: string; ok?: boolean;
              reply?: string; corrections?: { wrong: string; right: string }[]; commands?: AgentCommand[];
            };
            if (ev.type === "thought" || ev.type === "tool") {
              setSteps((s) => [...s, { kind: ev.type === "tool" ? "tool" : "thought", label: ev.label ?? "", detail: ev.detail }]);
            } else if (ev.type === "observe") {
              setSteps((s) => [...s, { kind: "observe", label: ev.label ?? "", detail: ev.detail, ok: ev.ok }]);
            } else if (ev.type === "error") {
              lastError = ev.label ?? "error";
              setSteps((s) => [...s, { kind: "error", label: ev.label ?? "error", detail: ev.detail }]);
            } else if (ev.type === "final") {
              final = { reply: ev.reply, corrections: ev.corrections, commands: ev.commands };
            }
          }
        }
        if (final?.reply) {
          setMessages((m) => [...m, { id: Date.now() + 1, role: "coach", reply: final.reply, corrections: final.corrections, commands: final.commands }]);
          (final.commands ?? []).forEach(executeCommand);
          setFinalArrived(true);
          void refresh();
          void loadWorkspace(); // the run may have written files
        } else {
          // A run that ends without a final answer must still SAY something.
          setMessages((m) => [
            ...m,
            {
              id: Date.now() + 1,
              role: "coach",
              reply: lastError
                ? `I hit a snag (${lastError}) before I could answer. Your message stands - send it again in a moment.`
                : "The connection dropped mid-run. Send that again and I will pick it up.",
            },
          ]);
        }
      } catch (e) {
        if (ctrl.signal.aborted) {
          setSteps((s) => [...s, { kind: "error", label: "Stopped" }]);
          setMessages((m) => [
            ...m,
            {
              id: Date.now() + 1,
              role: "coach",
              reply: "Stopped. What ran before the stop stays in the trace and in my memory - send another message whenever you want the rest done.",
            },
          ]);
          void refresh();
          void loadWorkspace();
        } else {
          setSteps((s) => [...s, { kind: "error", label: "Connection dropped mid-run" }]);
        }
      } finally {
        abortRef.current = null;
        setRunning(false);
      }
    },
    [running, executeCommand, refresh, loadWorkspace],
  );

  const stepIcon = (kind: LiveStep["kind"]) =>
    kind === "tool" ? <Wrench className="h-3.5 w-3.5" /> : kind === "observe" ? <Eye className="h-3.5 w-3.5" /> : kind === "error" ? <X className="h-3.5 w-3.5" /> : <BrainCircuit className="h-3.5 w-3.5" />;

  return (
    <>
      {/* Floating opener: visible on every tab, every viewport */}
      {!open && (
        <button
          onClick={() => onOpenChange(true)}
          aria-label="Open coach sidebar"
          className="fixed bottom-5 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[var(--rah-primary)] to-[#2f62c4] text-white shadow-[0_12px_32px_-8px_rgba(78,140,255,.7)] transition-transform hover:scale-105 active:scale-95"
        >
          <GraduationCap className="h-6 w-6" />
          {state && state.due > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#ffb02e] text-[10px] font-black text-[#1a1405]">
              {state.due > 99 ? "99" : state.due}
            </span>
          )}
        </button>
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-white/[0.08] bg-[#0d1320]/95 backdrop-blur-2xl shadow-[-24px_0_64px_-24px_rgba(0,0,0,.8)] transition-transform duration-300 sm:w-[440px] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--rah-primary)] to-[#2f62c4] text-white">
              <GraduationCap className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-sm font-black text-[#f2f5fa]">Coach</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d889c]">
                {running ? "working…" : "agent · every tab"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {state && <Chip tone="blue">{state.learner.gems ?? 0} gems</Chip>}
            {confirmDelete ? (
              <>
                <button
                  onClick={() => {
                    if (deleting) return;
                    setDeleting(true);
                    void fetch("/api/account", { method: "DELETE" })
                      .then((r) => r.json())
                      .then((d: { ok?: boolean; removed?: { learnerState: boolean } }) => {
                        clearRahToken();
                        toast({
                          title: "Account deleted",
                          desc: d.removed?.learnerState
                            ? "Everything was wiped: account, progress, reviews, files. The app is empty again."
                            : "Your account is gone. Shared learner state kept (other accounts remain).",
                        });
                        onSignOut();
                      })
                      .catch(() => toast({ title: "Deletion failed", desc: "Try again in a moment." }));
                  }}
                  disabled={deleting}
                  title="Really delete everything"
                  className="rounded-lg px-2 py-1.5 text-[11px] font-bold text-[#ff6b6b] transition-colors hover:bg-[#ff6b6b]/10 disabled:opacity-50"
                >
                  {deleting ? "deleting…" : "really delete"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  title="Keep my account"
                  className="rounded-lg p-2 min-h-[40px] min-w-[40px] text-[#7d889c] transition-colors hover:bg-white/[0.06] hover:text-[#f2f5fa]"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                title="Delete account - wipes everything for good"
                className="rounded-lg p-2 min-h-[40px] min-w-[40px] text-[#7d889c] transition-colors hover:bg-[#ff6b6b]/10 hover:text-[#ff6b6b]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => {
                void fetch("/api/auth/session", { method: "DELETE" }).then(() => {
                  clearRahToken();
                  onSignOut();
                });
              }}
              title="Sign out"
              className="rounded-lg p-2 min-h-[40px] min-w-[40px] text-[#7d889c] transition-colors hover:bg-white/[0.06] hover:text-[#f2f5fa]"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <button
              onClick={() => onOpenChange(false)}
              title="Close"
              className="rounded-lg p-2 min-h-[40px] min-w-[40px] text-[#7d889c] transition-colors hover:bg-white/[0.06] hover:text-[#f2f5fa]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Stream */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 && steps.length === 0 && (
            <div className="rounded-2xl border border-[var(--rah-primary)]/20 bg-[#131c30] p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[#9dc0ff]">
                <GraduationCap className="h-3.5 w-3.5" /> An agent, not a chatbot
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-[#8b96a9]">
                I can read your live state, write files, render PDFs, run code, search the web, and act across every tab. Ask for a plan, a report, a drill file - I will show my steps as I work.
              </p>
            </div>
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--rah-primary)]/[0.16] px-3.5 py-2.5 text-[13px] font-medium text-[#dbe7ff]">
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={m.id} className="space-y-2">
                <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-white/[0.06] bg-[#141c2e] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#e8eefb]">
                  {m.reply}
                </div>
                {m.corrections && m.corrections.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.corrections.slice(0, 4).map((c, i) => (
                      <span key={i} className="rounded-lg border border-[#ff6b6b]/25 bg-[#ff6b6b]/[0.08] px-2 py-1 text-[11px] text-[#ffb3b3]">
                        {c.wrong} <ArrowRight className="inline h-3 w-3" /> {c.right}
                      </span>
                    ))}
                  </div>
                )}
                {m.toolsUsed && m.toolsUsed.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {m.toolsUsed.map((t, i) => (
                      <span key={i} className="rounded-md bg-[#1b2438] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#7d889c]">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {m.commands && m.commands.filter((c) => c.type === "navigate" || c.type === "start_review" || c.type === "open_placement").length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.commands
                      .filter((c) => c.type === "navigate" || c.type === "start_review" || c.type === "open_placement")
                      .map((c, i) => (
                        <button
                          key={i}
                          onClick={() => executeCommand(c)}
                          className="rounded-lg border border-[var(--rah-primary)]/30 bg-[var(--rah-primary)]/[0.1] px-2.5 py-1 text-[11px] font-bold text-[#9dc0ff] transition-colors hover:bg-[var(--rah-primary)]/[0.2]"
                        >
                          {c.type === "start_review" ? "Start review" : c.type === "open_placement" ? "Open placement" : `Go to ${c.view}`}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            ),
          )}

          {/* Live agent trace: visible WHILE working (and after a failure so the
              steps stay inspectable); collapses once the final answer lands, so
              the conversation shows one clean reply instead of tool noise. */}
          {steps.length > 0 && (running || !finalArrived) && (
            <div className="space-y-1.5 rounded-2xl border border-white/[0.06] bg-[#101726] p-3">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-[#7d889c]">
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3 w-3" /> agent trace
                </span>
                {!running && (
                  <button
                    onClick={() => {
                      const text = steps.map((s) => `[${s.kind}] ${s.label}${s.detail ? ` — ${s.detail}` : ""}`).join("\n");
                      void navigator.clipboard?.writeText(text).catch(() => undefined);
                    }}
                    className="normal-case tracking-normal text-[#9dc0ff] hover:text-[#f2f5fa]"
                  >
                    copy
                  </button>
                )}
              </div>
              {steps.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] leading-snug">
                  <span className={`mt-0.5 shrink-0 ${s.kind === "error" ? "text-[#ff6b6b]" : s.kind === "observe" ? (s.ok === false ? "text-[#ffb02e]" : "text-[#4ade80]") : s.kind === "tool" ? "text-[#9dc0ff]" : "text-[#8b96a9]"}`}>
                    {stepIcon(s.kind)}
                  </span>
                  <div className="min-w-0">
                    <span className="font-semibold text-[#dbe3f0]">{s.label}</span>
                    {s.detail && <span className="text-[#6b7688]"> — {s.detail.length > 110 ? `${s.detail.slice(0, 110)}…` : s.detail}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {running && (
            <div className="flex items-center gap-2 text-[11px] font-semibold text-[#7d889c]">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#2a3242] border-t-[var(--rah-primary)]" />
              agent running…
            </div>
          )}
        </div>

        {/* Workspace: the agent's deliverables, downloadable */}
        <div className="border-t border-white/[0.06] px-4 py-2">
          <button
            onClick={() => {
              setWsOpen((v) => !v);
              void loadWorkspace();
            }}
            className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
            aria-expanded={wsOpen}
          >
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#7d889c]">
              <FolderOpen className="h-3 w-3" /> workspace
              {files.length > 0 && (
                <span className="rounded-full bg-[var(--rah-primary)]/[0.18] px-1.5 py-0.5 text-[9px] font-bold text-[#9dc0ff]">{files.length}</span>
              )}
            </span>
            <span className="text-[10px] font-bold text-[#5d6879]">{wsOpen ? "hide" : "show"}</span>
          </button>
          {wsOpen && (
            <div className="mt-1 max-h-40 space-y-1 overflow-y-auto pb-1">
              {files.length === 0 && (
                <div className="px-1 py-1.5 text-[11px] text-[#5d6879]">
                  Nothing yet - ask me to write a plan or make a PDF and it lands here.
                </div>
              )}
              {files.map((f) => (
                <div key={f.path} className="flex items-center justify-between gap-2 rounded-lg bg-[#101726] px-2.5 py-1.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className={`h-3.5 w-3.5 shrink-0 ${f.pdf ? "text-[#ff8ba0]" : "text-[#7d889c]"}`} />
                    <span className="truncate text-[12px] font-semibold text-[#dbe3f0]" title={`data/coach-workspace/${f.path}`}>
                      {f.path}
                    </span>
                    <span className="shrink-0 text-[10px] text-[#5d6879]">{fmtSize(f.size)}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!f.pdf && (
                      <button
                        onClick={() => void openFile(f, false)}
                        title="Preview"
                        className="rounded-md p-1.5 text-[#7d889c] transition-colors hover:bg-white/[0.06] hover:text-[#f2f5fa]"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => void openFile(f, true)}
                      title="Download"
                      className="rounded-md p-1.5 text-[#9dc0ff] transition-colors hover:bg-[var(--rah-primary)]/[0.15]"
                    >
                      <FileDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Suggestions + input */}
        <div className="border-t border-white/[0.06] px-4 pb-4 pt-3">
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => void send(s)}
                disabled={running}
                className="shrink-0 rounded-full border border-white/[0.08] bg-[#141c2e] px-3 py-1.5 text-[11px] font-semibold text-[#9dc0ff] transition-colors hover:border-[var(--rah-primary)]/40 disabled:opacity-40"
              >
                {s}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={running ? "Agent is working…" : "Ask the agent to do something…"}
              disabled={running}
              className="min-h-11 flex-1 rounded-xl border border-white/[0.08] bg-[#141c2e] px-3.5 text-[13px] text-[#f2f5fa] outline-none transition-colors placeholder:text-[#5d6879] focus:border-[var(--rah-primary)]/50 disabled:opacity-50"
            />
            <Btn type="submit" disabled={running || !input.trim()} className="!min-h-11 !px-3">
              <Send className="h-4 w-4" />
            </Btn>
            {running && (
              <Btn onClick={stopRun} variant="danger" className="!min-h-11 !px-3 rah-pulse">
                <Square className="h-4 w-4" />
              </Btn>
            )}
          </form>
        </div>
      </div>
    </>
  );
}
