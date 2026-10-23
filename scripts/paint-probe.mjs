/*
 * paint-probe.mjs - WHY is FCP late? Load the prod shell, sample visible
 * content + screenshots during boot, and dump paint entries.
 */
import { chromium, devices } from "playwright";
import fs from "node:fs";

const url = process.argv[2] || "http://localhost:3000/";
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await cdp.send("Network.emulateNetworkConditions", {
  offline: false, latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
});

const t0 = Date.now();
await page.goto(url, { waitUntil: "commit", timeout: 60000 });

for (const at of [500, 1000, 1500, 2200, 3000]) {
  const wait = at - (Date.now() - t0);
  if (wait > 0) await page.waitForTimeout(wait);
  const state = await page.evaluate(() => {
    const spin = document.querySelector(".animate-spin");
    const r = spin?.getBoundingClientRect();
    const cs = spin ? getComputedStyle(spin) : null;
    return {
      readyState: document.readyState,
      spinnerInDom: !!spin,
      spinnerRect: r ? { w: r.width, h: r.height, x: Math.round(r.x), y: Math.round(r.y) } : null,
      spinnerVisible: cs ? cs.visibility + "/d=" + cs.display + "/op=" + cs.opacity : null,
      bodyChildren: document.body ? document.body.children.length : -1,
      bodyText: document.body ? document.body.innerText.slice(0, 60) : null,
    };
  }).catch((e) => ({ err: e.message }));
  console.log(`@${at}ms`, JSON.stringify(state));
  await page.screenshot({ path: `download/probe-${at}.png` }).catch(() => {});
}

const paints = await page.evaluate(() => ({
  fcp: performance.getEntriesByType("paint").map((p) => ({ name: p.name, t: Math.round(p.startTime) })),
  lcp: performance.getEntriesByType("largest-contentful-paint").map((p) => ({ t: Math.round(p.startTime), el: p.element?.tagName, size: Math.round(p.size) })),
  nav: performance.getEntriesByType("navigation").map((n) => ({ resp: Math.round(n.responseStart), dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) })),
  css: performance.getEntriesByType("resource").filter((r) => r.name.includes(".css")).map((r) => ({ start: Math.round(r.startTime), end: Math.round(r.responseEnd), size: r.transferSize })),
}));
console.log("PAINTS:", JSON.stringify(paints, null, 1));
await browser.close();
