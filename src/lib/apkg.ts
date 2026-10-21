// .apkg (Anki package) import - feature #4 v2 (Stage 04 lead item).
//
// An .apkg is a ZIP archive; the deck lives inside as a SQLite database
// (collection.anki2, or collection.anki21 on newer exports). This module
// reads it with ZERO new dependencies:
//   - a minimal ZIP central-directory reader (stored + deflate entries),
//   - the runtime's built-in SQLite: node:sqlite (Next dev runs node) with a
//     bun:sqlite fallback (the production start script runs bun).
//
// Honest boundaries, stated in errors not guesses:
//   - Anki 2.1.50+ "new format" collections (collection.anki21b: zstd-compressed
//     protobuf) are NOT parsed - the learner is told to re-export with
//     "support older Anki versions" checked (Anki's own interop path).
//   - Media (audio/images) stays behind: refs are stripped from card faces.
//   - Anki's own FSRS state is NOT imported - cards enter Rah's queue as new
//     (importing another scheduler's state would fake memory evidence here).
//
// Pure + deterministic apart from the temp-file copy: same bytes in, same
// cards out - battery-pinned with a fixture built by buildZip() below.

import { inflateRawSync } from "node:zlib";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, writeFile, rm } from "node:fs/promises";

export const APKG_MAX_BYTES = 8 * 1024 * 1024; // 8 MB raw - Anki text decks are far below this
export const APKG_MAX_CARDS = 300; // same cap as CSV import

// ---------- minimal ZIP reader ----------

function u16(b: Uint8Array, o: number): number {
  return b[o] | (b[o + 1] << 8);
}
function u32(b: Uint8Array, o: number): number {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
}

export function unzip(buf: Uint8Array): Map<string, Uint8Array> {
  // Find the End Of Central Directory record (scan the last 64 KB).
  const scanStart = Math.max(0, buf.length - 65536);
  let eocd = -1;
  for (let i = buf.length - 22; i >= scanStart; i--) {
    if (u32(buf, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("This file is not a valid .apkg (no ZIP structure found).");
  const count = u16(buf, eocd + 10);
  let off = u32(buf, eocd + 16);
  const out = new Map<string, Uint8Array>();
  for (let i = 0; i < count; i++) {
    if (u32(buf, off) !== 0x02014b50) break; // corrupt central dir - take what we read
    const method = u16(buf, off + 10);
    const compSize = u32(buf, off + 20);
    const nameLen = u16(buf, off + 28);
    const extraLen = u16(buf, off + 30);
    const commentLen = u16(buf, off + 32);
    const localOffset = u32(buf, off + 42);
    const name = new TextDecoder().decode(buf.slice(off + 46, off + 46 + nameLen));
    off += 46 + nameLen + extraLen + commentLen;
    if (u32(buf, localOffset) !== 0x04034b50) continue;
    const lNameLen = u16(buf, localOffset + 26);
    const lExtraLen = u16(buf, localOffset + 28);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const raw = buf.slice(dataStart, dataStart + compSize);
    let data: Uint8Array;
    if (method === 0) data = raw;
    else if (method === 8) data = inflateRawSync(raw);
    else continue; // unknown method - skip the entry, the collection lookup reports honestly
    out.set(name, data);
  }
  return out;
}

// ---------- stored-entry ZIP writer (battery fixture + tests) ----------

function crc32(b: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < b.length; i++) {
    c ^= b[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

export function buildZip(entries: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const crc = crc32(e.data);
    const local = new Uint8Array(30 + name.length + e.data.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true); // version needed
    dv.setUint16(8, 0, true); // stored
    dv.setUint32(14, crc, true);
    dv.setUint32(18, e.data.length, true);
    dv.setUint32(22, e.data.length, true);
    dv.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(e.data, 30 + name.length);
    locals.push(local);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, 0, true); // stored
    cv.setUint32(16, crc, true);
    cv.setUint32(20, e.data.length, true);
    cv.setUint32(24, e.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);
    offset += local.length;
  }
  const cdSize = centrals.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const total = offset + cdSize + 22;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const l of locals) {
    out.set(l, pos);
    pos += l.length;
  }
  for (const c of centrals) {
    out.set(c, pos);
    pos += c.length;
  }
  out.set(eocd, pos);
  return out;
}

// ---------- Anki collection parsing ----------

export interface ApkgCard {
  front: string;
  back: string;
}

export interface ApkgParse {
  cards: ApkgCard[];
  skipped: number;
  mediaRefs: number; // [sound:...] / image refs stripped from faces
  format: string; // which collection file was read
}

const FIELD_SEP = "\x1f";

export function stripAnkiHtml(s: string): { text: string; mediaRefs: number } {
  let media = 0;
  let t = String(s ?? "");
  // Media refs cannot play here - count them, then remove.
  t = t.replace(/\[sound:[^\]]*\]/g, () => {
    media += 1;
    return " ";
  });
  t = t.replace(/<img[^>]*>/gi, () => {
    media += 1;
    return " ";
  });
  t = t.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "");
  t = t
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
  return { text: t.replace(/\s+/g, " ").trim(), mediaRefs: media };
}

// Cloze markup: the FIRST cloze marker becomes the blank (same convention as
// the CSV pre-blanked passthrough); later markers keep their content bare.
export function convertCloze(flds0: string): { front: string; answer: string } | null {
  const first = flds0.match(/\{\{c\d+::(.*?)(?:::(.*?))?\}\}/);
  if (!first) return null;
  const answer = first[1];
  let front = flds0.replace(first[0], "___");
  front = front.replace(/\{\{c\d+::(.*?)(?:::(.*?))?\}\}/g, "$1");
  return { front, answer };
}

export async function parseApkg(buf: Uint8Array): Promise<ApkgParse> {
  if (buf.length > APKG_MAX_BYTES) {
    throw new Error(`The .apkg is ${(buf.length / 1048576).toFixed(1)} MB - the import cap is ${APKG_MAX_BYTES / 1048576} MB. Split the deck.`);
  }
  let entries: Map<string, Uint8Array>;
  try {
    entries = unzip(buf);
  } catch (e) {
    throw e instanceof Error ? e : new Error("This file is not a valid .apkg.");
  }
  let format = "";
  let collection: Uint8Array | undefined;
  for (const key of ["collection.anki2", "collection.anki21"]) {
    const v = entries.get(key);
    if (v) {
      collection = v;
      format = key;
      break;
    }
  }
  if (!collection) {
    if (entries.has("collection.anki21b")) {
      throw new Error("This .apkg uses Anki's new compressed format. In Anki: File > Export, pick 'Anki Deck Package', check 'Support older Anki versions', then import that file here.");
    }
    throw new Error("No Anki collection found inside the .apkg - is it really an Anki deck export?");
  }
  const dir = await mkdtemp(join(tmpdir(), "rah-apkg-"));
  const dbPath = join(dir, format);
  try {
    await writeFile(dbPath, collection);
    // Runtime-adaptive SQLite (zero deps): node:sqlite on the Node dev
    // server, bun:sqlite when the standalone server runs under bun. Only a
    // MISSING MODULE falls back - a corrupt collection must surface its own
    // error, not mask itself as a second failed runtime.
    let sq: { all: () => unknown[]; close: () => void };
    try {
      const { DatabaseSync } = await import("node:sqlite");
      const d = new DatabaseSync(dbPath, { readOnly: true });
      sq = { all: () => d.prepare("SELECT flds FROM notes").all(), close: () => d.close() };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/cannot find module|no such built-in module|not supported/i.test(msg)) throw e;
      const { Database } = await import("bun:sqlite");
      const d = new Database(dbPath, { readonly: true });
      sq = { all: () => d.query("SELECT flds FROM notes").all() as unknown[], close: () => d.close() };
    }
    const rows = sq.all() as { flds: string }[];
    sq.close();
    const cards: ApkgCard[] = [];
    const seen = new Set<string>();
    let skipped = 0;
    let mediaRefs = 0;
    for (const r of rows) {
      if (cards.length >= APKG_MAX_CARDS) {
        skipped += 1;
        continue;
      }
      const fields = String(r.flds ?? "").split(FIELD_SEP);
      if (fields.length < 2) {
        skipped += 1;
        continue;
      }
      const f0 = stripAnkiHtml(fields[0]);
      const f1 = stripAnkiHtml(fields[1]);
      mediaRefs += f0.mediaRefs + f1.mediaRefs;
      let front = f0.text;
      let back = f1.text;
      const cloze = convertCloze(f0.text);
      if (cloze) {
        front = cloze.front;
        back = cloze.answer;
      }
      if (!front || !back || front === back || seen.has(front)) {
        skipped += 1;
        continue;
      }
      seen.add(front);
      cards.push({ front, back });
    }
    return { cards, skipped, mediaRefs, format };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
