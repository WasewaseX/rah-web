// Task 60: deploy-time DB endpoints (P0 - learner data must survive updates).
// Lib-level test against a THROWAWAY database, same pattern as
// test-deployment-lock.ts. Proves:
//   1. No token configured anywhere -> both endpoints answer 404 (locked,
//      unconfigured deployments leak nothing).
//   2. Token file configured + missing/wrong bearer -> 401.
//   3. Correct bearer -> /api/admin/db streams a VALID standalone SQLite
//      snapshot whose Learner row matches the seeded state (VACUUM INTO path).
//   4. /api/admin/stats returns the fingerprint the deploy pipeline diffs.
//   5. RAH_ADMIN_TOKEN env works as a token source when the file is absent.
//   6. Snapshot temp files are always cleaned up (no *.tmp left in the db dir).
process.env.DATABASE_URL = "file:/tmp/rah-admin-route-test/custom.db";
export {}; // module marker: top-level await needs it (tsc TS1375)

import fs from "fs";

const DIR = "/tmp/rah-admin-route-test";
const DB = `${DIR}/custom.db`;
const TOKEN = "test-token-0f4c1ba7";

let failures = 0;
let n = 0;
function check(ok: boolean, what: string, detail = "") {
  n += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` -> ${detail}`}`);
}

function req(tok?: string, path = "/api/admin/db"): Request {
  const headers: Record<string, string> = {};
  if (tok) headers.authorization = `Bearer ${tok}`;
  return new Request(`http://localhost${path}`, { headers });
}

try {
  // fresh throwaway DB: apply the versioned migrations (the Task-47 path)
  fs.rmSync(DIR, { recursive: true, force: true });
  fs.mkdirSync(DIR, { recursive: true });
  const { execSync } = await import("child_process");
  execSync("bunx prisma migrate deploy", { env: process.env, stdio: "pipe" });

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  await prisma.learner.create({ data: { id: "me", xp: 4242, streak: 7 } });
  await prisma.user.create({ data: { email: `admin-route-${Date.now()}@rah.test` } });
  await prisma.reviewLog.create({ data: { cardId: "deck:test", grade: 3, ivl: 1, day: 0 } });

  const dbRoute = await import("@/app/api/admin/db/route");
  const statsRoute = await import("@/app/api/admin/stats/route");

  // 1. no token configured anywhere -> 404 on both endpoints
  const r404a = await dbRoute.GET(req(TOKEN));
  const r404b = await statsRoute.GET(req(TOKEN));
  check(r404a.status === 404, "db endpoint 404 when no token configured", String(r404a.status));
  check(r404b.status === 404, "stats endpoint 404 when no token configured", String(r404b.status));

  // 2. token file configured -> auth enforced
  fs.writeFileSync(`${DIR}/admin-token`, `${TOKEN}\n`);
  const r401a = await dbRoute.GET(req());
  const r401b = await dbRoute.GET(req("wrong-token"));
  const r401c = await statsRoute.GET(req("wrong-token"));
  check(r401a.status === 401, "db endpoint 401 without bearer", String(r401a.status));
  check(r401b.status === 401, "db endpoint 401 with wrong token", String(r401b.status));
  check(r401c.status === 401, "stats endpoint 401 with wrong token", String(r401c.status));

  // 3. correct token -> valid standalone SQLite snapshot
  const ok = await dbRoute.GET(req(TOKEN));
  check(ok.status === 200, "db endpoint 200 with correct token", String(ok.status));
  check(
    (ok.headers.get("cache-control") ?? "").includes("no-store"),
    "snapshot response is no-store",
    ok.headers.get("cache-control") ?? "missing",
  );
  const buf = Buffer.from(await ok.arrayBuffer());
  fs.writeFileSync(`${DIR}/snapshot.db`, buf);
  const py = execSync(
    `python3 - <<'PY'
import sqlite3, sys
con = sqlite3.connect("${DIR}/snapshot.db")
assert open("${DIR}/snapshot.db","rb").read(16) == b"SQLite format 3\\x00", "bad magic"
assert con.execute("PRAGMA integrity_check").fetchone()[0] == "ok", "integrity"
assert con.execute("SELECT xp, streak FROM Learner WHERE id='me'").fetchone() == (4242, 7), "learner row"
assert con.execute("SELECT COUNT(*) FROM ReviewLog").fetchone()[0] == 1, "reviewlog"
print("snapshot-valid")
PY`,
    { encoding: "utf8" },
  ).trim();
  check(py === "snapshot-valid", "snapshot is a standalone valid SQLite db with seeded state", py);

  // 6. temp snapshot files are cleaned up
  const leftovers = fs.readdirSync(DIR).filter((f) => f.includes(".snapshot-"));
  check(leftovers.length === 0, "no *.snapshot-* temp files left in db dir", leftovers.join(","));

  // 4. stats fingerprint
  const st = await statsRoute.GET(req(TOKEN));
  check(st.status === 200, "stats endpoint 200 with correct token", String(st.status));
  const stats = JSON.parse(await st.text());
  check(stats.xp === 4242, "stats xp matches seeded learner", JSON.stringify(stats.xp));
  check(stats.streak === 7, "stats streak matches", JSON.stringify(stats.streak));
  check(stats.users === 1, "stats user count", JSON.stringify(stats.users));
  check(stats.reviews === 1, "stats review count", JSON.stringify(stats.reviews));

  // 5. env token works when the file is absent
  fs.rmSync(`${DIR}/admin-token`);
  process.env.RAH_ADMIN_TOKEN = TOKEN;
  const rEnv = await dbRoute.GET(req(TOKEN));
  check(rEnv.status === 200, "RAH_ADMIN_TOKEN env accepted as token source", String(rEnv.status));
  const rEnvBad = await dbRoute.GET(req("nope"));
  check(rEnvBad.status === 401, "wrong env-token still 401", String(rEnvBad.status));
  delete process.env.RAH_ADMIN_TOKEN;

  await prisma.$disconnect();
} catch (e) {
  check(false, "unexpected exception", String(e));
}

console.log(`\n${n - failures}/${n} checks passed`);
process.exit(failures === 0 ? 0 : 1);
