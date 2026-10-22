// Email delivery for login codes. Two modes:
//  - SMTP configured (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS + optional SMTP_FROM): real email via nodemailer.
//  - Otherwise DEV delivery: the code is logged and surfaced in the API response so the
//    app is fully usable with zero setup. The response marks it clearly as dev delivery.
// Gmail addresses work in both modes: the code flow does not care about the provider,
// and OAuth (Google) is a separate, optional path in /api/auth/google/start.

import nodemailer, { type Transporter } from "nodemailer";
import { createHash } from "crypto";
import { db } from "@/lib/db";

export interface MailResult {
  delivered: boolean;
  devCode?: string; // only set in dev delivery
  via: "smtp" | "dev";
  idempotent?: boolean; // true when a retry hit the ledger instead of SMTP
}

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT ?? 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM ?? smtpUser ?? "rah@localhost";

let transporter: Transporter | null = null;

function getTransport(): Transporter | null {
  if (!smtpHost) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
    });
  }
  return transporter;
}

export function smtpConfigured(): boolean {
  return Boolean(smtpHost);
}

export function isGmailAddress(email: string): boolean {
  return /@(gmail\.com|googlemail\.com)$/i.test(email.trim());
}

const CODE_MAIL_STYLES = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0d1119;padding:32px;border-radius:16px;color:#f2f5fa;max-width:480px">
    <div style="font-size:22px;font-weight:900;letter-spacing:-0.02em;margin-bottom:6px">Rah</div>
    <div style="font-size:13px;color:#8b96a9;margin-bottom:20px">Your sign-in code. It expires in 10 minutes and works once.</div>
    <div style="font-size:40px;font-weight:900;letter-spacing:0.3em;background:#16233e;border:1px solid #2a3a5c;border-radius:12px;padding:18px 24px;text-align:center;color:#9dc0ff">{{CODE}}</div>
    <div style="font-size:12px;color:#5d6879;margin-top:20px">If you did not request this, ignore this email. Never share this code.</div>
  </div>`;

// Idempotency window (audit P2): one send per (kind, recipient) per 60s,
// measured SLIDING from the first attempt - not calendar buckets, so a call
// pair straddling a minute boundary still dedupes. A double-click, a route
// retry or an orchestrator replay hits the ledger and gets the FIRST
// attempt's recorded outcome instead of a second email; a legitimate later
// request (window expired) refreshes the same row, so the ledger stays one
// row per (kind, recipient) = the delivery report for that address.
const IDEM_WINDOW_MS = 60_000;

function idemKey(kind: string, to: string): string {
  return createHash("sha256").update(`${kind}|${to}`).digest("hex");
}

export async function sendLoginCode(email: string, code: string): Promise<MailResult> {
  const t = getTransport();
  const html = CODE_MAIL_STYLES.replace("{{CODE}}", code);
  const key = idemKey("login_code", email);

  // Ledger-first: if this recipient+kind sent (or failed) inside the window,
  // report that attempt instead of sending again.
  const prior = await db.mailLog.findUnique({ where: { idemKey: key } }).catch(() => null);
  if (prior && Date.now() - prior.at.getTime() < IDEM_WINDOW_MS) {
    console.log(`[mailer] idempotent replay for ${email} (prior ${prior.status} at ${prior.at.toISOString()})`);
    return {
      delivered: prior.status === "sent",
      devCode: prior.status === "dev" ? code : undefined,
      via: prior.status === "dev" ? "dev" : "smtp",
      idempotent: true,
    };
  }

  // Record helper: refresh the row when it exists (window expired), else create.
  const record = (data: { status: string; messageId?: string; error?: string }) =>
    db.mailLog.upsert({
      where: { idemKey: key },
      create: { to: email, kind: "login_code", idemKey: key, ...data },
      update: { at: new Date(), ...data },
    }).catch(() => undefined);

  if (!t) {
    // Dev delivery: no SMTP in this deployment. Log it loudly, return it so the
    // login screen can show it in a "dev inbox" strip. Never in production SMTP mode.
    console.log(`[mailer] DEV login code for ${email}: ${code}`);
    await record({ status: "dev" });
    return { delivered: false, devCode: code, via: "dev" };
  }
  try {
    const info = await t.sendMail({
      from: smtpFrom,
      to: email,
      subject: `Rah sign-in code: ${code}`,
      text: `Your Rah sign-in code is ${code}. It expires in 10 minutes and works once.`,
      html,
    });
    // Delivery reporting (audit P2): the SMTP message id lands in the ledger,
    // so "did the email go out?" is a DB query, not a support ticket.
    await record({ status: "sent", messageId: String(info?.messageId ?? "") });
    return { delivered: true, via: "smtp" };
  } catch (e) {
    await record({ status: "failed", error: String((e as Error).message ?? e).slice(0, 500) });
    throw e;
  }
}
