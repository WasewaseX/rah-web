"use client";

// Voice Arena: the shadowing gauntlet. The coach says the sentence (TTS),
// you say it back (browser ASR), the server scores the word-level diff and
// pays XP by accuracy. Five reps a session, weakness-biased sentences.

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Play, Square, Volume2 } from "lucide-react";
import { Btn, Card, Chip, FA, Spinner } from "../ui";

interface SoundContrast {
  key: string;
  label: string;
  tip: string;
  evidence: { target: string; heard: string }[];
  drill: { front: string; back: string }[];
}

interface SoundReport {
  contrasts: SoundContrast[];
  other: { target: string; heard: string }[];
  note: string;
}

interface Drill {
  id: string;
  en: string;
  fa: string;
  tag: string | null;
  note: string | null;
}

interface Score {
  accuracy: number;
  missed: string[];
  extra: string[];
  targetWords: number;
  verdict: string;
}

interface RepResult {
  score: Score;
  sound?: SoundReport;
  xpGain: number;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function speak(text: string, rate = 0.9) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = rate;
    window.speechSynthesis.speak(u);
  } catch {
    // no tts available; the sentence is always visible as fallback
  }
}

const REPS = 5;

export default function VoiceArena({ onChange }: { onChange: () => void }) {
  const [phase, setPhase] = useState<"idle" | "loading" | "drill" | "done">("idle");
  const [drills, setDrills] = useState<Drill[]>([]);
  const [rep, setRep] = useState(0);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<RepResult[]>([]);
  const [last, setLast] = useState<RepResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const hasSpeech = typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  const drill = drills[rep] as Drill | undefined;

  const startSession = async () => {
    setPhase("loading");
    setError(null);
    const r = await fetch("/api/arena/voice", { cache: "no-store" });
    const j = await r.json();
    setDrills(j.drills ?? []);
    setRep(0);
    setResults([]);
    setLast(null);
    setTranscript("");
    setPhase("drill");
  };

  const stopRec = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
    setListening(false);
  }, []);

  const record = () => {
    if (!hasSpeech || !drill) return;
    setError(null);
    setTranscript("");
    const Ctor = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike; SpeechRecognition?: new () => SpeechRecognitionLike })
      .webkitSpeechRecognition ?? (window as unknown as { SpeechRecognition: new () => SpeechRecognitionLike }).SpeechRecognition;
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) text += r[0].transcript;
      }
      setTranscript((t) => (t + " " + text).trim());
    };
    rec.onend = () => setListening(false);
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("The microphone refused to start. Check browser permissions.");
      setListening(false);
    }
  };

  const submit = async () => {
    if (!drill || busy || !transcript.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/arena/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: drill.en, transcript }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "Scoring failed.");
        setBusy(false);
        return;
      }
      const repResult: RepResult = { score: j.score, sound: j.sound, xpGain: j.xpGain };
      setLast(repResult);
      setResults((rs) => [...rs, repResult]);
      onChange();
    } catch {
      setError("The scorer is unreachable. One more try usually lands it.");
    }
    setBusy(false);
  };

  const next = () => {
    if (rep + 1 >= REPS || rep + 1 >= drills.length) {
      setPhase("done");
      return;
    }
    setRep(rep + 1);
    setTranscript("");
    setLast(null);
    setError(null);
  };

  useEffect(() => stopRec, [stopRec]);

  if (phase === "idle" || phase === "loading") {
    return (
      <Card className="py-10 text-center">
        {phase === "loading" ? (
          <Spinner label="Pulling your shadowing drills" />
        ) : (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--rah-accent)]/[0.14] text-[#9de6fb]">
              <Mic className="h-8 w-8" />
            </div>
            <div className="mt-4 text-xl font-black tracking-tight text-[#f2f5fa]">Voice Arena</div>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#a9b4c6]">
              Five reps. The coach speaks a sentence aimed at your weak constructions, you shadow it back, the word-diff scores your mouth. 30 XP per clean rep.
            </p>
            {!hasSpeech && (
              <p className="mx-auto mt-3 max-w-sm text-xs font-semibold text-[#ffa3b1]">
                No speech recognition here - you can still train by typing what you said after each line.
              </p>
            )}
            <Btn variant="go" onClick={startSession} className="mt-6">
              <Mic className="h-4 w-4" /> Enter the arena
            </Btn>
          </>
        )}
      </Card>
    );
  }

  if (phase === "done") {
    const avg = results.length ? Math.round(results.reduce((s, r) => s + r.score.accuracy, 0) / results.length) : 0;
    const best = results.reduce((b, r) => Math.max(b, r.score.accuracy), 0);
    const totalXp = results.reduce((s, r) => s + r.xpGain, 0);
    return (
      <Card className="rah-pop py-10 text-center">
        <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#9de6fb]">Session over</div>
        <div className="mt-1 text-5xl font-black tracking-tight text-[#f2f5fa]">{avg}%</div>
        <div className="mt-2 text-sm font-bold text-[#8b96a9]">average shadow accuracy</div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Chip tone="amber">best rep {best}%</Chip>
          <Chip tone="cyan">+{totalXp} XP</Chip>
          <Chip tone="slate">{results.length} reps</Chip>
        </div>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-[#a9b4c6]">
          {avg >= 85
            ? "Your mouth is ahead of your pen. The sentences got harder next session."
            : avg >= 65
              ? "Respectable shadowing. The endings are where accuracy dies - exaggerate them."
              : "Slow the playback to 0.8x mentally and over-pronounce the word endings for a few sessions."}
        </p>
        <Btn variant="go" onClick={startSession} className="mt-6">
          <Mic className="h-4 w-4" /> Five fresh reps
        </Btn>
      </Card>
    );
  }

  // drill
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Chip tone="blue">
          Rep {rep + 1}/{Math.min(REPS, drills.length)}
        </Chip>
        {drill?.tag && <Chip tone="rose">drills: {drill.tag.replace(/_/g, " ")}</Chip>}
      </div>

      <Card className="min-h-64">
        <div className="text-center">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#5f8fe8]">Listen, then say it back</div>
          <div className="mx-auto mt-4 max-w-md text-[22px] font-bold leading-relaxed text-[#e7ecf5]">{drill?.en}</div>
          {drill?.fa && <FA className="mt-2 block text-sm">{drill.fa}</FA>}
          <Btn variant="soft" onClick={() => drill && speak(drill.en)} className="mt-4">
            <Volume2 className="h-4 w-4" /> Play the sentence
          </Btn>
        </div>

        {!last && (
          <div className="mt-6 border-t border-white/[0.06] pt-5 text-center">
            {listening ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[#ff8ba0]">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#ff6b81]" /> Listening… say it back
                </div>
                <Btn variant="danger" onClick={stopRec}>
                  <Square className="h-4 w-4" /> Stop
                </Btn>
              </div>
            ) : (
              <Btn variant="go" onClick={record} disabled={busy}>
                <Mic className="h-4 w-4" /> {transcript ? "Re-record" : "Say it back"}
              </Btn>
            )}
            <div className="mt-4">
              <input
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder={hasSpeech ? "Heard nothing? Fix what the mic caught, or type what you said" : "No mic - type what you said, the scorer takes it as the transcript"}
                className="w-full rounded-xl border border-white/[0.08] bg-[#141924] px-4 py-3 text-sm text-[#dbe3f0] outline-none placeholder:text-[#5d6880] focus:border-[#5f8fe8]/60"
                aria-label="Transcript (editable)"
              />
            </div>
            <Btn variant="primary" onClick={submit} disabled={busy || !transcript.trim() || listening} className="mt-4">
              {busy ? "Scoring…" : "Score this rep"}
            </Btn>
          </div>
        )}

        {last && (
          <div className="rah-pop mt-6 border-t border-white/[0.06] pt-5">
            <div className="text-center">
              <div className="text-4xl font-black tracking-tight text-[#f2f5fa]">{last.score.accuracy}%</div>
              <div className="mt-1 text-sm font-bold text-[#9de6fb]">+{last.xpGain} XP</div>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#a9b4c6]">{last.score.verdict}</p>
            </div>
            {last.score.missed.length > 0 && (
              <div className="mt-4 text-center">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#7d889c]">Words that did not come back</div>
                <div className="mt-1.5 flex flex-wrap justify-center gap-1.5">
                  {last.score.missed.map((w, i) => (
                    <Chip key={i} tone="rose">
                      {w}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {last.sound && <SoundPanel sound={last.sound} />}
            <div className="mt-5 text-center">
              <Btn variant="go" onClick={next}>
                <Play className="h-4 w-4" /> {rep + 1 >= Math.min(REPS, drills.length) ? "Finish session" : "Next rep"}
              </Btn>
            </div>
          </div>
        )}

        {error && <div className="mt-4 text-center text-sm font-bold text-[#ffa3b1]">{error}</div>}
      </Card>
    </div>
  );
}

// Extracted so TS narrowing survives the .map callbacks, and so the Sound
// Lab block stays readable inside an already long component.
function SoundPanel({ sound }: { sound: SoundReport }) {
  if (sound.contrasts.length === 0 && sound.other.length === 0) return null;
  return (
    <div className="mt-5 rounded-2xl border border-white/[0.06] bg-[#141924] p-4 text-left">
      <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#9de6fb]">Sound lab</div>
      {sound.contrasts.map((c) => (
        <div key={c.key} className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="amber">{c.label}</Chip>
            {c.evidence.map((ev, i) => (
              <span key={i} className="text-xs text-[#a9b4c6]">
                you aimed at <b className="text-[#e7ecf5]">{ev.target}</b>, the mic heard <b className="text-[#ffa3b1]">{ev.heard}</b>
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[#a9b4c6]">{c.tip}</p>
          {c.drill.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {c.drill.map((d, i) => (
                <button
                  key={i}
                  onClick={() => {
                    speak(d.front);
                    setTimeout(() => speak(d.back), 900);
                  }}
                  className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-[#1b2230] px-2.5 py-1.5 text-xs font-semibold text-[#dbe3f0] hover:border-[#5f8fe8]/60"
                  title="Play the pair"
                >
                  <Volume2 className="h-3.5 w-3.5 text-[#9de6fb]" />
                  {d.front} / {d.back}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      {sound.other.length > 0 && (
        <div className="mt-3 text-xs leading-relaxed text-[#7d889c]">
          Also different (no known pattern):{" "}
          {sound.other.map((o, i) => (
            <span key={i}>
              {o.target} → {o.heard}
              {i < sound.other.length - 1 ? ", " : ""}
            </span>
          ))}
        </div>
      )}
      <p className="mt-3 border-t border-white/[0.06] pt-2 text-[11px] italic leading-relaxed text-[#5d6880]">{sound.note}</p>
    </div>
  );
}
