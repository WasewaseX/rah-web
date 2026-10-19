// Smoke test for the coach's markdown -> PDF engine (run with bun directly).
import { markdownToPdf, parseBlocks, inlineRuns } from "../src/lib/coach-agent/pdf";
import { writeFile, mkdir } from "fs/promises";

const SAMPLE = `# Rah Progress Report

**Learner:** B2 · streak 3 days · 124 XP

## This week

| day | reviews | accuracy |
| --- | --- | --- |
| Mon | 22 | 86% |
| Tue | 30 | 90% |
| Wed | 17 | 76% |

### What went well

- Collocation accuracy climbed from 61% to **86%**
- You cleared the *present-perfect* trap family \`3 days\` in a row
- Listening recall held at 90% despite the new audio direction

### What needs work

1. Farsi-to-English production (fae) — accuracy 64%
2. Word-bank direction — tap speed, not accuracy
3. Review consistency — 2 days missed last week

> Missed days happen. Your freeze bank covered one of them automatically.

## Code check

\`\`\`ts
const due = cards.filter(c => c.due <= today);
console.log(due.length); // 10
\`\`\`

---

A final paragraph with a very long unbroken token: supercalifragilisticexpialidociousantidisestablishmentarianismfloccinaucinihilipilification to test the hard-break path, plus mixed 中文 runs and "smart quotes" and — em dashes.
`;

async function main() {
  const blocks = parseBlocks(SAMPLE);
  const kinds = blocks.map((b) => b.kind).join(",");
  console.log("blocks:", blocks.length, kinds);
  if (!kinds.includes("table")) throw new Error("table not parsed");
  if (!kinds.includes("code")) throw new Error("code not parsed");
  const runs = inlineRuns("**bold** and *ital* and `code` and plain");
  if (runs.map((r) => r.style).join(",") !== "bold,regular,italic,regular,mono,regular") {
    console.log("runs:", JSON.stringify(runs));
    throw new Error("inline runs wrong");
  }

  const { bytes, pages } = await markdownToPdf(SAMPLE);
  const head = Buffer.from(bytes.slice(0, 8)).toString("latin1");
  if (!head.startsWith("%PDF-")) throw new Error(`bad header: ${head}`);
  if (bytes.length < 3000) throw new Error(`suspiciously small pdf: ${bytes.length}`);
  console.log(`PDF OK: ${pages} page(s), ${(bytes.length / 1024).toFixed(1)} KB, header ${head.slice(0, 8)}`);

  await mkdir("data/coach-workspace", { recursive: true });
  await writeFile("data/coach-workspace/_smoke.pdf", bytes);

  // edge cases: empty, only headings, CJK, monster table
  const empty = await markdownToPdf("# Empty\n");
  console.log("empty doc OK:", empty.pages, `${(empty.bytes.length / 1024).toFixed(1)} KB`);
  const cjk = await markdownToPdf("# 中文测试\n\n这是**中文**段落，验证 CJK 字体嵌入。\n");
  console.log("cjk doc OK:", cjk.pages, `${(cjk.bytes.length / 1024).toFixed(1)} KB`);
  const wide = await markdownToPdf("| a | b | c | d | e | f | g | h |\n| - | - | - | - | - | - | - | - |\n| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |\n".repeat(1));
  console.log("wide table OK:", wide.pages);
  console.log("ALL PDF SMOKE PASS");
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
