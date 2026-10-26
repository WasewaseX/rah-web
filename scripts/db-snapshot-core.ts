// Data-survival core. Given an ABSOLUTE target path, this script:
//   1. Prunes ephemeral auth noise from the live DB (expired sessions,
//      used/expired login codes) so snapshots stay hygienic but the
//      learner STAYS LOGGED IN across updates (active sessions kept).
//   2. Produces a consistent copy via SQLite VACUUM INTO - safe while the
//      dev server holds the database (no torn files, no journal gambling).
// The caller (db-snapshot.sh) hashes the result and skips identical copies.
import { PrismaClient } from "@prisma/client";

const target = process.argv[2];
if (!target || !target.startsWith("/")) {
  console.error("usage: bun run scripts/db-snapshot.ts /abs/path/to/snapshot.sqlite");
  process.exit(1);
}

// Task 98: defense in depth behind the db-snapshot.sh engine gate - this
// core is SQLite-only (VACUUM INTO, pragma_* queries are not PG SQL). If
// the live store is PostgreSQL, refuse loudly instead of pruning the live
// PG rows and then failing mid-copy (the P2010/42601 boot failure).
const envUrl = process.env.DATABASE_URL ?? "";
if (envUrl.startsWith("postgresql://") || envUrl.startsWith("postgres://")) {
  console.error(
    "snapshot core: live store is PostgreSQL - this core only snapshots SQLite live stores; use pg-survival.sh dump",
  );
  process.exit(1);
}

const db = new PrismaClient({ log: [] });

try {
  const now = new Date();
  const prunedCodes = await db.loginCode.deleteMany({
    where: { OR: [{ usedAt: { not: null } }, { expiresAt: { lt: now } }] },
  });
  const prunedSessions = await db.session.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  await db.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  const k = await db.$queryRawUnsafe<{ page_count: number }[]>(
    `SELECT (page_count * page_size) AS page_count FROM pragma_page_count(), pragma_page_size()`,
  ).catch(() => [{ page_count: 0 }]);
  const rawBytes: unknown = k[0]?.page_count;
  const bytes = rawBytes == null ? 0 : Number(rawBytes);
  const codes = typeof prunedCodes === "number" ? prunedCodes : prunedCodes.count;
  const sessions = typeof prunedSessions === "number" ? prunedSessions : prunedSessions.count;
  console.log(
    `snapshot core: vacuumed into ${target} (~${Math.round(bytes / 1024)} KB, pruned ${codes} login codes / ${sessions} expired sessions)`,
  );
} finally {
  await db.$disconnect();
}
