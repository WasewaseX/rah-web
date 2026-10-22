// Azure AI Speech pronunciation-assessment adapter (Task 64 - the decision
// gate, made concrete).
//
// The external audit named Azure as "the only validated acoustic scoring
// path" for phoneme-level pronunciation feedback and asked for a DECISION
// before "pronunciation" claims move from honest-inference to measured.
//
// Decision shipped here, two halves:
//   1. TODAY (no new credentials): src/lib/pronunciation.ts scores word-level
//      accuracy from REAL audio via the built-in SDK ASR - a measurement,
//      honestly labeled "measured:asr-alignment".
//   2. WHEN THE LEARNER OPTS IN: set AZURE_SPEECH_KEY + AZURE_SPEECH_REGION
//      and this adapter takes over automatically - real phoneme-level scoring
//      (HundredMark, Phoneme granularity, miscue on) per Microsoft's
//      pronunciation-assessment REST contract. No other code changes; the
//      route prefers Azure and falls back to the built-in tier, labeling the
//      degradation in the response.
//
// Until a key exists this file is dormant and no Azure claims are made
// anywhere in the UI - the honest-tier rule holds.

export interface AzureWord {
  word: string;
  accuracyScore: number;
  errorType: string; // None | Mispronunciation | Omission | Insertion
  phonemes?: { phoneme: string; accuracyScore: number }[];
}

export interface AzureAssessResult {
  transcript: string;
  pronunciationScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  words: AzureWord[];
  tier: "measured:azure-phoneme";
}

export function azureSpeechConfigured(): boolean {
  return Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

interface AzureBest {
  Display?: string;
  PronunciationAssessment?: { PronScore?: number; AccuracyScore?: number; FluencyScore?: number; CompletenessScore?: number };
  Words?: {
    Word: string;
    PronunciationAssessment?: { AccuracyScore?: number; ErrorType?: string };
    Phonemes?: { Phoneme: string; PronunciationAssessment?: { AccuracyScore?: number } }[];
  }[];
}

interface AzureResponse {
  DisplayText?: string;
  NBest?: AzureBest[];
}

/**
 * Run Azure pronunciation assessment on 16k-mono WAV audio against a
 * reference text. Throws speakable Error messages; the route treats any
 * throw as "Azure unavailable" and degrades to the built-in measured tier.
 */
export async function azureAssess(rawBase64: string, referenceText: string): Promise<AzureAssessResult> {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) throw new Error("azure: not configured");

  const b64 = String(rawBase64 ?? "").replace(/^data:audio\/[a-z0-9.+-]+;base64,/i, "");
  if (!b64) throw new Error("azure: empty audio");

  // Microsoft pronunciation-assessment REST contract: the config JSON rides
  // in the Pronunciation-Assessment header (base64), audio is the body.
  const pronParams = Buffer.from(
    JSON.stringify({
      ReferenceText: referenceText,
      GradingSystem: "HundredMark",
      Granularity: "Phoneme",
      Dimension: "Comprehensive",
      EnableMiscue: true,
    }),
  ).toString("base64");

  const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": 'audio/wav; codecs="audio/pcm"; samplerate=16000',
      Accept: "application/json",
      "Pronunciation-Assessment": pronParams,
    },
    body: Buffer.from(b64, "base64"),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`azure: HTTP ${res.status}`);

  interface AzureWordRaw {
    Word: string;
    PronunciationAssessment?: { AccuracyScore?: number; ErrorType?: string };
    Phonemes?: { Phoneme: string; PronunciationAssessment?: { AccuracyScore?: number } }[];
  }
  interface AzureBestRaw {
    Display?: string;
    PronunciationAssessment?: { PronScore?: number; AccuracyScore?: number; FluencyScore?: number; CompletenessScore?: number };
    Words?: AzureWordRaw[];
  }
  const j = (await res.json()) as { DisplayText?: string; NBest?: AzureBestRaw[] };
  const best = j?.NBest?.[0];
  if (!best) throw new Error("azure: empty NBest");

  const words: AzureWord[] = (best.Words ?? []).map((w) => ({
    word: w.Word,
    accuracyScore: Number(w.PronunciationAssessment?.AccuracyScore ?? 0),
    errorType: String(w.PronunciationAssessment?.ErrorType ?? "None"),
    phonemes: (w.Phonemes ?? []).map((p) => ({
      phoneme: p.Phoneme,
      accuracyScore: Number(p.PronunciationAssessment?.AccuracyScore ?? 0),
    })),
  }));

  return {
    transcript: String(best.Display ?? j.DisplayText ?? ""),
    pronunciationScore: Number(best.PronunciationAssessment?.PronScore ?? 0),
    accuracyScore: Number(best.PronunciationAssessment?.AccuracyScore ?? 0),
    fluencyScore: Number(best.PronunciationAssessment?.FluencyScore ?? 0),
    completenessScore: Number(best.PronunciationAssessment?.CompletenessScore ?? 0),
    words,
    tier: "measured:azure-phoneme",
  };
}
