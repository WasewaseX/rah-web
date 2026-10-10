import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEFAULT_THEME, resolveTheme } from "@/lib/skills/theme";
import type { ThemeSpec } from "@/lib/skills/types";

export const dynamic = "force-dynamic";

async function readSettings(): Promise<Record<string, unknown>> {
  const learner = await db.learner.findUnique({ where: { id: "me" } });
  if (!learner) return {};
  try {
    return JSON.parse(learner.settings || "{}");
  } catch {
    return {};
  }
}

async function writeSettings(patch: Record<string, unknown>) {
  const current = await readSettings();
  const next = { ...current, ...patch };
  await db.learner.upsert({
    where: { id: "me" },
    update: { settings: JSON.stringify(next) },
    create: { id: "me", settings: JSON.stringify(next) },
  });
  return next;
}

export async function GET() {
  const settings = await readSettings();
  const theme = (settings.theme as ThemeSpec) ?? DEFAULT_THEME;
  return NextResponse.json({ theme });
}

// The appearance plugin persists a full ThemeSpec, or a one-word restyle
// ("emerald") resolved locally.
export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  let theme = body?.theme as ThemeSpec | undefined;
  if (!theme?.vars && typeof body?.look === "string") {
    theme = resolveTheme(body.look) ?? undefined;
  }
  if (!theme?.vars) {
    return NextResponse.json({ error: "theme.vars required" }, { status: 400 });
  }
  await writeSettings({ theme });
  return NextResponse.json({ theme });
}

export async function DELETE() {
  await writeSettings({ theme: DEFAULT_THEME });
  return NextResponse.json({ theme: DEFAULT_THEME });
}
