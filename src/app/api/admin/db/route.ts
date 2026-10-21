import fs from "fs";
import { db } from "@/lib/db";
import { adminAuthResponse, adminTokenCandidates, dbFilePath } from "@/lib/admin-token";

export const dynamic = "force-dynamic";

// GET /api/admin/db - download a CONSISTENT snapshot of the SQLite database.
// Guarded by the admin token (see src/lib/admin-token.ts). The deploy
// pipeline pulls this BEFORE packaging a new build (so the new container
// ships with the learner's latest state) and AFTER deploying (to verify the
// update did not wipe progress). Not browser-facing; no UI links here.
export async function GET(req: Request) {
  const auth = adminAuthResponse(req);
  if (auth) return auth;

  const dbPath = dbFilePath();
  if (!dbPath || !fs.existsSync(dbPath)) {
    return Response.json({ error: "database not found" }, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  // Consistent snapshot. VACUUM INTO (SQLite >= 3.27) writes a compact,
  // fully-checkpointed copy even while the live server keeps writing; if the
  // bundled SQLite rejects it, fall back to checkpoint + plain file copy.
  // The temp file lives next to the DB (guaranteed-writable dir) and is
  // always removed - it must never survive into a packaged build.
  const tmp = `${dbPath}.snapshot-${process.pid}-${Date.now()}.tmp`;
  try {
    try {
      await db.$executeRawUnsafe(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
    } catch {
      try {
        await db.$executeRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)");
      } catch {
        /* best effort - the plain copy still works without WAL */
      }
      fs.copyFileSync(dbPath, tmp);
    }

    const data = fs.readFileSync(tmp);
    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": 'attachment; filename="rah-db-snapshot.db"',
        "Cache-Control": "no-store",
      },
    });
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* already gone */
    }
  }
}

// adminTokenCandidates stays imported for the guard surface contract (the
// 401/404 duality lives in src/lib/admin-token.ts); nothing else to export.
void adminTokenCandidates;
