// Task 48: the deployment lock (P0-1 data isolation, audit-sanctioned
// single-user enforcement) - integration test at the lib level against a
// THROWAWAY database (a second next-dev instance cannot boot: Turbopack
// locks the shared .next dir). Proves, with the lock active (env unset):
//   1. The first account registers and claims the deployment.
//   2. A second account is refused with the honest message.
//   3. The first account can still re-login (only NEW accounts are gated).
//   4. With RAH_OPEN_REGISTRATION=1 the same deployment accepts a second
//      account (the dev-toolchain escape hatch is real and documented).
process.env.DATABASE_URL = "file:/tmp/rah-lock-test.db";
export {}; // module marker: top-level await needs it (tsc TS1375)
// Bun auto-loads .env AND @prisma/client re-loads it on first import (non-
// overriding). DELETING the var would let dotenv re-populate it from .env -
// so the lock test simulates production by setting it to EMPTY STRING
// (existing vars are never overridden by dotenv; "" !== "1" => lock active).
process.env.RAH_OPEN_REGISTRATION = "";

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const { issueLoginCode, verifyLoginCode } = await import("@/lib/auth");

let failures = 0;
let n = 0;
function check(ok: boolean, what: string, detail = "") {
  n += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` -> ${detail}`}`);
}

try {
  // fresh DB: apply the versioned migrations (the Task-47 path)
  const { execSync } = await import("child_process");
  execSync("bunx prisma migrate deploy", { env: { ...process.env }, stdio: "pipe" });
  const userCount0 = await prisma.user.count();
  check(userCount0 === 0, "throwaway DB starts with zero users", String(userCount0));

  const emailA = `lock-owner-${Date.now()}@rah.test`;
  const emailB = `lock-second-${Date.now()}@rah.test`;
  const emailC = `lock-open-${Date.now()}@rah.test`;

  // 1. first account claims the deployment
  const cA = await issueLoginCode(emailA);
  const a = await verifyLoginCode(emailA, cA.code!);
  check(a.ok === true && !!a.user, "first account registers and claims the deployment", JSON.stringify(a.error));

  // 2. second account refused
  const cB = await issueLoginCode(emailB);
  const b = await verifyLoginCode(emailB, cB.code!);
  check(b.ok === false, "second account refused (lock fires)", `ok=${b.ok}`);
  check(
    typeof b.error === "string" && b.error.includes("already claimed"),
    "refusal carries the honest owner-facing message",
    String(b.error),
  );

  // 3. owner re-login unaffected (code consumed -> fresh code, still allowed)
  const cA2 = await issueLoginCode(emailA);
  const a2 = await verifyLoginCode(emailA, cA2.code!);
  check(a2.ok === true && a2.user?.isNew === false, "owner can still re-login (lock only gates NEW accounts)", JSON.stringify(a2.error));

  // 4. the documented escape hatch: RAH_OPEN_REGISTRATION=1 opens registration
  process.env.RAH_OPEN_REGISTRATION = "1";
  const cC = await issueLoginCode(emailC);
  const c = await verifyLoginCode(emailC, cC.code!);
  check(c.ok === true, "RAH_OPEN_REGISTRATION=1 opens registration (documented escape hatch)", JSON.stringify(c.error));
  process.env.RAH_OPEN_REGISTRATION = "";
} catch (e) {
  check(false, "lock test crashed", e instanceof Error ? e.message : String(e));
} finally {
  await prisma.user.deleteMany({ where: { email: { startsWith: "lock-" } } });
  await prisma.loginCode.deleteMany({ where: { email: { startsWith: "lock-" } } });
  await prisma.$disconnect();
}

console.log(`\nDEPLOYMENT LOCK: ${n - failures}/${n} ${failures === 0 ? "ALL PASS" : `${failures} FAILURES`}`);
process.exit(failures === 0 ? 0 : 1);
