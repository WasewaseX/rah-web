"use client";

// Writing-draft autosave store (Task 94): the learner's in-progress essay
// survives reloads, offline blips, and accidental tab closes.
//
// Why this exists (the review's teaching-validation priority): writing volume
// is the pilot's zero track. The essay surface REFUSES offline (a fake queue
// entry would lie - grading needs the model), which is honest, but until now
// it also meant a network blip mid-draft DESTROYED the draft. Autosaving the
// unsent draft to this device converts that data loss into data
// preservation: nothing is claimed to have been submitted or synced - the
// draft simply waits locally until the learner submits it themselves.
//
// Honesty rules this module keeps:
//  - The store is a DRAFT cache, never a submission ledger. Clearing happens
//    only when the server has accepted a submission (or the learner erases
//    the text).
//  - The storage is injectable so tests can pin the behavior without a DOM;
//    the app passes window.localStorage.
//  - Corrupt/foreign payloads are ignored, never thrown into the writing UI.

export interface WriteDraft {
  text: string;
  goalSel: string;
  revisingId: number | null;
  at: number; // Date.now() of the last save
}

type Store = {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
};

export const WRITE_DRAFT_KEY = "rah-write-draft-v1";

function sanitize(raw: unknown): WriteDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<WriteDraft>;
  if (typeof d.text !== "string") return null;
  const revisingId =
    d.revisingId === null || d.revisingId === undefined
      ? null
      : Number.isFinite(Number(d.revisingId))
        ? Number(d.revisingId)
        : null;
  return {
    text: d.text,
    goalSel: typeof d.goalSel === "string" ? d.goalSel : "",
    revisingId: revisingId !== null && revisingId >= 0 ? revisingId : null,
    at: Number.isFinite(Number(d.at)) ? Number(d.at) : 0,
  };
}

export function loadWriteDraft(store: Store | null | undefined): WriteDraft | null {
  if (!store || typeof store.getItem !== "function") return null;
  try {
    const raw = store.getItem(WRITE_DRAFT_KEY);
    if (!raw) return null;
    const draft = sanitize(JSON.parse(raw));
    // An empty draft is not a draft - nothing to restore, nothing to keep.
    return draft && draft.text.trim().length > 0 ? draft : null;
  } catch {
    return null;
  }
}

export function saveWriteDraft(draft: WriteDraft, store: Store | null | undefined): boolean {
  if (!store || typeof store.setItem !== "function") return false;
  if (draft.text.trim().length === 0) return clearWriteDraft(store);
  try {
    store.setItem(WRITE_DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false; // quota/private-mode: autosave is best-effort, never a blocker
  }
}

export function clearWriteDraft(store: Store | null | undefined): boolean {
  if (!store || typeof store.removeItem !== "function") return false;
  try {
    store.removeItem(WRITE_DRAFT_KEY);
    return true;
  } catch {
    return false;
  }
}
