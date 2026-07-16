"use client";

type Point = { date: string; views: number };

type Props = {
  data: Point[];
  title?: string;
  height?: number;
};

export function ViewsChart({ data, title, height = 200 }: Props) {
  if (!data.length) {
    return (
      <div className="chart-empty">
        <p className="hint">Pas encore de données sur cette période.</p>
      </div>
    );
  }

  const width = 640;
  const pad = { top: 16, right: 12, bottom: 28, left: 48 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxViews = Math.max(...data.map((d) => d.views), 1);

  const points = data.map((d, i) => {
    const x = pad.left + (i / Math.max(data.length - 1, 1)) * innerW;
    const y = pad.top + innerH - (d.views / maxViews) * innerH;
    return { x, y, ...d };
  });

  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${points[0].x},${pad.top + innerH} ${line} ${points[points.length - 1].x},${pad.top + innerH}`;

  const yTicks = [0, 0.5, 1].map((t) => ({
    value: Math.round(maxViews * t),
    y: pad.top + innerH - t * innerH,
  }));

  const xLabels = [
    data[0],
    data[Math.floor(data.length / 2)],
    data[data.length - 1],
  ].filter(Boolean);

  return (
    <div className="chart-wrap">
      {title && <h3 className="chart-title">{title}</h3>}
      <svg viewBox={`0 0 ${width} ${height}`} className="views-chart" role="img" aria-label={title || "Courbe des vues"}>
        {yTicks.map((t) => (
          <g key={t.value}>
            <line
              x1={pad.left}
              y1={t.y}
              x2={width - pad.right}
              y2={t.y}
              className="chart-grid"
            />
            <text x={pad.left - 6} y={t.y + 4} textAnchor="end" className="chart-axis">
              {formatShort(t.value)}
            </text>
          </g>
        ))}
        <polygon points={area} className="chart-area" />
        <polyline points={line} className="chart-line" fill="none" />
        {points.map((p) => (
          <circle key={p.date} cx={p.x} cy={p.y} r={3} className="chart-dot" />
        ))}
        {xLabels.map((d) => {
          const i = data.indexOf(d);
          const x = pad.left + (i / Math.max(data.length - 1, 1)) * innerW;
          return (
            <text key={d.date} x={x} y={height - 6} textAnchor="middle" className="chart-axis">
              {formatDate(d.date)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function formatShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function formatDate(iso: string): string {
  try {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  } catch {
    return iso;
  }
}
