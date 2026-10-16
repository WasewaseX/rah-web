"use client";

// Mind Reader: the coach's memory made visible and editable. Every mistake
// family with its evidence (wrong -> right), its heal progress toward the
// two-clean-hits retirement, and a Forgive & Forget switch for false
// positives. Trust needs a window; this is it.

import { useCallback, useEffect, useState } from "react";
import { Brain, Trash2, X } from "lucide-react";
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
}

export default function MindReader({ onChange }: { onChange?: () => void }) {
  const [families, setFamilies] = useState<Family[]>([]);
  const [healed, setHealed] = useState<Family[]>([]);
  const [armed, setArmed] = useState<string | null>(null);
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
    await fetch(`/api/mistakes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setArmed(null);
    await load();
    onChange?.();
  };

  const row = (f: Family, isHealed: boolean) => {
    const [wrong, right] = f.evidence.split(" -> ");
    const healPct = Math.min(100, Math.round((f.streakClean / 2) * 100));
    return (
      <div key={f.id} className={`rounded-2xl px-3.5 py-3 ${isHealed ? "bg-[#3ccb7f]/[0.05]" : "bg-[#171c28]"}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`truncate text-sm font-bold ${isHealed ? "text-[#7fe0ac]" : "text-[#c3cddd]"}`}>{f.label}</span>
            <Chip tone={isHealed ? "emerald" : f.streakClean > 0 ? "amber" : "rose"}>{isHealed ? "healed" : `${f.count}x`}</Chip>
          </div>
          <button
            onClick={() => forget(f.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition-all ${
              armed === f.id ? "bg-[#ff6b81] text-white" : "text-[#5c6678] hover:bg-white/[0.05] hover:text-[#ff8ba0]"
            }`}
            title="Forget this family"
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
        Every recurring mistake family, its latest evidence, and how close it is to healing. Forgive &amp; forget anything you disagree with - the coach stops steering on it immediately.
      </div>
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
