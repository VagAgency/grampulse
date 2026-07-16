"use client";

export type CountrySlice = { country: string; percent: number };

type Props = {
  data: CountrySlice[];
  title?: string;
  hint?: string;
};

const BAR_COLORS = ["#8b5cf6", "#06b6d4", "#22c55e", "#f59e0b", "#ec4899"];

export function CountryBreakdown({ data, title, hint }: Props) {
  if (!data.length) {
    return (
      <div className="country-empty">
        <p className="hint">Répartition pays indisponible pour ce compte (pas assez de données commentaires).</p>
      </div>
    );
  }

  return (
    <div className="country-breakdown">
      {title && <h3 className="chart-title">{title}</h3>}
      {hint && <p className="hint chart-hint">{hint}</p>}
      <div className="country-list">
        {data.map((item, i) => (
          <div key={item.country} className="country-row">
            <div className="country-row-head">
              <span className="country-rank">#{i + 1}</span>
              <span className="country-name">{item.country}</span>
              <span className="country-pct">{item.percent.toFixed(1)}%</span>
            </div>
            <div className="country-bar-track">
              <div
                className="country-bar-fill"
                style={{
                  width: `${Math.max(item.percent, 4)}%`,
                  background: BAR_COLORS[i % BAR_COLORS.length],
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
