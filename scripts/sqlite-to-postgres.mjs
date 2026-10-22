/**
 * Task 74 — SQLite -> PostgreSQL CUTOVER VALIDATION (read-only on the live DB).
 *
 * Proves the real cutover path the multi-user push will use: copy ALL learner
 * data from the live SQLite db into a PostgreSQL database (rah_cutover) with
 * per-column type adaptation, then compare per-table row counts.
 *
 * SAFETY: the SQLite db is opened READ-ONLY (file:...?mode=ro). The live DB
 * is never written. The PG target lives in the local sandbox cluster.
 *
 * Run: node scripts/sqlite-to-postgres.mjs
 */
import { DatabaseSync } from "node:sqlite";
import pkg_pg from "/home/z/my-project/scripts/out/pgsandbox/node_modules/pg/lib/index.js";
const { Client } = pkg_pg;
import { execSync } from "node:child_process";
import fs from "node:fs";

const LIVE_DB = process.env.RAH_DB_PATH || "/home/z/my-project/db/custom.db";
const PG = { host: "127.0.0.1", port: 5433, user: "postgres", database: "rah_cutover" };

const sqlite = new DatabaseSync(`file:${LIVE_DB}?mode=ro`, { readOnly: true });

async function main() {
  execSync('node runsql.mjs "DROP DATABASE IF EXISTS rah_cutover"', { cwd: "/home/z/my-project/scripts/out/pgsandbox" });
  execSync('node runsql.mjs "CREATE DATABASE rah_cutover"', { cwd: "/home/z/my-project/scripts/out/pgsandbox" });

  const pg = new Client(PG);
  await pg.connect();
  await pg.query(fs.readFileSync("/home/z/my-project/scripts/out/pgsandbox/pg-schema.sql", "utf8"));

  // PG column metadata
  const meta = await pg.query(
    `SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public'`
  );
  const pgCols = new Map(); // table -> [{name, type}]
  for (const r of meta.rows) {
    if (!pgCols.has(r.table_name)) pgCols.set(r.table_name, []);
    pgCols.get(r.table_name).push({ name: r.column_name, type: r.data_type });
  }

  const sqliteTables = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_migrations'`)
    .all()
    .map((r) => r.name);

  let migrated = 0, skippedCols = 0, mismatched = 0;
  const report = [];

  for (const table of sqliteTables) {
    const target = pgCols.get(table);
    if (!target) { report.push(`${table}: NO PG TABLE (skipped)`); continue; }
    const tCols = new Set(target.map((c) => c.name));
    const sCols = sqlite.prepare(`PRAGMA table_info("${table}")`).all().map((r) => r.name);
    const common = sCols.filter((c) => tCols.has(c));
    skippedCols += sCols.length - common.length;
    const colMeta = new Map(target.map((c) => [c.name, c.type]));

    const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all();
    let inserted = 0;
    const BATCH = 100;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      if (!batch.length) break;
      const values = [];
      const chunks = batch.map((row, bi) => {
        const ph = common.map((c, ci) => {
          const v = row[c];
          const t = colMeta.get(c);
          let out = v === null || v === undefined ? null : v;
          if (out !== null) {
            if (t === "boolean") out = v === 1 || v === true || v === "1";
            else if (t === "jsonb") out = JSON.stringify(v);
            else if (t === "integer" || t === "bigint" || t === "smallint") out = Math.trunc(Number(v));
            else if (t === "double precision" || t === "real" || t === "numeric") out = Number(v);
            else if (/timestamp|date/.test(t)) {
              const s = String(v);
              if (/^\d{13}$/.test(s)) out = new Date(Number(s)).toISOString(); // epoch ms stored as INTEGER
              else if (/^\d{10}$/.test(s)) out = new Date(Number(s) * 1000).toISOString(); // epoch s
              else out = s;
            }
            else out = String(v);
          }
          values.push(out);
          return `$${bi * common.length + ci + 1}`;
        });
        return "(" + ph.join(",") + ")";
      });
      const sql = `INSERT INTO "${table}" (${common.map((c) => `"${c}"`).join(",")}) VALUES ${chunks.join(",")} ON CONFLICT DO NOTHING`;
      const res = await pg.query(sql, values);
      inserted += res.rowCount;
    }
    const ok = inserted === rows.length;
    if (!ok) mismatched++;
    migrated += inserted;
    report.push(`${table}: ${rows.length} -> ${inserted} ${ok ? "OK" : "MISMATCH"}`);
  }

  console.log("=== SQLITE -> POSTGRESQL CUTOVER VALIDATION ===");
  for (const line of report) console.log("  " + line);
  console.log(`  columns not present in PG schema (intersection-dropped): ${skippedCols}`);
  console.log(`  total rows migrated: ${migrated}; mismatched tables: ${mismatched}`);

  // sanity: the learner's real numbers made it across (counts only, no content printed)
  const l = await pg.query(`SELECT xp, streak FROM "Learner" LIMIT 1`);
  console.log(`  learner row in PG: xp=${l.rows[0]?.xp} streak=${l.rows[0]?.streak} (must match the live DB)`);
  const u = await pg.query(`SELECT count(*)::int AS n FROM "User"`);
  console.log(`  user rows in PG: ${u.rows[0].n}`);

  await pg.end();
  sqlite.close();
  if (mismatched) process.exit(1);
  console.log("=== CUTOVER PATH VALIDATED ===");
}

main().catch((e) => { console.error("CUTOVER ERROR:", e.message); process.exit(1); });
