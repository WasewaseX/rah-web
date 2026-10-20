import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { issueLoginCode } from "@/lib/auth";
import { sendLoginCode, smtpConfigured } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({ email: "" }));
  // Per-IP throttle on top of the per-email DB limit (proxy-aware best effort).
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim()
    || (req.headers.get("x-real-ip") ?? "");
  const issued = await issueLoginCode(String(email ?? ""), ip);
  if (!issued.ok) return NextResponse.json({ error: issued.error }, { status: 400 });

  // The plaintext code came back from issueLoginCode's memory; the DB only
  // ever saw its sha256 hash. Mail it immediately and let it go.
  const mail = await sendLoginCode(String(email).trim().toLowerCase(), issued.code!);
  return NextResponse.json({
    ok: true,
    email: String(email).trim().toLowerCase(),
    via: mail.via,
    smtpConfigured: smtpConfigured(),
    // Dev delivery only (no SMTP configured AND not production): the code is
    // returned so the login screen can show it in the clearly-marked dev
    // inbox. With SMTP set, or in production, this stays undefined.
    devCode: mail.devCode && process.env.NODE_ENV !== "production" ? mail.devCode : undefined,
  });
}
