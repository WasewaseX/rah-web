"use client";

// Read-aloud assessor (Task 64 - the measured acoustic tier).
//
// The learner reads a target sentence out loud; the clip is encoded 16k-mono
// WAV in the browser, scored server-side from REAL audio, and every word gets
// a colored chip. Honesty labels are load-bearing here: the tier chip says
// which engine scored the clip ("measured: word-level" vs the Azure phoneme
// tier when configured), and near-misses defer their "why" to Sound Lab's
// labeled inference - the measurement never pretends to be a phoneme test.

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Volume2, RefreshCw } from "lucide-react";
import { Btn, Card, Chip, Note, Spinner } from "./ui";

interface PronWord {
  target: string;
  heard: string | null;
  status: string; // hit | near | miss (built-in tier)
}

interface AssessResponse {
  target: string;
  transcript: string;
  tier: string;
  provider: string;
  degraded: string | null;
  report:
    | {
        accuracy: number;
        hits: number;
        near: number;
        misses: number;
        total: number;
        words: PronWord[];
        extra: string[];
        note: string;
      }
    | {
        accuracy: number;
        pronunciation: number;
        fluency: number;
        completeness: number;
        words: { word: string; accuracyScore: number; errorType: string }[];
      };
}

// ---------- 16k mono WAV encoder (browser side) ----------

async function clipToWav16kMono(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const Ctx = (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext) as typeof AudioContext;
  const decoded = await new Ctx().decodeAudioData(buf);
  const rate = 16000;
  const frames = Math.max(1, Math.ceil(decoded.length * (rate / decoded.sampleRate)));
  const off = new OfflineAudioContext(1, frames, rate);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  const pcm = rendered.getChannelData(0);

  const bytes = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(bytes);
  const ascii = (off2: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off2 + i, s.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let bin = "";
  const u8 = new Uint8Array(bytes);
  for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode(...u8.subarray(i, i + 8192));
  return btoa(bin);
}

// ---------- component ----------

const WORD_STYLE: Record<string, string> = {
  hit: "border-[#2fc273]/50 bg-[#2fc273]/[0.12] text-[#7fe0ae]",
  near: "border-[#ffb02e]/50 bg-[#ffb02e]/[0.12] text-[#ffd08a]",
  miss: "border-[#ff6b81]/50 bg-[#ff6b81]/[0.12] text-[#ff9aa7]",
};

export default function ReadAloud({ onChange }: { onChange: () => void }) {
  const [targets, setTargets] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [azure, setAzure] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<AssessResponse | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    fetch("/api/speak/assess", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setTargets(Array.isArray(j.targets) ? j.targets : []);
        setAzure(Boolean(j.azure));
      })
      .catch(() => setTargets([]));
    return () => {
      try {
        recRef.current?.stream.getTracks().forEach((t) => t.stop());
      } catch {
        /* already gone */
      }
    };
  }, []);

  const say = useCallback(() => {
    try {
      const u = new SpeechSynthesisUtterance(targets[idx] ?? "");
      u.lang = "en-US";
      u.rate = 0.95;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      /* no tts; the sentence is on screen */
    }
  }, [targets, idx]);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
    setRecording(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setRes(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setBusy(true);
        try {
          const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
          const audio = await clipToWav16kMono(blob);
          const r = await fetch("/api/speak/assess", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ target: targets[idx], audio }),
          });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error ?? "Assessment failed.");
          setRes(j);
          onChange();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setError("Microphone unavailable - allow mic access and try again.");
    }
  }, [targets, idx, onChange]);

  const target = targets[idx] ?? "";
  const builtIn = res && "hits" in res.report ? res.report : null;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-extrabold tracking-tight text-[#f2f5fa]">Read aloud - measured</div>
        <Chip tone={azure ? "cyan" : "emerald"}>
          {azure ? "azure phoneme tier active" : "measured: word-level (ASR alignment)"}
        </Chip>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[#7d889c]">
        Read the sentence out loud. Your recording is transcribed by a speech recognizer and aligned word by word -
        the score is measured from real audio, not guessed.
      </p>

      {target && (
        <div className="mt-4 rounded-2xl border border-[#2a3242] bg-[#131722] p-4">
          <p className="text-base font-bold leading-relaxed tracking-tight text-[#e7ecf5]">{target}</p>
          <button
            onClick={say}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#4e8cff] hover:text-[#7dabff]"
          >
            <Volume2 className="h-3.5 w-3.5" /> hear it
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!recording ? (
          <Btn onClick={start} variant="primary" disabled={busy || !target}>
            <Mic className="h-4 w-4" /> {res || error ? "Record again" : "Record"}
          </Btn>
        ) : (
          <Btn onClick={stop} variant="danger">
            <Square className="h-4 w-4" /> Stop
          </Btn>
        )}
        <Btn
          onClick={() => {
            setIdx((i) => (i + 1) % Math.max(1, targets.length));
            setRes(null);
            setError(null);
          }}
          variant="ghost"
        >
          <RefreshCw className="h-4 w-4" /> Next sentence
        </Btn>
        {recording && <Chip tone="rose">recording…</Chip>}
      </div>

      {busy && (
        <div className="mt-4">
          <Spinner label="Scoring your audio…" />
        </div>
      )}
      {error && (
        <div className="mt-4">
          <Note tone="rose">{error}</Note>
        </div>
      )}
      {res?.degraded && (
        <div className="mt-4">
          <Note tone="amber">{res.degraded}</Note>
        </div>
      )}

      {res && (
        <div className="rah-rise mt-5">
          <div className="flex flex-wrap items-baseline gap-3">
            <div className="font-mono text-[44px] font-black tabular-nums leading-none text-[#f2f5fa]">
              {res.report.accuracy}
            </div>
            <div className="text-xs font-bold uppercase tracking-widest text-[#7d889c]">word accuracy</div>
            <Chip tone="cyan">{res.tier}</Chip>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-[#8b96a9]">
            Heard: <span className="font-semibold text-[#dbe3f0]">{res.transcript}</span>
          </p>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {builtIn
              ? builtIn.words.map((w, i) => (
                  <span
                    key={i}
                    title={w.status === "hit" ? "matched" : `heard: ${w.heard ?? "(nothing)"}`}
                    className={`rounded-lg border px-2 py-1 text-xs font-bold ${WORD_STYLE[w.status] ?? WORD_STYLE.miss}`}
                  >
                    {w.target}
                  </span>
                ))
              : res.report.words.map((w, i) => (
                  <span
                    key={i}
                    title={`${w.errorType} - accuracy ${w.accuracyScore}`}
                    className={`rounded-lg border px-2 py-1 text-xs font-bold ${
                      w.errorType === "None" ? WORD_STYLE.hit : w.errorType === "Insertion" ? WORD_STYLE.near : WORD_STYLE.miss
                    }`}
                  >
                    {w.word}
                  </span>
                ))}
          </div>

          {builtIn && (builtIn.near > 0 || builtIn.misses > 0 || builtIn.extra.length > 0) && (
            <p className="mt-3 text-xs leading-relaxed text-[#7d889c]">
              {builtIn.near > 0 && <>Amber words were heard as something close (half credit). </>}
              {builtIn.misses > 0 && <>Red words were not recognized. </>}
              {builtIn.extra.length > 0 && <>Extra words heard: {builtIn.extra.join(", ")}. </>}
            </p>
          )}

          {builtIn && (
            <div className="mt-3">
              <Note tone="blue">{builtIn.note}</Note>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
