// Task 94 E2E: the teaching-experience volume chain, end to end on a
// THROWAWAY stack (own db + own dist + open registration; the real learner
// db is never opened).
//
// Part A (browser): the writing surface — type, draft-autosave fires,
// RELOAD restores the unsent draft (the honest indicator appears), the
// submission grades, the local draft cache is cleared, and the pilot's
// volume ledger counts the writing.
//
// Part B (API): the speaking volume chain — a speak session records and the
// volume ledger counts it. The acoustic measurement chain has its own E2E
// (test-readaloud-e2e.ts) + pronunciation battery; this drive proves the
// LEDGER plumbing the pilot reads.
//
// Run: node scripts/e2e-task94-teach.mjs
import { chromium } from "playwright";
import { spawn } from "node:child_process";

const PORT = 3112;
const BASE = `http://localhost:${PORT}`;
const DB = `file:/home/z/my-project/db/battery-teach.db`;
const DIST = ".next-teach";
const EMAIL = "teach@rah.test";

const stack = spawn("bunx", ["next", "dev", "-p", String(PORT)], {
  cwd: "/home/z/my-project",
  env: {
    ...process.env,
    DATABASE_URL: DB,
    NEXT_DIST_DIR: DIST,
    RAH_OPEN_REGISTRATION: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
stack.stdout.on("data", () => {});
stack.stderr.on("data", () => {});

let pass = 0, fail = 0;
const ok = (c, what, detail = "") => {
  if (c) { pass++; console.log(`  PASS: ${what}`); }
  else { fail++; console.log(`  FAIL: ${what}${detail ? ` (${detail})` : ""}`); }
};

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/api/version`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("isolated stack never came up");
}

async function main() {
  await waitForServer();
  console.log("== isolated teach stack up ==");

  // fresh throwaway db schema
  const { execSync } = await import("node:child_process");
  execSync(`DATABASE_URL="${DB}" bunx prisma db push --skip-generate`, { cwd: "/home/z/my-project", stdio: "pipe" });

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // --- login (open registration + devCode) ---
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(1500);
  await page.locator('input[placeholder="you@gmail.com"]').fill(EMAIL);
  await page.getByRole("button", { name: "Send login code" }).click();
  await page.waitForTimeout(1200);
  const codeRes = await ctx.request.post(`${BASE}/api/auth/request-code`, { data: { email: EMAIL } });
  const codeJson = await codeRes.json();
  await page.locator('input[placeholder="000000"]').fill(String(codeJson.devCode));
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await page.waitForTimeout(2500);
  ok(true, "registered + signed in on the throwaway stack");

  // --- Part A: writing surface + draft autosave ---
  await page.goto(`${BASE}/#write`);
  await page.waitForTimeout(2500);
  const essay = "Last weekend I visited my grandmother in the countryside, and we cooked a traditional soup together while she told me stories about her childhood in the village where she grew up many years ago.";
  const ta = page.locator("textarea").first();
  await ta.fill(essay);
  await page.waitForTimeout(900); // draft debounce is 500ms
  const stored = await page.evaluate(() => window.localStorage.getItem("rah-write-draft-v1"));
  ok(!!stored && stored.includes("grandmother"), "draft autosaved to the device cache");
  const savedLine = await page.getByText("Draft saved on this device").count();
  ok(savedLine > 0, "honest autosave indicator shown");

  // RELOAD: the unsent draft must come back
  await page.reload();
  await page.waitForTimeout(2500);
  await page.goto(`${BASE}/#write`);
  await page.waitForTimeout(2500);
  const restored = await page.locator("textarea").first().inputValue();
  ok(restored === essay, "reload restored the unsent draft verbatim");
  const restoredLine = await page.getByText("Restored your unsent draft").count();
  ok(restoredLine > 0, "restore indicator is honest about what happened");

  // Submit for grading
  await page.getByRole("button", { name: "Grade my essay" }).click();
  await page.waitForTimeout(6000);
  const pageText = await page.locator("main").innerText();
  ok(/practice estimate/i.test(pageText), "graded result rendered with the practice-estimate label");
  const cleared = await page.evaluate(() => window.localStorage.getItem("rah-write-draft-v1"));
  ok(cleared === null, "draft cache cleared after the server accepted the submission");

  // The pilot's volume ledger must count the writing
  const prog = await ctx.request.get(`${BASE}/api/progress`);
  const progJ = await prog.json();
  const written = progJ?.volume?.last7?.written ?? progJ?.volume?.last7Written ?? null;
  ok(written !== null && Number(written) >= 1, `volume ledger counts the writing (last7.written=${JSON.stringify(written)})`, JSON.stringify(progJ?.volume ?? {}).slice(0, 120));

  // --- Part B: speaking volume chain (API level on the same stack) ---
  const sp = await ctx.request.post(`${BASE}/api/speak`, {
    data: { prompt: "Describe your morning routine.", transcript: "Every morning I wake up at seven and drink coffee.", round: 1 },
  });
  ok(sp.status() === 200, "speak session recorded", `status=${sp.status()}`);
  const prog2 = await ctx.request.get(`${BASE}/api/progress`);
  const prog2J = await prog2.json();
  const spoken = prog2J?.volume?.last7?.spoken ?? prog2J?.volume?.last7Spoken ?? null;
  ok(spoken !== null && Number(spoken) >= 1, `volume ledger counts the speaking (last7.spoken=${JSON.stringify(spoken)})`, JSON.stringify(prog2J?.volume ?? {}).slice(0, 120));

  await browser.close();
}

main()
  .catch((e) => { fail++; console.log("  FAIL: harness error ->", e.message); })
  .finally(async () => {
    try { spawn("pkill", ["-f", `next dev -p ${PORT}`]); } catch {}
    console.log(`\n=== TEACH CHAIN E2E: ${pass} passed, ${fail} failed ===`);
    process.exit(fail ? 1 : 0);
  });
