"use client";

// Offline status affordances (Task 70): the honest bar that tells the learner
// what offline actually means in Rah today. It appears ONLY when there is
// something to say - the browser is offline, or grades are still queued, or a
// sync just finished - and it never pretends the whole app works offline:
// chats/writings/speech need the network (AI), the review loop does not.

import { useEffect } from "react";
import { CloudOff, CloudUpload, Loader2, RefreshCcw } from "lucide-react";
import { replayQueue, useSyncStore, wireOfflineQueue } from "@/lib/offline-queue";

export default function OfflineStatusBar() {
  const { online, queued, dead, syncing, lastSyncAt, lastError } = useSyncStore();

  useEffect(() => {
    wireOfflineQueue();
  }, []);

  if (online && queued === 0 && dead === 0) return null;

  const quiet = online && !syncing && queued === 0 && lastSyncAt !== null && !lastError;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-3 pointer-events-none"
    >
      <div className="pointer-events-auto flex max-w-full items-center gap-2.5 rounded-2xl border border-[#2a3242] bg-[#141925]/95 px-3.5 py-2 shadow-[0_14px_38px_-14px_rgba(0,0,0,.75)] backdrop-blur">
        {!online && (
          <>
            <CloudOff className="h-4 w-4 shrink-0 text-[#ffb454]" />
            <div className="min-w-0 text-xs leading-tight">
              <span className="font-bold text-[#f2f5fa]">Offline.</span>{" "}
              <span className="text-[#a9b4c6]">
                Review grades are saved on this device{queued > 0 ? ` (${queued} waiting)` : ""} and sync automatically. Chat, writing and speaking need the network.
              </span>
            </div>
          </>
        )}
        {online && syncing && (
          <>
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#9dc0ff]" />
            <div className="text-xs text-[#a9b4c6]">
              Syncing {queued} saved grade{queued === 1 ? "" : "s"}…
            </div>
          </>
        )}
        {online && !syncing && queued > 0 && (
          <>
            <CloudUpload className="h-4 w-4 shrink-0 text-[#ffb454]" />
            <div className="text-xs text-[#a9b4c6]">
              {queued} grade{queued === 1 ? "" : "s"} waiting to sync{lastError ? " - last try hit a network error" : ""}.
            </div>
            <button
              className="flex items-center gap-1.5 rounded-xl border border-[#2a3242] px-2.5 py-1 text-xs font-bold text-[#dbe3f0] hover:border-[#3f4c63]"
              onClick={() => void replayQueue()}
            >
              <RefreshCcw className="h-3.5 w-3.5" /> Sync now
            </button>
          </>
        )}
        {quiet && (
          <div className="text-xs text-[#a9b4c6]">
            <span className="font-bold text-[#2fc273]">Synced.</span> Your queued reviews are in.
            {dead > 0 && ` ${dead} could not be applied (server refused) - they are kept in a local dead-letter list.`}
          </div>
        )}
      </div>
    </div>
  );
}
