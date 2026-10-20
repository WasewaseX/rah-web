// Task 58 E2E: the CEFR curriculum map in the real browser.
//  1. Fresh throwaway stack (:3100, fresh db) - register a learner.
//  2. Open the Progress tab: the "Curriculum map" card renders.
//  3. The graph spans B2/B2+/C1, statuses render, frontier is marked.
//  4. Gates show honest evidence lines, C1 shows locked with prerequisites.
import { chromium } from "playwright";

const BASE = "http://localhost:3100";
const email = `e2e-cur-${Date.now()}@rah.test`;
const results = [];
function check(ok, what, detail = "") {
  results.push({ ok, what });
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` -> ${detail}`}`);
}

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.locator('input[placeholder="you@gmail.com"]').fill(email);
  await page.getByRole("button", { name: "Send login code" }).click();
  await page.waitForTimeout(1200);
  const codeRes = await ctx.request.post(`${BASE}/api/auth/request-code`, { data: { email } });
  const codeJson = await codeRes.json();
  await page.locator('input[placeholder="000000"]').fill(String(codeJson.devCode));
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await page.waitForTimeout(2500);

  // The map data straight from the API (ground truth for the UI pins)
  const cur = await ctx.request.get(`${BASE}/api/curriculum`);
  const curJson = await cur.json();
  check(cur.status() === 200 && Array.isArray(curJson.nodes) && curJson.nodes.length >= 16, "API serves the full curriculum graph", `nodes=${curJson.nodes?.length}`);

  // Open the Progress tab
  await page.getByRole("button", { name: "Progress" }).first().click();
  await page.waitForTimeout(2000);
  const card = await page.getByText("Curriculum map").count();
  check(card > 0, "Progress tab shows the Curriculum map card");

  const provenChip = await page.getByText(/gates proven/).count();
  check(provenChip > 0, "the proven-gates counter chip renders");
  const b2Group = await page.getByText("B2 - close the interference core").count();
  const b2pGroup = await page.getByText("B2+ - integrate it").count();
  const c1Group = await page.getByText("C1 - precision").count();
  check(b2Group > 0 && b2pGroup > 0 && c1Group > 0, "all three band groups render");

  const nextGate = await page.getByText("next gate").count();
  check(nextGate > 0, "the frontier node carries the next-gate marker");
  const openChips = await page.getByText("open", { exact: true }).count();
  check(openChips > 0, "open gates are visible for a fresh learner", `open chips=${openChips}`);
  const lockedChips = await page.getByText("locked", { exact: true }).count();
  check(lockedChips > 0, "locked C1 nodes show the locked chip", `locked chips=${lockedChips}`);
  const prereqLine = await page.getByText(/Opens when proven:/).count();
  check(prereqLine > 0, "locked nodes name their prerequisite");
  const evidence = await page.getByText(/70% proven/).count();
  check(evidence > 0, "gate evidence lines show the honest threshold (fresh: need 8+ at 70%)", `evidence lines=${evidence}`);
  const line = curJson.summary?.line ?? "";
  check(line.includes("Next gate"), "summary line names the next gate", line.slice(0, 80));
} catch (e) {
  check(false, "E2E crashed", String(e).slice(0, 200));
} finally {
  await browser.close();
}
const fails = results.filter((r) => !r.ok).length;
console.log(`\n=== CURRICULUM E2E: ${results.length - fails}/${results.length} ===`);
process.exit(fails > 0 ? 1 : 0);
