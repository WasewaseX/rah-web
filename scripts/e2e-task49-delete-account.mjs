// Task 49 E2E: account deletion in the real browser.
//  1. Synthetic user logs in (top-level).
//  2. Opens the coach sidebar, clicks the trash icon, then "really delete".
//  3. App returns to the login screen; the session is dead server-side.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const email = `e2e-del-${Date.now()}@rah.test`;
const results = [];
function check(ok, what, detail = "") {
  results.push({ ok, what });
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` -> ${detail}`}`);
}

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  // login
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.locator('input[placeholder="you@gmail.com"]').fill(email);
  await page.getByRole("button", { name: "Send login code" }).click();
  await page.waitForTimeout(1200);
  const codeRes = await ctx.request.post(`${BASE}/api/auth/request-code`, { data: { email } });
  const codeJson = await codeRes.json();
  await page.locator('input[placeholder="000000"]').fill(String(codeJson.devCode));
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await page.waitForTimeout(2500);
  const body = await page.locator("main").innerText().catch(() => "");
  check(!body.includes("Send login code"), "logged in", body.slice(0, 60));

  // open the coach sidebar (FAB) and click the delete trash icon
  const fab = page.getByRole("button", { name: /coach|agent/i }).first();
  const fabVisible = (await fab.count()) > 0;
  if (fabVisible) {
    await fab.click();
    await page.waitForTimeout(1200);
  } else {
    // fallback: the sidebar may be open by default on wide screens
  }
  await page.locator('button[title="Delete account - wipes everything for good"]').first().click();
  await page.waitForTimeout(400);
  await page.getByText("really delete").first().click();
  await page.waitForTimeout(2500);
  const after = await page.locator("body").innerText().catch(() => "");
  check(after.includes("Send login code"), "back at the login screen after deletion", after.slice(0, 80));
  const session = await ctx.request.get(`${BASE}/api/auth/session`);
  const sj = await session.json();
  check(sj?.user === null, "session is dead server-side", JSON.stringify(sj));
  await ctx.close();
} catch (e) {
  check(false, "E2E crashed", e instanceof Error ? e.message : String(e));
} finally {
  await browser.close();
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
await prisma.user.deleteMany({ where: { email: { startsWith: "e2e-del-" } } });
await prisma.loginCode.deleteMany({ where: { email: { startsWith: "e2e-del-" } } });
await prisma.$disconnect();
console.log(`\nE2E TASK 49: ${results.filter((r) => r.ok).length}/${results.length} ${results.every((r) => r.ok) ? "ALL PASS" : "FAILURES"}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
