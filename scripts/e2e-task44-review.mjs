// Task 44 E2E: drive the remaining review cards to the finished screen and
// verify the auto-continue -> budget-spent transition in the real browser.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  // Login: email-code flow (dev exposes the code in the response).
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(1500);
  await page.locator('input[placeholder="you@gmail.com"]').fill("noob@rah.dev");
  await page.getByRole("button", { name: "Send login code" }).click();
  await page.waitForTimeout(1200);
  const codeRes = await ctx.request.post(`${BASE}/api/auth/request-code`, { data: { email: "noob@rah.dev" } });
  const codeJson = await codeRes.json();
  await page.locator('input[placeholder="000000"]').fill(String(codeJson.devCode));
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await page.waitForTimeout(2500);
  await page.goto(`${BASE}/#review`);
  await page.waitForTimeout(2500);

  const log = [];
  for (let i = 0; i < 30; i++) {
    // Finished screen?
    const keep = page.getByRole("button", { name: "Keep practicing" });
    if ((await keep.count()) > 0) {
      log.push(`FINISHED SCREEN reached after ${i} grades`);
      // Capture the finished screen text
      const text = await page.locator("main").innerText();
      log.push("---- finished screen ----\n" + text.slice(0, 600));
      break;
    }
    // Grade button?
    const good = page.locator("button", { hasText: /^GOOD/ });
    if ((await good.count()) > 0) {
      await good.first().click();
      await page.waitForTimeout(1100);
      continue;
    }
    // Typed input?
    const inp = page.locator('input[placeholder="Type your answer"]');
    if ((await inp.count()) > 0) {
      await inp.fill("zz");
      const check = page.getByRole("button", { name: "Check", exact: true });
      if ((await check.count()) > 0 && (await check.isEnabled())) {
        await check.click();
        await page.waitForTimeout(900);
      }
      continue;
    }
    // Word bank / mcq: use "I do not know"
    const idk = page.getByRole("button", { name: "I do not know" });
    if ((await idk.count()) > 0) {
      await idk.click();
      await page.waitForTimeout(900);
      continue;
    }
    // MCQ pick first option
    const mcq = page.locator("main button").filter({ hasText: /./ });
    log.push("stuck: no actionable control found");
    break;
  }

  // Extra-practice round: the Keep practicing path.
  const keep2 = page.getByRole("button", { name: "Keep practicing" });
  if ((await keep2.count()) > 0) {
    await keep2.click();
    await page.waitForTimeout(2000);
    const chip = await page.locator("main").innerText();
    log.push("---- after Keep practicing ----");
    log.push(`extra-practice chip visible: ${chip.includes("Extra practice")}`);
    log.push(`fsrs visibility line visible: ${chip.includes("normally returns every") || chip.includes("First meeting")}`);
    log.push(`card counter: ${(chip.match(/Card \d+ of \d+/) ?? ["none"])[0]}`);
  }

  // Rival badge on Home.
  await page.goto(`${BASE}/#home`);
  await page.waitForTimeout(2500);
  const home = await page.locator("main").innerText();
  log.push(`practice-bot badge on Home (css-uppercased): ${/practice bot/i.test(home)}`);
  log.push(`rival name present: ${(home.match(/(Vahid|Sahar|Arman|Parham|Neda|Kian|Roya|Behnam)[^·\n]*/) ?? ["none"])[0]}`);

  console.log(log.join("\n"));
  await page.screenshot({ path: "e2e-finished-screen.png", fullPage: true });
  await browser.close();
}

main().catch((e) => {
  console.error("E2E FAIL:", e.message);
  process.exit(1);
});
