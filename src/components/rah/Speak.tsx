"use client";

// Speaking loop: two forced minutes, transcript diagnosis on four aspects,
// then a harder repeat with a real constraint. Output is the workout.

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, RotateCcw, Clock } from "lucide-react";
import { Btn, Card, Chip, FA, Note, ScoreRow, Spinner } from "./ui";
import type { AppState } from "./App";

interface Result {
  scores: { fluency: number; range: number; accuracy: number; delivery: number };
  errors: { bad: string; good: string; fa: string; trap: string }[];
  upgrades: { plain: string; better: string; fa: string }[];
  round2: { constraint: string; same_prompt: boolean };
  verdict: string;
  fa_note: string;
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

export default function SpeakView({ state, onChange }: { state: AppState; onChange: () => void }) {
  const [prompts, setPrompts] = useState<string[]>([]);
  const [prompt, setPrompt] = useState(0);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(120);
  const [transcript, setTranscript] = useState("");
  const [round, setRound] = useState(1);
  const [constraint, setConstraint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasSpeech = typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  useEffect(() => {
    fetch("/api/speak", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setPrompts(j.prompts ?? []))
      .catch(() => setPrompts([]));
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const stopEverything = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
    setRecording(false);
  }, []);

  const tick = useCallback(() => {
    setSeconds((s) => {
      if (s <= 1) {
        stopEverything();
        return 0;
      }
      return s - 1;
    });
  }, [stopEverything]);

  const start = () => {
    setError(null);
    setResult(null);
    setTranscript("");
    setSeconds(120);
    setRecording(true);
    if (hasSpeech) {
      const Ctor = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike; SpeechRecognition?: new () => SpeechRecognitionLike })
        .webkitSpeechRecognition ?? (window as unknown as { SpeechRecognition: new () => SpeechRecognitionLike }).SpeechRecognition;
      if (Ctor) {
        const rec = new Ctor();
        rec.lang = "en-US";
        rec.continuous = true;
        rec.interimResults = false;
        rec.onresult = (e) => {
          let add = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) add += e.results[i][0].transcript + " ";
          }
          setTranscript((t) => (t + " " + add).trim());
        };
        rec.onend = () => setRecording(false);
        recRef.current = rec;
        try {
          rec.start();
        } catch {
          /* ignore */
        }
      }
    }
    timerRef.current = setInterval(tick, 1000);
  };

  const stop = () => {
    stopEverything();
  };

  const submit = useCallback(async () => {
    if (transcript.trim().length < 30) {
      setError("The transcript is too short. Speak the full two minutes, or type what you said if your browser cannot listen.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompts[prompt] ?? "", transcript, round }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Diagnosis failed.");
      setResult(j);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [prompts, prompt, transcript, round, onChange]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center justify-between">
          <span className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Round {round}</span>
          {round === 2 && constraint && <Chip tone="amber">constraint active</Chip>}
        </div>
        <p className="mt-4 text-lg font-bold leading-relaxed tracking-tight text-[#e7ecf5]">
          {constraint ?? prompts[prompt] ?? "Talk for 2 minutes on anything that matters to you."}
        </p>
        {!constraint && prompts.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {prompts.map((p, i) => (
              <button
                key={i}
                onClick={() => {
                  setPrompt(i);
                  setResult(null);
                }}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all ${
                  prompt === i
                    ? "border-[#ffb02e]/60 bg-[#ffb02e]/[0.12] text-[#ffd08a]"
                    : "border-[#2a3242] text-[#8b96a9] hover:border-[#3f4c63] hover:text-[#dbe3f0]"
                }`}
              >
                Prompt {i + 1}
              </button>
            ))}
          </div>
        )}

        <div className="mt-7 flex flex-col items-center gap-5">
          <div className={`flex items-center gap-2.5 font-mono text-[40px] font-black tabular-nums tracking-tight ${recording ? "text-[#ff6b81]" : "text-[#f2f5fa]"}`}>
            <Clock className="h-7 w-7" /> {mm}:{ss}
          </div>
          {!recording ? (
            <Btn onClick={start} variant={round === 2 ? "warm" : "primary"} className="px-10">
              <Mic className="h-4 w-4" /> {transcript ? "Record again" : "Start speaking"}
            </Btn>
          ) : (
            <Btn onClick={stop} variant="danger" className="rah-pulse px-10">
              <Square className="h-4 w-4" /> Stop
            </Btn>
          )}
          {!hasSpeech && (
            <p className="max-w-sm text-center text-xs leading-relaxed text-[#7d889c]">
              This browser cannot transcribe speech. Record yourself elsewhere, then paste or type what you said below. The diagnosis works the same.
            </p>
          )}
        </div>

        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={5}
          placeholder="Your words land here while you speak. Edit anything the recognizer got wrong before submitting."
          className="mt-7 w-full resize-none rounded-2xl border-2 border-[#2a3242] bg-[#141924] p-4 text-sm leading-relaxed text-[#e7ecf5] outline-none transition-colors placeholder:text-[#5c6678] focus:border-[#ffb02e]/70"
        />
        <div className="mt-4 flex justify-end">
          <Btn onClick={submit} disabled={busy || transcript.trim().length < 30} variant="warm">
            {busy ? "Diagnosing" : "Diagnose this round"}
          </Btn>
        </div>
      </Card>

      {busy && (
        <Card>
          <Spinner label="Scoring fluency, range, accuracy, delivery" />
        </Card>
      )}
      {error && <Note tone="rose">{error}</Note>}

      {result && (
        <>
          <div className="rah-rise">
            <Card>
              <div className="mb-5 text-sm font-extrabold tracking-tight text-[#f2f5fa]">Four aspect diagnosis</div>
              <div className="flex flex-col gap-3.5">
                <ScoreRow name="Fluency" value={result.scores.fluency} />
                <ScoreRow name="Range" value={result.scores.range} tone="cyan" />
                <ScoreRow name="Accuracy" value={result.scores.accuracy} tone={result.scores.accuracy < 6 ? "rose" : "emerald"} />
                <ScoreRow name="Delivery" value={result.scores.delivery} tone="amber" />
              </div>
              <p className="mt-5 text-sm leading-relaxed text-[#a9b4c6]">{result.verdict}</p>
              <FA className="mt-2.5 block text-sm">{result.fa_note}</FA>
            </Card>
          </div>

          {result.errors.length > 0 && (
            <div className="rah-rise">
              <Card>
                <div className="mb-4 text-sm font-extrabold tracking-tight text-[#f2f5fa]">What to fix</div>
                <div className="flex flex-col gap-3">
                  {result.errors.map((e, i) => (
                    <div key={i} className="rounded-2xl border border-[#ffb02e]/25 bg-[#ffb02e]/[0.06] p-3.5 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[#ff8ba0] line-through">{e.bad}</span>
                        <span className="font-black text-[#7fe0ac]">{e.good}</span>
                      </div>
                      <FA className="mt-1.5 block text-xs leading-loose">{e.fa}</FA>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          <div className="rah-rise">
            <Card className="border-[#ffb02e]/25 bg-gradient-to-br from-[#221c10] to-[#1a1f2b]">
              <div className="text-sm font-extrabold tracking-tight text-[#ffd08a]">Round 2 constraint</div>
              <p className="mt-2 text-sm leading-relaxed text-[#dbe3f0]">{result.round2.constraint}</p>
              <Btn
                variant="warm"
                className="mt-5"
                onClick={() => {
                  setRound(2);
                  setConstraint(result.round2.constraint);
                  setResult(null);
                  setTranscript("");
                  setSeconds(120);
                  onChange();
                }}
              >
                <RotateCcw className="h-4 w-4" /> Repeat the task, harder
              </Btn>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
