import { NextResponse } from "next/server";
import { DECK } from "@/lib/content";

export const dynamic = "force-dynamic";

// Review feature #12 (the 7.4/10 wave): standard-deck interoperability, the
// honest EXPORT half. Anki imports tab-separated files: front <TAB> back
// <TAB> tags, with #-prefixed lines treated as file headers/comments. Rah's
// FSRS scheduling does not round-trip into Anki (their model is different on
// purpose) - so the state travels as a plain tag (rah:review etc.) for
// information only, and the header says so. No lock-in in either direction.

function cell(v: string): string {
  // TSV cell: strip control chars, flatten tabs/newlines to spaces (Anki
  // supports HTML in fields, but plain text survives the round trip cleanest).
  return String(v ?? "")
    .replace(/[\u0000-\u001f]+/g, " ")
    .replace(/[\t\n\r]+/g, " ")
    .trim();
}

export async function GET() {
  const lines: string[] = [
    "#separator:tab",
    "#html:false",
    "#rah:export v1 - front/back/tags. Rah's FSRS schedule does NOT round-trip into Anki; each card carries its rah state as a plain tag (rah:new|review|mature) for information only.",
  ];
  for (const c of DECK) {
    const front = cell(c.en);
    const back = cell([c.fa, c.note ? `(${c.note})` : ""].filter(Boolean).join(" "));
    const tags = ["rah", c.level, c.unit, c.skill, ...c.traps].map((t) => cell(t).replace(/\s+/g, "_")).filter(Boolean).join(" ");
    lines.push(`${front}\t${back}\t${tags}`);
  }
  return new NextResponse(lines.join("\n") + "\n", {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": 'attachment; filename="rah-deck-anki.tsv"',
    },
  });
}
