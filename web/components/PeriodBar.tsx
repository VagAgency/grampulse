"use client";

import { formatPeriodLabel } from "@/lib/api";

export const CHART_RANGES = [7, 14, 30, 60, 90] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

type Props = {
  days: number;
  onChangeDays: (days: number) => void;
  note?: string | null;
  children?: React.ReactNode;
};

export function PeriodBar({ days, onChangeDays, note, children }: Props) {
  return (
    <section className="card period-bar">
      <div className="period-bar-top">
        <strong>Période analysée — {days} jours</strong>
        <span className="hint">{formatPeriodLabel(days)}</span>
      </div>
      <div className="chart-toolbar" style={{ marginBottom: note ? 12 : 0 }}>
        {children}
        <div className="chart-range-toggle">
          {CHART_RANGES.map((range) => (
            <button
              key={range}
              type="button"
              className={`chart-range-btn${days === range ? " active" : ""}`}
              onClick={() => onChangeDays(range)}
            >
              {range}j
            </button>
          ))}
        </div>
      </div>
      {note && <p className="hint period-note">{note}</p>}
    </section>
  );
}
