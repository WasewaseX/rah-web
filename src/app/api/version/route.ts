import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { readFileSync, existsSync, readdirSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";

// Freshness beacon: after every change, `curl /api/version` on localhost and on
// the preview URL must return the SAME git SHA. If they differ, the preview is
// stale and the deploy guarantee is broken. This is the "never happen again" check.
//
// DATA PROVENANCE (the 2026-10-20 lesson: the DB once silently reset and the
// only symptom the learner saw was a re-fired achievement): the beacon now also
// reports the learner data's identity so data loss is INSTANTLY visible. If
// data.createdAt jumps to the current deploy time after an update, data died.
// Every read is failure-isolated: the beacon must answer even with a broken DB.
const probeDb = new PrismaClient({ log: [] });

async function dataProvenance() {
  try {
    const [learner, reviews] = await Promise.all([
      probeDb.learner.findUnique({ where: { id: "me" }, select: { createdAt: true, xp: true, streak: true } }),
      probeDb.reviewLog.count(),
    ]);
    let snapshot: string | null = null;
    try {
      const dir = path.join(process.cwd(), "backups");
      const snaps = readdirSync(dir).filter((f) => f.startsWith("rah-") && f.endsWith(".sqlite.gz")).sort();
      if (snaps.length) snapshot = snaps[snaps.length - 1];
    } catch {
      /* no backups dir yet */
    }
    return {
      createdAt: learner?.createdAt?.toISOString() ?? null,
      xp: learner?.xp ?? null,
      streak: learner?.streak ?? null,
      reviews,
      latestSnapshot: snapshot,
    };
  } catch {
    return null; // beacon stays alive even if the DB is unreachable
  }
}

function gitSha(): string {
  try {
    return execSync("git rev-parse HEAD", { cwd: process.cwd(), encoding: "utf8" }).trim().slice(0, 12);
  } catch {
    return "no-git";
  }
}

function dirtyCount(): number {
  try {
    const out = execSync("git status --porcelain", { cwd: process.cwd(), encoding: "utf8" });
    return out.split("\n").filter(Boolean).length;
  } catch {
    return -1;
  }
}

function startedAt(): string {
  const p = path.join(process.cwd(), ".next", "dev", "server-started.json");
  if (existsSync(p)) {
    try {
      return JSON.parse(readFileSync(p, "utf8")).at ?? "unknown";
    } catch {
      /* ignore */
    }
  }
  return new Date().toISOString();
}

export async function GET() {
  const data = await dataProvenance();
  return NextResponse.json({
    app: "rah",
    version: gitSha(),
    dirty: dirtyCount(),
    servedAt: new Date().toISOString(),
    startedAt: startedAt(),
    data,
  });
}
