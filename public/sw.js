/*
 * Rah service worker (P2 of the mega-update: PWA + habit loop).
 *
 * Honesty rules this worker keeps:
 *  - The freshness beacon (/api/version) is NEVER cached - the deploy
 *    guarantee ("localhost and preview must return the same SHA") must not
 *    be masked by a cache hit.
 *  - Cache versions are keyed by the LIVE git SHA read from /api/version at
 *    install; on activate, every cache that is not the current one is
 *    evicted. A new deploy therefore self-evicts stale shells.
 *  - API calls are network-first with a short timeout; the cache is only a
 *    read-mostly grace layer for offline opens, never a source of stale
 *    truth when the network is alive.
 *  - Reminders are local notifications only. There is no push server, so no
 *    push is promised. A "remind me later" timer lives inside the worker and
 *    is best-effort by nature (browsers may reclaim it); the UI says so.
 */

const SHELL = "/";

let CACHE = "rah-boot";
// A dirty tree (or a missing SHA) means the served JS is NOT the committed
// build: dev and preview recompile continuously while the git SHA stands
// still, so content is NOT addressed by its URL. Caching /_next/static then
// freezes the app at the last commit until the next one - the service worker
// becomes the reason "my fix is not showing up". In that state the worker
// must stay out of the way of every static chunk.
let NO_CACHE_STATIC = false;

async function resolveCacheName() {
  if (CACHE !== "rah-boot") return CACHE;
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    const j = await res.json();
    NO_CACHE_STATIC = !j.version || j.version === "dev" || j.version === "no-git" || Number(j.dirty ?? 0) > 0;
    CACHE = NO_CACHE_STATIC ? "rah-dev-nocache" : `rah-${j.version}`;
  } catch {
    NO_CACHE_STATIC = true;
    CACHE = "rah-dev-nocache";
  }
  return CACHE;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const name = await resolveCacheName();
      const cache = await caches.open(name);
      try {
        await cache.addAll([SHELL, "/logo.svg", "/icons/icon-192.png", "/icons/icon-512.png"]);
      } catch {
        // offline at install time: the shell gets cached on first success
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const name = await resolveCacheName();
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== name).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

function withTimeout(fetchPromise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    fetchPromise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function cacheFirst(req) {
  const cache = await caches.open(await resolveCacheName());
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone()).catch(() => {});
  return res;
}

async function networkFirst(req, timeoutMs = 4500) {
  const cache = await caches.open(await resolveCacheName());
  try {
    const res = await withTimeout(fetch(req), timeoutMs);
    if (res.ok && req.method === "GET") cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw new Error("offline and uncached");
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // The freshness beacon must never be answered from cache.
  if (url.pathname === "/api/version") return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(req).catch(() => new Response(JSON.stringify({ offline: true, error: "offline and uncached" }), { status: 503, headers: { "content-type": "application/json" } })));
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await withTimeout(fetch(req), 5000);
          const cache = await caches.open(await resolveCacheName());
          cache.put(SHELL, res.clone()).catch(() => {});
          return res;
        } catch {
          const cache = await caches.open(await resolveCacheName());
          return (await cache.match(SHELL)) || (await cache.match("/")) || Response.error();
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons/") || url.pathname === "/logo.svg") {
    if (NO_CACHE_STATIC) return; // dev/preview: chunks are not URL-addressed, network only
    event.respondWith(cacheFirst(req).catch(() => Response.error()));
  }
});

// Local reminders (honest scope): { type: "RAH_REMIND", hours, title, body }
// Schedules one local notification from inside the worker. Best effort by
// nature - if the browser reclaims the timer or the worker dies, the
// reminder simply does not fire; no promise is made beyond that.
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "RAH_REMIND") return;
  const hours = Math.min(24, Math.max(0.1, Number(data.hours) || 2));
  const title = String(data.title || "Rah is waiting");
  const body = String(data.body || "Your reviews are due.");
  setTimeout(() => {
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "rah-reminder",
      data: { url: "/" },
    });
  }, hours * 3600 * 1000);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          await client.focus();
          client.navigate(url).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
