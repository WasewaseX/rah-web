"use client";

// One-click shareable Battle Card. Self-contained: pulls the freshest state
// and progress, draws the 1080x1350 canvas, downloads the PNG.

import { useState } from "react";
import { ImageDown } from "lucide-react";
import { Btn } from "./ui";
import { buildBattleCard, downloadBlob, type BattleCardData } from "@/lib/battle-card";

export default function BattleCardButton({ variant = "soft" }: { variant?: "soft" | "primary" | "warm" }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  const go = async () => {
    if (busy) return;
    setBusy(true);
    setErr(false);
    try {
      const [stateRes, progressRes] = await Promise.all([fetch("/api/state", { cache: "no-store" }), fetch("/api/progress", { cache: "no-store" })]);
      const s = await stateRes.json();
      const p = await progressRes.json();
      const stat = (k: string) => s.game?.stats?.find((x: { key: string }) => x.key === k)?.best ?? 0;
      const activeDays = (p.days ?? []).filter((d: { reviews: number }) => d.reviews > 0);
      const accuracy35 =
        activeDays.length > 0
          ? Math.round((activeDays.reduce((a: number, d: { correct: number }) => a + d.correct, 0) / activeDays.reduce((a: number, d: { reviews: number }) => a + d.reviews, 0)) * 100)
          : null;
      const data: BattleCardData = {
        level: s.game.level,
        streak: s.learner.streak,
        freezes: s.learner.freezes ?? 0,
        todayXp: s.today?.xp ?? 0,
        accuracy35,
        skills: p.skillLevels ?? [],
        trophiesUnlocked: s.game.unlocked.length,
        trophiesTotal: s.game.all.length,
        speedBest: stat("speed:best"),
        bossWins: stat("boss:wins"),
        questsDone: (s.quests ?? []).filter((q: { done: boolean }) => q.done).length,
        questsTotal: (s.quests ?? []).length,
        rivalName: s.rival?.name ?? "The Rival",
        rivalYou: s.rival?.you ?? 0,
        rivalXp: s.rival?.weekXp ?? 0,
      };
      const blob = await buildBattleCard(data);
      if (blob) downloadBlob(blob, `rah-battle-card-lv${data.level.level}.png`);
      else setErr(true);
    } catch {
      setErr(true);
    }
    setBusy(false);
  };

  return (
    <Btn variant={variant} onClick={go} disabled={busy}>
      <ImageDown className="h-4 w-4" />
      {busy ? "Rendering…" : err ? "Render failed - try again" : "Export battle card"}
    </Btn>
  );
}
