// Task 46 E2E: auth hardening in the real browser.
//  A. Normal (top-level) login: httpOnly cookie only - NO rah_token anywhere
//     in JS storage (localStorage AND sessionStorage empty of tokens).
//  B. Embedded (iframe) login: x-rah-embed flows, token lands in
//     sessionStorage ONLY (never localStorage), API calls work cookie-less.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const emailA = `e2e-auth-a-${Date.now()}@rah.test`;
const emailB = `e2e-auth-b-${Date.now()}@rah.test`;
const results = [];
function check(ok, what, detail = "") {
  results.push({ ok, what });
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` -> ${detail}`}`);
}

async function loginInPage(page, ctx, email) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.locator('input[placeholder="you@gmail.com"]').fill(email);
  await page.getByRole("button", { name: "Send login code" }).click();
  await page.waitForTimeout(1200);
  const codeRes = await ctx.request.post(`${BASE}/api/auth/request-code`, { data: { email } });
  const codeJson = await codeRes.json();
  await page.locator('input[placeholder="000000"]').fill(String(codeJson.devCode));
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await page.waitForTimeout(2500);
}

const browser = await chromium.launch();
try {
  // ---------- A. normal top-level login ----------
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await loginInPage(pageA, ctxA, emailA);
  const bodyText = await pageA.locator("main").innerText().catch(() => "");
  check(bodyText.length > 100 && !bodyText.includes("Send login code"), "A: dashboard rendered after normal login", bodyText.slice(0, 80));
  const storageA = await pageA.evaluate(() => ({
    local: localStorage.getItem("rah_token"),
    session: sessionStorage.getItem("rah_token"),
  }));
  check(storageA.local === null && storageA.session === null, "A: NO JS-readable token in localStorage or sessionStorage", JSON.stringify(storageA));
  // API access works via the httpOnly cookie alone
  const apiA = await pageA.evaluate(async () => {
    const r = await fetch("/api/auth/session");
    return { status: r.status, body: await r.json() };
  });
  check(apiA.status === 200 && apiA.body?.user?.email === emailA, "A: session resolves from the httpOnly cookie alone", JSON.stringify(apiA.body).slice(0, 100));
  await ctxA.close();

  // ---------- B. embedded (iframe) login ----------
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  // Wrapper page with a same-origin iframe: window.self !== window.top inside.
  // setContent keeps the wrapper static (no React to detach the frame).
  await pageB.setContent(`<!doctype html><html><body style="margin:0"><iframe id="f" src="${BASE}/" style="width:1280px;height:900px;border:0"></iframe></body></html>`, { waitUntil: "domcontentloaded" });
  await pageB.waitForTimeout(3000);
  // ALL interaction via frameLocator: it re-resolves the frame on every call
  // (cached contentFrame handles go stale when the app re-renders).
  const fLoc = pageB.frameLocator("#f");
  await fLoc.locator('input[placeholder="you@gmail.com"]').fill(emailB);
  await fLoc.getByRole("button", { name: "Send login code" }).click();
  await pageB.waitForTimeout(1500);
  const codeResB = await ctxB.request.post(`${BASE}/api/auth/request-code`, { data: { email: emailB } });
  const codeB = await codeResB.json();
  await fLoc.locator('input[placeholder="000000"]').fill(String(codeB.devCode));
  await fLoc.getByRole("button", { name: "Verify and sign in" }).click();
  await pageB.waitForTimeout(2500);
  const storageB = await fLoc.locator("body").evaluate((el) => {
    const w = el.ownerDocument.defaultView;
    return {
      local: w.localStorage.getItem("rah_token"),
      session: w.sessionStorage.getItem("rah_token"),
      embedded: w.self !== w.top,
    };
  });
  check(storageB.embedded === true, "B: iframe context detected (x-rah-embed active)", JSON.stringify(storageB));
  check(storageB.session !== null && storageB.session.length >= 32, "B: token in sessionStorage (fallback engaged)", `len=${storageB.session?.length ?? 0}`);
  check(storageB.local === null, "B: token NEVER in localStorage", String(storageB.local));
  const bodyTextB = await fLoc.locator("main").innerText().catch(() => "");
  check(bodyTextB.length > 100 && !bodyTextB.includes("Send login code"), "B: dashboard rendered inside the iframe", bodyTextB.slice(0, 80));
  const apiB = await fLoc.locator("body").evaluate(async (el) => {
    const r = await el.ownerDocument.defaultView.fetch("/api/auth/session");
    return { status: r.status, body: await r.json() };
  });
  check(apiB.status === 200 && apiB.body?.user?.email === emailB, "B: session resolves inside the iframe (cookie or header ladder)", JSON.stringify(apiB.body).slice(0, 100));
  await ctxB.close();
} catch (e) {
  check(false, "E2E crashed", e instanceof Error ? e.message : String(e));
} finally {
  await browser.close();
}

// cleanup both e2e users + their codes
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
await prisma.user.deleteMany({ where: { email: { startsWith: "e2e-auth-" } } });
await prisma.loginCode.deleteMany({ where: { email: { startsWith: "e2e-auth-" } } });
await prisma.$disconnect();
console.log(`\nE2E TASK 46: ${results.filter((r) => r.ok).length}/${results.length} ${results.every((r) => r.ok) ? "ALL PASS" : "FAILURES"}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
