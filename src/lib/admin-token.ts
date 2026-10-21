// Admin-token guard for the deploy-time DB endpoints (/api/admin/db,
// /api/admin/stats). These endpoints are NOT for browser users - they exist
// so the deploy pipeline can pull the live production database back into the
// workspace BEFORE packaging a new build, and verify afterwards that learner
// data survived. Without that pull, every deploy replaced the container's
// database with the stale workspace copy and wiped learner progress (the
// Oct-20 "first word achievement again" incident).
//
// The token resolves from BOTH sources, whichever exists:
//   1. RAH_ADMIN_TOKEN env (if the platform propagates env into the container)
//   2. a file named `admin-token` sitting NEXT TO the SQLite database
//      (workspace: db/admin-token; packaged: /app/db/admin-token - the build
//      copies it, so workspace and container share the same value)
//
// With NEITHER source present the endpoints answer 404: an unconfigured
// deployment leaks nothing, and the pull step treats 404 as "no endpoint yet"
// (the graceful fallback for the very first deploy after this change).

import fs from "fs";
import path from "path";
import crypto from "crypto";

/** Absolute path of the SQLite database file from DATABASE_URL (file: URLs only). */
export function dbFilePath(): string | null {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:")) return null;
  const p = url.slice("file:".length);
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

/** All configured admin token values (env + token file next to the DB). */
export function adminTokenCandidates(): string[] {
  const out: string[] = [];
  const env = process.env.RAH_ADMIN_TOKEN;
  if (env && env.trim()) out.push(env.trim());
  const dbPath = dbFilePath();
  if (dbPath) {
    try {
      const fromFile = fs
        .readFileSync(path.join(path.dirname(dbPath), "admin-token"), "utf8")
        .trim();
      if (fromFile) out.push(fromFile);
    } catch {
      /* no token file -> env-only or fully locked */
    }
  }
  return out;
}

/** Timing-safe Bearer-token check. False when no token is configured. */
export function adminAuthorized(req: Request): boolean {
  const candidates = adminTokenCandidates();
  if (candidates.length === 0) return false;
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) return false;
  const given = Buffer.from(m[1]);
  return candidates.some((want) => {
    const w = Buffer.from(want);
    return w.length === given.length && crypto.timingSafeEqual(w, given);
  });
}

/**
 * Uniform 401/404 answer for the admin endpoints: 404 when no token is
 * configured at all (endpoint effectively "not there"), 401 on a bad token.
 */
export function adminAuthResponse(req: Request): Response | null {
  const configured = adminTokenCandidates().length > 0;
  if (adminAuthorized(req)) return null;
  return Response.json(
    { error: configured ? "unauthorized" : "not available" },
    { status: configured ? 401 : 404, headers: { "Cache-Control": "no-store" } },
  );
}
