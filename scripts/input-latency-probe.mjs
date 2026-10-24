// Task 94: mobile INPUT-responsiveness probe (the next measurement after
// FCP/interactivity - the review's "real user loading time and mobile-device
// performance" directive, third round).
//
// What it measures (iPhone 13 emulation, 4x CPU throttle, throttled network):
//  1. REVIEW ANSWER TAP -> visual response (the app's highest-frequency
//     interaction; the grade button must react instantly).
//  2. WRITING KEYSTROKE -> mirrored underline layer update (the per-keystroke
//     path Task 89 optimized; regressions here feel like a laggy editor).
//  3. COACH SEND -> first streamed reply byte (AI surfaces may take seconds
//     TOTAL, but the first feedback must arrive fast).
//
// Method: performance.now() around a real tap/keystroke, awaiting the DOM
// mutation that IS the visual response (MutationObserver). Honest scope: a
// test-harness number on a throttled desktop Chrome, not a claim about every
// user's device.
//
// Run: bash scripts/run-input-probe.sh  (mints a one-shot session, cleans up)
import { chromium, devices } from "playwright";
import fs from "node:fs";

const label = process.argv[2] || "run";
const url = process.argv[3] || "http://localhost:3000/";
const COOKIE = process.env.RAH_SESSION || "";
if (!COOKIE) { console.error("RAH_SESSION required (run via scripts/run-input-probe.sh)"); process.exit(1); }

const iphone = devices["iPhone 13"];

async function withPage(browser, fn) {
  const ctx = await browser.newContext({ ...iphone, locale: "en-US" });
  const page = await ctx.newPage();
  await ctx.addCookies([{ name: "rah_session", value: COOKIE.split("=")[1], url }]);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.emulateNetworkConditions", { offline: false, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8, latency: 150 });
  try { await fn(page); } finally { await ctx.close(); }
}

const results = {};

const browser = await chromium.launch();

// --- 1. review answer tap -> visual response -------------------------------
await withPage(browser, async (page) => {
  await page.goto(url + "#review", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const btn = page.locator("button", { hasText: /^GOOD/ }).first();
  const visible = await btn.isVisible().catch(() => false);
  if (!visible) {
    // Honest fallback: the live queue deals TYPED cards (meaning check) - the
    // real interaction is fill -> tap "Check". Measure THAT tap; if no Check
    // button either, record the pane state instead of inventing a number.
    const paneText = (await page.locator("main").innerText().catch(() => "")).slice(0, 200);
    results.reviewNote = "typed-card flow at probe time - pane: " + paneText.replace(/\n/g, " | ");
    const inp = page.locator('input[placeholder="Type your answer"]').first();
    if (await inp.isVisible().catch(() => false)) await inp.fill("zz");
    const check = page.getByRole("button", { name: "Check", exact: true }).first();
    if (!(await check.isVisible().catch(() => false))) { results.reviewTapMs = -4; return; }
    results.reviewTapMs = await page.evaluate(() => new Promise((resolve) => {
      const t0 = performance.now();
      const target = [...document.querySelectorAll("main button")].find((b) => (b.textContent || "").trim() === "Check");
      if (!target) return resolve(-1);
      const before = document.body.innerText.length;
      const mo = new MutationObserver(() => {
        if (document.body.innerText.length !== before) { mo.disconnect(); resolve(Math.round(performance.now() - t0)); }
      });
      mo.observe(document.body, { subtree: true, childList: true, characterData: true });
      target.click();
      setTimeout(() => { mo.disconnect(); resolve(-2); }, 10000);
    }));
    return;
  }
  results.reviewTapMs = await page.evaluate(() => new Promise((resolve) => {
    const t0 = performance.now();
    const btns = [...document.querySelectorAll("button")];
    const target = btns.find((b) => /^GOOD/.test((b.textContent || "").trim()));
    if (!target) return resolve(-1);
    const before = target.className + "|" + document.body.innerText.length;
    const mo = new MutationObserver(() => {
      const now = target.className + "|" + document.body.innerText.length;
      if (now !== before) { mo.disconnect(); resolve(Math.round(performance.now() - t0)); }
    });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    target.click();
    setTimeout(() => { mo.disconnect(); resolve(-2); }, 10000);
  }));
});

// --- 2. writing keystroke -> underline-layer update -------------------------
await withPage(browser, async (page) => {
  await page.goto(url + "#write", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const ta = page.locator("textarea").first();
  await ta.waitFor({ state: "visible", timeout: 20000 });
  results.keystrokeMs = await page.evaluate(() => new Promise((resolve) => {
    const t0 = performance.now();
    const taEl = document.querySelector("textarea");
    if (!taEl) return resolve(-1);
    const before = document.body.innerHTML.length;
    const mo = new MutationObserver(() => {
      if (document.body.innerHTML.length !== before) { mo.disconnect(); resolve(Math.round(performance.now() - t0)); }
    });
    mo.observe(document.body, { subtree: true, childList: true, characterData: true });
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(taEl, "Today I want to talk about my hometown and why it matters to me so much.");
    taEl.dispatchEvent(new Event("input", { bubbles: true }));
    setTimeout(() => { mo.disconnect(); resolve(-2); }, 10000);
  }));
});

// --- 3. coach send -> first streamed byte -----------------------------------
await withPage(browser, async (page) => {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  results.coachFirstByteMs = await page.evaluate(async () => {
    const t0 = performance.now();
    try {
      const res = await fetch("/api/coach-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Give me one quick tip for today." }),
      });
      if (!res.body) return -1;
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.length > 0) return Math.round(performance.now() - t0);
      }
      return -2;
    } catch { return -3; }
  });
});

await browser.close();

results.harness = { device: "iPhone 13 emulation", cpu: "4x throttle", network: "1.6Mbps/150ms", at: new Date().toISOString(), label };
fs.writeFileSync(`db/input-latency-${label}.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
