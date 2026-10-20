// Task 59 E2E: real Anki .apkg import in the real browser.
//  1. Build a byte-true .apkg fixture (node:sqlite collection + stored ZIP).
//  2. Login on a throwaway stack, open Reading > Add material > .apkg mode.
//  3. Pick the file, import, expect the honest created-count message.
//  4. The material row + card list render (imported-from source chip).
import { chromium } from "playwright";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const BASE = "http://localhost:3100";
const email = `e2e-apkg-${Date.now()}@rah.test`;
const results = [];
function check(ok, what, detail = "") {
  results.push({ ok, what });
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` -> ${detail}`}`);
}

// ---------- minimal stored-entry ZIP writer (same format as src/lib/apkg.ts) ----------
function crc32(b) {
  let c = ~0;
  for (let i = 0; i < b.length; i++) {
    c ^= b[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function buildZip(entries) {
  const enc = new TextEncoder();
  const locals = [], centrals = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const crc = crc32(e.data);
    const local = new Uint8Array(30 + name.length + e.data.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(8, 0, true);
    dv.setUint32(14, crc, true); dv.setUint32(18, e.data.length, true); dv.setUint32(22, e.data.length, true);
    dv.setUint16(26, name.length, true);
    local.set(name, 30); local.set(e.data, 30 + name.length);
    locals.push(local);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(10, 0, true); cv.setUint32(16, crc, true);
    cv.setUint32(20, e.data.length, true); cv.setUint32(24, e.data.length, true);
    cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);
    offset += local.length;
  }
  const cdSize = centrals.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true); ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + cdSize + 22);
  let pos = 0;
  for (const l of locals) { out.set(l, pos); pos += l.length; }
  for (const c of centrals) { out.set(c, pos); pos += c.length; }
  out.set(eocd, pos);
  return out;
}

// ---------- build the fixture ----------
const dir = mkdtempSync(join(tmpdir(), "e2e-apkg-"));
const dbPath = join(dir, "collection.anki2");
const sq = new DatabaseSync(dbPath);
sq.exec("CREATE TABLE notes (id INTEGER PRIMARY KEY, flds TEXT)");
const ins = sq.prepare("INSERT INTO notes (flds) VALUES (?)");
ins.run("What is the capital of France?\x1fParis");
ins.run("{{c1::heavy rain}} poured all night\x1f");
ins.run("to commit to\x1fto promise fully (a plan, a relationship)");
sq.close();
const apkgPath = join(dir, "fixture.apkg");
writeFileSync(apkgPath, buildZip([
  { name: "collection.anki2", data: new Uint8Array(readFileSync(dbPath)) },
  { name: "media", data: new TextEncoder().encode("{}") },
]));

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

  await page.getByRole("button", { name: "Reading" }).first().click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /Add material/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Anki package (.apkg)" }).click();
  await page.waitForTimeout(300);
  await page.locator('input[type="file"]').setInputFiles(apkgPath);
  await page.getByPlaceholder("Title (e.g. That work email about the deadline)").fill("My Anki deck");
  await page.getByRole("button", { name: "Import the deck" }).click();
  await page.waitForTimeout(8000);
  const success = await page.getByText(/4 cards created|3 cards created/).count();
  check(success > 0, "import succeeds with the honest created-count message");
  const row = await page.getByText("Imported deck (Anki .apkg").count();
  check(row > 0, "the material row shows the apkg source");
  // open the detail: the panel lists card ANSWERS (fronts live in the queue)
  await page.getByText("My Anki deck").first().click();
  await page.waitForTimeout(1500);
  const card1 = await page.getByText("Paris", { exact: true }).count();
  check(card1 > 0, "imported card answer appears in the material detail");
  const cloze = await page.getByText("heavy rain", { exact: true }).count();
  check(cloze > 0, "cloze answer (heavy rain) renders in the card list");
  // the deck enters the review queue
  const queue = await ctx.request.get(`${BASE}/api/review/queue`);
  const qj = await queue.json();
  const entry = (qj.batch ?? []).some((e) => e.card?.prompt === "What is the capital of France?");
  check(entry, "imported card is reachable in the review queue");
} catch (e) {
  check(false, "E2E crashed", String(e).slice(0, 200));
} finally {
  await browser.close();
  rmSync(dir, { recursive: true, force: true });
}
const fails = results.filter((r) => !r.ok).length;
console.log(`\n=== APKG E2E: ${results.length - fails}/${results.length} ===`);
process.exit(fails > 0 ? 1 : 0);
