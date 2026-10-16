"use client";

// Talent Tree: six branches hanging off the six measured skills, six real
// perks, SP earned by leveling up. Spending is server-validated.

import { useCallback, useEffect, useState } from "react";
import { Check, Lock, Sparkles } from "lucide-react";
import { Btn, Card, Chip, Spinner } from "../ui";

interface PerkDef {
  key: string;
  branch: string;
  tier: number;
  title: string;
  desc: string;
}

interface PerksView {
  sp: number;
  owned: string[];
  perks: PerkDef[];
  skills: { skill: string; score: number }[];
  leveled: boolean;
}

const BRANCH_META: Record<string, { icon: string; tone: string }> = {
  reading: { icon: "📖", tone: "#9de6fb" },
  vocabulary: { icon: "🧩", tone: "#7fe0ac" },
  writing: { icon: "✒️", tone: "#ffd08a" },
  listening: { icon: "🎧", tone: "#cfc3fc" },
  speaking: { icon: "🎙️", tone: "#ffa3b1" },
  grammar: { icon: "⚙️", tone: "#9dc0ff" },
};

export default function Talents({ onChange }: { onChange: () => void }) {
  const [view, setView] = useState<PerksView | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/arcade/perks", { cache: "no-store" })
      .then((r) => r.json())
      .then(setView)
      .catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  const buy = async (key: string) => {
    const r = await fetch("/api/arcade/perks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ perk: key }),
    });
    const j = (await r.json()) as { ok: boolean; error?: string; sp: number };
    if (!j.ok) setMsg(j.error ?? "Blocked");
    else setMsg(null);
    load();
    onChange();
  };

  if (!view) return <Spinner label="Unrolling the tree..." />;
  const branches = [...new Set(view.perks.map((p) => p.branch))];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ffb02e]/[0.14] text-[#ffd08a]">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-[#f2f5fa]">Talent Tree</div>
            <div className="text-[11px] text-[#7d889c]">One SP per level-up. Perks are real: they change XP, timers, hearts and the chain itself.</div>
          </div>
          <Chip tone="amber" >{view.sp} SP banked</Chip>
        </div>
        {msg && <div className="mb-3 rounded-xl border border-[#ff6b81]/30 bg-[#ff6b81]/[0.08] px-3 py-2 text-xs font-semibold text-[#ffa3b1]">{msg}</div>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {branches.map((b) => {
            const meta = BRANCH_META[b] ?? { icon: "•", tone: "#8b96a9" };
            const skill = view.skills.find((s) => s.skill === b);
            const perks = view.perks.filter((p) => p.branch === b);
            const bought = view.owned.filter((k) => perks.some((p) => p.key === k)).length;
            return (
              <div key={b} className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-base">{meta.icon}</span>
                  <span className="text-xs font-extrabold uppercase tracking-[0.12em]" style={{ color: meta.tone }}>
                    {b}
                  </span>
                  <span className="ml-auto text-[10px] text-[#7d889c]">{bought}/{perks.length} · {skill ? Math.round(skill.score * 100) : 0}% mastery</span>
                </div>
                <div className="flex flex-col gap-2">
                  {perks.map((p) => {
                    const owned = view.owned.includes(p.key);
                    const affordable = view.sp >= p.tier;
                    return (
                      <div key={p.key} className={`rounded-xl border px-3 py-2.5 ${owned ? "border-[#3ccb7f]/30 bg-[#3ccb7f]/[0.06]" : "border-white/[0.06] bg-white/[0.02]"}`}>
                        <div className="flex items-center gap-2">
                          {owned ? (
                            <Check className="h-4 w-4 text-[#7fe0ac]" />
                          ) : (
                            <Lock className={`h-4 w-4 ${affordable ? "text-[#ffd08a]" : "text-[#4a5364]"}`} />
                          )}
                          <span className={`text-xs font-extrabold ${owned ? "text-[#a9e8c5]" : "text-[#dbe3f0]"}`}>{p.title}</span>
                          <span className="ml-auto text-[10px] font-bold text-[#7d889c]">{p.tier} SP</span>
                        </div>
                        <div className="mt-1 text-[11px] leading-snug text-[#8b96a9]">{p.desc}</div>
                        {!owned && (
                          <Btn variant={affordable ? "warm" : "soft"} className="mt-2 !min-h-9 !px-3 !py-1.5 !text-xs" onClick={() => buy(p.key)} disabled={!affordable}>
                            Unlock for {p.tier} SP
                          </Btn>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
