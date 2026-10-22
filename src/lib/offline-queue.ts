"use client";

/*
 * Offline review queue (P1 reliability: offline sync, the write half).
 *
 * The service worker already gives offline READS (grace layer). This module
 * adds the WRITE half for the core learning loop: a review graded while
 * offline is stored in IndexedDB and replayed - in order, oldest first - the
 * moment connectivity returns. The SERVER stays the only source of truth:
 * FSRS scheduling, XP, streaks and quests are all computed server-side at
 * replay time, exactly as if the grade had arrived live.
 *
 * Idempotency contract (the honesty rule of this module): every queued grade
 * carries a clientRef (uuid). The grade route treats a repeated clientRef as
 * a replay of an ALREADY-APPLIED grade (network died after the server
 * committed) and returns the current card state without re-grading, so a
 * flaky connection can never double-apply FSRS state or XP.
 *
 * Nothing here promises full offline app parity: chats/writings/speech stay
 * online-only (they need AI), and the queue covers the review-grade path
 * (Review + Blitz + Pairs), which is the loop a learner on a metro ride
 * actually needs. The UI labels this scope honestly.
 */

import { create } from "zustand";
import { v4 as uuid } from "uuid";

export const QUEUE_DB = "rah-offline";
export const QUEUE_VERSION = 1;
const STORE_QUEUE = "queue";
const STORE_DEAD = "dead";

export type QueuedGrade = {
  id?: number;
  kind: "review-grade";
  clientRef: string;
  queuedAt: number;
  attempts: number;
  lastError?: string;
  payload: { cardId: string; grade: number; dir: string };
};

// ---- shared sync status (drives the OfflineStatusBar + Review chips) ----

type SyncState = {
  online: boolean;
  queued: number;
  dead: number;
  syncing: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
};

export const useSyncStore = create<SyncState>(() => ({
  online: true,
  queued: 0,
  dead: 0,
  syncing: false,
  lastSyncAt: null,
  lastError: null,
}));

export function setSync(patch: Partial<SyncState>) {
  useSyncStore.setState(patch);
}

// ---- outcome classification (pure; unit-tested in scripts/test-offline.ts) ----

export type ReplayOutcome =
  | "applied" // 2xx: server committed (or deduped) - safe to forget the item
  | "rejected" // 4xx (not 408/429): permanent - the server refused the grade itself
  | "transient"; // network error, 408/429/5xx/503: retry later, keep order

export function classifyOutcome(status: number | null): ReplayOutcome {
  if (status === null) return "transient"; // fetch threw = network down
  if (status >= 200 && status < 300) return "applied";
  if (status === 408 || status === 429 || status >= 500) return "transient";
  return "rejected";
}

// ---- IndexedDB plumbing (raw API; zero deps by design) ----

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(QUEUE_DB, QUEUE_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const s = db.createObjectStore(STORE_QUEUE, { keyPath: "id", autoIncrement: true });
        s.createIndex("queuedAt", "queuedAt");
      }
      if (!db.objectStoreNames.contains(STORE_DEAD)) {
        db.createObjectStore(STORE_DEAD, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function countIn(store: string): Promise<number> {
  try {
    const db = await openDb();
    return await new Promise<number>((resolve, reject) => {
      const req = db.transaction(store, "readonly").objectStore(store).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return 0; // no IndexedDB (private mode, old webview): offline queue degrades to no-op
  }
}

export async function queueCounts(): Promise<{ queued: number; dead: number }> {
  return { queued: await countIn(STORE_QUEUE), dead: await countIn(STORE_DEAD) };
}

export async function listQueue(): Promise<QueuedGrade[]> {
  try {
    const db = await openDb();
    return await new Promise<QueuedGrade[]>((resolve, reject) => {
      const req = db.transaction(STORE_QUEUE, "readonly").objectStore(STORE_QUEUE).getAll();
      req.onsuccess = () => resolve((req.result as QueuedGrade[]).sort((a, b) => a.queuedAt - b.queuedAt));
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function enqueueGrade(payload: { cardId: string; grade: number; dir: string }): Promise<void> {
  const item: QueuedGrade = {
    kind: "review-grade",
    clientRef: uuid(),
    queuedAt: Date.now(),
    attempts: 0,
    payload,
  };
  const db = await openDb();
  const tx = db.transaction(STORE_QUEUE, "readwrite");
  tx.objectStore(STORE_QUEUE).add(item);
  await txDone(tx);
  setSync({ queued: await countIn(STORE_QUEUE) });
}

// ---- replay ----

async function postGrade(item: QueuedGrade): Promise<Response | null> {
  return fetch("/api/review/grade", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-rah-client-ref": item.clientRef },
    body: JSON.stringify(item.payload),
  }).catch(() => null);
}

async function removeItem(store: string, id: number | undefined): Promise<void> {
  if (id === undefined) return;
  const db = await openDb();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).delete(id);
  await txDone(tx);
}

async function toDead(item: QueuedGrade, why: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_DEAD, "readwrite");
    tx.objectStore(STORE_DEAD).add({ ...item, lastError: why, deadAt: Date.now() });
    await txDone(tx);
  } catch {
    // dead-lettering is best-effort diagnostics, never a crash path
  }
}

export async function replayQueue(): Promise<{ applied: number; rejected: number; remaining: number }> {
  const { syncing } = useSyncStore.getState();
  if (syncing) return { applied: 0, rejected: 0, remaining: -1 };
  setSync({ syncing: true, lastError: null });
  let applied = 0;
  let rejected = 0;

  try {
    const items = await listQueue();
    for (const item of items) {
      const res = await postGrade(item);
      const outcome = classifyOutcome(res ? res.status : null);
      if (outcome === "applied") {
        await removeItem(STORE_QUEUE, item.id);
        applied += 1;
      } else if (outcome === "rejected") {
        await removeItem(STORE_QUEUE, item.id);
        await toDead(item, `HTTP ${res?.status}`);
        rejected += 1;
      } else {
        // transient: stop the walk, keep strict order (later grades depend on
        // earlier FSRS state), bump the attempt counter for diagnostics
        const db = await openDb();
        const tx = db.transaction(STORE_QUEUE, "readwrite");
        tx.objectStore(STORE_QUEUE).put({ ...item, attempts: item.attempts + 1, lastError: "network" });
        setSync({ lastError: "Network unavailable - will retry when back online" });
        break;
      }
    }
  } finally {
    const counts = await queueCounts();
    setSync({ syncing: false, queued: counts.queued, dead: counts.dead, lastSyncAt: Date.now() });
    if (applied > 0 && typeof window !== "undefined") {
      // The queue's numbers are now server numbers: tell the app shell to
      // refetch /api/state so xp/streak/due counts come back from the source
      // of truth, not from pre-sync local assumptions.
      window.dispatchEvent(new CustomEvent("rah:synced"));
    }
  }
  return { applied, rejected, remaining: (await queueCounts()).queued };
}

// ---- the one submit path all three grade callers share ----

export type SubmitResult = { applied: "live" | "queued"; data?: unknown };

export async function submitReviewGrade(payload: { cardId: string; grade: number; dir: string }): Promise<SubmitResult> {
  try {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      const res = await fetch("/api/review/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) return { applied: "live", data: await res.json().catch(() => undefined) };
      if (res.status === 503) {
        // SW grace layer says offline; queue instead of losing the grade
        await enqueueGrade(payload);
        return { applied: "queued" };
      }
      // Other 4xx: the server refused the grade itself - surface, don't queue
      return { applied: "live", data: { error: res.status } };
    }
  } catch {
    // fall through to the offline queue
  }
  await enqueueGrade(payload);
  setSync({ online: false });
  return { applied: "queued" };
}

// ---- lifecycle wiring (called once from PwaBootstrap) ----

let wired = false;

export function wireOfflineQueue(): void {
  if (wired || typeof window === "undefined") return;
  wired = true;

  const refresh = async () => {
    const counts = await queueCounts();
    setSync({ online: navigator.onLine, queued: counts.queued, dead: counts.dead });
    if (navigator.onLine && counts.queued > 0) void replayQueue();
  };

  window.addEventListener("online", () => void refresh());
  window.addEventListener("offline", () => setSync({ online: false }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refresh();
  });
  void refresh();
}
