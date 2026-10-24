/* Diagnostic: what does the Progress tab transition actually do? */
import { chromium, devices } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "en-US" });
if (process.env.RAH_SESSION) {
  const [name, ...rest] = process.env.RAH_SESSION.split("=");
  await ctx.addCookies([{ name: (name || "rah_session").trim(), value: rest.join("="), url: "http://localhost:3000/" }]);
}
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
await page.goto("http://localhost:3000/", { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(2500);

const diag = await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button, a")];
  const matches = btns
    .filter((el) => (el.textContent || "").trim().toLowerCase().startsWith("progress"))
    .map((el) => ({ text: (el.textContent || "").trim().slice(0, 30), visible: Boolean(el.offsetWidth || el.offsetHeight) }));
  return { matches, progressWordCount: (document.body.textContent.toLowerCase().match(/progress/g) || []).length };
});
console.log("MATCHES:", JSON.stringify(diag));

const clicked = await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button, a")];
  const b = btns.find((el) => (el.textContent || "").trim().toLowerCase().startsWith("progress") && (el.offsetWidth || el.offsetHeight));
  if (!b) return false;
  window.__t0 = performance.now();
  b.click();
  return true;
});
console.log("CLICKED VISIBLE:", clicked);
await page.waitForTimeout(3000);
const after = await page.evaluate(() => ({
  activeBtn: [...document.querySelectorAll("nav button")]
    .filter((b) => b.className.includes("9dc0ff"))
    .map((b) => (b.textContent || "").trim().slice(0, 20)),
  res: performance
    .getEntriesByType("resource")
    .filter((r) => r.startTime >= window.__t0)
    .map((r) => ({ url: r.name.split("/").pop().slice(0, 44), bytes: r.transferSize, start: Math.round(r.startTime) })),
}));
console.log("ACTIVE BTN:", JSON.stringify(after.activeBtn));
console.log("NEW RESOURCES:", JSON.stringify(after.res, null, 2));
await browser.close();
