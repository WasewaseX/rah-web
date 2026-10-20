// Task 48 E2E: the deployment lock (P0-1 data isolation, audit-sanctioned
// single-user enforcement). Boots a THROWAWAY server on port 3100 with a
// fresh migrated DB and NO RAH_OPEN_REGISTRATION, then proves:
//   1. The first account registers and claims the deployment.
//   2. A second account is refused with the honest message.
//   3. The first account can still re-login (session path unaffected).
import { PrismaClient } from "@prisma/client";

const BASE = "http://localhost:3100";
const emailA = `lock-owner-${Date.now()}@rah.test`;
const emailB = `lock-second-${Date.now()}@rah.test`;
const results = [];
function check(ok, what, detail = "") {
  results.push({ ok, what });
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` -> ${detail}`}`);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/api/version`);
      if (r.ok) return true;
    } catch {}
    await wait(1000);
  }
  return false;
}

async function login(email) {
  const req = await fetch(`${BASE}/api/auth/request-code`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const reqBody = await req.json();
  if (!reqBody?.devCode) return { status: req.status, body: reqBody, devCode: null };
  const res = await fetch(`${BASE}/api/auth/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, code: reqBody.devCode }),
  });
  return { status: res.status, body: await res.json(), devCode: reqBody.devCode };
}

const main = async () => {
  check(await waitForServer(), "throwaway server up on 3100 (fresh DB, lock active)");
  const a = await login(emailA);
  check(a.status === 200, "first account registers and claims the deployment", JSON.stringify(a.body).slice(0, 120));
  const b = await login(emailB);
  check(b.status === 400, "second account refused (lock fires)", `status=${b.status}`);
  check(
    typeof b.body?.error === "string" && b.body.error.includes("already claimed"),
    "refusal carries the honest owner-facing message",
    JSON.stringify(b.body).slice(0, 140),
  );
  const a2 = await login(emailA);
  check(a2.status === 200, "owner can still re-login (lock only gates NEW accounts)", `status=${a2.status}`);
};

try {
  await main();
} catch (e) {
  check(false, "E2E crashed", e instanceof Error ? e.message : String(e));
}

// cleanup throwaway DB rows
const prisma = new PrismaClient({ datasources: { db: { url: "file:/tmp/rah-lock-test.db" } } });
await prisma.user.deleteMany({ where: { email: { startsWith: "lock-" } } });
await prisma.loginCode.deleteMany({ where: { email: { startsWith: "lock-" } } });
await prisma.session.deleteMany({});
await prisma.$disconnect();
console.log(`\nE2E TASK 48: ${results.filter((r) => r.ok).length}/${results.length} ${results.every((r) => r.ok) ? "ALL PASS" : "FAILURES"}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
