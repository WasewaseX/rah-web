"use client";

// Theme bus: applies coach-chosen tokens to the document and notifies the
// shell. Tokens persist server side (Learner.theme); this module paints them.

export interface RahTheme {
  primary?: string;
  primaryDeep?: string;
  bg?: string;
  surface?: string;
  accent?: string;
}

const VARS: Record<keyof RahTheme, string> = {
  primary: "--rah-primary",
  primaryDeep: "--rah-primary-deep",
  bg: "--rah-bg",
  surface: "--rah-surface",
  accent: "--rah-accent",
};

export function applyTheme(tokens: RahTheme | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!tokens) {
    // Reset to the midnight defaults baked in CSS.
    root.style.removeProperty(VARS.primary);
    root.style.removeProperty(VARS.primaryDeep);
    root.style.removeProperty(VARS.bg);
    root.style.removeProperty(VARS.surface);
    root.style.removeProperty(VARS.accent);
    return;
  }
  for (const [key, cssVar] of Object.entries(VARS) as [keyof RahTheme, string][]) {
    const v = tokens[key];
    if (v && /^#[0-9a-fA-F]{3}|^#[0-9a-fA-F]{6}/.test(v)) root.style.setProperty(cssVar, v);
  }
  window.dispatchEvent(new CustomEvent("rah-theme", { detail: tokens }));
}
