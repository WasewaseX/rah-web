// Codemod: wire aiRateLimit into every AI-capable POST route.
// Idempotent: skips files already carrying the guard.
const fs = require("fs");

const files = [
  "src/app/api/coach-agent/route.ts",
  "src/app/api/coach/briefing/route.ts",
  "src/app/api/speak/route.ts",
  "src/app/api/speak/conversation/route.ts",
  "src/app/api/arena/voice/route.ts",
  "src/app/api/exam/grade/route.ts",
  "src/app/api/quiz/route.ts",
  "src/app/api/writing/route.ts",
  "src/app/api/grammar-check/route.ts",
  "src/app/api/placement/route.ts",
  "src/app/api/listen/route.ts",
  "src/app/api/listen/dictation/route.ts",
  "src/app/api/flow/route.ts",
  "src/app/api/chat/route.ts",
];

const IMPORT = 'import { aiRateLimit } from "@/lib/rate-limit";';
const GUARD = [
  "  // Abuse limit (audit P1-6): AI calls cost real money - 30/min per client IP.",
  "  const rl = aiRateLimit(req);",
  "  if (!rl.ok) return rl.response!;",
  "",
].join("\n");

let patched = 0;
for (const f of files) {
  let src = fs.readFileSync(f, "utf8");
  if (src.includes("aiRateLimit(req)")) {
    console.log("skip (already wired):", f);
    continue;
  }
  // 1. import before `export const dynamic`
  if (!src.includes(IMPORT)) {
    src = src.replace('export const dynamic', `${IMPORT}\n\nexport const dynamic`);
  }
  // 2. guard right after the POST opening line
  const sig = "export async function POST(req: Request) {";
  if (!src.includes(sig)) {
    console.error("NO POST SIG:", f);
    process.exit(1);
  }
  src = src.replace(sig, `${sig}\n${GUARD}`);
  fs.writeFileSync(f, src);
  patched += 1;
  console.log("patched:", f);
}
console.log(`\npatched ${patched}/${files.length}`);
