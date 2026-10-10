// App-control plugins: the coach is not limited to talk. It can restyle and
// drive the app itself through these actions. Every chat envelope may carry
// `actions`; the client applies them and persists the result. Server-side
// sanitizeActions() is the guard: only whitelisted types and value ranges
// ever reach the client.

export type PresetId = "midnight" | "emerald" | "royal" | "sunset" | "crimson" | "graphite" | "ocean";
export type BackdropStyle = "aurora" | "nebula" | "waves" | "off";

const VIEW_IDS = ["home", "review", "chat", "write", "speak", "listen", "read", "placement", "progress"];

export interface ThemePreset {
  id: PresetId;
  label_en: string;
  label_fa: string;
  accent: string; // primary signal color
  hue: number;    // backdrop hue anchor (0-360)
}

export const PRESETS: ThemePreset[] = [
  { id: "midnight", label_en: "Midnight Blue", label_fa: "آبی نیمه‌شب", accent: "#4e8cff", hue: 222 },
  { id: "emerald", label_en: "Emerald", label_fa: "زمردی", accent: "#2fc273", hue: 152 },
  { id: "royal", label_en: "Royal Violet", label_fa: "بنفش سلطنتی", accent: "#8b7cf6", hue: 258 },
  { id: "sunset", label_en: "Sunset Amber", label_fa: "کهربایی غروب", accent: "#ffb02e", hue: 32 },
  { id: "crimson", label_en: "Crimson", label_fa: "سرخ گلی", accent: "#ff5d7a", hue: 350 },
  { id: "ocean", label_en: "Ocean Cyan", label_fa: "فیروزه‌ای اقیانوس", accent: "#33c3e0", hue: 192 },
  { id: "graphite", label_en: "Graphite", label_fa: "گرافیتی", accent: "#9aa7bd", hue: 215 },
];

export type AppAction =
  | { type: "preset"; id: PresetId }
  | { type: "theme"; accent: string } // hex color
  | { type: "backdrop"; enabled?: boolean; style?: Exclude<BackdropStyle, "off"> }
  | { type: "density"; value: "comfortable" | "compact" }
  | { type: "font"; scale: number } // 0.85 - 1.25
  | { type: "radius"; value: number } // 8 - 28 px card radius
  | { type: "motion"; enabled: boolean }
  | { type: "navigate"; view: string };

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Human-readable plugin catalog, injected into the coach prompt. */
export function pluginCatalog(): string {
  const presets = PRESETS.map((p) => `${p.id} (${p.label_en} ${p.accent})`).join(", ");
  return `## App plugins (you can restyle the app itself)

The app is plugin-driven. When the learner asks to change its look or behavior, include "actions" in your reply:
- {"type":"preset","id":"..."}: switch to a named theme. Presets: ${presets}.
- {"type":"theme","accent":"#rrggbb"}: any custom accent color they describe (map words like "green" or "warm" to a hex you choose). One sentence in the reply confirming what changed.
- {"type":"backdrop","enabled":true|false,"style":"aurora"|"nebula"|"waves"}: the animated light backdrop behind the app.
- {"type":"density","value":"comfortable"|"compact"}: spacing size.
- {"type":"font","scale":0.9}: text size, 0.85 to 1.25.
- {"type":"radius","value":16}: corner roundness, 8 to 28.
- {"type":"motion","enabled":true|false}: all animation on/off.
- {"type":"navigate","view":"home|review|chat|write|speak|listen|read|placement|progress"}: open a section.
Combine several actions in one reply when the request spans several settings. Confirm briefly in Farsi what changed (fa_note). If their request is about English learning instead, always [].`;
}

/** Server-side guard: drop anything malformed, clamp every value. */
export function sanitizeActions(raw: unknown): AppAction[] {
  if (!Array.isArray(raw)) return [];
  const out: AppAction[] = [];
  for (const a of raw.slice(0, 4)) {
    if (!a || typeof a !== "object") continue;
    const t = (a as any).type;
    if (t === "preset" && PRESETS.some((p) => p.id === (a as any).id)) {
      out.push({ type: "preset", id: (a as any).id });
    } else if (t === "theme" && typeof (a as any).accent === "string" && HEX_RE.test((a as any).accent)) {
      out.push({ type: "theme", accent: (a as any).accent.toLowerCase() });
    } else if (t === "backdrop") {
      const act: AppAction = { type: "backdrop" };
      if (typeof (a as any).enabled === "boolean") (act as any).enabled = (a as any).enabled;
      if (["aurora", "nebula", "waves"].includes((a as any).style)) (act as any).style = (a as any).style;
      if ("enabled" in act || "style" in act) out.push(act);
    } else if (t === "density" && ["comfortable", "compact"].includes((a as any).value)) {
      out.push({ type: "density", value: (a as any).value });
    } else if (t === "font") {
      const s = Number((a as any).scale);
      if (Number.isFinite(s)) out.push({ type: "font", scale: Math.max(0.85, Math.min(1.25, s)) });
    } else if (t === "radius") {
      const r = Number((a as any).value);
      if (Number.isFinite(r)) out.push({ type: "radius", value: Math.max(8, Math.min(28, Math.round(r))) });
    } else if (t === "motion" && typeof (a as any).enabled === "boolean") {
      out.push({ type: "motion", enabled: (a as any).enabled });
    } else if (t === "navigate" && typeof (a as any).view === "string" && VIEW_IDS.includes((a as any).view)) {
      out.push({ type: "navigate", view: (a as any).view });
    }
  }
  return out;
}
