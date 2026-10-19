// A real markdown -> PDF engine for the coach's make_pdf tool.
// Why hand-built layout on pdf-lib instead of a converter package: every
// npm "md to pdf" bridge needs headless Chromium (300MB, dies in serverless)
// or ships a layout engine that cannot run inside the Next server. pdf-lib +
// fontkit is pure JS, and the layout rules here are small enough to own:
// A4, Liberation Sans (Helvetica metrics) for Latin text, Noto Serif SC for
// CJK runs, DejaVu Mono for code, deterministic wrapping, no network.

import { PDFDocument, rgb, PDFFont, PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export interface PdfResult {
  bytes: Uint8Array;
  pages: number;
}

// ---------- fonts ----------

const FONT_PATHS = {
  regular: "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  bold: "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  italic: "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf",
  mono: "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
  cjk: "/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf",
};

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  mono: PDFFont;
  cjk: PDFFont | null;
}

const CJK_RE = /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]/;

function pickFont(f: Fonts, style: Run["style"], text: string): PDFFont {
  if (style !== "mono" && f.cjk && CJK_RE.test(text)) return f.cjk;
  return f[style];
}

// pdf-lib throws on codepoints the embedded font cannot map (e.g. Arabic in a
// Latin font). Replace them honestly instead of crashing the tool: the reports
// the coach writes are Latin-script; exotic scripts become "?" placeholders.
function sanitize(text: string): string {
  let out = "";
  for (const ch of text.replace(/\r/g, "").replace(/\t/g, "    ")) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 32 && ch !== "\n") continue;
    if (c >= 0x0600 && c <= 0x06ff) { out += "?"; continue; } // Arabic: unshapable without an RTL engine
    if (c > 0xffff) continue; // astral planes (emoji): not in any embedded font
    out += ch;
  }
  return out;
}

// ---------- layout constants ----------

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 56;
const MARGIN_TOP = 68;
const MARGIN_BOTTOM = 62;

const INK = rgb(0.12, 0.15, 0.2);
const MUTED = rgb(0.42, 0.47, 0.55);
const LINE = rgb(0.82, 0.85, 0.89);
const ACCENT = rgb(0.31, 0.55, 1.0);
const CODE_BG = rgb(0.955, 0.96, 0.97);
const TABLE_HEAD_BG = rgb(0.925, 0.945, 0.985);

interface Ctx {
  doc: PDFDocument;
  fonts: Fonts;
  page: PDFPage;
  y: number;
}

function newPage(c: Ctx): void {
  c.page = c.doc.addPage([PAGE_W, PAGE_H]);
  c.y = PAGE_H - MARGIN_TOP;
}

function ensure(c: Ctx, needed: number): void {
  if (c.y - needed < MARGIN_BOTTOM) newPage(c);
}

// ---------- inline markdown -> styled runs ----------

export interface Run {
  text: string;
  style: "regular" | "bold" | "italic" | "mono";
}

export function inlineRuns(md: string): Run[] {
  const s = sanitize(md);
  const runs: Run[] = [];
  let i = 0;
  let plain = "";
  const flush = () => {
    if (plain) {
      runs.push({ text: plain, style: "regular" });
      plain = "";
    }
  };
  while (i < s.length) {
    if (s.startsWith("**", i)) {
      const end = s.indexOf("**", i + 2);
      if (end > i + 1) {
        flush();
        runs.push({ text: s.slice(i + 2, end), style: "bold" });
        i = end + 2;
        continue;
      }
    }
    if (s[i] === "`") {
      const end = s.indexOf("`", i + 1);
      if (end > i) {
        flush();
        runs.push({ text: s.slice(i + 1, end), style: "mono" });
        i = end + 1;
        continue;
      }
    }
    if ((s[i] === "*" || s[i] === "_") && i + 1 < s.length && !/\s/.test(s[i + 1])) {
      const mark = s[i];
      const end = s.indexOf(mark, i + 1);
      if (end > i + 1) {
        flush();
        runs.push({ text: s.slice(i + 1, end), style: "italic" });
        i = end + 1;
        continue;
      }
    }
    plain += s[i];
    i += 1;
  }
  flush();
  return runs.length ? runs : [{ text: "", style: "regular" }];
}

// ---------- word model + wrapping ----------

interface Frag {
  text: string;
  style: Run["style"];
}

interface Word {
  frags: Frag[];
  width: number;
}

function fragWidth(fr: Frag, f: Fonts, size: number): number {
  return pickFont(f, fr.style, fr.text).widthOfTextAtSize(fr.text, size);
}

// Draw styled runs with word wrapping inside [x, x+maxW]; returns lines drawn.
function wrapDraw(
  c: Ctx,
  runs: Run[],
  size: number,
  leading: number,
  x: number,
  maxW: number,
  color = INK,
): number {
  const f = c.fonts;
  // build word list with widths, keeping per-frag styles
  const words: Word[] = [];
  {
    let cur: Frag[] = [];
    const push = () => {
      const w: Word = { frags: cur, width: 0 };
      w.width = w.frags.reduce((s, fr) => s + fragWidth(fr, f, size), 0);
      words.push(w);
      cur = [];
    };
    for (const r of runs) {
      const parts = r.text.split(" ");
      parts.forEach((p, idx) => {
        if (idx > 0) push();
        if (p) cur.push({ text: p, style: r.style });
      });
    }
    push();
  }

  const spaceW = f.regular.widthOfTextAtSize(" ", size);
  let linesDrawn = 0;
  let line: Word[] = [];
  let lineW = 0;

  const drawLine = () => {
    let cx = x;
    for (const w of line) {
      for (const fr of w.frags) {
        const font = pickFont(f, fr.style, fr.text);
        c.page.drawText(fr.text, { x: cx, y: c.y, size, font, color });
        cx += fragWidth(fr, f, size);
      }
      cx += spaceW;
    }
    linesDrawn += 1;
  };

  for (const w of words) {
    const add = line.length === 0 ? w.width : w.width + spaceW;
    if (line.length > 0 && lineW + add > maxW) {
      drawLine();
      c.y -= leading;
      if (c.y < MARGIN_BOTTOM) newPage(c);
      line = [];
      lineW = 0;
    }
    if (w.width > maxW && line.length === 0) {
      // hard-break a monster word character by character
      let acc = "";
      let accStyle: Run["style"] = "regular";
      for (const fr of w.frags) {
        for (const ch of fr.text) {
          const testW = fragWidth({ text: acc + ch, style: fr.style }, f, size);
          if (acc && testW > maxW) {
            c.page.drawText(acc, { x, y: c.y, size, font: pickFont(f, accStyle, acc), color });
            c.y -= leading;
            if (c.y < MARGIN_BOTTOM) newPage(c);
            acc = ch;
            accStyle = fr.style;
          } else {
            acc += ch;
            accStyle = fr.style;
          }
        }
      }
      if (acc) c.page.drawText(acc, { x, y: c.y, size, font: pickFont(f, accStyle, acc), color });
      linesDrawn += 1;
      continue;
    }
    line.push(w);
    lineW += add;
  }
  if (line.length > 0 || linesDrawn === 0) drawLine();
  return linesDrawn;
}

// ---------- block parser ----------

interface Block {
  kind: "h1" | "h2" | "h3" | "p" | "bullet" | "number" | "code" | "quote" | "hr" | "table";
  text?: string;
  lines?: string[];
  cells?: string[][];
  number?: number;
}

export function parseBlocks(md: string): Block[] {
  const src = sanitize(md).split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let code: string[] | null = null;
  let list: { kind: "bullet" | "number"; items: string[] } | null = null;
  let table: string[][] | null = null;

  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: "p", text: para.join(" ").trim() });
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const items = list.items;
      const kind = list.kind;
      items.forEach((it, i) => blocks.push({ kind, text: it, number: kind === "number" ? i + 1 : undefined }));
      list = null;
    }
  };
  const flushTable = () => {
    if (table && table.length) {
      const rows = table.filter((r) => !r.every((cell) => /^:?-{2,}:?$/.test(cell.trim()) || cell.trim() === ""));
      if (rows.length) blocks.push({ kind: "table", cells: rows });
      table = null;
    }
  };

  for (const raw of src) {
    const line = raw.trimEnd();
    if (code !== null) {
      if (/^```/.test(line.trim())) {
        blocks.push({ kind: "code", lines: code });
        code = null;
      } else code.push(raw);
      continue;
    }
    const t = line.trim();
    if (/^```/.test(t)) {
      flushPara();
      flushList();
      flushTable();
      code = [];
      continue;
    }
    if (!t) {
      flushPara();
      flushList();
      flushTable();
      continue;
    }
    if (/^\|.*\|$/.test(t)) {
      flushPara();
      flushList();
      table = table ?? [];
      table.push(t.slice(1, -1).split("|").map((x) => x.trim()));
      continue;
    }
    flushTable();
    const h = t.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushPara();
      flushList();
      blocks.push({ kind: h[1].length === 1 ? "h1" : h[1].length === 2 ? "h2" : "h3", text: h[2] });
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(t)) {
      flushPara();
      flushList();
      blocks.push({ kind: "hr" });
      continue;
    }
    const b = t.match(/^[-*+]\s+(.*)$/);
    if (b) {
      flushPara();
      if (!list || list.kind !== "bullet") {
        flushList();
        list = { kind: "bullet", items: [] };
      }
      list.items.push(b[1]);
      continue;
    }
    const n = t.match(/^(\d+)[.)]\s+(.*)$/);
    if (n) {
      flushPara();
      if (!list || list.kind !== "number") {
        flushList();
        list = { kind: "number", items: [] };
      }
      list.items.push(n[2]);
      continue;
    }
    const q = t.match(/^>\s?(.*)$/);
    if (q) {
      flushPara();
      flushList();
      blocks.push({ kind: "quote", text: q[1] });
      continue;
    }
    flushList();
    para.push(t);
  }
  if (code !== null && code.length) blocks.push({ kind: "code", lines: code });
  flushPara();
  flushList();
  flushTable();
  return blocks;
}

// ---------- code blocks ----------

function drawCodeBlock(c: Ctx, lines: string[]): void {
  const size = 8.5;
  const leading = 11.5;
  const pad = 8;
  const maxChars = 92;
  const f = c.fonts;

  // wrap long lines by characters first
  const wrapped: string[] = [];
  for (const raw of lines) {
    let ln = sanitize(raw);
    while (f.mono.widthOfTextAtSize(ln, size) > (PAGE_W - MARGIN_X * 2) - pad * 2) {
      let cut = Math.min(maxChars, ln.length);
      while (cut > 1 && f.mono.widthOfTextAtSize(ln.slice(0, cut), size) > (PAGE_W - MARGIN_X * 2) - pad * 2) cut -= 1;
      wrapped.push(ln.slice(0, cut));
      ln = ln.slice(cut);
    }
    wrapped.push(ln);
  }

  // draw in page-sized chunks: rect + text per chunk
  let i = 0;
  while (i < wrapped.length) {
    const rowsOnThisPage = Math.floor((c.y - MARGIN_BOTTOM - pad * 2) / leading);
    const chunk = wrapped.slice(i, i + Math.max(rowsOnThisPage, 1));
    const blockH = chunk.length * leading + pad * 2 - 4;
    if (c.y - blockH < MARGIN_BOTTOM && chunk.length > 1) {
      chunk.pop();
    }
    const h = chunk.length * leading + pad * 2 - 4;
    c.page.drawRectangle({ x: MARGIN_X, y: c.y - h + 4, width: PAGE_W - MARGIN_X * 2, height: h, color: CODE_BG, borderColor: LINE, borderWidth: 0.5 });
    let ty = c.y - pad - size + 2;
    for (const ln of chunk) {
      c.page.drawText(ln, { x: MARGIN_X + pad, y: ty, size, font: f.mono, color: INK });
      ty -= leading;
    }
    c.y -= h + 6;
    i += chunk.length;
    if (i < wrapped.length) newPage(c);
  }
}

// ---------- tables ----------

function drawTable(c: Ctx, cells: string[][], f: Fonts): void {
  const size = 8.75;
  const pad = 5;
  const cols = Math.max(...cells.map((r) => r.length));
  const colW: number[] = [];
  for (let i = 0; i < cols; i++) {
    let w = 0;
    for (const row of cells) {
      const txt = sanitize(row[i] ?? "");
      const font = row === cells[0] ? f.bold : f.regular;
      w = Math.max(w, font.widthOfTextAtSize(txt, size));
    }
    colW.push(Math.min(Math.max(w + pad * 2, 42), 210));
  }
  const total = colW.reduce((a, b) => a + b, 0);
  const scale = (PAGE_W - MARGIN_X * 2) / total;
  if (scale < 1) for (let i = 0; i < colW.length; i++) colW[i] = colW[i] * scale;

  const rowH = (row: string[], header: boolean): number => {
    let maxLines = 1;
    row.forEach((cell, ci) => {
      const font = header ? f.bold : f.regular;
      const textW = font.widthOfTextAtSize(sanitize(cell), size);
      const avail = Math.max((colW[ci] ?? colW[colW.length - 1]) - pad * 2, 24);
      maxLines = Math.max(maxLines, Math.max(1, Math.ceil(textW / avail)));
    });
    return maxLines * 11 + pad + 3;
  };

  const drawRow = (row: string[], header: boolean) => {
    const h = rowH(row, header);
    const w = colW.reduce((a, b) => a + b, 0);
    if (header) c.page.drawRectangle({ x: MARGIN_X, y: c.y - h + 4, width: w, height: h, color: TABLE_HEAD_BG });
    let x = MARGIN_X;
    row.forEach((cell, ci) => {
      const cw = colW[ci] ?? colW[colW.length - 1];
      c.page.drawRectangle({ x, y: c.y - h + 4, width: cw, height: h, borderColor: LINE, borderWidth: 0.5 });
      const font = header ? f.bold : f.regular;
      let line = "";
      let ly = c.y - pad - size + 4;
      const flushLine = () => {
        if (line) c.page.drawText(line, { x: x + pad, y: ly, size, font, color: INK });
        ly -= 11;
        line = "";
      };
      for (const ch of sanitize(cell)) {
        if (line && font.widthOfTextAtSize(line + ch, size) > cw - pad * 2) flushLine();
        line += ch;
      }
      flushLine();
      x += cw;
    });
    c.y -= h;
  };

  for (let ri = 0; ri < cells.length; ri++) {
    const header = ri === 0;
    const h = rowH(cells[ri], header);
    if (c.y - h < MARGIN_BOTTOM) {
      newPage(c);
      if (ri > 0) drawRow(cells[0], true); // repeat the header row
    }
    drawRow(cells[ri], header);
  }
  c.y -= 8;
}

// ---------- main ----------

export async function markdownToPdf(md: string): Promise<PdfResult> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle("Rah - coach report");
  doc.setProducer("rah-web coach agent");

  const fs = await import("fs/promises");
  // subset: true keeps each embedded font to the glyphs actually used
  const embed = async (p: string): Promise<PDFFont> => doc.embedFont(await fs.readFile(p), { subset: true });
  const fonts: Fonts = {
    regular: await embed(FONT_PATHS.regular),
    bold: await embed(FONT_PATHS.bold),
    italic: await embed(FONT_PATHS.italic),
    mono: await embed(FONT_PATHS.mono),
    cjk: null,
  };
  if (CJK_RE.test(sanitize(md))) {
    // CJK font is ~9MB raw: only embed (subset) when the report actually uses it
    try {
      fonts.cjk = await embed(FONT_PATHS.cjk);
    } catch {
      fonts.cjk = null; // CJK falls back to Latin-only rendering
    }
  }

  const c: Ctx = { doc, fonts, page: doc.addPage([PAGE_W, PAGE_H]), y: PAGE_H - MARGIN_TOP };
  const contentW = PAGE_W - MARGIN_X * 2;

  let firstH1 = true;
  for (const b of parseBlocks(md)) {
    switch (b.kind) {
      case "h1": {
        // Convention everywhere: c.y IS the baseline of the next line drawn.
        c.y -= firstH1 ? 0 : 14;
        firstH1 = false;
        const size = 18.5;
        c.page.drawText(b.text ?? "", { x: MARGIN_X, y: c.y, size, font: fonts.bold, color: INK });
        c.y -= 24; // past descenders
        c.page.drawRectangle({ x: MARGIN_X, y: c.y + 2, width: 46, height: 2.5, color: ACCENT });
        c.y -= 10;
        break;
      }
      case "h2": {
        ensure(c, 36);
        c.y -= 14;
        const size = 13.5;
        c.page.drawText(b.text ?? "", { x: MARGIN_X, y: c.y, size, font: fonts.bold, color: INK });
        c.y -= 18;
        break;
      }
      case "h3": {
        ensure(c, 30);
        c.y -= 10;
        const size = 11.5;
        c.page.drawText(b.text ?? "", { x: MARGIN_X, y: c.y, size, font: fonts.bold, color: INK });
        c.y -= 16;
        break;
      }
      case "p": {
        const size = 10;
        const leading = 14.5;
        ensure(c, leading * 2 + 4);
        wrapDraw(c, inlineRuns(b.text ?? ""), size, leading, MARGIN_X, contentW);
        c.y -= leading + 5;
        break;
      }
      case "bullet": {
        const size = 10;
        const leading = 14;
        const indent = 16;
        ensure(c, leading * 2 + 2);
        c.page.drawText("•", { x: MARGIN_X + 3, y: c.y, size: size + 1, font: fonts.regular, color: ACCENT });
        wrapDraw(c, inlineRuns(b.text ?? ""), size, leading, MARGIN_X + indent, contentW - indent);
        c.y -= leading + 3;
        break;
      }
      case "number": {
        const size = 10;
        const leading = 14;
        const indent = 20;
        ensure(c, leading * 2 + 2);
        c.page.drawText(`${b.number ?? 1}.`, { x: MARGIN_X, y: c.y, size, font: fonts.bold, color: ACCENT });
        wrapDraw(c, inlineRuns(b.text ?? ""), size, leading, MARGIN_X + indent, contentW - indent);
        c.y -= leading + 3;
        break;
      }
      case "code": {
        drawCodeBlock(c, b.lines ?? []);
        break;
      }
      case "quote": {
        const size = 10;
        const leading = 14;
        const indent = 14;
        ensure(c, leading * 2 + 4);
        const estLines = Math.max(1, Math.ceil(fonts.italic.widthOfTextAtSize(sanitize(b.text ?? ""), size) / (contentW - indent)));
        // bar spans from just above the first baseline to below the last one
        c.page.drawRectangle({ x: MARGIN_X, y: c.y - (estLines - 1) * leading - 10, width: 2.5, height: (estLines - 1) * leading + 14, color: LINE });
        wrapDraw(c, inlineRuns(b.text ?? ""), size, leading, MARGIN_X + indent, contentW - indent, MUTED);
        c.y -= leading + 6;
        break;
      }
      case "hr": {
        ensure(c, 18);
        c.y -= 8;
        c.page.drawRectangle({ x: MARGIN_X, y: c.y, width: contentW, height: 0.75, color: LINE });
        c.y -= 10;
        break;
      }
      case "table": {
        ensure(c, 40);
        drawTable(c, b.cells ?? [], fonts);
        break;
      }
    }
  }

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawText("Rah - coach workspace", { x: MARGIN_X, y: 34, size: 7.5, font: fonts.regular, color: MUTED });
    const label = `${i + 1} / ${pages.length}`;
    const w = fonts.regular.widthOfTextAtSize(label, 7.5);
    p.drawText(label, { x: PAGE_W - MARGIN_X - w, y: 34, size: 7.5, font: fonts.regular, color: MUTED });
  });

  const bytes = await doc.save();
  return { bytes, pages: pages.length };
}
