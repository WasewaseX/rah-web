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
//  - Chat/essays/speech need the model and are refused offline with a
//    speakable message instead of a fake queue entry. Dungeon/Gauntlet are
//    server-dealt state machines (the next item is the server's) - they
//    refuse offline rather than fake a local deal.
//  - localStorage (not IndexedDB): the entries are tiny (<200 B), the count
//    stays small (a day of reviews), and synchronous reads keep the UI
//    simple. The queue is capped; the cap is generous for a day's round.

import { awardLocalXpHint } from "@/lib/offline-helpers";

const KEY = "rah-outbox-v1";
const GKEY = "rah-outbox-games-v1";
const MAX_ITEMS = 120;
const MAX_GAMES = 60;

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

/** Solo arcade aggregates queue in a second store (same honesty rules). */
export interface GameOutboxItem {
  gid: string;
  path: string; // e.g. /api/arcade/speed - the aggregate POST endpoint
  body: Record<string, unknown>; // the clamped-server-side aggregate, gid included
  at: number;
}

function readGames(): GameOutboxItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GKEY);
    const arr = raw ? (JSON.parse(raw) as GameOutboxItem[]) : [];
    return Array.isArray(arr) ? arr.filter((x) => x && typeof x.gid === "string" && typeof x.path === "string") : [];
  } catch {
    return [];
  }
}

function writeGames(items: GameOutboxItem[]) {
  try {
    window.localStorage.setItem(GKEY, JSON.stringify(items.slice(-MAX_GAMES)));
  } catch {
    // storage blocked: the run is lost honestly - the UI showed queued state
  }
  emit();
}

export function count(): number {
  return read().length + readGames().length;
}

/** Submit a solo-game aggregate with offline fallback (gid receipt server-side).
 *  Resolves { online: true, data } with the server's ORIGINAL clamped payload,
 *  or queues and resolves { online: false } - the UI announces the queue. */
export async function submitGameResult(
  path: string,
  body: Record<string, unknown>
): Promise<{ online: true; data: Record<string, unknown> } | { online: false }> {
  const gid = uuid();
  const payload = { ...body, gid };
  try {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok && r.status >= 500) throw new Error(`server ${r.status}`);
    let data: Record<string, unknown> = {};
    try {
      data = (await r.json()) as Record<string, unknown>;
    } catch {
      // empty body: the receipt holds the truth server-side
    }
    return { online: true, data };
  } catch {
    const items = readGames();
    items.push({ gid, path, body: payload, at: Date.now() });
    writeGames(items);
    return { online: false };
  }
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
  const games = readGames();
  if (items.length === 0 && games.length === 0) return null;
  flushing = true;
  let sent = 0;
  let dropped = 0;
  const kept: OutboxItem[] = [];
  const keptGames: GameOutboxItem[] = [];
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
    for (const g of games) {
      try {
        const r = await fetch(g.path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(g.body),
        });
        if (r.ok) {
          sent += 1;
        } else if (r.status >= 400 && r.status < 500) {
          dropped += 1; // a real refusal (stale run, tampered clamp) - drop honestly
        } else {
          keptGames.push(g);
        }
      } catch {
        keptGames.push(g);
        break;
      }
    }
  } finally {
    flushing = false;
    if (kept.length !== items.length) write(kept);
    if (keptGames.length !== games.length) writeGames(keptGames);
  }
  return { sent, kept: kept.length + keptGames.length, dropped };
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
