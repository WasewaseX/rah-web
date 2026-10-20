// CSV/TSV deck import (Stage 03 feature #4 - Anki-style interop, v1).
// Deterministic, zero-AI: parse rows, skip Anki's #-headers, dedupe, and
// produce MaterialCards that ride the SAME FSRS queue as everything else.
//
// Row handling:
//  - tab- or comma-separated (auto-detected from the first data row)
//  - lines starting with # are Anki metadata headers -> skipped
//  - 2+ columns: first column = front, second = back (rest ignored)
//  - front already contains ___  -> cloze card, front as-is
//  - front contains the back verbatim (>= 3 chars) -> the back is blanked
//    deterministically so the card reviews as a cloze
//  - otherwise -> front-back card ("front [?]" renders naturally in the
//    cloze UI: prompt + blank + typed answer)

export interface ParsedCard {
  front: string;
  answer: string;
  note: string;
}

export interface ParseResult {
  cards: ParsedCard[];
  skipped: number;
  separator: "tab" | "comma";
}

const MAX_ROWS = 300;
const MAX_CELL = 500;

function detectSeparator(sample: string): "tab" | "comma" {
  const line = sample.split("\n").find((l) => l.trim() && !l.trim().startsWith("#")) ?? "";
  const tabs = (line.match(/\t/g) ?? []).length;
  const commas = (line.match(/,/g) ?? []).length;
  return tabs >= commas ? "tab" : "comma";
}

function splitLine(line: string, sep: "tab" | "comma"): string[] {
  if (sep === "tab") return line.split("\t").map((c) => c.trim());
  // comma: respect double-quoted cells (the CSV standard's one mercy)
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function parseDeckCsv(input: string): ParseResult {
  const sep = detectSeparator(input);
  const cards: ParsedCard[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#")) continue; // Anki file headers
    const cols = splitLine(line, sep);
    const front = (cols[0] ?? "").slice(0, MAX_CELL);
    const back = (cols[1] ?? "").slice(0, MAX_CELL);
    if (!front || !back) {
      skipped += 1;
      continue;
    }
    const key = front.toLowerCase();
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    if (cards.length >= MAX_ROWS) {
      skipped += 1;
      continue;
    }
    if (front.includes("___")) {
      cards.push({ front, answer: back, note: "Imported from your deck" });
      continue;
    }
    // Deterministic blanking: if the back appears in the front, blank it.
    const idx = front.toLowerCase().indexOf(back.toLowerCase());
    if (back.length >= 3 && idx >= 0) {
      cards.push({
        front: front.slice(0, idx) + "___" + front.slice(idx + back.length),
        answer: front.slice(idx, idx + back.length),
        note: "Imported from your deck",
      });
      continue;
    }
    cards.push({ front, answer: back, note: "Imported from your deck" });
  }
  return { cards, skipped, separator: sep };
}
