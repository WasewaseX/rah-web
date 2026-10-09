"use client";

// Shared UI primitives. Rah Midnight: dark gray surfaces, dark blue primary,
// one accent per meaning. Buttons press like real keys. No decoration that
// does not carry information.

import { type ReactNode } from "react";

export function Btn({
  children,
  onClick,
  variant = "primary",
  disabled,
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "soft" | "danger" | "warm" | "go";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold tracking-wide transition-all active:scale-[.99] disabled:pointer-events-none min-h-12 select-none";
  const styles = {
    // Dark blue key with a deeper blue edge underneath.
    primary:
      "rah-3d bg-[var(--rah-primary)] text-white hover:bg-[#66a0ff] [--rah-edge:var(--rah-primary-deep)]",
    // Emerald key for "go" moments: start a round, confirm.
    go: "rah-3d bg-[#2fc273] text-[#062012] hover:bg-[#45d687] [--rah-edge:#1d8f52]",
    ghost: "text-[#a9b4c6] hover:bg-white/5 hover:text-[#e7ecf5] rounded-xl",
    soft: "bg-white/[0.06] text-[#dbe3f0] border border-white/[0.07] hover:bg-white/[0.1] hover:border-white/[0.12] rounded-2xl",
    danger: "rah-3d bg-[#ff6b81] text-white hover:bg-[#ff8194] [--rah-edge:#c2475c]",
    warm: "rah-3d bg-[#ffb02e] text-[#221400] hover:bg-[#ffc055] [--rah-edge:#b87715]",
  } as const;
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-3xl border border-white/[0.07] bg-[var(--rah-surface)] p-6 shadow-[0_1px_2px_rgba(0,0,0,.35),0_16px_40px_-24px_rgba(0,0,0,.6)] ${className}`}
    >
      {children}
    </div>
  );
}

// Section header in the brilliant register: small caps kicker + display line.
export function SectionHead({ kicker, title }: { kicker?: string; title: string }) {
  return (
    <div className="mb-1">
      {kicker && (
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5f8fe8]">{kicker}</div>
      )}
      <div className="text-lg font-extrabold tracking-tight text-[#f2f5fa]">{title}</div>
    </div>
  );
}

export function Chip({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "emerald" | "amber" | "rose" | "blue" | "cyan";
}) {
  const tones = {
    slate: "bg-white/[0.06] text-[#b7c1d3] border-white/[0.08]",
    blue: "bg-[var(--rah-primary)]/12 text-[#9dc0ff] border-[var(--rah-primary)]/25",
    emerald: "bg-[#3ccb7f]/12 text-[#7fe0ac] border-[#3ccb7f]/25",
    amber: "bg-[#ffb02e]/12 text-[#ffd08a] border-[#ffb02e]/25",
    rose: "bg-[#ff6b81]/12 text-[#ffa3b1] border-[#ff6b81]/25",
    cyan: "bg-[var(--rah-accent)]/12 text-[#9de6fb] border-[var(--rah-accent)]/25",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Ring({
  value,
  max,
  size = 96,
  label,
  sub,
}: {
  value: number;
  max: number;
  size?: number;
  label?: string;
  sub?: string;
}) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#262d3b" strokeWidth={8} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringBlue)"
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-all duration-700"
        />
        <defs>
          <linearGradient id="ringBlue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--rah-primary)" />
            <stop offset="100%" stopColor="var(--rah-accent)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute text-center">
        <div className="text-lg font-black leading-none text-[#f2f5fa]">{label ?? value}</div>
        {sub && <div className="mt-0.5 text-[10px] font-semibold text-[#8b96a9]">{sub}</div>}
      </div>
    </div>
  );
}

export function Bar({
  value,
  max,
  tone = "blue",
}: {
  value: number;
  max: number;
  tone?: "blue" | "amber" | "rose" | "emerald" | "cyan";
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const tones = {
    blue: "bg-gradient-to-r from-[var(--rah-primary)] to-[#6aa6ff]",
    amber: "bg-gradient-to-r from-[#ffb02e] to-[#ffcb6b]",
    rose: "bg-gradient-to-r from-[#ff6b81] to-[#ff8ba0]",
    emerald: "bg-gradient-to-r from-[#2fc273] to-[#55d98f]",
    cyan: "bg-gradient-to-r from-[var(--rah-accent)] to-[#7fdcf7]",
  } as const;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#232b3a]">
      <div className={`h-full rounded-full ${tones[tone]} transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// Persian text run. dir=rtl so mixed lines wrap correctly. Vazirmatn carries
// the glyphs the Latin stack lacks.
export function FA({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      dir="rtl"
      lang="fa"
      className={`inline-block font-[family-name:var(--font-vazir)] text-[#aeb9cc] ${className}`}
    >
      {children}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-[#a9b4c6]">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2a3242] border-t-[var(--rah-primary)]" />
      {label ?? "Working"}
    </div>
  );
}

export function Note({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: "blue" | "amber" | "rose" | "emerald";
}) {
  const tones = {
    blue: "border-[var(--rah-primary)]/25 bg-[var(--rah-primary)]/[0.08] text-[#cfe0ff]",
    amber: "border-[#ffb02e]/25 bg-[#ffb02e]/[0.07] text-[#ffe3b3]",
    rose: "border-[#ff6b81]/25 bg-[#ff6b81]/[0.07] text-[#ffc9d2]",
    emerald: "border-[#3ccb7f]/25 bg-[#3ccb7f]/[0.07] text-[#c4f2d8]",
  } as const;
  return <div className={`rounded-2xl border p-4 text-sm leading-relaxed ${tones[tone]}`}>{children}</div>;
}

export function ScoreRow({
  name,
  value,
  max = 10,
  tone = "blue",
}: {
  name: string;
  value: number;
  max?: number;
  tone?: "blue" | "amber" | "rose" | "emerald" | "cyan";
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-sm font-medium text-[#a9b4c6]">{name}</span>
      <Bar value={value} max={max} tone={tone} />
      <span className="w-8 shrink-0 text-right text-sm font-black text-[#f2f5fa]">{value}</span>
    </div>
  );
}
