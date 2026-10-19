// Auth core: email-code login, sessions, cookie handling.
// Flow: POST /api/auth/request-code {email} -> 6-digit code emailed (10 min TTL, single use,
// rate limited) -> POST /api/auth/verify {email, code} -> User row (created on first login)
// + Session row + httpOnly cookie. getSessionUser(req) resolves the cookie for every route.
// Gmail: the same code flow covers gmail addresses; Google OAuth is optional extras in
// /api/auth/google/* (active only when GOOGLE_CLIENT_ID/SECRET are configured).

import { createHash, randomBytes, randomInt } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "rah_session";
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000; // 30 days
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CODES_PER_WINDOW = 5;
const CODE_WINDOW_MS = 15 * 60 * 1000;

export function normalizeEmail(email: string): string {
  return String(email ?? "").trim().toLowerCase();
}

export function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export interface RequestCodeResult {
  ok: boolean;
  error?: string;
}

export async function issueLoginCode(rawEmail: string): Promise<RequestCodeResult> {
  const email = normalizeEmail(rawEmail);
  if (!validEmail(email)) return { ok: false, error: "That does not look like an email address." };

  // Rate limit: 5 codes per email per 15 minutes. Honest limit, no lockout games.
  const windowStart = new Date(Date.now() - CODE_WINDOW_MS);
  const recent = await db.loginCode.count({ where: { email, createdAt: { gte: windowStart } } });
  if (recent >= MAX_CODES_PER_WINDOW) {
    return { ok: false, error: "Too many codes requested. Wait a few minutes and try again." };
  }

  const code = newCode();
  await db.loginCode.create({
    data: { email, code, expiresAt: new Date(Date.now() + CODE_TTL_MS) },
  });
  return { ok: true };
}

export interface VerifyResult {
  ok: boolean
  error?: string;
  token?: string;
  user?: { id: string; email: string; name: string; provider: string; isNew: boolean };
}

export async function verifyLoginCode(rawEmail: string, rawCode: string): Promise<VerifyResult> {
  const email = normalizeEmail(rawEmail);
  const code = String(rawCode ?? "").trim();
  if (!email || !/^\d{6}$/.test(code)) return { ok: false, error: "Enter the 6-digit code from your email." };

  const row = await db.loginCode.findFirst({
    where: { email, code, usedAt: null, expiresAt: { gte: new Date() } },
    orderBy: { id: "desc" },
  });
  if (!row) return { ok: false, error: "That code is wrong, used, or expired. Request a fresh one." };

  await db.loginCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });

  let user = await db.user.findUnique({ where: { email } });
  const isNew = !user;
  if (!user) {
    user = await db.user.create({ data: { email, name: email.split("@")[0], provider: "email" } });
  }

  const token = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      token: hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  return { ok: true, token, user: { id: user.id, email: user.email, name: user.name, provider: user.provider, isNew } };
}

// Tokens are stored hashed: a DB leak must not leak live sessions.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  provider: string;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return resolveToken(token);
}

// Embedded contexts (preview iframes, third-party-cookie-blocked browsers)
// drop SameSite cookies entirely: the verify POST succeeds and the dashboard
// renders from its response body, but no cookie is ever stored, so every
// later call arrives cookie-less. Those callers send the login token in the
// x-rah-token header instead - resolve it as a full first-class credential.
export async function getSessionUserWithRequest(req: Request): Promise<SessionUser | null> {
  const jar = await cookies();
  const cookieToken = jar.get(SESSION_COOKIE)?.value;
  if (cookieToken) {
    const fromCookie = await resolveToken(cookieToken);
    if (fromCookie) return fromCookie;
  }
  const headerToken = req.headers.get("x-rah-token");
  return resolveToken(headerToken);
}

export async function resolveToken(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { token: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return { id: session.user.id, email: session.user.email, name: session.user.name, provider: session.user.provider };
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

export async function destroySession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await db.session.deleteMany({ where: { token: hashToken(token) } }).catch(() => undefined);
}

// --- Google OAuth (optional: only active with GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET) ---

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleAuthUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface GoogleProfile {
  email: string;
  name: string;
}

export async function exchangeGoogleCode(code: string, origin: string): Promise<GoogleProfile | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: `${origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) return null;
  const tokens = (await res.json()) as { access_token?: string };
  if (!tokens.access_token) return null;
  const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  if (!info.ok) return null;
  const profile = (await info.json()) as { email?: string; name?: string };
  if (!profile.email) return null;
  return { email: profile.email, name: profile.name ?? profile.email.split("@")[0] };
}

export async function upsertGoogleUser(profile: GoogleProfile): Promise<{ id: string; email: string; name: string }> {
  const email = normalizeEmail(profile.email);
  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    user = await db.user.create({ data: { email, name: profile.name, provider: "google" } });
  }
  return { id: user.id, email: user.email, name: user.name };
}
