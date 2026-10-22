"use client";

// Offline-sync badge (Task 68): an honest, always-visible indicator that the
// learner made grades offline and they are waiting to sync. Renders nothing
// while the outbox is empty and the device is online - no fake "synced"
// claims, no decoration. The outbox count and the network state come through
// useSyncExternalStore; the flush is event-driven (online/visibility), so no
// setState ever runs synchronously inside an effect.

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { subscribe, count, flush } from "@/lib/offline";

function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const getOnlineSnapshot = () => navigator.onLine;
const getOnlineServerSnapshot = () => true;
const getCountServerSnapshot = () => 0;

export default function OfflineBadge({ onSynced }: { onSynced?: (sent: number) => void }) {
  const pending = useSyncExternalStore(subscribe, count, getCountServerSnapshot);
  const online = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getOnlineServerSnapshot);

  const onSyncedRef = useCallback(
    (sent: number) => onSynced?.(sent),
    [onSynced],
  );

  // Reconnect flush: drain the outbox whenever the device comes back online
  // or the tab returns to the foreground. All state changes happen inside the
  // flush promise chain (external events), never synchronously in the effect.
  useEffect(() => {
    const drain = () => {
      void flush().then((r) => {
        if (r && r.sent > 0) onSyncedRef(r.sent);
      });
    };
    window.addEventListener("online", drain);
    const vis = () => {
      if (document.visibilityState === "visible" && navigator.onLine) drain();
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("online", drain);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [onSyncedRef]);

  if (pending === 0 && online) return null;

  return (
    <div
      data-testid="offline-badge"
      className="fixed bottom-20 left-1/2 z-[65] flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#2a3242] bg-[#141925]/95 px-3.5 py-1.5 text-xs shadow-[0_10px_28px_-10px_rgba(0,0,0,.65)] md:bottom-5"
      role="status"
    >
      {online ? (
        <>
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          <span className="font-semibold text-[#c3f0d1]">{pending} grade{pending === 1 ? "" : "s"} waiting to sync</span>
        </>
      ) : (
        <>
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="font-semibold text-[#f0dcae]">
            Offline - {pending} grade{pending === 1 ? "" : "s"} queued on this device
          </span>
        </>
      )}
    </div>
  );
}
