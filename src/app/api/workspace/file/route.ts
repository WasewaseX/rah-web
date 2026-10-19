// GET /api/workspace/file?path=rel - download one coach-workspace file.
// Auth-gated, SAME sandbox as the agent's file tools (safePath rejects any
// escape). `dl=1` forces an attachment download; otherwise PDFs and text
// render inline so the learner can preview them in a new tab.

import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { getSessionUserWithRequest } from "@/lib/auth";
import { safePath, ensureWorkspace } from "@/lib/coach-agent/tools";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".ts": "text/plain; charset=utf-8",
  ".js": "text/plain; charset=utf-8",
};

export async function GET(req: Request) {
  const user = await getSessionUserWithRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in to open your workspace files." }, { status: 401 });

  await ensureWorkspace();
  const url = new URL(req.url);
  const rel = url.searchParams.get("path") ?? "";
  const p = safePath(rel);
  if (!p || !rel) return NextResponse.json({ error: "Rejected path (outside the workspace)" }, { status: 400 });

  let s;
  try {
    s = await stat(p);
  } catch {
    return NextResponse.json({ error: `No such file: ${rel}` }, { status: 404 });
  }
  if (!s.isFile()) return NextResponse.json({ error: `Not a file: ${rel}` }, { status: 400 });

  const bytes = await readFile(p);
  const ext = (rel.match(/\.[a-z0-9]+$/i) ?? [""])[0].toLowerCase();
  const type = TYPES[ext] ?? "application/octet-stream";
  const name = rel.split("/").pop() ?? "file";
  const attach = url.searchParams.get("dl") === "1";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": type,
      "content-disposition": `${attach ? "attachment" : "inline"}; filename="${name.replace(/"/g, "")}"`,
      "cache-control": "no-store",
    },
  });
}
