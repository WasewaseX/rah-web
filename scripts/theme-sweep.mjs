// One-shot codemod: swap hardcoded hex colors in Rah components for
// RGB-triplet CSS variables so the theme plugin can repaint the whole app.
// Run once: node scripts/theme-sweep.mjs
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";

const DIR = "/home/z/my-project/src/components/rah";

// hex -> var name (accent identity + status + text + bg, all tokenized)
const HEXMAP = {
  "#4e8cff": "--c-primary",
  "#2f62c4": "--c-primary-deep",
  "#3a6fd6": "--c-primary-mid",
  "#9dc0ff": "--c-primary-soft",
  "#2650a3": "--c-primary-edge",
  "#5f8fe8": "--c-primary-soft",
  "#66a0ff": "--c-primary-soft",
  "#6aa6ff": "--c-primary-soft",
  "#7fa8f5": "--c-primary-soft",
  "#cfe0ff": "--c-primary-frost",
  "#7fe0ac": "--c-mint",
  "#2fc273": "--c-green",
  "#3ccb7f": "--c-green",
  "#45d687": "--c-green",
  "#55d98f": "--c-green",
  "#1d8f52": "--c-green-deep",
  "#c4f2d8": "--c-green-tint",
  "#ff6b81": "--c-red",
  "#ff8194": "--c-red-soft",
  "#ffa3b1": "--c-red-soft",
  "#ffc9d2": "--c-red-tint",
  "#c2475c": "--c-red-deep",
  "#ffb02e": "--c-gold",
  "#ffd08a": "--c-gold-soft",
  "#ffc055": "--c-gold-soft",
  "#ffcb6b": "--c-gold-soft",
  "#ffe3b3": "--c-gold-tint",
  "#b87715": "--c-gold-deep",
  "#4cc9f0": "--c-cyan",
  "#9de6fb": "--c-cyan-soft",
  "#7fdcf7": "--c-cyan-soft",
  "#f2f5fa": "--c-text",
  "#e7ecf5": "--c-text-2",
  "#dbe3f0": "--c-text-3",
  "#c3cddd": "--c-text-4",
  "#b7c1d3": "--c-text-5",
  "#aeb9cc": "--c-text-5",
  "#a9b4c6": "--c-text-6",
  "#8b96a9": "--c-dim",
  "#7d889c": "--c-dim-2",
  "#6e7a8e": "--c-dim-3",
  "#5c6678": "--c-dim-4",
  "#3f4c63": "--c-faint",
  "#3a4356": "--c-faint-2",
  "#10131a": "--c-bg",
  "#12161f": "--c-bg-2",
  "#0e1421": "--c-bg-3",
  "#101725": "--c-bg-4",
  "#0d1119": "--c-bg-5",
  "#121724": "--c-bg-5",
  "#141924": "--c-bg-6",
  "#1a1f2b": "--c-bg-7",
  "#212836": "--c-surface",
  "#2a3242": "--c-border",
  "#262d3b": "--c-border-2",
  "#16233e": "--c-panel-1",
  "#131b2c": "--c-panel-2",
  "#141c30": "--c-panel-deep",
  "#232b3a": "--c-empty",
};

// rgb triplets for rgba() matching, derived from the hex map
const RGBMAP = {};
for (const [hex, v] of Object.entries(HEXMAP)) {
  const h = hex.slice(1);
  const n = parseInt(h, 16);
  const rgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  RGBMAP[rgb] = v;
}

function sweep(src) {
  let out = src;
  let n = 0;
  const bump = () => { n++; return ""; };

  // 1) [#hex]/[0.xx] -> [rgb(var(--c-x)/0.xx)]
  out = out.replace(/\[#([0-9a-fA-F]{6})\]\/\[(\d*\.?\d+)\]/g, (m, hex, op) => {
    const v = HEXMAP["#" + hex.toLowerCase()];
    if (!v) return m;
    bump();
    return `[rgb(var(${v})/${op})]`;
  });

  // 2) [#hex]/60 -> [rgb(var(--c-x)/0.60)]
  out = out.replace(/\[#([0-9a-fA-F]{6})\]\/(\d{1,3})\b/g, (m, hex, op) => {
    const v = HEXMAP["#" + hex.toLowerCase()];
    if (!v) return m;
    const f = (parseInt(op, 10) / 100).toFixed(2).replace(/0$/, "");
    bump();
    return `[rgb(var(${v})/${f})]`;
  });

  // 3) rgba(r,g,b,a) -> rgb(var(--c-x)/a)  (shadows + inline styles)
  out = out.replace(/rgba\((\d+),(\d+),(\d+),\s*\.?(\d*\.?\d+)\)/g, (m, r, g, b, a) => {
    const v = RGBMAP[`${r},${g},${b}`] || RGBMAP[`${r}, ${g}, ${b}`];
    if (!v) return m;
    bump();
    const alpha = a.includes(".") ? a : `0.${a}`;
    return `rgb(var(${v})/${alpha})`;
  });

  // 4) remaining [#hex] -> [rgb(var(--c-x))]
  out = out.replace(/\[#([0-9a-fA-F]{6})\]/g, (m, hex) => {
    const v = HEXMAP["#" + hex.toLowerCase()];
    if (!v) return m;
    bump();
    return `[rgb(var(${v}))]`;
  });

  // 5) quoted "#hex" (inline style objects)
  out = out.replace(/"#([0-9a-fA-F]{6})"/g, (m, hex) => {
    const v = HEXMAP["#" + hex.toLowerCase()];
    if (!v) return m;
    bump();
    return `"rgb(var(${v}))"`;
  });

  return { out, n };
}

for (const f of readdirSync(DIR)) {
  if (!f.endsWith(".tsx") && !f.endsWith(".ts")) continue;
  const p = join(DIR, f);
  const src = readFileSync(p, "utf8");
  const { out, n } = sweep(src);
  if (n > 0) {
    writeFileSync(p, out);
    console.log(`${f}: ${n} replacements`);
  }
}
console.log("sweep done");
