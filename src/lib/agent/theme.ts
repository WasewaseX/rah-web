// Theme plugin: the coach can repaint the app by emitting token overrides.
// Everything is validated server side and mapped to CSS variables on :root.

import type { ThemeTokens } from "./types";

export interface ThemePreset {
  id: string;
  name: string;
  tokens: Required<ThemeTokens>;
}

// CSS variable names the client maps tokens onto.
export const THEME_VARS: Record<keyof ThemeTokens, string> = {
  primary: "--rah-primary",
  primaryDeep: "--rah-primary-deep",
  bg: "--rah-bg",
  surface: "--rah-surface",
  accent: "--rah-accent",
};

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isHex(s: string): boolean {
  return HEX.test(s);
}

export const PRESETS: ThemePreset[] = [
  {
    id: "midnight",
    name: "Midnight (default)",
    tokens: { primary: "#4e8cff", primaryDeep: "#2650a3", bg: "#10131a", surface: "#1a1f2b", accent: "#4cc9f0" },
  },
  {
    id: "ocean",
    name: "Ocean",
    tokens: { primary: "#38bdf8", primaryDeep: "#0369a1", bg: "#0b1220", surface: "#111c30", accent: "#7dd3fc" },
  },
  {
    id: "forest",
    name: "Forest",
    tokens: { primary: "#34d399", primaryDeep: "#047857", bg: "#0d1512", surface: "#14201b", accent: "#6ee7b7" },
  },
  {
    id: "sunset",
    name: "Sunset",
    tokens: { primary: "#fb923c", primaryDeep: "#c2410c", bg: "#171114", surface: "#211820", accent: "#fdba74" },
  },
  {
    id: "violet",
    name: "Violet",
    tokens: { primary: "#a78bfa", primaryDeep: "#6d28d9", bg: "#120f1c", surface: "#1b1628", accent: "#c4b5fd" },
  },
  {
    id: "rose",
    name: "Rose",
    tokens: { primary: "#fb7185", primaryDeep: "#be123c", bg: "#171014", surface: "#211821", accent: "#fda4af" },
  },
];

export function presetById(id: string): ThemePreset | undefined {
  return PRESETS.find((p) => p.id === id.toLowerCase().trim());
}

export function sanitizeTokens(raw: unknown): ThemeTokens | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const out: ThemeTokens = {};
  let any = false;
  for (const k of ["primary", "primaryDeep", "bg", "surface", "accent"] as const) {
    const v = src[k];
    if (typeof v === "string" && isHex(v.trim())) {
      out[k] = v.trim().toLowerCase();
      any = true;
    }
  }
  return any ? out : null;
}

// Parse a free-text theme request into either a preset id or explicit tokens.
export function parseThemeRequest(text: string): { preset?: string; tokens?: ThemeTokens } {
  const t = text.toLowerCase();
  const hexes = text.match(/#[0-9a-fA-F]{6}\b/g);
  if (hexes && hexes.length > 0) {
    const [primary, primaryDeep, bg, surface, accent] = hexes;
    return { tokens: { primary, primaryDeep, bg, surface, accent } };
  }
  const preset = presetById(t);
  if (preset) return { preset: preset.id };
  if (/\b(ocean|sea|blue cyan|cyan)\b/.test(t)) return { preset: "ocean" };
  if (/\b(forest|green|emerald|nature)\b/.test(t)) return { preset: "forest" };
  if (/\b(sunset|orange|warm|amber)\b/.test(t)) return { preset: "sunset" };
  if (/\b(violet|purple|lavender)\b/.test(t)) return { preset: "violet" };
  if (/\b(rose|pink|red)\b/.test(t)) return { preset: "rose" };
  if (/\b(midnight|default|reset|original|normal)\b/.test(t)) return { preset: "midnight" };
  return {};
}
