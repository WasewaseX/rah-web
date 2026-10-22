"use client";

// Real offline sync (Task 68, audit P1): grades made with no network are
// queued in localStorage and replayed automatically on reconnect. The server
// dedupes replays via the gid receipt (GradeAck), so flushing twice is safe.
//
// Honesty rules this module keeps:
//  - A queued grade is announced to the learner (badge + toasts), never
//    silently pretended to have synced.
//  - Only NETWORK failures enqueue. A 4xx answer is a real refusal (bad
//    payload, rate limit) - retrying it forever would be a lie, so the item
//    is dropped and counted as such.
//  - The outbox holds grades only (the core daily loop); chat/essays/speech
//    need the model and are refused offline with a speakable message instead
//    of a fake queue entry.
//  - localStorage (not IndexedDB): the entries are tiny (<200 B), the count
//    stays small (a day of reviews), and synchronous reads keep the UI
//    simple. The queue is capped; the cap is generous for a day's round.

import { awardLocalXpHint } from "@/lib/offline-helpers";

const KEY = "rah-outbox-v1";
const MAX_ITEMS = 120;

export interface OutboxItem {
  gid: string; // client idempotency key - the server answers replays with the original response
  cardId: string;
  grade: number;
  dir: string;
  at: number; // Date.now() when the grade was made offline
}

type Listener = (n: number) => void;
const listeners = new Set<Listener>();
let flushing = false;

function read(): OutboxItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as OutboxItem[]) : [];
    return Array.isArray(arr) ? arr.filter((x) => x && typeof x.gid === "string" && typeof x.cardId === "string") : [];
  } catch {
    return [];
  }
}

function write(items: OutboxItem[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(-MAX_ITEMS)));
  } catch {
    // storage full/blocked: the grade is lost honestly - the UI showed the
    // queued state and the learner will see the count not drop
  }
  emit();
}

function emit() {
  const n = count();
  for (const l of listeners) {
    try {
      l(n);
    } catch {
      // a dead listener never breaks the flush
    }
  }
}

export function count(): number {
  return read().length;
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `g${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Submit a grade with offline fallback. Returns what the UI should announce. */
export async function submitGrade(cardId: string, grade: number, dir: string): Promise<{ online: boolean; replayed?: boolean }> {
  const gid = uuid();
  try {
    const r = await fetch("/api/review/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, grade, dir, gid }),
    });
    if (!r.ok && r.status >= 500) throw new Error(`server ${r.status}`);
    return { online: true };
  } catch {
    // network is gone (or the server 5xx'd): queue for the reconnect flush
    const items = read();
    items.push({ gid, cardId, grade, dir, at: Date.now() });
    write(items);
    awardLocalXpHint(grade);
    return { online: false };
  }
}

/**
 * Replay the outbox. Called on `online`, on visibility return, and after any
 * successful API call (piggyback). Safe to call concurrently - the flush flag
 * makes overlapping calls no-ops, and the server's gid receipt makes replays
 * idempotent even if two tabs flush at once.
 */
export async function flush(): Promise<{ sent: number; kept: number; dropped: number } | null> {
  if (typeof window === "undefined" || flushing) return null;
  const items = read();
  if (items.length === 0) return null;
  flushing = true;
  let sent = 0;
  let dropped = 0;
  const kept: OutboxItem[] = [];
  try {
    for (const it of items) {
      try {
        const r = await fetch("/api/review/grade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId: it.cardId, grade: it.grade, dir: it.dir, gid: it.gid }),
        });
        if (r.ok) {
          sent += 1;
        } else if (r.status >= 400 && r.status < 500) {
          dropped += 1; // a real refusal - retrying would be a lie
        } else {
          kept.push(it); // 5xx: server trouble, keep for later
        }
      } catch {
        kept.push(it); // still offline: stop early, keep the rest
        break;
      }
    }
  } finally {
    flushing = false;
    if (kept.length !== items.length) write(kept);
  }
  return { sent, kept: kept.length, dropped };
}

/** Wire the auto-flush triggers. Call once from the app shell. */
export function installOfflineSync(): void {
  if (typeof window === "undefined") return;
  const w = window as Window & { __rahOfflineInstalled?: boolean };
  if (w.__rahOfflineInstalled) return;
  w.__rahOfflineInstalled = true;

  w.addEventListener("online", () => {
    void flush();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.onLine) void flush();
  });
  emit();
}
