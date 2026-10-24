/*
 * interactivity-probe.mjs - mobile performance round 2 (Task 92-bis, the
 * refined directive: "real user loading time and mobile-device performance").
 *
 * load-metrics.mjs covers FCP/load; this probe covers the NEXT half-second:
 *   1. MAIN-THREAD BLOCKING on the boot screen: PerformanceObserver('longtask')
 *      over a 4s settle window after load - TBT-style total (sum of dur-50ms),
 *      worst task, count.
 *   2. LAZY-TAB TRANSITION: click a lazy (next/dynamic) tab, measure the time
 *      until its content actually renders (throttled: chunk fetch + hydrate).
 *      This is the cost a learner feels opening Progress/Writing/Arcade the
 *      first time on a phone.
 *
 * Same harness class as load-metrics.mjs: iPhone 13 emulation, 4x CPU,
 * 1.6Mbps/150ms. Writes JSON to db/interactivity-<label>.json.
 *
 * Usage: node scripts/interactivity-probe.mjs <label> [url] [tabName]
 */

import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";

const label = process.argv[2] || "run";
const url = process.argv[3] || "http://localhost:3000/";
const TAB = process.argv[4] || "Progress";

async function throttle(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  return cdp;
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "en-US" });
  if (process.env.RAH_SESSION) {
    // Authenticated probe (the lazy tabs live in the daily loop, behind the
    // session gate). RAH_SESSION carries the RAW token; the cookie name must
    // match the app's session cookie.
    const [name, ...rest] = process.env.RAH_SESSION.split("=");
    await ctx.addCookies([
      { name: (name || "rah_session").trim(), value: rest.join("=") || process.env.RAH_SESSION, url },
    ]);
  }
  await ctx.addInitScript(() => {
    window.__rahLongTasks = [];
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__rahLongTasks.push({ dur: Math.round(e.duration), start: Math.round(e.startTime) });
      }).observe({ entryTypes: ["longtask"] });
    } catch {
      /* longtask unsupported - collector stays empty and reports unsupported */
      window.__rahLongTaskUnsupported = true;
    }
  });
  const page = await ctx.newPage();
  await throttle(page);

  await page.goto(url, { waitUntil: "load", timeout: 60000 });

  // 1. boot-screen blocking: settle window after load
  await page.waitForTimeout(4000);
  const blocking = await page.evaluate(() => {
    const tasks = window.__rahLongTasks || [];
    const supported = !window.__rahLongTaskUnsupported;
    const tbt = tasks.reduce((a, t) => a + Math.max(0, t.dur - 50), 0);
    const worst = tasks.reduce((a, t) => Math.max(a, t.dur), 0);
    return { supported, count: tasks.length, tbt, worst, tasks: tasks.slice(0, 10) };
  });

  // 2. lazy-tab transition (first open = chunk fetch + data + render, throttled)
  //    Real learner-perceived cost: click -> the tab is ACTIVE and the view's
  //    content has settled (DOM text stops growing after the chunk + its data
  //    fetches land). Pre-existing tab-name text on the boot view makes naive
  //    text matching lie (measured: Home already contains "Progress" x4).
  //    First wait for the shell to be interactive at all (a freshly booted
  //    standalone server + 4x CPU can hydrate past the settle window).
  await page.waitForFunction(
    () => [...document.querySelectorAll("button, a")].some((el) => el.offsetWidth || el.offsetHeight),
    { timeout: 45000, polling: 200 },
  );
  const clicked = await page.evaluate((tab) => {
    const btns = [...document.querySelectorAll("button, a")];
    const b = btns.find(
      (el) => (el.textContent || "").trim().toLowerCase().startsWith(String(tab).toLowerCase()) && (el.offsetWidth || el.offsetHeight),
    );
    if (!b) return null;
    window.__rahTabT0 = performance.now();
    b.click();
    return true;
  }, TAB);
  if (!clicked) {
    const tabs = await page.evaluate(() => [...document.querySelectorAll("button, a")].map((el) => (el.textContent || "").trim().slice(0, 24)).filter(Boolean).slice(0, 30));
    console.error(`interactivity-probe: tab "${TAB}" not found. Visible buttons/links: ${JSON.stringify(tabs)}`);
    await browser.close();
    process.exit(1);
  }
  // content-settle wait: the tab's nav button is ACTIVE, AND (a) no new
  // network entry for 800ms (the view's data fetches all landed) AND (b) page
  // text stable for 600ms (render settled). Bounded 45s; on timeout, dump
  // diagnostics instead of failing blind.
  let settled = true;
  try {
    await page.waitForFunction(
      (tab) => {
        const t = String(tab).toLowerCase();
        const active = [...document.querySelectorAll("nav button")].some(
          (b) => (b.textContent || "").trim().toLowerCase().startsWith(t) && b.className.includes("9dc0ff"),
        );
        if (!active) return false;
        const w = window;
        const now = performance.now();
        const resCount = performance.getEntriesByType("resource").length;
        const len = (document.body.innerText || "").length;
        const resQuiet = w.__rahResAt === undefined || now - w.__rahResAt >= 800 || resCount === w.__rahResCount;
        if (resCount !== w.__rahResCount) {
          w.__rahResCount = resCount;
          w.__rahResAt = now;
        }
        const textQuiet = w.__rahTextAt === undefined || now - w.__rahTextAt >= 600 || Math.abs(len - (w.__rahTextLen ?? len)) < 24;
        if (w.__rahTextLen === undefined || Math.abs(len - w.__rahTextLen) >= 24) {
          w.__rahTextLen = len;
          w.__rahTextAt = now;
        }
        return resQuiet && textQuiet;
      },
      TAB,
      { timeout: 45000, polling: 50 },
    );
  } catch {
    settled = false;
  }
  const diag = await page.evaluate(() => ({
    activeBtns: [...document.querySelectorAll("nav button")]
      .filter((b) => b.className.includes("9dc0ff"))
      .map((b) => (b.textContent || "").trim().slice(0, 20)),
    textLen: (document.body.innerText || "").length,
    lastRes: performance
      .getEntriesByType("resource")
      .slice(-6)
      .map((r) => r.name.split("/").pop().slice(0, 40)),
  }));
  if (!settled) {
    console.error("interactivity-probe: view content did not settle in 45s. DIAG:", JSON.stringify(diag));
    await browser.close();
    process.exit(1);
  }
  void diag;
  const tabMs = await page.evaluate(() => Math.round(performance.now() - window.__rahTabT0));
  const chunks = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((r) => r.name.includes("_next/static/chunks") && r.startTime >= window.__rahTabT0)
      .map((r) => ({ url: r.name.split("/").pop(), bytes: r.transferSize, ms: Math.round(r.responseEnd - window.__rahTabT0) })),
  );
  const chunkBytes = chunks.reduce((a, c) => a + (c.bytes || 0), 0);
  const firstChunkMs = chunks.length ? Math.min(...chunks.map((c) => c.ms)) : null;

  const out = {
    label,
    url,
    tab: TAB,
    harness: { device: "iPhone 13", cpuThrottle: "4x", net: "1.6Mbps/150ms RTT" },
    at: new Date().toISOString(),
    bootBlocking: blocking,
    lazyTabSettleMs: tabMs,
    lazyFirstChunkMs: firstChunkMs,
    lazyChunkBytes: chunkBytes,
    lazyChunks: chunks,
  };
  const dest = path.join("db", `interactivity-${label}.json`);
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log("=== INTERACTIVITY SUMMARY ===");
  console.log(JSON.stringify(out, null, 2));
  console.log("saved:", dest);
  await browser.close();
}

main().catch((e) => {
  console.error("interactivity-probe FAILED:", e.message);
  process.exit(1);
});
