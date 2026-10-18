"use client";

// P2 of the mega-update: PWA + habit loop, client half.
//  - Registers the service worker (SHA-versioned caches live in sw.js).
//  - Surfaces the browser install prompt exactly once per dismissal.
//  - On open with due reviews or a streak at risk, asks for notification
//    permission ONCE and fires a local notification that clicks back into
//    the app. No push server exists, so nothing beyond local is promised;
//    iOS Safari gets no background notifications and the UI never claims it.

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Habit nudge: on a fresh open with due reviews or a streak at risk, ask for
// permission once and fire ONE local notification that clicks back into the
// app. Best-effort by design - any failure here is silent by contract.
async function maybeNotify(reg: ServiceWorkerRegistration) {
  try {
    if (!("Notification" in window) || Notification.permission === "denied") return;
    if (localStorage.getItem("rah-nudge-dismissed") === "1") return;
    const res = await fetch("/api/state", { cache: "no-store" });
    if (!res.ok) return;
    const state = (await res.json()) as {
      due?: number;
      learner?: { streak?: number };
      today?: { reviews?: number; correct?: number; day?: number };
    };
    const due = Number(state.due ?? 0);
    const streak = Number(state.learner?.streak ?? 0);
    const done = Number(state.today?.correct ?? 0);
    const goal = 20; // matches the default daily goal; the nudge stays generic anyway
    const atRisk = streak > 0 && done === 0;
    if (due <= 0 && !atRisk) return;
    if (Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
    }
    const title = due > 0 ? `${due} card${due === 1 ? "" : "s"} due on your road` : `Day ${streak} is still clean`;
    const body =
      due > 0
        ? done >= goal
          ? "Daily goal met - extra reps are pure interest. Five minutes is enough."
          : "A short session keeps the chain and the schedule honest."
        : "One short session keeps the streak alive.";
    // Small delay so the notification does not fight the page for attention
    // on a cold open the learner initiated deliberately.
    setTimeout(() => {
      reg.showNotification(title, {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: "rah-habit",
        data: { url: "/" },
      });
    }, 4000);
  } catch {
    // nudge is best-effort
  }
}

export default function PwaBootstrap() {
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let cancelled = false;
    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        if (cancelled) return;
        await maybeNotify(reg);
      } catch {
        // SW is an enhancement; the app must run fine without it.
      }
    };
    void register();

    const onPrompt = (e: Event) => {
      e.preventDefault();
      if (sessionStorage.getItem("rah-install-dismissed") === "1") return;
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  if (!installEvt || installDismissed) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-[#2a3242] bg-[#141925]/95 px-4 py-3 shadow-[0_18px_44px_-14px_rgba(0,0,0,.7)]">
      <div className="text-sm">
        <div className="font-bold text-[#f2f5fa]">Install Rah</div>
        <div className="text-xs text-[#8b96a9]">Own window, works offline, one tap from your home screen.</div>
      </div>
      <button
        className="rounded-xl bg-[var(--rah-primary)] px-3 py-1.5 text-sm font-bold text-white"
        onClick={async () => {
          try {
            await installEvt.prompt();
            await installEvt.userChoice;
          } catch {
            // choice is the user's; nothing to record
          }
          setInstallEvt(null);
        }}
      >
        Install
      </button>
      <button
        className="text-xs text-[#8b96a9] hover:text-[#c3cbd8]"
        onClick={() => {
          sessionStorage.setItem("rah-install-dismissed", "1");
          setInstallDismissed(true);
        }}
      >
        Later
      </button>
    </div>
  );
}
