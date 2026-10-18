#!/usr/bin/env python3
"""P2 PWA drive: the browser-level proof the spec's gate demands.

Claim set:
  1. Manifest served, parsed, installable shape (icons 192+512, standalone).
  2. Service worker registers, activates, and CONTROLS the page.
  3. Worker cache is SHA-versioned and contains the shell.
  4. Offline reload renders the real app shell (no dinosaur).
  5. /api/version is NEVER answered from cache (beacon honesty) - offline
     version fetch must fail rather than serve a stale SHA.
  6. The habit nudge path: due>0 state produces a notification permission
     ask is SKIPPABLE (headless denies by default) - assert the app still
     boots clean with notifications denied (graceful degradation).
  Full state restore: none needed (read-only drive).
"""
import json
import time
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
fails = []
n = 0

def check(ok, what, detail=""):
    global n
    n += 1
    print(("PASS " if ok else "FAIL ") + what + ("" if ok else f" -> {detail}"))
    if not ok:
        fails.append(what)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    # 1) manifest shape
    import urllib.request
    man = json.load(urllib.request.urlopen(f"{BASE}/manifest.webmanifest"))
    icons = man.get("icons", [])
    sizes = {i.get("sizes") for i in icons}
    check(man.get("display") == "standalone" and "192x192" in sizes and "512x512" in sizes,
          "manifest: standalone with 192+512 icons", json.dumps(man)[:200])
    check(any(i.get("purpose") == "maskable" for i in icons), "manifest: maskable icon present", str(icons))

    # 2+3) SW registration + control + SHA cache
    page.goto(BASE, wait_until="networkidle")
    time.sleep(2.5)  # registration + activation + claim
    sw = page.evaluate("""async () => {
      if (!('serviceWorker' in navigator)) return { supported: false };
      const reg = await navigator.serviceWorker.ready;
      const keys = await caches.keys();
      return {
        supported: true,
        controlled: !!navigator.serviceWorker.controller,
        scope: reg.scope,
        caches: keys,
        cacheKeys: (await Promise.all(keys.map(async k => ({ k, n: (await (await caches.open(k)).keys()).length })))),
      };
    }""")
    check(sw.get("supported") and sw.get("controlled"), "SW: registered and controlling the page", json.dumps(sw)[:200])
    caches = sw.get("caches", [])
    check(any(c.startswith("rah-") for c in caches), "SW: SHA-versioned cache present", str(caches))
    total_cached = sum(c["n"] or 0 for c in sw.get("cacheKeys", []))
    check(total_cached >= 3, "SW: shell precached", json.dumps(sw.get("cacheKeys", [])))

    version_local = json.load(urllib.request.urlopen(f"{BASE}/api/version"))
    sha = version_local.get("version", "")
    check(any(sha and sha.split("-")[0][:8] in c for c in caches), "SW: cache name carries the live git SHA", f"{caches} vs {sha}")

    # 4) offline reload renders the shell
    ctx.set_offline(True)
    page.reload(wait_until="domcontentloaded")
    time.sleep(1.5)
    body = page.evaluate("() => document.body ? document.body.innerText.slice(0, 400) : ''")
    has_shell = ("Rah" in body) and ("dinosaur" not in body.lower())
    check(has_shell, "offline: reload renders the app shell", body[:120])
    title_ok = page.evaluate("() => document.title")
    check("Rah" in title_ok, "offline: document title intact", title_ok)

    # 5) beacon honesty: /api/version must NOT come from cache when offline
    ver_offline = page.evaluate("""async () => {
      try {
        const r = await fetch('/api/version', { cache: 'no-store' });
        return { status: r.status };
      } catch (e) {
        return { status: 0, err: String(e).slice(0, 80) };
      }
    }""")
    check(ver_offline.get("status") != 200, "beacon: /api/version not served from cache offline", json.dumps(ver_offline))

    # API grace: a cached API read (if any was cached during the online pass)
    # stays available, and the worker answers 503 JSON for uncached ones.
    api_off = page.evaluate("""async () => {
      try {
        const r = await fetch('/api/state', { cache: 'no-store' });
        return { status: r.status, json: r.headers.get('content-type') || '' };
      } catch (e) {
        return { status: 0, err: String(e).slice(0, 80) };
      }
    }""")
    check(api_off.get("status") in (200, 503), "offline: API answered 200 (grace) or 503 (honest JSON)", json.dumps(api_off))

    ctx.set_offline(False)

    # 6) notifications denied must not break the app
    ctx2 = browser.new_context(viewport={"width": 1280, "height": 900},
                               permissions=[])  # no notification permission granted
    p2 = ctx2.new_page()
    errs2 = []
    p2.on("pageerror", lambda e: errs2.append(str(e)))
    p2.goto(BASE, wait_until="networkidle")
    time.sleep(2)
    boot = p2.evaluate("() => document.body.innerText.includes('Rah')")
    check(boot and len(errs2) == 0, "degrade: app boots clean with notifications ungranted", f"{errs2[:2]}")

    # 7) install banner: when the browser offers the prompt, the banner shows
    banner = p2.evaluate("""() => {
      const evt = new Event('beforeinstallprompt');
      evt.prompt = () => Promise.resolve();
      evt.userChoice = Promise.resolve({ outcome: 'dismissed' });
      window.dispatchEvent(evt);
      return new Promise(res => setTimeout(() => {
        const t = document.body.innerText;
        res({ shown: t.includes('Install Rah'), dismiss: t.includes('Later') });
      }, 300));
    }""")
    check(banner.get("shown") and banner.get("dismiss"), "install: banner renders on beforeinstallprompt", json.dumps(banner))

    browser.close()

print(f"\nPWA DRIVE: {n - len(fails)}/{n} " + ("ALL PASS" if not fails else f"{len(fails)} FAILURES"))
raise SystemExit(0 if not fails else 1)
