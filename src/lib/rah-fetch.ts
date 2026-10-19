"use client";

// Auth header fallback for contexts where cookies cannot persist.
//
// The app runs embedded in preview iframes and other cross-site contexts
// where modern browsers silently DROP SameSite cookies: login succeeds (the
// verify POST creates the session server-side and the dashboard renders from
// its JSON), but every subsequent /api call arrives cookie-less and gets a
// 401 - "Sign in to talk to your coach" while already signed in.
//
// Fix: verify also returns the login token; this wrapper stores it and
// attaches it as x-rah-token on every same-origin /api request. The server
// resolves cookie OR header (getSessionUserWithRequest). On localhost the
// cookie path works as before and the header simply rides along.

const KEY = "rah_token";
let installed = false;

export function storeRahToken(token: string | undefined | null): void {
  try {
    if (token) localStorage.setItem(KEY, token);
  } catch {
    // private mode etc. - the cookie path still works where cookies survive
  }
}

export function clearRahToken(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function getRahToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

// Self-installing: import once in the app shell; every later fetch is covered.
export function installRahFetch(): void {
  if (installed || typeof window === "undefined" || typeof window.fetch !== "function") return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
      const sameOriginApi = url.startsWith("/api/") || url.includes(`${window.location.origin}/api/`);
      const token = getRahToken();
      if (sameOriginApi && token) {
        const headers = new Headers(init?.headers);
        if (!headers.has("x-rah-token")) headers.set("x-rah-token", token);
        return original(input, { ...init, headers });
      }
    } catch {
      // never break a request over the fallback
    }
    return original(input, init);
  };
}
