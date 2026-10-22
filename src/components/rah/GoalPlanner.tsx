"use client";

// Goal planner (audit P2, Task 65). The learner states the goal; Rah answers
// with a plan built from measured tables only - FSRS due load, the observed
// 14-day practice rhythm, and the mastery ledger's danger tags. Feasibility
// says the honest thing: a plan that does not match observed behavior is
// labeled tight or overcommitted with numbers, never pep-talked.

import { useCallback, useEffect, useState } from "react";
import { Target, Plus, Archive } from "lucide-react";
import { Btn, Card, Chip, Note } from "./ui";

interface GoalView {
  id: string;
  title: string;
  kind: string;
  target: string;
  dueDay: number | null;
  weeklySessions: number;
  createdAt: string;
  archivedAt: string | null;
}

interface Plan {
  dueForecast: { day: number; count: number }[];
  dueTotal: number;
  dailyReviews: number;
  sessionMinutes: number;
  weeklyMinutes: number;
  avgActiveDays14: number;
  avgXp14: number;
  feasibility: "on_track" | "tight" | "overcommitted" | "no_data";
  feasibilityNote: string;
  priorities: string[];
}

const FEAS_TONE: Record<string, "emerald" | "amber" | "rose" | "slate"> = {
  on_track: "emerald",
  tight: "amber",
  overcommitted: "rose",
  no_data: "slate",
};

export default function GoalPlanner({ onChange }: { onChange?: () => void }) {
  const [goals, setGoals] = useState<GoalView[]>([]);
  const [archived, setArchived] = useState<GoalView[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("habit");
  const [weekly, setWeekly] = useState(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/goals", { cache: "no-store" });
      const j = await r.json();
      setGoals(j.active ?? []);
      setArchived(j.archived ?? []);
      setPlan(j.plan ?? null);
    } catch {
      /* keep last */
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, kind, weeklySessions: weekly }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Could not save the goal.");
      setTitle("");
      await load();
      onChange?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const archive = async (id: string) => {
    await fetch(`/api/goals?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
    onChange?.();
  };

  const peak = Math.max(1, ...(plan?.dueForecast.map((f) => f.count) ?? [1]));

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#4e8cff]/[0.14] text-[#8ab4ff]">
            <Target className="h-4 w-4" />
          </div>
          <span className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Goal planner</span>
        </div>
        {plan && <Chip tone={FEAS_TONE[plan.feasibility]}>{plan.feasibility.replace("_", " ")}</Chip>}
      </div>

      {plan && (
        <div className="mt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <div className="font-mono text-[30px] font-black leading-none tabular-nums text-[#f2f5fa]">{plan.dailyReviews}</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[#7d889c]">reviews/day queued</div>
            </div>
            <div>
              <div className="font-mono text-[30px] font-black leading-none tabular-nums text-[#f2f5fa]">~{plan.sessionMinutes}m</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[#7d889c]">per session</div>
            </div>
            <div>
              <div className="font-mono text-[30px] font-black leading-none tabular-nums text-[#f2f5fa]">{plan.avgActiveDays14}</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[#7d889c]">practice days/week observed</div>
            </div>
          </div>
          <div className="mt-4 flex h-12 items-end gap-1">
            {plan.dueForecast.map((f) => (
              <div key={f.day} className="flex-1 rounded-t bg-gradient-to-t from-[#2650a3] to-[#4e8cff]" style={{ height: `${Math.max(6, (f.count / peak) * 100)}%` }} title={`${f.count} due`} />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[9px] font-bold uppercase tracking-widest text-[#5c6678]">
            <span>today</span>
            <span>+6 days</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[#8b96a9]">{plan.feasibilityNote}</p>
          {plan.priorities.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {plan.priorities.map((t) => (
                <Chip key={t} tone="rose">
                  hunt: {t}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 border-t border-[#232b3a] pt-4">
        {goals.length > 0 && (
          <div className="mb-3 flex flex-col gap-2">
            {goals.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-2 rounded-xl bg-[#171c28] px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-[#c3cddd]">{g.title}</div>
                  <div className="text-[11px] text-[#7d889c]">
                    {g.kind} · {g.weeklySessions}x/week{g.target ? ` · ${g.target}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => archive(g.id)}
                  className="shrink-0 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-[#5c6678] transition-all hover:bg-white/[0.05] hover:text-[#ff8ba0]"
                  title="Archive this goal (kept, not deleted)"
                >
                  <Archive className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Set a goal - e.g. IELTS 6.5 by spring, or 5 practice days a week"
            className="min-w-0 flex-1 rounded-xl border border-[#2a3242] bg-[#10141d] px-3 py-2 text-sm font-semibold text-[#e7ecf5] outline-none focus:border-[#4e8cff]"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="rounded-xl border border-[#2a3242] bg-[#10141d] px-3 py-2 text-sm font-bold text-[#dbe3f0] outline-none"
          >
            <option value="habit">habit</option>
            <option value="exam">exam</option>
            <option value="level">level</option>
          </select>
          <select
            value={weekly}
            onChange={(e) => setWeekly(Number(e.target.value))}
            className="rounded-xl border border-[#2a3242] bg-[#10141d] px-3 py-2 text-sm font-bold text-[#dbe3f0] outline-none"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}x/week
              </option>
            ))}
          </select>
          <Btn onClick={create} variant="primary" disabled={busy || title.trim().length < 3} className="!min-h-9 text-xs">
            <Plus className="h-4 w-4" /> Plan it
          </Btn>
        </div>

        {error && (
          <div className="mt-3">
            <Note tone="rose">{error}</Note>
          </div>
        )}

        {archived.length > 0 && (
          <div className="mt-3">
            <button onClick={() => setShowArchived((s) => !s)} className="text-[11px] font-bold text-[#5c6678] hover:text-[#8b96a9]">
              {showArchived ? "hide" : "show"} archived goals ({archived.length})
            </button>
            {showArchived && (
              <div className="mt-2 flex flex-col gap-1.5">
                {archived.map((g) => (
                  <div key={g.id} className="rounded-xl bg-[#131722] px-3 py-2 text-xs text-[#7d889c]">
                    <span className="font-bold text-[#8b96a9]">{g.title}</span> · archived
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
