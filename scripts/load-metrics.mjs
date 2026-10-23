/*
 * load-metrics.mjs - REAL user loading measurement (Task 92, review ask:
 * "real user loading time and mobile-device performance, not bundle size alone").
 *
 * Harness: Playwright chromium, mobile device emulation (iPhone 13 class),
 * CDP CPU throttling 4x + Fast-3G-class network shaping (1.6Mbps down / 750Kbps up / 150ms RTT).
 * Measures navigation timing + paint + transferred bytes on:
 *   - COLD: fresh browser context (empty cache, no SW) x N
 *   - WARM: same context revisits (service worker active) x N
 * Prints a median summary and writes JSON to db/load-metrics-<label>.json
 * so before/after optimization runs are comparable on the identical harness.
 *
 * Usage: node scripts/load-metrics.mjs <label> [url]
 */

import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";

const label = process.argv[2] || "run";
const url = process.argv[3] || "http://localhost:3000/";
const COLD_RUNS = 3;
const WARM_RUNS = 3;

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

async function measure(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const nav = performance.getEntriesByType("navigation")[0];
        const paint = performance.getEntriesByType("paint").find((p) => p.name === "first-contentful-paint");
        const res = performance.getEntriesByType("resource");
        const js = res.filter((r) => r.name.endsWith(".js") || r.name.includes("/_next/static/chunks"));
        const done = () => {
          const nav2 = performance.getEntriesByType("navigation")[0];
          const paint2 = performance.getEntriesByType("paint").find((p) => p.name === "first-contentful-paint");
          const res2 = performance.getEntriesByType("resource");
          const js2 = res2.filter((r) => r.name.includes("_next/static"));
          resolve({
            ttfb: Math.round(nav2.responseStart),
            fcp: paint2 ? Math.round(paint2.startTime) : null,
            dcl: Math.round(nav2.domContentLoadedEventEnd),
            load: Math.round(nav2.loadEventEnd > 0 ? nav2.loadEventEnd : performance.now()),
            jsBytes: js2.reduce((a, r) => a + (r.transferSize || 0), 0),
            totalBytes:
              (nav2.transferSize || 0) + res2.reduce((a, r) => a + (r.transferSize || 0), 0),
            requests: res2.length + 1,
          });
        };
        // wait until load event + a settle window so lazy beacons settle
        if (document.readyState === "complete") setTimeout(done, 1200);
        else window.addEventListener("load", () => setTimeout(done, 1200));
      })
  );
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    ...devices["iPhone 13"],
    locale: "en-US",
  });
  // Mobile-realistic throttling via CDP (chromium only)
  const page = await ctx.newPage();
  const cdp2 = await ctx.newCDPSession(page);
  await cdp2.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp2.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });

  const cold = [];
  const warm = [];

  // COLD: first navigation in this fresh context (cache empty, SW installing during load)
  for (let i = 0; i < COLD_RUNS; i++) {
    const c = i === 0 ? ctx : await browser.newContext({ ...devices["iPhone 13"], locale: "en-US" });
    const p = i === 0 ? page : await c.newPage();
    const cd = await c.newCDPSession(p);
    await cd.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cd.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    await p.goto(url, { waitUntil: "load", timeout: 60000 });
    const m = await measure(p);
    cold.push(m);
    if (i > 0) await c.close();
    console.log(`cold#${i + 1}`, JSON.stringify(m));
  }

  // WARM: revisit in the original context (SW + HTTP cache active)
  for (let i = 0; i < WARM_RUNS; i++) {
    await page.reload({ waitUntil: "load", timeout: 60000 });
    const m = await measure(page);
    warm.push(m);
    console.log(`warm#${i + 1}`, JSON.stringify(m));
  }

  const summary = (runs) => ({
    ttfb: median(runs.map((r) => r.ttfb)),
    fcp: median(runs.map((r) => r.fcp)),
    dcl: median(runs.map((r) => r.dcl)),
    load: median(runs.map((r) => r.load)),
    jsBytes: median(runs.map((r) => r.jsBytes)),
    totalBytes: median(runs.map((r) => r.totalBytes)),
    requests: median(runs.map((r) => r.requests)),
  });

  const out = {
    label,
    url,
    harness: { device: "iPhone 13", cpuThrottle: "4x", net: "1.6Mbps/150ms RTT" },
    at: new Date().toISOString(),
    cold: { runs: cold, summary: summary(cold) },
    warm: { runs: warm, summary: summary(warm) },
  };

  const dest = path.join("db", `load-metrics-${label}.json`);
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log("=== SUMMARY (median) ===");
  console.log("COLD:", JSON.stringify(summary(cold)));
  console.log("WARM:", JSON.stringify(summary(warm)));
  console.log("saved:", dest);
  await browser.close();
}

run().catch((e) => {
  console.error("load-metrics FAILED:", e.message);
  process.exit(1);
});
