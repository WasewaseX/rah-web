// Email delivery for login codes. Two modes:
//  - SMTP configured (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS + optional SMTP_FROM): real email via nodemailer.
//  - Otherwise DEV delivery: the code is logged and surfaced in the API response so the
//    app is fully usable with zero setup. The response marks it clearly as dev delivery.
// Gmail addresses work in both modes: the code flow does not care about the provider,
// and OAuth (Google) is a separate, optional path in /api/auth/google/start.

import nodemailer, { type Transporter } from "nodemailer";

export interface MailResult {
  delivered: boolean;
  devCode?: string; // only set in dev delivery
  via: "smtp" | "dev";
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

export async function sendLoginCode(email: string, code: string): Promise<MailResult> {
  const t = getTransport();
  const html = CODE_MAIL_STYLES.replace("{{CODE}}", code);
  if (!t) {
    // Dev delivery: no SMTP in this deployment. Log it loudly, return it so the
    // login screen can show it in a "dev inbox" strip. Never in production SMTP mode.
    console.log(`[mailer] DEV login code for ${email}: ${code}`);
    return { delivered: false, devCode: code, via: "dev" };
  }
  await t.sendMail({
    from: smtpFrom,
    to: email,
    subject: `Rah sign-in code: ${code}`,
    text: `Your Rah sign-in code is ${code}. It expires in 10 minutes and works once.`,
    html,
  });
  return { delivered: true, via: "smtp" };
}
