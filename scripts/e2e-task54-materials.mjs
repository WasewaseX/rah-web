// Task 54 E2E: BYO materials in the real browser.
//  1. Log in, open the Reading tab - "Your materials" panel is there.
//  2. Paste a real paragraph, extract - success message with the card count.
//  3. The material row shows cards; the detail view shows source sentences.
//  4. A mat card shows up in the review queue surface (state check via API).
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const email = `e2e-mat-${Date.now()}@rah.test`;
const results = [];
function check(ok, what, detail = "") {
  results.push({ ok, what });
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` -> ${detail}`}`);
}

const MATERIAL_TEXT = `Solar power has become one of the fastest-growing sources of electricity in the world. Engineers have made significant breakthroughs in battery storage, which addresses the intermittency problem that has long plagued renewable energy. The cost of solar panels has dropped dramatically over the past decade, making them competitive with fossil fuels in most markets. However, experts warn that governments must invest in grid infrastructure to fully harness this potential.`;

const browser = await chromium.launch();
let materialId = null;
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  // login (email-code, dev exposes devCode)
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.locator('input[placeholder="you@gmail.com"]').fill(email);
  await page.getByRole("button", { name: "Send login code" }).click();
  await page.waitForTimeout(1200);
  const codeRes = await ctx.request.post(`${BASE}/api/auth/request-code`, { data: { email } });
  const codeJson = await codeRes.json();
  await page.locator('input[placeholder="000000"]').fill(String(codeJson.devCode));
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await page.waitForTimeout(2500);

  // open the Reading tab
  await page.getByRole("button", { name: "Reading" }).first().click();
  await page.waitForTimeout(1200);
  const panel = await page.getByText("Your materials").count();
  check(panel > 0, "Reading tab shows the Your materials panel");

  // open the form and import
  await page.getByRole("button", { name: /Add material/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByPlaceholder("Title (e.g. That work email about the deadline)").fill("Solar article");
  await page.getByPlaceholder("Where it is from (optional - URL, book, course...)").fill("e2e test");
  await page.getByPlaceholder("Paste the text here (a few paragraphs is ideal)...").fill(MATERIAL_TEXT);
  await page.getByRole("button", { name: /Extract and add to review/ }).first().click();
  await page.waitForTimeout(30000); // AI extraction
  const successMsg = await page.getByText(/card.*created from your text/).count();
  check(successMsg > 0, "extraction succeeded with an honest card-count message");

  const listRes = await ctx.request.get(`${BASE}/api/materials`);
  const listJson = await listRes.json();
  const mat = (listJson.materials ?? []).find((m) => m.title === "Solar article");
  check(!!mat && mat.cards >= 4, "material row exists with cards", JSON.stringify(listJson.materials ?? []).slice(0, 120));
  materialId = mat?.id ?? null;

  // open the detail: source sentences visible
  if (mat) {
    const row = page.locator("div", { has: page.getByText("Solar article") }).last();
    await row.click();
    await page.waitForTimeout(1200);
    const contextVisible = await page.getByText(/Solar power has become/).count();
    check(contextVisible > 0, "detail view shows the source sentence of a card");
  }

  // mat card reachable through the queue contract
  const q = await ctx.request.get(`${BASE}/api/review/queue`);
  const qj = await q.json();
  const matEntry = (qj.batch ?? []).some((e) => e.card?.unit === "material");
  check(matEntry, "mat card appears in the review queue batch");
  await ctx.close();
} catch (e) {
  check(false, "E2E crashed", e instanceof Error ? e.message : String(e));
} finally {
  await browser.close();
}

// cleanup
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
if (materialId) {
  const m = await prisma.material.findUnique({ where: { id: materialId }, include: { cards: true } });
  if (m) {
    await prisma.cardState.deleteMany({ where: { cardId: { in: m.cards.map((c) => c.id) } } });
    await prisma.material.delete({ where: { id: materialId } });
  }
}
await prisma.user.deleteMany({ where: { email: { startsWith: "e2e-mat-" } } });
await prisma.loginCode.deleteMany({ where: { email: { startsWith: "e2e-mat-" } } });
await prisma.$disconnect();
console.log(`\nE2E TASK 54: ${results.filter((r) => r.ok).length}/${results.length} ${results.every((r) => r.ok) ? "ALL PASS" : "FAILURES"}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
