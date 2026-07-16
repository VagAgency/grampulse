"use client";

import { useCallback, useMemo, useState } from "react";

export type ChartPoint = { date: string; views: number };

export type ChartSeries = {
  id: string;
  label: string;
  color: string;
  data: ChartPoint[];
};

const PALETTE = [
  "#8b5cf6",
  "#06b6d4",
  "#22c55e",
  "#f59e0b",
  "#ec4899",
  "#6366f1",
  "#14b8a6",
  "#ef4444",
  "#a855f7",
  "#0ea5e9",
];

const CHART_WIDTH = 720;

export function seriesColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

type Props = {
  series: ChartSeries[];
  title?: string;
  height?: number;
  hint?: string;
  valueUnit?: string;
};

export function MultiViewsChart({
  series,
  title,
  height = 240,
  hint,
  valueUnit = "vues",
}: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const visibleSeries = useMemo(
    () => series.filter((s) => !hidden.has(s.id)),
    [series, hidden]
  );

  const dates = useMemo(() => {
    const set = new Set<string>();
    series.forEach((s) => s.data.forEach((d) => set.add(d.date)));
    return Array.from(set).sort();
  }, [series]);

  const maxViews = useMemo(() => {
    let max = 1;
    series.forEach((s) => {
      s.data.forEach((d) => {
        if (d.views > max) max = d.views;
      });
    });
    return max;
  }, [series]);

  const minViews = useMemo(() => {
    let min = Infinity;
    series.forEach((s) => {
      s.data.forEach((d) => {
        if (d.views > 0 && d.views < min) min = d.views;
      });
    });
    return min === Infinity ? 0 : min;
  }, [series]);

  const yFloor = useMemo(() => {
    if (minViews > 50 && maxViews > minViews && maxViews / minViews < 1.25) {
      return Math.floor(minViews * 0.92);
    }
    return 0;
  }, [minViews, maxViews]);

  const pad = { top: 20, right: 16, bottom: 32, left: 52 };
  const innerW = CHART_WIDTH - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const xAt = useCallback(
    (date: string) => {
      const i = dates.indexOf(date);
      return pad.left + (i / Math.max(dates.length - 1, 1)) * innerW;
    },
    [dates, innerW, pad.left]
  );

  const yAt = useCallback(
    (views: number) => {
      const span = Math.max(maxViews - yFloor, 1);
      return pad.top + innerH - ((views - yFloor) / span) * innerH;
    },
    [innerH, maxViews, pad.top, yFloor]
  );

  const tooltip = useMemo(() => {
    if (hoverIndex == null || !dates[hoverIndex]) return null;
    const date = dates[hoverIndex];
    const rows = visibleSeries
      .map((s) => {
        const point = s.data.find((d) => d.date === date);
        return {
          label: s.label,
          color: s.color,
          value: point?.views ?? 0,
        };
      })
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "fr"));
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    return { date, rows, total, x: xAt(date) };
  }, [dates, hoverIndex, visibleSeries, xAt]);

  function toggle(id: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handlePointerMove(clientX: number, svgRect: DOMRect) {
    const scaleX = CHART_WIDTH / svgRect.width;
    const x = (clientX - svgRect.left) * scaleX;
    const rel = x - pad.left;
    if (rel < 0 || rel > innerW || dates.length === 0) {
      setHoverIndex(null);
      return;
    }
    const idx = Math.round((rel / innerW) * (dates.length - 1));
    setHoverIndex(Math.max(0, Math.min(dates.length - 1, idx)));
  }

  if (!series.length) {
    return (
      <div className="chart-empty">
        <p className="hint">Pas encore de données sur cette période.</p>
      </div>
    );
  }

  const yTicks = [0, 0.5, 1].map((t) => ({
    value: Math.round(yFloor + (maxViews - yFloor) * t),
    y: pad.top + innerH - t * innerH,
  }));

  const xLabels = Array.from(
    new Set([dates[0], dates[Math.floor(dates.length / 2)], dates[dates.length - 1]].filter(Boolean))
  );

  const tooltipLeftPct = tooltip ? (tooltip.x / CHART_WIDTH) * 100 : 0;
  const tooltipFlip = tooltipLeftPct > 62;

  return (
    <div className="chart-wrap chart-wrap-interactive">
      {title && <h3 className="chart-title">{title}</h3>}
      {hint && <p className="hint chart-hint">{hint}</p>}

      <div className="chart-stage">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${height}`}
          className="views-chart"
          role="img"
          aria-label={title || "Courbe des vues"}
          onMouseMove={(e) => handlePointerMove(e.clientX, e.currentTarget.getBoundingClientRect())}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <rect
            x={pad.left}
            y={pad.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            className="chart-hover-zone"
          />

          {yTicks.map((t, i) => (
            <g key={`y-tick-${i}`}>
              <line x1={pad.left} y1={t.y} x2={CHART_WIDTH - pad.right} y2={t.y} className="chart-grid" />
              <text x={pad.left - 8} y={t.y + 4} textAnchor="end" className="chart-axis">
                {formatShort(t.value)}
              </text>
            </g>
          ))}

          {tooltip && (
            <line
              x1={tooltip.x}
              y1={pad.top}
              x2={tooltip.x}
              y2={height - pad.bottom}
              className="chart-crosshair"
            />
          )}

          {series.map((s) => {
            const isHidden = hidden.has(s.id);
            const byDate = new Map(s.data.map((d) => [d.date, d.views]));
            const points = dates
              .map((date) => ({
                date,
                views: byDate.get(date) ?? 0,
                x: xAt(date),
                y: yAt(byDate.get(date) ?? yFloor),
              }))
              .filter((p) => byDate.has(p.date));

            if (!points.length) return null;

            const linePath = points.length >= 2 ? buildSmoothPath(points) : null;
            const hoveredDate = tooltip?.date;

            return (
              <g
                key={s.id}
                className={`chart-series${isHidden ? " chart-series-hidden" : ""}`}
              >
                {linePath && (
                  <path
                    d={linePath}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="chart-series-line"
                  />
                )}
                {points.map((p) => (
                  <g key={`${s.id}-${p.date}`}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={hoveredDate === p.date ? 5 : points.length === 1 ? 6 : 3.5}
                      fill={s.color}
                      stroke="#0f1629"
                      strokeWidth={hoveredDate === p.date ? 2 : 1.5}
                      className="chart-series-dot"
                    />
                    {points.length === 1 && (
                      <text x={p.x} y={p.y - 12} textAnchor="middle" className="chart-axis">
                        {formatShort(p.views)}
                      </text>
                    )}
                  </g>
                ))}
              </g>
            );
          })}

          {xLabels.map((date) => (
            <text key={date} x={xAt(date)} y={height - 8} textAnchor="middle" className="chart-axis">
              {formatDate(date)}
            </text>
          ))}
        </svg>

        {tooltip && (
          <div
            className={`chart-tooltip${tooltipFlip ? " chart-tooltip-flip" : ""}`}
            style={{ left: `${tooltipLeftPct}%` }}
          >
            <div className="chart-tooltip-head">
              <strong>{formatTooltipDate(tooltip.date)}</strong>
              <span className="chart-tooltip-total">
                Total : {formatExact(tooltip.total)} {valueUnit}
              </span>
            </div>
            <ul className="chart-tooltip-list">
              {tooltip.rows.map((row) => (
                <li key={row.label}>
                  <span className="chart-tooltip-dot" style={{ background: row.color }} />
                  <span className="chart-tooltip-value">{formatExact(row.value)}</span>
                  <span className="chart-tooltip-label">{row.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="chart-legend">
        {series.map((s) => {
          const isHidden = hidden.has(s.id);
          return (
            <button
              key={s.id}
              type="button"
              className={`legend-item${isHidden ? " legend-hidden" : " legend-active"}`}
              onClick={() => toggle(s.id)}
              aria-pressed={!isHidden}
            >
              <span className="legend-dot" style={{ background: s.color }} />
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Courbe lissée type spline (Catmull-Rom → Bézier). */
function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const d: string[] = [`M ${points[0].x} ${points[0].y}`];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }

  return d.join(" ");
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

function formatTooltipDate(iso: string): string {
  try {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y.slice(-2)}`;
  } catch {
    return iso;
  }
}

function formatExact(n: number): string {
  return n.toLocaleString("fr-FR");
}
