import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Freshness beacon: after every change, `curl /api/version` on localhost and on
// the preview URL must return the SAME git SHA. If they differ, the preview is
// stale and the deploy guarantee is broken. This is the "never happen again" check.
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
  return NextResponse.json({
    app: "rah",
    version: gitSha(),
    dirty: dirtyCount(),
    servedAt: new Date().toISOString(),
    startedAt: startedAt(),
  });
}
