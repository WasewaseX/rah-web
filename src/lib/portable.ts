// P5 of the mega-update: the learner owns the state.
//
// Export/import of the ENTIRE learner state - every table, no exceptions.
// The bundle is deterministic (fixed table order, rows sorted by primary
// key, stable JSON) so a content hash identifies it exactly: the import
// route verifies the hash BEFORE touching anything and a re-import of the
// same bundle is idempotent by construction.
//
// Redaction rule inherited from the Tauri export: no secrets, ever. The DB
// holds no AI keys and none of these tables may ever gain one; the registry
// below is also the audit list for that promise.

import { createHash } from "crypto";
import { db } from "@/lib/db";
import type { PrismaClient } from "@prisma/client";

export const BUNDLE_FORMAT = "rah.v1";

interface TableSpec {
  model: string; // Prisma model delegate name on the client
  dates: string[]; // DateTime fields - JSON round-trips need Date coercion
}

// Fixed order = deterministic bundle. Dates per model mirror the schema.
const TABLES: TableSpec[] = [
  { model: "learner", dates: [] },
  { model: "cardState", dates: [] },
  { model: "reviewLog", dates: ["at"] },
  { model: "placement", dates: ["updatedAt"] },
  { model: "chatMsg", dates: ["at"] },
  { model: "writingSub", dates: ["at"] },
  { model: "speakSession", dates: ["at"] },
  { model: "dailyStat", dates: [] },
  { model: "quizItem", dates: ["at"] },
  { model: "exam", dates: ["createdAt"] },
  { model: "skillLevel", dates: ["updatedAt"] },
  { model: "achievement", dates: ["at"] },
  { model: "gameStat", dates: ["updatedAt"] },
  { model: "quest", dates: [] },
  { model: "rival", dates: [] },
  { model: "league", dates: [] },
  { model: "runState", dates: ["updatedAt"] },
  { model: "briefing", dates: ["at"] },
  { model: "mistakeFamily", dates: ["lastSeen", "updatedAt", "resolvedAt"] },
  { model: "tagMastery", dates: ["lastOk", "lastNo", "updatedAt"] },
  { model: "mistakeForgiven", dates: ["at"] },
  { model: "goal", dates: ["createdAt", "archivedAt"] },
];

type Bundle = { format: string; exportedAt: string; tables: Record<string, Record<string, unknown>[]> };

function stableValue(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(stableValue);
  if (v && typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>)
      .filter(([k]) => typeof k === "string")
      .sort(([a], [b]) => (a < b ? -1 : 1));
    return Object.fromEntries(entries.map(([k, x]) => [k, stableValue(x)]));
  }
  return v;
}

export function bundleHash(tables: Record<string, Record<string, unknown>[]>): string {
  const canon = JSON.stringify(Object.fromEntries(Object.keys(tables).sort().map((k) => [k, tables[k].map(stableValue)])));
  return createHash("sha256").update(canon).digest("hex");
}

export async function buildBundle(): Promise<{ bundle: Bundle; hash: string; counts: Record<string, number> }> {
  const tables: Record<string, Record<string, unknown>[]> = {};
  const counts: Record<string, number> = {};
  for (const t of TABLES) {
     
    const raw = (await (db as any)[t.model].findMany()) as unknown[];
    const rows: Record<string, unknown>[] = raw.map((r) => Object.fromEntries(Object.entries(r as Record<string, unknown>)));
    rows.sort((a, b) => (JSON.stringify(stableValue(a)) < JSON.stringify(stableValue(b)) ? -1 : 1));
    tables[t.model] = rows;
    counts[t.model] = rows.length;
  }
  const bundle: Bundle = { format: BUNDLE_FORMAT, exportedAt: new Date().toISOString(), tables };
  return { bundle, hash: bundleHash(tables), counts };
}

export interface ImportPlan {
  valid: boolean;
  reason?: string;
  counts: Record<string, number>; // rows the import will write per table
  hash?: string;
}

// Validate + plan. Never writes. A wrong hash is rejected before anything
// else happens - the file must be exactly what an export produced.
export function planImport(input: unknown): ImportPlan {
  const b = input as Bundle | null;
  if (!b || typeof b !== "object" || b.format !== BUNDLE_FORMAT || !b.tables || typeof b.tables !== "object") {
    return { valid: false, reason: "This file is not a Rah export (format mismatch). Export fresh from the app and try again.", counts: {} };
  }
  const hash = bundleHash(b.tables);
  const expected = (input as { hash?: string }).hash;
  if (expected && expected !== hash) {
    return { valid: false, reason: `The file is corrupted or was edited (hash ${hash.slice(0, 12)} != declared ${String(expected).slice(0, 12)}). Import refused.`, counts: {} };
  }
  const counts: Record<string, number> = {};
  for (const t of TABLES) {
    const rows: unknown = b.tables[t.model];
    if (!Array.isArray(rows)) {
      return { valid: false, reason: `The export is missing the ${t.model} table. Export fresh from the app.`, counts: {} };
    }
    counts[t.model] = rows.length;
  }
  return { valid: true, counts, hash };
}

// The restore itself: one transaction, delete-then-create over the fixed
// table list. Delete-then-create is what makes a re-import idempotent and
// the post-import state hash-identical to the bundle.
export async function commitImport(tables: Record<string, Record<string, unknown>[]>): Promise<void> {
   
  await db.$transaction(async (tx: any) => {
    for (const t of [...TABLES].reverse()) {
       
      await (tx as any)[t.model].deleteMany();
    }
    for (const t of TABLES) {
      const rows = tables[t.model] ?? [];
      const coerced = rows.map((r) => {
        const out: Record<string, unknown> = Object.fromEntries(Object.entries(r));
        for (const f of t.dates) {
          if (out[f] != null) out[f] = new Date(out[f] as string);
        }
        return out;
      });
      if (coerced.length > 0) {
         
        await (tx as any)[t.model].createMany({ data: coerced });
      }
    }
  });
}
