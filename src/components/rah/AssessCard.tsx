"use client";

// Per-skill band card: grammar vs vocabulary vs the rest, one overall band.

import type { AssessmentPayload } from "@/lib/agent/types";
import { Bar, Card } from "./ui";

const TONE: Record<string, "blue" | "amber" | "rose" | "emerald" | "cyan"> = {
  grammar: "blue",
  vocabulary: "amber",
  writing: "emerald",
  speaking: "rose",
  reading: "cyan",
  listening: "blue",
};

export function AssessCard({ data }: { data: AssessmentPayload }) {
  const measured = data.skills.filter((s) => s.samples > 0);
  return (
    <Card className="w-[640px] max-w-full p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Skill bands</div>
        <div className="rounded-full border border-[var(--rah-primary)]/30 bg-[var(--rah-primary)]/[0.1] px-3 py-1 text-xs font-black text-[#9dc0ff]">
          Overall {data.overall === "?" ? "unmeasured" : data.overall}
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2.5">
        {data.skills.map((s) => (
          <div key={s.skill} className="flex items-center gap-3 text-xs">
            <span className="w-20 shrink-0 font-bold capitalize text-[#a9b4c6]">{s.skill}</span>
            <Bar value={Math.round(s.score * 100)} max={100} tone={TONE[s.skill] ?? "blue"} />
            <span className="w-9 shrink-0 text-right font-black text-[#f2f5fa]">
              {s.samples > 0 ? s.level : "—"}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm leading-relaxed text-[#c4cddc]">{data.note}</p>
      {measured.length === 0 && (
        <p className="mt-2 text-xs leading-relaxed text-[#8b96a9]">
          Run /assess for the quick probe, or /deep for the full 30-second analysis. Exams and reviews feed these bands automatically.
        </p>
      )}
    </Card>
  );
}
