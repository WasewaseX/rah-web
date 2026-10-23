"use client";

// The login gate. Email + code (works for every address including gmail),
// plus Google OAuth when the deployment configured credentials. Dev delivery:
// with no SMTP configured the code is shown in a clearly-marked dev strip so
// the app is fully usable with zero setup.

import { useEffect, useState } from "react";
import { Mail, ShieldCheck, KeyRound, Sparkles, ArrowLeft } from "lucide-react";
import { Btn } from "./ui";
import { storeRahToken } from "@/lib/rah-fetch";

interface SessionInfo {
  user: { email: string; name: string } | null;
  googleConfigured: boolean;
}

export default function Login({ onSignedIn }: { onSignedIn: (user: { email: string; name: string }) => void }) {
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [googleOk, setGoogleOk] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((s: SessionInfo) => {
        setGoogleOk(s.googleConfigured);
        if (s.user) onSignedIn(s.user);
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [onSignedIn]);

  const requestCode = async () => {
    setBusy(true);
    setError("");
    setDevCode("");
    try {
      const r = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await r.json()) as { error?: string; devCode?: string; via?: string };
      if (!r.ok) {
        setError(data.error ?? "Could not send the code.");
      } else {
        setStage("code");
        setSentTo(email.trim());
        if (data.devCode) setDevCode(data.devCode);
      }
    } catch {
      setError("Network hiccup - try once more.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: sentTo, code }),
      });
      const data = (await r.json()) as { error?: string; token?: string; user?: { email: string; name: string } };
      if (!r.ok || !data.user) {
        setError(data.error ?? "Verification failed.");
      } else {
        // Keep the token for contexts where cookies cannot persist (preview
        // iframes drop SameSite cookies entirely): the fetch wrapper attaches
        // it as x-rah-token on every /api call.
        storeRahToken(data.token);
        onSignedIn(data.user);
      }
    } catch {
      setError("Network hiccup - try once more.");
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    // Contentful boot splash (Task 92): the SSR shell previously painted only a
    // bare spinner, and Chrome does not count a spinner as a contentful paint -
    // real-user FCP waited for full hydration (~2.6s on a throttled mobile
    // profile). Rendering the same wordmark block the sign-in view uses (static
    // markup, identical on the server and the client's first render, zero layout
    // shift on swap) lets the browser paint real text as soon as CSS lands.
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--rah-bg)] px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-[var(--rah-primary)] to-[#2f62c4] text-2xl font-black text-white shadow-[0_16px_40px_-12px_rgba(78,140,255,.6)]">
            R
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#f2f5fa]">Rah</h1>
          <p className="mt-1 text-sm font-medium text-[#7d889c]">B2 to C1, your road. Sign in to continue.</p>
          <span className="mx-auto mt-6 block h-6 w-6 animate-spin rounded-full border-2 border-[#2a3242] border-t-[var(--rah-primary)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--rah-bg)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-[var(--rah-primary)] to-[#2f62c4] text-2xl font-black text-white shadow-[0_16px_40px_-12px_rgba(78,140,255,.6)]">
            R
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#f2f5fa]">Rah</h1>
          <p className="mt-1 text-sm font-medium text-[#7d889c]">B2 to C1, your road. Sign in to continue.</p>
        </div>

        <div className="rounded-3xl border border-white/[0.07] bg-[#0f1522] p-5 shadow-[0_24px_64px_-32px_rgba(0,0,0,.9)]">
          {stage === "email" ? (
            <>
              <label className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7d889c]">Email</label>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#141c2e] px-3 focus-within:border-[var(--rah-primary)]/50">
                <Mail className="h-4 w-4 shrink-0 text-[#5d6879]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && email.includes("@") && void requestCode()}
                  placeholder="you@gmail.com"
                  className="min-h-12 w-full bg-transparent text-sm text-[#f2f5fa] outline-none placeholder:text-[#5d6879]"
                />
              </div>
              <Btn onClick={() => void requestCode()} disabled={busy || !email.includes("@")} className="mt-3 w-full !min-h-12 justify-center">
                <KeyRound className="h-4 w-4" /> Send login code
              </Btn>

              <div className="my-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-white/[0.07]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5d6879]">or</span>
                <span className="h-px flex-1 bg-white/[0.07]" />
              </div>

              <a
                href={googleOk ? "/api/auth/google/start" : undefined}
                onClick={
                  googleOk
                    ? undefined
                    : (e) => {
                        e.preventDefault();
                        setError("Google sign-in is not configured here. Enter your gmail address above - the code works the same.");
                      }
                }
                className="flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-white/[0.1] bg-white text-sm font-bold text-[#1a1f2b] transition-colors hover:bg-[#e8eaf0]"
              >
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5">
                  <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.02.15 3.5 2.7.24.02c2.2-2.05 3.5-5.05 3.5-8.58z" />
                  <path fill="#34A853" d="M12 24c3.2 0 5.9-1.07 7.9-2.9l-3.76-2.9c-1 .7-2.36 1.2-4.1 1.2-3.15 0-5.83-2.08-6.78-4.96l-.14.01-3.6 2.8-.05.13C3.43 21.3 7.4 24 12 24z" />
                  <path fill="#FBBC05" d="M5.2 14.4c-.24-.72-.38-1.5-.38-2.4s.14-1.67.37-2.4l-.01-.16-3.65-2.83-.12.06C.5 8.3 0 10.1 0 12s.5 3.7 1.4 5.33l3.8-2.93z" />
                  <path fill="#EA4335" d="M12 4.6c2.25 0 3.77.97 4.64 1.78l3.4-3.3C17.9 1.07 15.2 0 12 0 7.4 0 3.43 2.7 1.4 6.67l3.8 2.93C6.17 6.7 8.85 4.6 12 4.6z" />
                </svg>
                Continue with Gmail
              </a>
            </>
          ) : (
            <>
              <button onClick={() => setStage("email")} className="mb-3 flex items-center gap-1 text-[11px] font-bold text-[#7d889c] hover:text-[#dbe3f0]">
                <ArrowLeft className="h-3 w-3" /> change email
              </button>
              <label className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7d889c]">
                Code sent to {sentTo}
              </label>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#141c2e] px-3 focus-within:border-[var(--rah-primary)]/50">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[#5d6879]" />
                <input
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && code.length === 6 && void verify()}
                  placeholder="000000"
                  className="min-h-12 w-full bg-transparent text-lg font-black tracking-[0.3em] text-[#f2f5fa] outline-none placeholder:text-[#3a4356]"
                />
              </div>
              {devCode && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#ffb02e]/25 bg-[#ffb02e]/[0.06] px-3 py-2.5">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ffd08a]" />
                  <div className="text-[12px] leading-relaxed text-[#ffd08a]">
                    <b>Dev inbox</b> (no SMTP configured): your code is{" "}
                    <b className="tracking-[0.2em]">{devCode}</b>
                  </div>
                </div>
              )}
              <Btn onClick={() => void verify()} disabled={busy || code.length !== 6} className="mt-3 w-full !min-h-12 justify-center">
                <ShieldCheck className="h-4 w-4" /> Verify and sign in
              </Btn>
              <button onClick={() => void requestCode()} disabled={busy} className="mt-2 w-full text-center text-[11px] font-bold text-[#7d889c] hover:text-[#dbe3f0]">
                resend code
              </button>
            </>
          )}

          {error && <div className="mt-3 rounded-xl border border-[#ff6b6b]/25 bg-[#ff6b6b]/[0.08] px-3 py-2 text-[12px] font-semibold text-[#ffb3b3]">{error}</div>}
        </div>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-[#5d6879]">
          One account per learner. Codes expire in 10 minutes and work once.
        </p>
      </div>
    </div>
  );
}
