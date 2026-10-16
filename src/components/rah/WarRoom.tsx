"use client";

// Hexagonal mastery radar for the six measured skills. Pure SVG, no deps.

export function Radar({ skills }: { skills: { skill: string; score: number; samples: number }[] }) {
  const size = 250;
  const c = size / 2;
  const r = 88;
  const order = ["grammar", "vocabulary", "writing", "speaking", "reading", "listening"];
  const byId = new Map(skills.map((s) => [s.skill, s]));
  const pts = order.map((k) => byId.get(k) ?? { skill: k, score: 0, samples: 0 });

  const angle = (i: number) => (Math.PI * 2 * i) / order.length - Math.PI / 2;
  const at = (i: number, v: number) => [c + Math.cos(angle(i)) * r * v, c + Math.sin(angle(i)) * r * v];

  const rings = [0.25, 0.5, 0.75, 1];
  const poly = pts.map((p, i) => at(i, Math.max(0.04, p.score)).join(",")).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {rings.map((v) => (
        <polygon
          key={v}
          points={order.map((_, i) => at(i, v).join(",")).join(" ")}
          fill="none"
          stroke="#2a3242"
          strokeWidth={v === 1 ? 1.5 : 1}
        />
      ))}
      {order.map((k, i) => {
        const [x, y] = at(i, 1);
        return <line key={k} x1={c} y1={c} x2={x} y2={y} stroke="#2a3242" strokeWidth={1} />;
      })}
      <polygon points={poly} fill="rgba(78,140,255,.18)" stroke="#4e8cff" strokeWidth={2} strokeLinejoin="round" />
      {pts.map((p, i) => {
        const [x, y] = at(i, Math.max(0.04, p.score));
        const [lx, ly] = at(i, 1.24);
        return (
          <g key={p.skill}>
            <circle cx={x} cy={y} r={3.5} fill={p.samples > 0 ? "#4e8cff" : "#3a4356"} />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={9.5} fontWeight={700} fill={p.samples > 0 ? "#9dc0ff" : "#5c6678"}>
              {p.skill}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// 35-day accuracy timeline: a polyline over the days that had activity.
export function AccuracyTimeline({ days }: { days: { day: number; reviews: number; correct: number }[] }) {
  const w = 620;
  const h = 120;
  const pad = 6;
  const active = days.map((d, i) => ({ i, acc: d.reviews > 0 ? d.correct / d.reviews : null }));
  const maxI = Math.max(1, days.length - 1);
  const x = (i: number) => pad + (i / maxI) * (w - pad * 2);
  const y = (acc: number) => h - pad - acc * (h - pad * 2);
  const line = active
    .filter((a) => a.acc !== null)
    .map((a) => `${x(a.i)},${y(a.acc as number)}`)
    .join(" ");
  const zoneTop = y(0.85);
  const zoneBottom = y(0.7);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 120 }}>
      <rect x={0} y={zoneTop} width={w} height={Math.max(0, zoneBottom - zoneTop)} fill="rgba(47,194,115,.07)" />
      <line x1={0} y1={zoneTop} x2={w} y2={zoneTop} stroke="#2fc273" strokeDasharray="4 4" strokeWidth={1} opacity={0.5} />
      <line x1={0} y1={zoneBottom} x2={w} y2={zoneBottom} stroke="#2fc273" strokeDasharray="4 4" strokeWidth={1} opacity={0.5} />
      {line && <polyline points={line} fill="none" stroke="#4e8cff" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
      {active
        .filter((a) => a.acc !== null)
        .map((a) => (
          <circle key={a.i} cx={x(a.i)} cy={y(a.acc as number)} r={2.5} fill="#4e8cff" />
        ))}
      <text x={4} y={zoneTop - 3} fontSize={9} fontWeight={700} fill="#3ccb7f">
        C1 zone (85%+)
      </text>
      <text x={4} y={h - 2} fontSize={9} fill="#5c6678">
        last 35 days, days with reviews only
      </text>
    </svg>
  );
}
