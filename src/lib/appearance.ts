"use client";

// Appearance state: the single source of truth for everything the coach's
// plugin actions (and future settings) can restyle. Persisted in
// localStorage, applied as CSS custom properties + data attributes on <html>.
// Pure client: color math runs in the browser.

import type { AppAction } from "@/lib/tutor/plugins";

export interface Appearance {
  accent: string; // hex
  backdrop: boolean;
  backdropStyle: "aurora" | "nebula" | "waves";
  density: "comfortable" | "compact";
  fontScale: number; // 0.85 - 1.25
  radius: number; // 8 - 28
  motion: boolean;
}

export const DEFAULT_APPEARANCE: Appearance = {
  accent: "#4e8cff",
  backdrop: true,
  backdropStyle: "aurora",
  density: "comfortable",
  fontScale: 1,
  radius: 24,
  motion: true,
};

const KEY = "rah.appearance.v1";
let current: Appearance = { ...DEFAULT_APPEARANCE };

export function getAppearance(): Appearance {
  return { ...current };
}

export function loadAppearance(): Appearance {
  if (typeof window === "undefined") return { ...current };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Appearance>;
      current = sanitize({ ...DEFAULT_APPEARANCE, ...p });
    }
  } catch {
    current = { ...DEFAULT_APPEARANCE };
  }
  return { ...current };
}

export function saveAppearance(a: Appearance) {
  current = sanitize(a);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(current));
    } catch {
      // storage full or blocked: live session still keeps the look
    }
  }
}

// Merge plugin actions into the appearance and apply. Returns what changed.
export function applyActions(actions: AppAction[]): string[] {
  const a = { ...current };
  const changed: string[] = [];
  for (const act of actions) {
    switch (act.type) {
      case "preset":
      case "theme": {
        if (act.type === "preset") {
          const hex = PRESET_ACCENTS[act.id];
          if (hex && hex !== a.accent) {
            a.accent = hex;
            changed.push("theme");
          }
        } else if (act.accent !== a.accent) {
          a.accent = act.accent;
          changed.push("theme");
        }
        break;
      }
      case "backdrop": {
        if (typeof act.enabled === "boolean" && act.enabled !== a.backdrop) {
          a.backdrop = act.enabled;
          changed.push("backdrop");
        }
        if (act.style && act.style !== a.backdropStyle) {
          a.backdropStyle = act.style;
          changed.push("backdrop");
        }
        break;
      }
      case "density":
        if (act.value !== a.density) {
          a.density = act.value;
          changed.push("density");
        }
        break;
      case "font":
        if (Math.abs(act.scale - a.fontScale) > 0.001) {
          a.fontScale = act.scale;
          changed.push("font size");
        }
        break;
      case "radius":
        if (act.value !== a.radius) {
          a.radius = act.value;
          changed.push("corner radius");
        }
        break;
      case "motion":
        if (act.enabled !== a.motion) {
          a.motion = act.enabled;
          changed.push("motion");
        }
        break;
      default:
        break; // navigate is handled by the chat view, not appearance
    }
  }
  if (changed.length) {
    saveAppearance(a);
    applyAppearance(a);
  }
  return changed;
}

export function applyAppearance(a: Appearance) {
  if (typeof document === "undefined") return;
  const r = document.documentElement;
  r.style.setProperty("--accent", a.accent);
  r.style.setProperty("--accent-deep", shade(a.accent, -0.45));
  r.style.setProperty("--accent-soft", mixWhite(a.accent, 0.55));
  r.style.setProperty("--accent-dim", mixWhite(a.accent, 0.18));
  r.style.setProperty("--hue", String(hexHue(a.accent)));
  r.style.setProperty("--radius-card", `${a.radius}px`);
  r.style.fontSize = `${16 * a.fontScale}px`;
  r.dataset.density = a.density;
  r.dataset.motion = a.motion ? "on" : "off";
  r.dataset.backdrop = a.backdrop ? a.backdropStyle : "off";
}

// preset accents mirror plugins.ts PRESETS (kept local: appearance.ts must not
// pull server code)
const PRESET_ACCENTS: Record<string, string> = {
  midnight: "#4e8cff",
  emerald: "#2fc273",
  royal: "#8b7cf6",
  sunset: "#ffb02e",
  crimson: "#ff5d7a",
  ocean: "#33c3e0",
  graphite: "#9aa7bd",
};

function sanitize(a: Appearance): Appearance {
  const hex = /^#[0-9a-f]{6}$/i.test(a.accent) ? a.accent.toLowerCase() : DEFAULT_APPEARANCE.accent;
  return {
    accent: hex,
    backdrop: !!a.backdrop,
    backdropStyle: ["aurora", "nebula", "waves"].includes(a.backdropStyle) ? a.backdropStyle : "aurora",
    density: a.density === "compact" ? "compact" : "comfortable",
    fontScale: Math.max(0.85, Math.min(1.25, Number(a.fontScale) || 1)),
    radius: Math.max(8, Math.min(28, Math.round(Number(a.radius) || 24))),
    motion: !!a.motion,
  };
}

// ---------- color math ----------
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
function shade(hex: string, f: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 + f), g * (1 + f), b * (1 + f));
}
function mixWhite(hex: string, w: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * w, g + (255 - g) * w, b + (255 - b) * w);
}
function hexHue(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 222;
  const d = max - min;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return Math.round(((h * 60) + 360) % 360);
}
