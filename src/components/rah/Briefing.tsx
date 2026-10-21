"use client";

// The AI Director's daily briefing: one cached plan per day, read aloud via
// the browser's speech synthesis, with a live persona switch. The persona
// also flavors the coach chat through the learner profile.

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Volume2 } from "lucide-react";
import { Btn, Card, Chip, Spinner } from "./ui";

interface Brief {
  priority: string;
  plan: string[];
  pep: string;
  degraded?: boolean;
  degradedNotice?: string;
}

const PERSONAS = [
  { key: "mentor", label: "Mentor", hint: "warm, sharp" },
  { key: "drill", label: "Drill sergeant", hint: "short, brutal, fair" },
  { key: "zen", label: "Zen", hint: "calm, observant" },
] as const;

export default function Briefing() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [persona, setPersona] = useState<string>("mentor");
  const [loading, setLoading] = useState(true);
  const [regening, setRegening] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const load = useCallback(
    (force = false) => {
      if (force) setRegening(true);
      else setLoading(true);
      fetch(`/api/coach/briefing${force ? "?force=1" : ""}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((j: { brief: Brief; persona: string }) => {
          setBrief(j.brief);
          setPersona(j.persona);
        })
        .catch(() => undefined)
        .finally(() => {
          setLoading(false);
          setRegening(false);
        });
    },
    [],
  );
  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const switchPersona = async (key: string) => {
    setPersona(key);
    await fetch("/api/coach/briefing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona: key }),
    });
    load(true); // the plan re-reads in the new voice
  };

  const speak = () => {
    if (!brief || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(`Today's priority: ${brief.priority}. ${brief.plan.join(" ")} ${brief.pep}`);
    u.rate = 0.98;
    u.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };

  if (loading) return <Spinner label="The Director reads your night's data..." />;

  return (
    <Card className="border-[var(--rah-primary)]/20 bg-gradient-to-br from-[#131c30] to-[var(--rah-surface)]">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--rah-primary)]/[0.14] text-[#9dc0ff]">✦</span>
        <span className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Director&apos;s briefing</span>
        <div className="ml-auto flex items-center gap-1.5">
          {PERSONAS.map((p) => (
            <button
              key={p.key}
              onClick={() => switchPersona(p.key)}
              title={p.hint}
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors ${
                persona === p.key ? "bg-[var(--rah-primary)]/[0.2] text-[#9dc0ff]" : "text-[#6e7a8e] hover:bg-white/[0.05]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {brief ? (
        <div className="flex flex-col gap-3">
          <div className="text-sm font-bold leading-relaxed text-[#dbe3f0]">{brief.priority}</div>
          <ol className="flex flex-col gap-1.5">
            {brief.plan.map((step, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-[#a9b4c6]">
                <span className="font-black text-[var(--rah-primary)]">{i + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
          <div className="text-xs italic text-[#8b96a9]">&ldquo;{brief.pep}&rdquo;</div>
          <div className="flex flex-wrap items-center gap-2">
            <Btn variant="soft" className="!min-h-9 !px-3 !py-1.5 !text-xs" onClick={speak} disabled={speaking}>
              <Volume2 className="h-3.5 w-3.5" /> {speaking ? "Speaking..." : "Listen"}
            </Btn>
            <Btn variant="ghost" className="!min-h-9 !px-3 !py-1.5 !text-xs" onClick={() => load(true)} disabled={regening}>
              <RefreshCw className={`h-3.5 w-3.5 ${regening ? "animate-spin" : ""}`} /> Re-brief
            </Btn>
            {brief.degraded ? (
              <Chip tone="amber" title={brief.degradedNotice ?? "Built by the engine - the AI Director is offline."}>
                AI offline: engine-built plan
              </Chip>
            ) : (
              <Chip tone="slate">cached for today</Chip>
            )}
          </div>
        </div>
      ) : (
        <div className="text-sm text-[#8b96a9]">The Director is unreachable right now. Tap Re-brief in a minute - your plan comes back.</div>
      )}
    </Card>
  );
}
