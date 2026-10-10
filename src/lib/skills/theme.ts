// Appearance plugin: the coach can restyle the whole app. Everything runs on
// six CSS custom properties, so one ThemeSpec repaints every screen.

import type { ThemeSpec } from "./types";

export interface ThemePreset {
  id: string;
  name: string;
  vars: Record<string, string>;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "midnight",
    name: "Midnight",
    vars: {
      "--pri": "#4e8cff",
      "--pri-rgb": "78 140 255",
      "--pri-light": "#66a0ff",
      "--pri-deep": "#2f62c4",
      "--pri-edge": "#2650a3",
      "--acc": "#9dc0ff",
    },
  },
  {
    id: "emerald",
    name: "Emerald",
    vars: {
      "--pri": "#2fc273",
      "--pri-rgb": "47 194 115",
      "--pri-light": "#5ad694",
      "--pri-deep": "#1a8f56",
      "--pri-edge": "#11693d",
      "--acc": "#9ce9c4",
    },
  },
  {
    id: "violet",
    name: "Violet",
    vars: {
      "--pri": "#a78bfa",
      "--pri-rgb": "167 139 250",
      "--pri-light": "#bfabfc",
      "--pri-deep": "#7a5cf0",
      "--pri-edge": "#5b3ed1",
      "--acc": "#d6c8fd",
    },
  },
  {
    id: "rose",
    name: "Rose",
    vars: {
      "--pri": "#fb7185",
      "--pri-rgb": "251 113 133",
      "--pri-light": "#fd92a1",
      "--pri-deep": "#e14b66",
      "--pri-edge": "#b23148",
      "--acc": "#fdc0c9",
    },
  },
  {
    id: "amber",
    name: "Amber",
    vars: {
      "--pri": "#ffb02e",
      "--pri-rgb": "255 176 46",
      "--pri-light": "#ffc45e",
      "--pri-deep": "#d97706",
      "--pri-edge": "#a35507",
      "--acc": "#ffd794",
    },
  },
  {
    id: "cyan",
    name: "Cyan",
    vars: {
      "--pri": "#4cc9f0",
      "--pri-rgb": "76 201 240",
      "--pri-light": "#79d8f5",
      "--pri-deep": "#2795c4",
      "--pri-edge": "#1a6e93",
      "--acc": "#ace8f9",
    },
  },
  {
    id: "steel",
    name: "Steel",
    vars: {
      "--pri": "#94a3b8",
      "--pri-rgb": "148 163 184",
      "--pri-light": "#b3c0d1",
      "--pri-deep": "#64748b",
      "--pri-edge": "#475569",
      "--acc": "#cbd5e1",
    },
  },
];

// Color words the appearance plugin understands without any network round trip.
const COLOR_WORDS: Record<string, number> = {
  blue: 217, sky: 199, azure: 205, ocean: 205, sapphire: 215,
  green: 145, emerald: 152, mint: 152, forest: 150, lime: 80,
  teal: 174, turquoise: 174, aqua: 180,
  cyan: 194,
  red: 357, crimson: 350, scarlet: 354, cherry: 352,
  rose: 350, pink: 330, magenta: 300, fuchsia: 300,
  purple: 270, violet: 262, lavender: 265, indigo: 235,
  orange: 27, tangerine: 25, coral: 16, salmon: 8, peach: 20,
  amber: 38, gold: 41, golden: 41, honey: 38, yellow: 45, sunny: 45,
};

function hsl(h: number, s: number, l: number): string {
  return `hsl(${Math.round(((h % 360) + 360) % 360)} ${s}% ${l}%)`;
}

function hslToRgbTriplet(h: number, s: number, l: number): string {
  const H = (((h % 360) + 360) % 360) / 360;
  const S = s / 100;
  const L = l / 100;
  const q = L < 0.5 ? L * (1 + S) : L + S - L * S;
  const p = 2 * L - q;
  const chan = (t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const r = Math.round(chan(H + 1 / 3) * 255);
  const g = Math.round(chan(H) * 255);
  const b = Math.round(chan(H - 1 / 3) * 255);
  return `${r} ${g} ${b}`;
}

// Build a full palette from a color word the learner typed.
export function paletteFromWord(word: string): ThemeSpec | null {
  const w = word.toLowerCase().trim();
  const hue = COLOR_WORDS[w];
  if (hue === undefined) return null;
  const name = w.charAt(0).toUpperCase() + w.slice(1);
  return {
    name: `${name} Deep`,
    vars: {
      "--pri": hsl(hue, 78, 62),
      "--pri-rgb": hslToRgbTriplet(hue, 78, 62),
      "--pri-light": hsl(hue, 92, 72),
      "--pri-deep": hsl(hue, 60, 42),
      "--pri-edge": hsl(hue, 62, 30),
      "--acc": hsl(hue, 92, 80),
    },
  };
}

export function presetById(id: string): ThemePreset | null {
  return THEME_PRESETS.find((t) => t.id === id) ?? null;
}

// Try the local color dictionary first; the plugin stays offline and instant
// for every common word. Returns null when the word is unknown.
export function resolveTheme(description: string): ThemeSpec | null {
  const text = description.toLowerCase();
  for (const preset of THEME_PRESETS) {
    if (text.includes(preset.id) || text.includes(preset.name.toLowerCase())) {
      return { name: preset.name, preset: preset.id, vars: preset.vars };
    }
  }
  const words = text.replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
  for (const w of words) {
    const spec = paletteFromWord(w);
    if (spec) return spec;
  }
  return null;
}

export const DEFAULT_THEME: ThemeSpec = {
  name: "Midnight",
  preset: "midnight",
  vars: THEME_PRESETS[0].vars,
};
