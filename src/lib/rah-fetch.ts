"use client";

// Auth fallback for contexts where cookies cannot persist.
//
// The app runs embedded in preview iframes and other cross-site contexts
// where modern browsers silently DROP SameSite cookies: login succeeds (the
// verify POST creates the session server-side and the dashboard renders from
// its JSON), but every subsequent /api call arrives cookie-less and gets a
// 401 - "Sign in to talk to your coach" while already signed in.
//
// Defense ladder (server mirrors it in getSessionUserWithRequest):
//   1. httpOnly cookie (rah_session) - normal path, no JS-readable credential.
//   2. Partitioned SameSite=None cookie (rah_session_embed, prod+HTTPS) -
//      requested via the custom x-rah-embed header this module adds for
//      embedded frames (window.self !== window.top). Custom headers double as
//      the CSRF guard: cross-site forms cannot set them.
//   3. x-rah-token header - LAST RESORT only. The token is kept in
//      sessionStorage (dies with the tab, never localStorage) and only when
//      the server actually hands one over (verify responds with a body token
//      exclusively to x-rah-embed callers). Any legacy localStorage token is
//      removed on load.

const KEY = "rah_token";
let installed = false;

export function storeRahToken(token: string | undefined | null): void {
  if (!token) return;
  try {
    // Session-scoped only: closed tab = gone. Never localStorage (XSS-stealable
    // forever); also scrub any legacy token older versions left behind.
    localStorage.removeItem(KEY);
    sessionStorage.setItem(KEY, token);
  } catch {
    // private mode etc. - the cookie paths still work where cookies survive
  }
}

export function clearRahToken(): void {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {}
}

export function getRahToken(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // cross-origin access threw => definitely framed
  }
}

// Self-installing: import once in the app shell; every later fetch is covered.
export function installRahFetch(): void {
  if (installed || typeof window === "undefined" || typeof window.fetch !== "function") return;
  installed = true;
  try {
    localStorage.removeItem(KEY); // migration away from the old localStorage token
  } catch {}
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
      const sameOriginApi = url.startsWith("/api/") || url.includes(`${window.location.origin}/api/`);
      if (sameOriginApi) {
        const headers = new Headers(init?.headers);
        const embedded = isEmbedded();
        const token = embedded ? getRahToken() : null;
        if (token && !headers.has("x-rah-token")) headers.set("x-rah-token", token);
        if (embedded && !headers.has("x-rah-embed")) headers.set("x-rah-embed", "1");
        return original(input, { ...init, headers });
      }
    } catch {
      // never break a request over the fallback
    }
    return original(input, init);
  };
}
