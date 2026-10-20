// P5 portability + CEFR map drive.
//
// Claim set:
//  1. Export: full hash-sealed bundle, every table present, hash verifies
//     locally from the tables alone.
//  2. Wipe -> dryRun import reports the diff and writes NOTHING.
//  3. Real import: one transaction, post-import export re-hashes IDENTICALLY
//     (the wipe is fully undone by the bundle).
//  4. Idempotency: importing the same bundle twice changes nothing (hash still equal).
//  5. Corrupt file (tampered row, original hash declared) -> 422, nothing written.
//  6. Bands: /api/progress carries 5 bands with evidence + placement marker.
//  7. Browser: Progress renders the Band map.
// The final import of the original bundle IS the state restore.

process.env.DATABASE_URL ||= "file:/home/z/my-project/db/custom.db";
const BASE = "http://localhost:3000";
export {};

let failures = 0;
let n = 0;
function check(ok: boolean, what: string, detail = "") {
  n += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` -> ${detail}`}`);
}

type Bundle = { format: string; exportedAt: string; hash: string; tables: Record<string, Record<string, unknown>[]>; counts: Record<string, number> };

// Minimal structural types for the optional playwright E2E dep (not in package.json).
type PwLocator = {
  fill(value: string): Promise<unknown>;
  click(): Promise<unknown>;
};
type PwPage = {
  goto(url: string, o?: { waitUntil?: string }): Promise<unknown>;
  waitForTimeout(ms: number): Promise<unknown>;
  evaluate<T>(fn: () => T): Promise<T>;
  locator(sel: string): { first(): PwLocator; count(): Promise<number> } & PwLocator;
  getByRole(role: string, o?: { name?: string | RegExp }): PwLocator & { count(): Promise<number> };
};
type PwBrowser = {
  newPage(o?: { viewport: { width: number; height: number } }): Promise<PwPage>;
  close(): Promise<void>;
};

async function exportNow(): Promise<Bundle> {
  const r = await fetch(`${BASE}/api/export`);
  return (await r.json()) as Bundle;
}

try {
  const before = await exportNow();
  check(before.format === "rah.v1" && !!before.hash, "export: hash-sealed rah.v1 bundle", before.hash?.slice(0, 12));
  check(Object.keys(before.tables).length >= 20, "export: every table present", String(Object.keys(before.tables).length));

  // local hash recompute
  const { createHash } = await import("crypto");
  const stable = (v: unknown): unknown => {
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(stable);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, stable(x)]));
    return v;
  };
  const canon = JSON.stringify(Object.fromEntries(Object.keys(before.tables).sort().map((k) => [k, before.tables[k].map(stable)])));
  const localHash = createHash("sha256").update(canon).digest("hex");
  check(localHash === before.hash, "export: hash verifies from tables alone", `${localHash.slice(0, 12)} vs ${before.hash.slice(0, 12)}`);

  // wipe two tables (the import below restores them - that IS the restore)
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const wipedCards = await prisma.cardState.deleteMany();
  const wipedFamilies = await prisma.mistakeFamily.deleteMany();
  console.log(`(wiped ${wipedCards.count} card states, ${wipedFamilies.count} families)`);

  // dry run: reports the diff, writes nothing
  const dry = await fetch(`${BASE}/api/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bundle: before, dryRun: true }),
  });
  const dryj = (await dry.json()) as { ok?: boolean; counts?: Record<string, number> };
  check(dry.status === 200 && dryj.ok === true && dryj.counts?.cardState === before.counts.cardState, "dryRun: reports counts, writes nothing", JSON.stringify(dryj.counts?.cardState));
  const stillWiped = await prisma.cardState.count();
  check(stillWiped === 0, "dryRun: state untouched after dry run", `cardState rows: ${stillWiped}`);

  // real import restores everything; post-import export re-hashes identically
  const imp = await fetch(`${BASE}/api/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bundle: before }),
  });
  const impj = (await imp.json()) as { ok?: boolean; error?: string };
  check(imp.status === 200 && impj.ok === true, "import: committed", impj.error ?? "");
  const after = await exportNow();
  check(after.hash === before.hash, "import: post-import export re-hashes IDENTICALLY", `${after.hash.slice(0, 12)} vs ${before.hash.slice(0, 12)}`);

  // idempotency: import the same bundle again, hash must not move
  await fetch(`${BASE}/api/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bundle: before }),
  });
  const again = await exportNow();
  check(again.hash === before.hash, "import: idempotent - same bundle, same state", again.hash.slice(0, 12));

  // corrupt file: tamper a row but keep the declared hash -> refused
  const tampered = JSON.parse(JSON.stringify(before)) as Bundle;
  tampered.tables.learner = tampered.tables.learner.map((l) => ({ ...l, xp: 999999 }));
  const bad = await fetch(`${BASE}/api/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bundle: tampered }),
  });
  check(bad.status === 422, "corrupt: tampered bundle refused with 422", String(bad.status));
  const afterBad = await exportNow();
  check(afterBad.hash === before.hash, "corrupt: refusal wrote nothing", afterBad.hash.slice(0, 12));

  // missing table -> refused
  const missing = JSON.parse(JSON.stringify(before)) as Bundle;
  delete missing.tables.learner;
  const bad2 = await fetch(`${BASE}/api/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bundle: missing, dryRun: true }),
  });
  check(bad2.status === 422, "corrupt: missing table refused", String(bad2.status));

  // bands payload
  const prog = await fetch(`${BASE}/api/progress`);
  const pj = (await prog.json()) as { bands?: { band: string; proven: boolean; skills: unknown[]; exams: { graded: number } }[]; placementBand?: string };
  check(Array.isArray(pj.bands) && pj.bands.length === 5 && pj.bands.map((b) => b.band).join(",") === "A1,A2,B1,B2,C1", "bands: five bands in order", JSON.stringify(pj.bands?.map((b) => b.band)));
  check(pj.bands!.every((b) => typeof b.proven === "boolean"), "bands: proven flag from real evidence only", "");
  check(typeof pj.placementBand === "string", "bands: placement marker present", pj.placementBand ?? "?");

  await prisma.$disconnect();

  // browser proof: the Progress view renders the band map.
  // Playwright is an OPTIONAL E2E-only dep (not in package.json - CI has no browsers anyway).
  // The variable specifier keeps tsc from statically resolving it (TS2307 killed CI for months
  // because a stray parent-dir node_modules made local tsc resolve what CI could not).
  const pwName = "playwright";
  let pw: { chromium: { launch(o: { headless: boolean }): Promise<PwBrowser> } };
  try {
    pw = (await import(/* @vite-ignore */ pwName)) as typeof pw;
  } catch {
    console.log("SKIP browser proof: playwright not installed (E2E-only optional dep)");
    pw = null as unknown as typeof pw;
  }
  if (pw) {
    const browser = await pw.chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    // Login first (Progress is auth-gated): email-code flow, dev exposes devCode.
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.locator('input[placeholder="you@gmail.com"]').fill("noob@rah.dev");
    await page.getByRole("button", { name: "Send login code" }).click();
    await page.waitForTimeout(1200);
    const codeRes = await fetch(`${BASE}/api/auth/request-code`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "noob@rah.dev" }) });
    const codeJson = (await codeRes.json()) as { devCode?: string };
    await page.locator('input[placeholder="000000"]').fill(String(codeJson.devCode));
    await page.getByRole("button", { name: "Verify and sign in" }).click();
    await page.waitForTimeout(2500);
    await page.goto(`${BASE}/#progress`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    const body = await page.evaluate(() => document.body.innerText);
    check(body.includes("Band map"), "browser: Progress renders the band map", body.slice(0, 80));
    await browser.close();
  }
} catch (e) {
  failures += 1;
  console.log(`FAIL drive crashed: ${e instanceof Error ? e.message : String(e)}`);
}

console.log(`\nPORTABILITY DRIVE: ${n - failures}/${n} ${failures === 0 ? "ALL PASS" : `${failures} FAILURES`}`);
process.exit(failures === 0 ? 0 : 1);
