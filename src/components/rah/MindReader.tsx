"use client";

// Mind Reader: the coach's memory made visible and editable. Every mistake
// family with its evidence (wrong -> right), its heal progress toward the
// two-clean-hits retirement, and two correction moves (audit P2, Task 65):
//   - Correct: fix the label or the quoted evidence pair (learner-authored,
//     marked "corrected by you" - never presented as AI-mined again).
//   - Forget: the family leaves the memory AND the exact evidence pair is
//     tombstoned - that same pair will not re-aggregate, but genuinely new
//     evidence under the same tag still reopens the family. Trust needs a
//     window AND controls that mean something; this is both.

import { useCallback, useEffect, useState } from "react";
import { Brain, Trash2, X, Pencil, Check } from "lucide-react";
import { Btn, Card, Chip } from "./ui";

interface Family {
  id: string;
  kind: string;
  tag: string;
  label: string;
  count: number;
  evidence: string;
  streakClean: number;
  resolvedAt: string | null;
  editedAt: string | null;
}

interface EditState {
  id: string;
  label: string;
  wrong: string;
  right: string;
}

export default function MindReader({ onChange }: { onChange?: () => void }) {
  const [families, setFamilies] = useState<Family[]>([]);
  const [healed, setHealed] = useState<Family[]>([]);
  const [armed, setArmed] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/mistakes", { cache: "no-store" });
      const j = await r.json();
      setFamilies(j.families ?? []);
      setHealed(j.healed ?? []);
    } catch {
      /* keep last */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const forget = async (id: string) => {
    if (armed !== id) {
      setArmed(id);
      setTimeout(() => setArmed((a) => (a === id ? null : a)), 4000);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/mistakes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? "Forget failed.");
      }
      setArmed(null);
      await load();
      onChange?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (f: Family) => {
    const [wrong = "", right = ""] = f.evidence.split(" -> ");
    setEdit({ id: f.id, label: f.label, wrong, right });
    setArmed(null);
    setError(null);
  };

  const saveEdit = async () => {
    if (!edit) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/mistakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: edit.id, label: edit.label, evidence: `${edit.wrong} -> ${edit.right}` }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Correction failed.");
      setEdit(null);
      await load();
      onChange?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const row = (f: Family, isHealed: boolean) => {
    const [wrong, right] = f.evidence.split(" -> ");
    const healPct = Math.min(100, Math.round((f.streakClean / 2) * 100));
    const editing = edit?.id === f.id;
    return (
      <div key={f.id} className={`rounded-2xl px-3.5 py-3 ${isHealed ? "bg-[#3ccb7f]/[0.05]" : "bg-[#171c28]"}`}>
        {editing ? (
          <div className="flex flex-col gap-2">
            <input
              value={edit.label}
              onChange={(e) => setEdit({ ...edit, label: e.target.value })}
              placeholder="family name"
              className="w-full rounded-xl border border-[#2a3242] bg-[#10141d] px-3 py-2 text-sm font-bold text-[#e7ecf5] outline-none focus:border-[#4e8cff]"
            />
            <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
              <input
                value={edit.wrong}
                onChange={(e) => setEdit({ ...edit, wrong: e.target.value })}
                placeholder="wrong"
                className="min-w-0 flex-1 rounded-xl border border-[#ff6b81]/30 bg-[#10141d] px-3 py-2 text-[#ffa3b1] outline-none focus:border-[#ff6b81]"
              />
              <span className="text-[#5c6678]">→</span>
              <input
                value={edit.right}
                onChange={(e) => setEdit({ ...edit, right: e.target.value })}
                placeholder="right"
                className="min-w-0 flex-1 rounded-xl border border-[#2fc273]/30 bg-[#10141d] px-3 py-2 text-[#7fe0ac] outline-none focus:border-[#2fc273]"
              />
            </div>
            <div className="flex items-center gap-2">
              <Btn onClick={saveEdit} variant="go" disabled={busy} className="!min-h-9 text-xs">
                <Check className="h-3.5 w-3.5" /> Save correction
              </Btn>
              <Btn onClick={() => setEdit(null)} variant="ghost" className="!min-h-9 text-xs">
                Cancel
              </Btn>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`truncate text-sm font-bold ${isHealed ? "text-[#7fe0ac]" : "text-[#c3cddd]"}`}>{f.label}</span>
                <Chip tone={isHealed ? "emerald" : f.streakClean > 0 ? "amber" : "rose"}>{isHealed ? "healed" : `${f.count}x`}</Chip>
                {f.editedAt && <Chip tone="cyan">corrected by you</Chip>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => startEdit(f)}
                  className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-[#5c6678] transition-all hover:bg-white/[0.05] hover:text-[#7dabff]"
                  title="Correct what the memory quotes"
                >
                  <Pencil className="h-3.5 w-3.5" /> correct
                </button>
                <button
                  onClick={() => forget(f.id)}
                  className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition-all ${
                    armed === f.id ? "bg-[#ff6b81] text-white" : "text-[#5c6678] hover:bg-white/[0.05] hover:text-[#ff8ba0]"
                  }`}
                  title="Forget this family (the exact example will not re-aggregate)"
                >
                  {armed === f.id ? (
                    <>
                      <X className="h-3.5 w-3.5" /> confirm forget
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" /> forget
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="mt-1.5 text-[11px] leading-relaxed text-[#7d889c]">
              <span className="font-semibold text-[#8b96a9]">{f.kind} · {f.tag}</span>
              {wrong && right && (
                <div className="mt-1 font-mono">
                  <span className="text-[#ffa3b1] line-through">{wrong}</span>
                  <span className="mx-1.5 text-[#5c6678]">→</span>
                  <span className="text-[#7fe0ac]">{right}</span>
                </div>
              )}
            </div>
            {!isHealed && (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#232b3a]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#ffb02e] to-[#3ccb7f]" style={{ width: `${healPct}%` }} />
                </div>
                <span className="shrink-0 text-[10px] font-bold text-[#7d889c]">
                  {f.streakClean}/2 clean hits to heal
                </span>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <Card>
      <div className="mb-1 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#a78bfa]/[0.14] text-[#cfc3fc]">
          <Brain className="h-4 w-4" />
        </div>
        <span className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Mind reader: what the coach remembers</span>
      </div>
      <div className="mb-4 text-xs font-medium text-[#7d889c]">
        Every recurring mistake family, its latest evidence, and how close it is to healing. Correct anything misquoted, forgive &amp; forget anything you disagree with - forgetting one example never blinds the coach to new evidence.
      </div>
      {error && (
        <div className="mb-3 rounded-xl border border-[#ff6b81]/40 bg-[#ff6b81]/[0.08] px-3 py-2 text-xs font-bold text-[#ff9aa7]">{error}</div>
      )}
      {loading ? (
        <span className="block h-4 w-4 animate-spin rounded-full border-2 border-[#2a3242] border-t-[var(--rah-primary)]" />
      ) : families.length === 0 && healed.length === 0 ? (
        <p className="text-sm leading-relaxed text-[#a9b4c6]">Nothing on file yet. Chat corrections, essays, spoken takes and exam misses all feed this memory.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {families.map((f) => row(f, false))}
          {healed.map((f) => row(f, true))}
        </div>
      )}
      {(families.length > 0 || healed.length > 0) && (
        <div className="mt-4">
          <Btn variant="ghost" onClick={load} className="!min-h-9 text-xs">
            refresh memory
          </Btn>
        </div>
      )}
    </Card>
  );
}
