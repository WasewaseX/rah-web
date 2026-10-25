// Task 97: SMTP transport proof WITHOUT sending mail (quota untouched).
// nodemailer verify() = TCP connect + TLS + AUTH only. One-shot, throwaway.
import nodemailer from "nodemailer";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync("/home/z/my-project/.env", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

if (!env.SMTP_HOST || !env.SMTP_PASS) {
  console.log("SMTP env missing - nothing to verify");
  process.exit(1);
}

const t = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: Number(env.SMTP_PORT ?? 587),
  secure: Number(env.SMTP_PORT ?? 587) === 465,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});

try {
  await t.verify();
  console.log(`SMTP TRANSPORT OK: ${env.SMTP_HOST}:${env.SMTP_PORT} auth accepted (no mail sent)`);
  console.log(`sender identity: ${env.SMTP_FROM} (resend.dev sender - no custom domain verified)`);
  process.exit(0);
} catch (e) {
  console.log("SMTP TRANSPORT FAILED:", String(e instanceof Error ? e.message : e));
  process.exit(1);
}
