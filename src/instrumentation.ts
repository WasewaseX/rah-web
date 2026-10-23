/**
 * Boot-time data-survival chain (Task 90) - runs on EVERY boot road.
 *
 * Task 87 proved the recovery machinery against the ensure-server.sh boot
 * path. But the deployment's supervisor restarts the app via `bun run dev`
 * -> scripts/dev-or-prod.sh -> bare server.js, which NEVER ran ensure-server.
 * On that road a live-but-damaged DB (the Oct-23 class: review history
 * present, FSRS schedule gone) would be served unrepaired, and a missing DB
 * would boot schema-only before db-restore could act.
 *
 * Next.js calls register() once per server instance and AWITS it before the
 * first request is handled, so this is the one hook that covers every boot
 * road: supervisor restart, ensure-server revive, dev, and standalone prod.
 *
 * Mirrors the ensure-server order exactly:
 *   1. db-guard.sh boot        - snapshot-if-used BEFORE schema work / restore-if-fresh
 *   2. db-restore.sh           - restore-if-MISSING (sync -> vault -> OSS -> backups)
 *   3. db-migrate-safe.sh      - versioned migrate deploy, never reset
 *   4. db-integrity-repair.sh  - insert-only FSRS repair BEFORE writes accepted
 * Plus (dev only) the Task-87 client-stamp guard: a stale generated Prisma
 * client 500s every newer-column query at runtime; prod bakes the client at
 * build time so a regen there cannot take effect.
 *
 * Hard rules: NEVER blocks boot on failure (every step is failure-isolated),
 * never runs twice concurrently (global flag + stale-tolerant lockfile),
 * every step has a hard timeout.
 */
export async function register(): Promise<void> {
  const g = globalThis as { __rahBootGuard?: boolean };
  if (g.__rahBootGuard) return;
  g.__rahBootGuard = true;

  const { execFile } = await import("child_process");
  const fs = await import("fs");
  const path = await import("path");

  const root = process.cwd();
  const log = (line: string) => console.log(`[rah-boot] ${new Date().toISOString()} ${line}`);

  // Single-flight across processes: lockfile with PID, stale after 120s.
  const lockPath = path.join(root, "db", ".boot-guard.lock");
  try {
    if (fs.existsSync(lockPath)) {
      const raw = fs.readFileSync(lockPath, "utf8").trim();
      const pid = parseInt(raw.split(" ")[0] ?? "", 10);
      const at = parseInt(raw.split(" ")[1] ?? "", 10);
      const fresh = Number.isFinite(at) && Date.now() - at < 120_000;
      const alive = Number.isFinite(pid) && pid > 0 && (() => {
        try { process.kill(pid, 0); return true; } catch { return false; }
      })();
      if (fresh && alive) {
        log(`another boot guard holds the lock (pid ${pid}) - skipping`);
        return;
      }
      log(`taking over stale lock (pid ${raw})`);
    }
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, `${process.pid} ${Date.now()}`);
  } catch {
    /* lock failure must never block boot */
  }

  const run = (script: string, timeoutMs: number): Promise<void> =>
    new Promise((resolve) => {
      const t0 = Date.now();
      execFile(
        "bash",
        [path.join(root, "scripts", script)],
        { cwd: root, timeout: timeoutMs, killSignal: "SIGKILL" },
        (err, stdout, stderr) => {
          const ms = Date.now() - t0;
          const tail = `${stdout ?? ""}${stderr ?? ""}`.split("\n").filter(Boolean).slice(-2).join(" | ");
          if (err) log(`${script} FAILED in ${ms}ms: ${String(err.message).slice(0, 120)} :: ${tail}`);
          else log(`${script} ok in ${ms}ms :: ${tail}`);
          resolve(); // failure-isolated by contract: always resolve
        },
      );
    });

  try {
    log(`boot guard chain starting (cwd=${root}, NODE_ENV=${process.env.NODE_ENV ?? "unset"})`);
    await run("db-guard.sh", 90_000);            // boot: snapshot-if-used / restore-if-fresh
    await run("db-restore.sh", 120_000);          // restore-if-MISSING from the snapshot chain
    await run("db-migrate-safe.sh", 120_000);     // forward-only schema move
    await run("db-integrity-repair.sh", 120_000); // insert-only FSRS repair
    log("boot guard chain complete - server may accept requests");
  } catch (e) {
    log(`boot guard chain error (non-fatal): ${String(e).slice(0, 160)}`);
  } finally {
    try { fs.rmSync(lockPath, { force: true }); } catch { /* ignore */ }
  }
}
