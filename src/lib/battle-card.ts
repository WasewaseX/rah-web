// Shareable Battle Card: draws the learner's week as a 1080x1350 canvas -
// level ring, streak, XP, mastery radar, trophy count, game records - and
// returns a PNG blob for download. Client-only; no server round trip.

export interface BattleCardData {
  level: { level: number; name: string; xp: number; pct: number; nextAt: number | null };
  streak: number;
  freezes: number;
  todayXp: number;
  accuracy35: number | null; // 0..100
  skills: { skill: string; score: number; samples: number }[];
  trophiesUnlocked: number;
  trophiesTotal: number;
  speedBest: number;
  bossWins: number;
  questsDone: number;
  questsTotal: number;
  rivalName: string;
  rivalYou: number;
  rivalXp: number;
}

export async function buildBattleCard(d: BattleCardData): Promise<Blob | null> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Background: the Midnight gradient.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#101725");
  bg.addColorStop(0.55, "#0d1420");
  bg.addColorStop(1, "#0b1018");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // glow blob
  const glow = ctx.createRadialGradient(W - 140, 120, 20, W - 140, 120, 420);
  glow.addColorStop(0, "rgba(78,140,255,.16)");
  glow.addColorStop(1, "rgba(78,140,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const F = (weight: string, size: number) => `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;

  // Header
  ctx.fillStyle = "#4e8cff";
  ctx.font = F("900", 30);
  ctx.fillText("RAH", 72, 96);
  ctx.fillStyle = "#7d889c";
  ctx.font = F("700", 22);
  ctx.fillText("B2 to C1, your road", 72, 130);

  // Level ring
  const ringC = { x: W - 200, y: 190, r: 96 };
  ctx.lineWidth = 18;
  ctx.strokeStyle = "#1c2534";
  ctx.beginPath();
  ctx.arc(ringC.x, ringC.y, ringC.r, 0, Math.PI * 2);
  ctx.stroke();
  const grad = ctx.createLinearGradient(ringC.x - ringC.r, 0, ringC.x + ringC.r, 0);
  grad.addColorStop(0, "#a78bfa");
  grad.addColorStop(1, "#7fdcf7");
  ctx.strokeStyle = grad;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(ringC.x, ringC.y, ringC.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (d.level.pct / 100));
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = "#f2f5fa";
  ctx.font = F("900", 52);
  ctx.fillText(String(d.level.level), ringC.x, ringC.y + 8);
  ctx.fillStyle = "#cfc3fc";
  ctx.font = F("800", 20);
  ctx.fillText(d.level.name.toUpperCase(), ringC.x, ringC.y + 44);
  ctx.textAlign = "left";

  // Level line
  ctx.fillStyle = "#f2f5fa";
  ctx.font = F("900", 44);
  ctx.fillText(`Level ${d.level.level} · ${d.level.name}`, 72, 240);
  ctx.fillStyle = "#8b96a9";
  ctx.font = F("600", 24);
  ctx.fillText(`${d.level.xp.toLocaleString()} XP lifetime${d.level.nextAt ? ` · ${d.level.pct}% to next` : " · MAX"}`, 72, 282);

  // Stat tiles row
  const tiles: { label: string; value: string; color: string }[] = [
    { label: "DAY STREAK", value: String(d.streak), color: "#ffb02e" },
    { label: "TROPHIES", value: `${d.trophiesUnlocked}/${d.trophiesTotal}`, color: "#ffd08a" },
    { label: "ACCURACY 35D", value: d.accuracy35 !== null ? `${d.accuracy35}%` : "-", color: "#7fe0ac" },
    { label: "FREEZES", value: String(d.freezes), color: "#9de6fb" },
  ];
  const tw = (W - 72 * 2 - 24 * 3) / 4;
  tiles.forEach((t, i) => {
    const x = 72 + i * (tw + 24);
    const y = 340;
    ctx.fillStyle = "rgba(255,255,255,.03)";
    roundRect(ctx, x, y, tw, 130, 24);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.07)";
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, tw, 130, 24);
    ctx.stroke();
    ctx.fillStyle = t.color;
    ctx.font = F("900", 44);
    ctx.fillText(t.value, x + 20, y + 66);
    ctx.fillStyle = "#7d889c";
    ctx.font = F("800", 16);
    ctx.fillText(t.label, x + 20, y + 100);
  });

  // Radar
  const rc = { x: W / 2 - 130, y: 700, r: 170 };
  const order = ["grammar", "vocabulary", "writing", "speaking", "reading", "listening"];
  const byId = new Map(d.skills.map((s) => [s.skill, s]));
  const angle = (i: number) => (Math.PI * 2 * i) / 6 - Math.PI / 2;
  const at = (i: number, v: number) => [rc.x + Math.cos(angle(i)) * rc.r * v, rc.y + Math.sin(angle(i)) * rc.r * v];
  ctx.strokeStyle = "#1c2534";
  ctx.lineWidth = 2;
  for (const ring of [0.5, 1]) {
    ctx.beginPath();
    order.forEach((_, i) => {
      const [x, y] = at(i, ring);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
  }
  const polyPts = order.map((k, i) => at(i, Math.max(0.05, byId.get(k)?.score ?? 0)));
  ctx.beginPath();
  polyPts.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(78,140,255,.22)";
  ctx.fill();
  ctx.strokeStyle = "#4e8cff";
  ctx.lineWidth = 3;
  ctx.stroke();
  order.forEach((k, i) => {
    const [x, y] = at(i, 1.18);
    ctx.fillStyle = (byId.get(k)?.samples ?? 0) > 0 ? "#9dc0ff" : "#5c6678";
    ctx.font = F("800", 18);
    ctx.textAlign = "center";
    ctx.fillText(k.toUpperCase(), x, y);
  });
  ctx.textAlign = "left";

  // Right column: game records + quests + rival
  const rx = W - 470;
  const lines: [string, string, string][] = [
    ["SPEED ROUND BEST", String(d.speedBest), "#ffd08a"],
    ["BOSS WINS", String(d.bossWins), "#ffa3b1"],
    ["QUESTS TODAY", `${d.questsDone}/${d.questsTotal}`, "#7fe0ac"],
    ["TODAY'S XP", String(d.todayXp), "#9de6fb"],
  ];
  lines.forEach(([label, value, color], i) => {
    const y = 560 + i * 92;
    ctx.fillStyle = "rgba(255,255,255,.03)";
    roundRect(ctx, rx, y, 398, 76, 20);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.07)";
    roundRect(ctx, rx, y, 398, 76, 20);
    ctx.stroke();
    ctx.fillStyle = "#7d889c";
    ctx.font = F("800", 17);
    ctx.fillText(label, rx + 24, y + 32);
    ctx.fillStyle = color;
    ctx.font = F("900", 34);
    ctx.fillText(value, rx + 24, y + 64);
  });

  // Rival race bar
  const ry = 968;
  const total = Math.max(1, d.rivalYou + d.rivalXp);
  ctx.fillStyle = "#7d889c";
  ctx.font = F("800", 19);
  ctx.fillText("WEEKLY RACE", 72, ry - 16);
  ctx.fillStyle = d.rivalYou >= d.rivalXp ? "#7fe0ac" : "#b7c1d3";
  ctx.font = F("900", 26);
  ctx.fillText(`YOU ${d.rivalYou}`, 72, ry + 18);
  ctx.fillStyle = d.rivalYou >= d.rivalXp ? "#b7c1d3" : "#ffa3b1";
  ctx.textAlign = "right";
  ctx.fillText(`${d.rivalXp} ${d.rivalName.toUpperCase()}`, W - 72, ry + 18);
  ctx.textAlign = "left";
  const barW = W - 144;
  const youPct = d.rivalYou / total;
  ctx.fillStyle = "#1c2534";
  roundRect(ctx, 72, ry + 38, barW, 26, 13);
  ctx.fill();
  const youGrad = ctx.createLinearGradient(72, 0, 72 + barW * youPct, 0);
  youGrad.addColorStop(0, "#2fc273");
  youGrad.addColorStop(1, "#55d98f");
  ctx.fillStyle = youGrad;
  roundRect(ctx, 72, ry + 38, Math.max(26, barW * youPct), 26, 13);
  ctx.fill();
  const rivalGrad = ctx.createLinearGradient(72 + barW * youPct, 0, 72 + barW, 0);
  rivalGrad.addColorStop(0, "#ff6b81");
  rivalGrad.addColorStop(1, "#ff8ba0");
  ctx.fillStyle = rivalGrad;
  roundRect(ctx, 72 + barW * youPct, ry + 38, Math.max(26, barW * (1 - youPct)), 26, 13);
  ctx.fill();

  // Footer
  ctx.fillStyle = "#5c6678";
  ctx.font = F("600", 22);
  ctx.fillText("Retrieval. Spacing. Focus. Measurement.", 72, 1268);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
