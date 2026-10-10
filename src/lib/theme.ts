// Client-side theme engine. The coach's theme plugin (and the server-side
// Setting row) drive these values; the whole GUI reads the CSS variables.

export interface ThemePatch {
  name: string;
  primary: string;
  primaryDeep: string;
  accent: string;
  rgb: string;
}

export const DEFAULT_THEME: ThemePatch = {
  name: "midnight",
  primary: "#4e8cff",
  primaryDeep: "#2650a3",
  accent: "#9dc0ff",
  rgb: "78,140,255",
};

const SOFT = [0.05, 0.07, 0.1, 0.12, 0.14, 0.2, 0.25, 0.3, 0.55, 0.6, 0.65];

export function applyTheme(patch: ThemePatch, persist = true): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  root.setProperty("--rah-primary", patch.primary);
  root.setProperty("--rah-primary-deep", patch.primaryDeep);
  root.setProperty("--rah-primary-bright", `color-mix(in srgb, ${patch.primary} 80%, white)`);
  root.setProperty("--rah-accent", patch.accent);
  root.setProperty("--rah-primary-rgb", patch.rgb);
  for (const a of SOFT) {
    root.setProperty(`--rah-soft-${Math.round(a * 100)}`, `rgba(${patch.rgb},${a})`);
  }
  if (persist) {
    try {
      localStorage.setItem("rah.theme", JSON.stringify(patch));
    } catch {
      // private mode; theme lives for the session only
    }
  }
  window.dispatchEvent(new CustomEvent("rah-theme", { detail: patch }));
}

export function applyEffect(effect: string, persist = true): void {
  if (typeof window === "undefined") return;
  if (persist) {
    try {
      localStorage.setItem("rah.effect", effect);
    } catch {
      // ignore
    }
  }
  window.dispatchEvent(new CustomEvent("rah-effect", { detail: effect }));
}

export function loadPersistedTheme(): void {
  if (typeof window === "undefined") return;
  try {
    const t = localStorage.getItem("rah.theme");
    if (t) applyTheme(JSON.parse(t) as ThemePatch, false);
  } catch {
    // corrupted value; default stands
  }
}
