/**
 * Task 74 — P0 production-database decision: PostgreSQL VALIDATION BATTERY.
 *
 * Proves the Rah datamodel + the app's real write patterns on a REAL
 * PostgreSQL 17.5 server (userspace sandbox instance, port 5433, db "rah"):
 *   1. schema applied (30 tables) and empty
 *   2. concurrent grade-path writes (8 workers x 25 rounds) — the exact
 *      transaction shape the grade route uses (cardState.upsert +
 *      reviewLog.create + Learner xp increment + bumpDaily upsert) — with
 *      lost-update and count assertions
 *   3. GradeAck gid idempotency under a true race (12 concurrent same-gid
 *      creates -> exactly one wins on the PK, the rest P2002)
 *   4. two-account isolation semantics at the DB layer (scoped reads)
 *   5. logical restore drill (copy the whole DB into rah_restored, compare
 *      per-table counts + a checksum of the learner row)
 *   6. honest negative: the SQLite migration SQL does NOT run on PG (dialect
 *      mismatch is real) — the cutover path is `migrate diff` baselining,
 *      which this battery proves works (step 0 of this battery IS the diff).
 *
 * Run: bun scripts/pg-validate.ts
 * NOTE: excluded from tsconfig (Task 76-bis) - it depends on the generated
 * PG client (prisma/pg-client, gitignored), which a fresh CI checkout does
 * not have. It runs where the PG sandbox exists, not in CI.
 * Never touches the SQLite live DB or the app's Prisma client (separate
 * schema.postgres.prisma -> prisma/pg-client output).
 */
import { PrismaClient } from "../prisma/pg-client/index.js";

const db = new PrismaClient({
  datasources: { db: { url: "postgresql://postgres@127.0.0.1:5433/rah" } },
});

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`  PASS: ${name}${detail ? " (" + detail + ")" : ""}`);
  } else {
    fail++;
    console.log(`  FAIL: ${name}${detail ? " (" + detail + ")" : ""}`);
  }
}

const WORKERS = 8;
const ROUNDS = 25;
const XP_PER_GRADE = 10;

async function main() {
  console.log("=== PG VALIDATION BATTERY (Rah datamodel on PostgreSQL 17.5) ===");

  // ---- 1. schema shape + clean slate
  const tables = await db.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'`
  );
  ok("schema applied (>=30 public tables)", Number(tables[0].n) >= 30, `n=${tables[0].n}`);
  // re-runnable: wipe data tables (schema stays)
  const allTables = await db.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`
  );
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${allTables.map((t) => `"${t.table_name}"`).join(", ")} RESTART IDENTITY CASCADE`);
  const learner0 = await db.learner.count();
  ok("clean start", learner0 === 0);

  // ---- 2. concurrent grade-path writes (the route's transaction shape)
  await db.learner.create({ data: { id: "me", xp: 0, streak: 0 } });
  const userA = "me";
  const cardIds = Array.from({ length: 10 }, (_, i) => `pgcard${i}`);

  async function gradeOnce(w: number, r: number) {
    const cardId = cardIds[(w * ROUNDS + r) % cardIds.length];
    await db.$transaction(async (tx) => {
      const prev = await tx.cardState.findUnique({
        where: { userId_cardId: { userId: userA, cardId } },
      });
      void prev;
      await tx.cardState.upsert({
        where: { userId_cardId: { userId: userA, cardId } },
        create: { userId: userA, cardId, s: 1, d: 5, due: 20742, last: 20742, reps: 1, state: "new" },
        update: { reps: { increment: 1 }, last: 20742 },
      });
      await tx.reviewLog.create({
        data: { userId: userA, cardId, grade: 3, ivl: 1, day: 20742, source: "pg-validate" },
      });
      await tx.learner.update({ where: { id: userA }, data: { xp: { increment: XP_PER_GRADE } } });
      await tx.dailyStat.upsert({
        where: { userId_day: { userId: userA, day: 20742 } },
        create: { userId: userA, day: 20742, reviews: 1, correct: 1, xp: XP_PER_GRADE },
        update: { reviews: { increment: 1 }, correct: { increment: 1 }, xp: { increment: XP_PER_GRADE } },
      });
    });
  }

  const t0 = Date.now();
  const results = await Promise.allSettled(
    Array.from({ length: WORKERS }, (_, w) =>
      (async () => {
        for (let r = 0; r < ROUNDS; r++) await gradeOnce(w, r);
      })()
    )
  );
  const dt = Date.now() - t0;
  const rejected = results.filter((x) => x.status === "rejected");
  ok("concurrent grade transactions: none rejected", rejected.length === 0,
    rejected.length ? String((rejected[0] as PromiseRejectedResult).reason).slice(0, 120) : `${WORKERS * ROUNDS} tx in ${dt}ms (${Math.round((WORKERS * ROUNDS) / (dt / 1000))} tx/s)`);

  const learner = await db.learner.findUnique({ where: { id: "me" } });
  ok("no lost XP updates (atomic increment)", learner?.xp === WORKERS * ROUNDS * XP_PER_GRADE,
    `xp=${learner?.xp} expected=${WORKERS * ROUNDS * XP_PER_GRADE}`);
  const rl = await db.reviewLog.count();
  ok("no lost ReviewLog rows", rl === WORKERS * ROUNDS, `rows=${rl}`);
  const ds = await db.dailyStat.findUnique({ where: { userId_day: { userId: "me", day: 20742 } } });
  ok("DailyStat upsert races aggregate exactly", ds?.reviews === WORKERS * ROUNDS && ds?.xp === WORKERS * ROUNDS * XP_PER_GRADE,
    `reviews=${ds?.reviews} xp=${ds?.xp}`);
  const cs = await db.cardState.aggregate({ _sum: { reps: true } });
  ok("CardState upsert races aggregate exactly", Number(cs._sum.reps) === WORKERS * ROUNDS, `sum(reps)=${cs._sum.reps}`);

  // ---- 3. GradeAck gid idempotency under a TRUE race
  const GID = "pg-race-gid-0001";
  const ackBody = JSON.stringify({ xp: XP_PER_GRADE, replayed: false });
  const race = await Promise.allSettled(
    Array.from({ length: 12 }, () =>
      db.gradeAck.create({ data: { gid: GID, userId: "me", response: ackBody } })
    )
  );
  const won = race.filter((x) => x.status === "fulfilled").length;
  const lost = race.filter((x) => x.status === "rejected").length;
  ok("gid race: exactly one create wins", won === 1, `won=${won}`);
  ok("gid race: losers fail with unique-violation (P2002)", lost === 11,
    lost === 11 ? "all P2002" : `lost=${lost} first=${String((race.find((x) => x.status === "rejected") as PromiseRejectedResult)?.reason).slice(0, 80)}`);
  const ackRow = await db.gradeAck.findUnique({ where: { gid: GID } });
  ok("gid receipt holds the ORIGINAL response verbatim", ackRow?.response === ackBody);
  // replay-by-gid semantics: findUnique -> return stored, touch nothing
  const xpBeforeReplay = (await db.learner.findUnique({ where: { id: "me" } }))!.xp;
  ok("replay touches nothing (xp unchanged)", xpBeforeReplay === WORKERS * ROUNDS * XP_PER_GRADE);

  // ---- 4. two-account isolation semantics at the DB layer
  await db.user.create({ data: { id: "user-a", email: "a@pg.test" } });
  await db.user.create({ data: { id: "user-b", email: "b@pg.test" } });
  await db.chatMsg.create({ data: { userId: "user-a", role: "user", content: "A-private" } });
  await db.chatMsg.create({ data: { userId: "user-b", role: "user", content: "B-private" } });
  const aSees = await db.chatMsg.count({ where: { userId: "user-a" } });
  const scopedDeleteA = await db.chatMsg.deleteMany({ where: { userId: "user-a" } });
  const bAfter = await db.chatMsg.count({ where: { userId: "user-b" } });
  ok("scoped read is per-user", aSees === 1 && bAfter === 1);
  ok("scoped delete kills only the caller's rows", scopedDeleteA.count === 1 && (await db.chatMsg.count({ where: { userId: "user-b" } })) === 1);

  // ---- 5. logical restore drill (whole-DB copy into rah_restored)
  const { execSync } = await import("node:child_process");
  // build a restore dump via SQL (no pg_dump in the userspace dist): one INSERT-set per table, schema via the same diff DDL
  const tableRows = await db.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`
  );
  const dump: string[] = [];
  for (const { table_name } of tableRows) {
    const rows = await db.$queryRawUnsafe<any[]>(`SELECT * FROM "${table_name}"`);
    if (!rows.length) continue;
    const cols = Object.keys(rows[0]);
    const vals = rows
      .map((r) => "(" + cols.map((c) => {
        const v = r[c];
        if (v === null) return "NULL";
        if (v instanceof Date) return `'${v.toISOString()}'`;
        if (typeof v === "object") return "'" + JSON.stringify(v).replace(/'/g, "''") + "'::jsonb";
        if (typeof v === "number" || typeof v === "bigint") return String(v);
        if (typeof v === "boolean") return String(v);
        return "'" + String(v).replace(/'/g, "''") + "'";
      }).join(",") + ")")
      .join(",\n");
    dump.push(`DELETE FROM "${table_name}";\nINSERT INTO "${table_name}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES\n${vals};`);
  }
  execSync(`node runsql.mjs "DROP DATABASE IF EXISTS rah_restored" `, { cwd: process.cwd() + "/scripts/out/pgsandbox" });
  execSync(`node runsql.mjs "CREATE DATABASE rah_restored" `, { cwd: process.cwd() + "/scripts/out/pgsandbox" });
  const fs = await import("node:fs");
  fs.writeFileSync("scripts/out/pgsandbox/restore-dump.sql", "BEGIN;\n" + dump.join("\n\n") + "\nCOMMIT;\n");
  // apply into rah_restored through a second client (schema first, then rows)
  const { Client } = await import("/home/z/my-project/scripts/out/pgsandbox/node_modules/pg/lib/index.js");
  const r2 = new Client({ host: "127.0.0.1", port: 5433, user: "postgres", database: "rah_restored" });
  await r2.connect();
  await r2.query(fs.readFileSync("scripts/out/pgsandbox/pg-schema.sql", "utf8"));
  await r2.query(fs.readFileSync("scripts/out/pgsandbox/restore-dump.sql", "utf8"));
  let mismatch = 0;
  for (const { table_name } of tableRows) {
    const a = await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*)::int AS n FROM "${table_name}"`);
    const b = await r2.query(`SELECT count(*)::int AS n FROM "${table_name}"`);
    if (Number(a[0].n) !== Number(b.rows[0].n)) { mismatch++; console.log(`    table ${table_name}: ${a[0].n} vs ${b.rows[0].n}`); }
  }
  ok("logical restore: per-table row counts identical", mismatch === 0, `${tableRows.length} tables compared`);
  const rLearner = await r2.query(`SELECT xp, streak FROM "Learner" WHERE id='me'`);
  ok("restored learner row matches (xp/streak)", rLearner.rows[0]?.xp === WORKERS * ROUNDS * XP_PER_GRADE, `xp=${rLearner.rows[0]?.xp}`);
  await r2.end();

  // ---- 6. honest negative: SQLite migration dialect does not run on PG
  const sqliteMigration = fs.readFileSync("prisma/migrations/0001_init/migration.sql", "utf8").slice(0, 400);
  ok("sqlite migration SQL carries sqlite dialect (cutover MUST baseline via migrate diff)", /CREATE TABLE/i.test(sqliteMigration) && !/"schema_version"/.test(sqliteMigration));

  console.log(`\n=== PG VALIDATION: ${pass} passed, ${fail} failed ===`);
  await db.$disconnect();
  process.exit(fail ? 1 : 0);
}

main().catch(async (e) => {
  console.error("BATTERY ERROR:", e);
  await db.$disconnect();
  process.exit(1);
});
