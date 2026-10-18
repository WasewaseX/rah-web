import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { issueLoginCode } from "@/lib/auth";
import { sendLoginCode, smtpConfigured } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({ email: "" }));
  const issued = await issueLoginCode(String(email ?? ""));
  if (!issued.ok) return NextResponse.json({ error: issued.error }, { status: 400 });

  const normalized = String(email).trim().toLowerCase();
  const row = await db.loginCode.findFirst({
    where: { email: normalized, usedAt: null },
    orderBy: { id: "desc" },
  });
  if (!row) return NextResponse.json({ error: "Code issue failed; try again." }, { status: 500 });

  const mail = await sendLoginCode(row.email, row.code);
  return NextResponse.json({
    ok: true,
    email: row.email,
    via: mail.via,
    smtpConfigured: smtpConfigured(),
    // Dev delivery: no SMTP configured, so the code is returned and the login
    // screen shows it in a clearly-marked dev inbox. With SMTP set, this stays undefined.
    devCode: mail.devCode,
  });
}
