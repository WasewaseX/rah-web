// GET /api/workspace - list the coach's workspace files (the agent's
// write_file/make_pdf deliverables). Auth-gated: these are learner files.
// SHAPE: { root: "data/coach-workspace", files: [{ path, size, mtime, pdf }] }

import { NextResponse } from "next/server";
import { readdir, stat } from "fs/promises";
import { join } from "path";
import { getSessionUserWithRequest } from "@/lib/auth";
import { ensureWorkspace } from "@/lib/coach-agent/tools";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getSessionUserWithRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in to browse your workspace." }, { status: 401 });

  const root = await ensureWorkspace();
  const files: { path: string; size: number; mtime: number; pdf: boolean }[] = [];

  const walk = async (rel: string, depth: number): Promise<void> => {
    if (depth > 2 || files.length > 60) return;
    const abs = join(root, rel);
    let entries;
    try {
      entries = await readdir(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        await walk(relPath, depth + 1);
      } else if (e.isFile()) {
        try {
          const s = await stat(join(root, relPath));
          files.push({
            path: relPath,
            size: s.size,
            mtime: s.mtimeMs,
            pdf: /\.pdf$/i.test(e.name),
          });
        } catch {
          // file vanished mid-walk; skip it
        }
      }
    }
  };

  await walk("", 0);
  files.sort((a, b) => b.mtime - a.mtime);
  return NextResponse.json({ root: "data/coach-workspace", files });
}
